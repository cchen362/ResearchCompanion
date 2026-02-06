/**
 * Agent Execution Service
 *
 * This service handles the actual execution of research agents in the backend.
 * It moves the agent running logic from the frontend to the backend, enabling
 * true autonomous execution without user interaction.
 *
 * Key features:
 * - Executes PubMed, Clinical Trials, and Web search agents
 * - Handles rate limiting and API error recovery
 * - Stores findings directly in PostgreSQL
 * - Returns results for notification and digest generation
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { FindingModel } from '../models/finding.model.js';
import { aiService } from './ai.service.js';
import type { Agent } from '../models/agent.model.js';
import type { Finding } from '../models/finding.model.js';

// Define FindingSource interface locally
interface FindingSource {
  name: string;
  url: string;
  type: 'pubmed' | 'clinical_trial' | 'web' | 'pdf' | 'local' | 'timeline' | 'research_article' | 'web_article' | 'unknown';
  publishDate?: string;
  journal?: string;
  displayName?: string;
  authors?: string[];
  trialPhase?: string; // Added for compatibility
  trial?: {
    id: string;
    phase?: string;
    status: string;
    sponsor?: string;
    startDate?: string;
    completionDate?: string;
  };
}

// Rate limiting configuration
const RATE_LIMITS = {
  pubmed: { requestsPerSecond: 3, minDelay: 350 },
  clinical: { requestsPerSecond: 2, minDelay: 500 },
  web: { requestsPerSecond: 1, minDelay: 1000 }
};

// API endpoints
const API_ENDPOINTS = {
  pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  clinical: 'https://clinicaltrials.gov/api/v2',
  brave: 'https://api.brave.com/res/v1/web/search'
};

export class AgentExecutionService {
  private lastRequestTime: { [key: string]: number } = {};

  /**
   * Run all agents for a topic and return findings
   */
  async runAgentsForTopic(
    topicId: string,
    userId: string,
    agents: Agent[]
  ): Promise<Finding[]> {
    const allFindings: Finding[] = [];
    const errors: string[] = [];

    console.log(`[AgentExecution] Running ${agents.length} agents for topic ${topicId}`);

    // Run agents sequentially to respect rate limits
    for (const agent of agents) {
      try {
        console.log(`[AgentExecution] Running agent: ${agent.name} (${agent.type})`);

        const findings = await this.runSingleAgent(
          agent,
          topicId,
          userId
        );

        allFindings.push(...findings);
        console.log(`[AgentExecution] Agent ${agent.name} found ${findings.length} items`);

      } catch (error) {
        const errorMsg = `Failed to run agent ${agent.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[AgentExecution] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (errors.length > 0) {
      console.warn(`[AgentExecution] Completed with ${errors.length} errors:`, errors);
    }

    console.log(`[AgentExecution] Total findings for topic: ${allFindings.length}`);
    return allFindings;
  }

  /**
   * Run a single agent based on its type
   */
  private async runSingleAgent(
    agent: Agent,
    topicId: string,
    userId: string
  ): Promise<Finding[]> {
    // Build search query from agent parameters
    const searchQuery = this.buildSearchQuery(agent, topicId);

    // Execute search based on agent type
    let searchResults: any[] = [];

    switch (agent.type) {
      case 'pubmed':
      case 'medical_literature':  // Frontend type → maps to PubMed search
        searchResults = await this.searchPubMed(searchQuery, agent.config?.maxResults || 10);
        break;

      case 'clinical_trials':
      case 'clinical_trial':  // Frontend type (singular) → maps to Clinical Trials API
        searchResults = await this.searchClinicalTrials(searchQuery, agent.config?.maxResults || 10);
        break;

      case 'web':
      case 'treatment_breakthrough':  // Frontend type → maps to Web (Brave) search
        searchResults = await this.searchWeb(searchQuery, agent.config?.maxResults || 10);
        break;

      default:
        console.warn(`[AgentExecution] Unknown agent type: ${agent.type}`);
        return [];
    }

    // Convert search results to findings
    const findings = await this.convertToFindings(
      searchResults,
      agent,
      topicId,
      userId
    );

    // Store findings in database
    await this.storeFindings(findings, userId);

    return findings;
  }

  /**
   * Build search query from agent parameters
   */
  private buildSearchQuery(agent: Agent, topicId: string): string {
    const params = agent.config || {};

    // Start with base query
    let query = params.query || agent.name;

    // Add keywords if specified
    if (params.keywords && Array.isArray(params.keywords)) {
      query += ' ' + params.keywords.join(' ');
    }

    // Add filters based on agent type
    if (agent.type === 'pubmed' && params.filters) {
      if (params.filters.yearRange) {
        query += ` AND ${params.filters.yearRange}[pdat]`;
      }
      if (params.filters.publicationType) {
        query += ` AND ${params.filters.publicationType}[pt]`;
      }
    }

    return query;
  }

  /**
   * Search PubMed for research articles
   */
  private async searchPubMed(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('pubmed');

    try {
      // First, search for IDs
      const searchUrl = `${API_ENDPOINTS.pubmed}/esearch.fcgi`;
      const searchParams = {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance'
      };

      const searchResponse = await axios.get(searchUrl, { params: searchParams });
      const ids = searchResponse.data.esearchresult?.idlist || [];

      if (ids.length === 0) {
        return [];
      }

      // Fetch article details
      await this.enforceRateLimit('pubmed');
      const fetchUrl = `${API_ENDPOINTS.pubmed}/efetch.fcgi`;
      const fetchParams = {
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'xml',
        rettype: 'abstract'
      };

      const fetchResponse = await axios.get(fetchUrl, { params: fetchParams });

      // Parse XML response (simplified for this implementation)
      // In production, use a proper XML parser
      return this.parsePubMedXML(fetchResponse.data, ids);

    } catch (error) {
      console.error('[AgentExecution] PubMed search error:', error);
      throw new Error(`PubMed search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search ClinicalTrials.gov for clinical trials
   */
  private async searchClinicalTrials(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('clinical');

    try {
      const url = `${API_ENDPOINTS.clinical}/studies`;
      const params = {
        'query.term': query,
        pageSize: maxResults,
        format: 'json'
      };

      const response = await axios.get(url, { params });
      return response.data.studies || [];

    } catch (error) {
      console.error('[AgentExecution] Clinical Trials search error:', error);
      throw new Error(`Clinical Trials search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search web using Brave Search API
   */
  private async searchWeb(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('web');

    const braveApiKey = process.env.BRAVE_API_KEY;
    if (!braveApiKey) {
      console.warn('[AgentExecution] Brave Search API key not configured (BRAVE_API_KEY)');
      return [];
    }

    try {
      const response = await axios.get(API_ENDPOINTS.brave, {
        params: {
          q: query + ' medical research',
          count: maxResults
        },
        headers: {
          'X-Subscription-Token': braveApiKey
        }
      });

      return response.data.web?.results || [];

    } catch (error) {
      console.error('[AgentExecution] Web search error:', error);
      // Don't throw for web search failures, just return empty
      return [];
    }
  }

  /**
   * Parse PubMed XML response (simplified)
   */
  private parsePubMedXML(xml: string, ids: string[]): any[] {
    const results: any[] = [];

    // Simple regex parsing for demonstration
    // In production, use a proper XML parser like xml2js
    for (const id of ids) {
      const article: any = { id };

      // Extract title
      const titleMatch = xml.match(new RegExp(`<ArticleTitle>([^<]+)</ArticleTitle>`));
      if (titleMatch) {
        article.title = titleMatch[1];
      }

      // Extract abstract
      const abstractMatch = xml.match(new RegExp(`<AbstractText[^>]*>([^<]+)</AbstractText>`));
      if (abstractMatch) {
        article.abstract = abstractMatch[1];
      }

      // Extract authors
      const authorMatches = xml.matchAll(/<LastName>([^<]+)<\/LastName>/g);
      article.authors = Array.from(authorMatches).map(m => m[1]).slice(0, 3);

      // Extract publication date
      const yearMatch = xml.match(/<PubDate[^>]*>.*?<Year>(\d{4})<\/Year>/);
      if (yearMatch) {
        article.publishedDate = `${yearMatch[1]}-01-01`;
      }

      results.push(article);
    }

    return results;
  }

  /**
   * Convert search results to Finding objects
   */
  private async convertToFindings(
    searchResults: any[],
    agent: Agent,
    topicId: string,
    userId: string
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const result of searchResults) {
      try {
        // Create finding based on agent type
        const finding = await this.createFinding(result, agent, topicId, userId);
        if (finding) {
          findings.push(finding);
        }
      } catch (error) {
        console.error('[AgentExecution] Error converting result to finding:', error);
      }
    }

    return findings;
  }

  /**
   * Create a Finding object from search result
   */
  private async createFinding(
    result: any,
    agent: Agent,
    topicId: string,
    userId: string
  ): Promise<Finding | null> {
    // Build source information
    const source = this.buildSource(result, agent.type);

    // Use AI to extract key information and generate summary
    let content = '';
    let keyInsights: string[] = [];

    try {
      const aiAnalysis = await this.analyzeWithAI(result, agent.type);
      content = aiAnalysis.summary;
      keyInsights = aiAnalysis.insights;
    } catch (error) {
      // Fallback to basic extraction if AI fails
      content = this.extractBasicContent(result, agent.type);
    }

    const finding: Finding = {
      id: uuidv4(),
      topic_id: topicId,
      user_id: userId,
      title: source.displayName || source.name || 'Research Finding',
      source,
      content,
      summary: content.substring(0, 200),
      metadata: {
        keyInsights,
        agentId: agent.id,
        agentName: agent.name,
        searchQuery: agent.config?.query,
        originalResult: result
      },
      tags: this.extractTags(result, agent.type),
      is_read: false,
      is_starred: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    return finding;
  }

  /**
   * Build source information from search result
   */
  private buildSource(result: any, agentType: string): FindingSource {
    switch (agentType) {
      case 'pubmed':
        return {
          type: 'research_article',
          name: 'PubMed',
          displayName: result.title || 'Untitled Article',
          url: `https://pubmed.ncbi.nlm.nih.gov/${result.id}/`,
          journal: result.journal || 'Unknown Journal',
          authors: result.authors || [],
          publishDate: result.publishedDate || new Date().toISOString()
        };

      case 'clinical_trials':
        return {
          type: 'clinical_trial',
          name: 'ClinicalTrials.gov',
          displayName: result.protocolSection?.identificationModule?.briefTitle || 'Untitled Trial',
          url: `https://clinicaltrials.gov/study/${result.protocolSection?.identificationModule?.nctId}`,
          trialPhase: result.protocolSection?.designModule?.phases?.[0],
          trial: {
            id: result.protocolSection?.identificationModule?.nctId || '',
            status: result.protocolSection?.statusModule?.overallStatus || 'Unknown',
            phase: result.protocolSection?.designModule?.phases?.[0]
          },
          publishDate: result.protocolSection?.statusModule?.statusVerifiedDate || new Date().toISOString()
        };

      case 'web':
        return {
          type: 'web_article',
          name: result.site || 'Web',
          displayName: result.title || 'Untitled Article',
          url: result.url,
          publishDate: result.publishedDate || new Date().toISOString()
        };

      default:
        return {
          type: 'unknown',
          name: 'Unknown Source',
          displayName: 'Unknown',
          url: '#',
          publishDate: new Date().toISOString()
        };
    }
  }

  /**
   * Analyze search result with AI
   */
  private async analyzeWithAI(result: any, agentType: string): Promise<{ summary: string; insights: string[] }> {
    const prompt = this.buildAIPrompt(result, agentType);

    try {
      const response = await aiService.client.messages.create({
        model: 'claude-haiku-4-5-20251001', // Use Haiku 4.5 for cost-efficient background processing
        system: 'You are a medical research analyst. Extract key information and insights from research findings. Be concise and factual.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500
      });

      // Parse AI response
      const contentBlock = response.content[0];
      const content = contentBlock && 'text' in contentBlock ? contentBlock.text : '';
      const lines = content.split('\n').filter((l: string) => l.trim());

      return {
        summary: lines[0] || this.extractBasicContent(result, agentType),
        insights: lines.slice(1, 4).map((l: string) => l.replace(/^[-*]\s*/, ''))
      };

    } catch (error) {
      console.error('[AgentExecution] AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * Build AI analysis prompt
   */
  private buildAIPrompt(result: any, agentType: string): string {
    switch (agentType) {
      case 'pubmed':
        return `Analyze this medical research article:
Title: ${result.title || 'Unknown'}
Abstract: ${result.abstract || 'Not available'}

Provide:
1. A one-sentence summary of the main finding
2. Three key insights or implications (one per line, starting with -)`;

      case 'clinical_trials':
        return `Analyze this clinical trial:
Title: ${result.protocolSection?.identificationModule?.briefTitle || 'Unknown'}
Description: ${result.protocolSection?.descriptionModule?.briefSummary || 'Not available'}
Phase: ${result.protocolSection?.designModule?.phases?.[0] || 'Unknown'}
Status: ${result.protocolSection?.statusModule?.overallStatus || 'Unknown'}

Provide:
1. A one-sentence summary of the trial's purpose
2. Three key insights about the trial (one per line, starting with -)`;

      case 'web':
        return `Analyze this medical article:
Title: ${result.title || 'Unknown'}
Description: ${result.description || 'Not available'}

Provide:
1. A one-sentence summary of the main point
2. Three key takeaways (one per line, starting with -)`;

      default:
        return 'Summarize this finding in one sentence.';
    }
  }

  /**
   * Extract basic content without AI
   */
  private extractBasicContent(result: any, agentType: string): string {
    switch (agentType) {
      case 'pubmed':
        return result.abstract || result.title || 'No content available';

      case 'clinical_trials':
        return result.protocolSection?.descriptionModule?.briefSummary ||
               result.protocolSection?.identificationModule?.briefTitle ||
               'No description available';

      case 'web':
        return result.description || result.title || 'No content available';

      default:
        return 'No content available';
    }
  }

  /**
   * Extract tags from search result
   */
  private extractTags(result: any, agentType: string): string[] {
    const tags: string[] = [agentType];

    switch (agentType) {
      case 'pubmed':
        if (result.publicationType) {
          tags.push(result.publicationType);
        }
        break;

      case 'clinical_trials':
        if (result.protocolSection?.designModule?.phases) {
          tags.push(...result.protocolSection.designModule.phases);
        }
        if (result.protocolSection?.statusModule?.overallStatus) {
          tags.push(result.protocolSection.statusModule.overallStatus);
        }
        break;

      case 'web':
        tags.push('web-content');
        break;
    }

    return tags;
  }

  /**
   * Store findings in database
   */
  private async storeFindings(findings: Finding[], userId: string): Promise<void> {
    for (const finding of findings) {
      try {
        await FindingModel.create(userId, finding);
      } catch (error) {
        console.error('[AgentExecution] Error storing finding:', error);
      }
    }
  }

  /**
   * Enforce rate limiting for API calls
   */
  private async enforceRateLimit(service: string): Promise<void> {
    const limit = RATE_LIMITS[service as keyof typeof RATE_LIMITS];
    if (!limit) return;

    const now = Date.now();
    const lastRequest = this.lastRequestTime[service] || 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < limit.minDelay) {
      const delay = limit.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime[service] = Date.now();
  }
}