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

/** Parsed PubMed article from efetch XML */
interface PubMedArticle {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publishedDate: string;
  doi: string;
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

    // Pre-filter: skip results whose source URL already exists in DB (saves AI API calls)
    const newResults: any[] = [];
    for (const result of searchResults) {
      const sourceUrl = this.getSourceUrl(result, agent.type);
      if (sourceUrl) {
        const exists = await FindingModel.existsBySourceUrl(userId, topicId, sourceUrl);
        if (exists) continue;
      }
      newResults.push(result);
    }

    if (newResults.length === 0) {
      console.log(`[AgentExecution] All ${searchResults.length} results already exist, skipping AI analysis`);
      return [];
    }

    console.log(`[AgentExecution] ${newResults.length}/${searchResults.length} results are new, processing`);

    // Convert search results to findings
    const findings = await this.convertToFindings(
      newResults,
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
      return this.parsePubMedXML(fetchResponse.data);

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
   * Parse PubMed XML response by splitting into per-article blocks.
   * Reference: search.service.ts:112-170 (same proven approach)
   */
  private parsePubMedXML(xml: string): PubMedArticle[] {
    const results: PubMedArticle[] = [];
    const articleBlocks = xml.split('<PubmedArticle>');

    for (const block of articleBlocks) {
      const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmidMatch) continue;
      const pmid = pmidMatch[1];

      // Title — handle inline XML tags (e.g., <i>, <sup>)
      const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]
        ?.replace(/<[^>]+>/g, '').trim() || 'Untitled';

      // Abstract — join all sections (Background, Methods, Results, Conclusions)
      const abstractMatches = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
      const abstract = abstractMatches
        ? abstractMatches.map(m => m.replace(/<\/?[^>]+(>|$)/g, '').trim()).join(' ')
        : '';

      // Authors — first + last name per <Author> block
      const authorBlocks = block.match(/<Author[\s\S]*?<\/Author>/g) || [];
      const authors = authorBlocks.map(a => {
        const last = a.match(/<LastName>(.*?)<\/LastName>/)?.[1] || '';
        const fore = a.match(/<ForeName>(.*?)<\/ForeName>/)?.[1] || '';
        return fore ? `${fore} ${last}` : last;
      }).filter(Boolean).slice(0, 3);

      // Journal
      const journal = block.match(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/)?.[1]?.trim()
        || block.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/)?.[1]?.trim()
        || 'Unknown Journal';

      // Publication date
      const year = block.match(/<PubDate>[\s\S]*?<Year>(\d+)<\/Year>/)?.[1] || '';
      const month = block.match(/<PubDate>[\s\S]*?<Month>(.*?)<\/Month>/)?.[1] || '';
      const publishedDate = month ? `${year} ${month}` : (year || new Date().toISOString());

      // DOI
      const doi = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1]?.trim() || '';

      results.push({ id: pmid, title, abstract, authors, journal, publishedDate, doi });
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
    const normalizedType = this.normalizeAgentType(agent.type);
    const source = this.buildSource(result, normalizedType);

    // Guard: reject results that would produce garbage findings
    if (source.type === 'unknown' || source.url === '#') {
      console.warn(`[AgentExecution] Skipping result with unknown source (agent type: ${agent.type}, normalized: ${normalizedType})`);
      return null;
    }

    // Use AI to extract key information and generate summary
    let content = '';
    let keyInsights: string[] = [];

    let structuredDetails = '';
    try {
      const aiAnalysis = await this.analyzeWithAI(result, normalizedType);
      content = aiAnalysis.summary;
      keyInsights = aiAnalysis.insights;
      structuredDetails = aiAnalysis.structuredDetails;
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
      summary: content,
      metadata: {
        keyInsights,
        agentId: agent.id,
        agentName: agent.name,
        searchQuery: agent.config?.query,
        originalResult: result,
        structuredDetails: structuredDetails || undefined
      },
      tags: this.extractTags(result, normalizedType),
      is_read: false,
      is_starred: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    return finding;
  }

  /** Extract source URL from raw search result before AI processing */
  private getSourceUrl(result: any, agentType: string): string {
    const normalized = this.normalizeAgentType(agentType);
    switch (normalized) {
      case 'pubmed':
        return result.id ? `https://pubmed.ncbi.nlm.nih.gov/${result.id}/` : '';
      case 'clinical_trials': {
        const nctId = result.protocolSection?.identificationModule?.nctId;
        return nctId ? `https://clinicaltrials.gov/study/${nctId}` : '';
      }
      case 'web':
        return result.url || '';
      default:
        return '';
    }
  }

  /** Normalize frontend agent types to API types used by buildSource/buildAIPrompt/extractTags */
  private normalizeAgentType(agentType: string): string {
    switch (agentType) {
      case 'medical_literature': return 'pubmed';
      case 'clinical_trial': return 'clinical_trials';
      case 'treatment_breakthrough': return 'web';
      default: return agentType;
    }
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
  private async analyzeWithAI(result: any, agentType: string): Promise<{ summary: string; insights: string[]; structuredDetails: string }> {
    const prompt = this.buildAIPrompt(result, agentType);

    try {
      const response = await aiService.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        system: `You are a medical research analyst. Generate a structured summary of research findings.
Always respond with valid JSON in this exact format:
{
  "summary": "1-2 sentence plain text summary of the main finding",
  "keyFinding": "One sentence: what was specifically found or demonstrated",
  "method": "One sentence: study type, sample size, duration if available. Omit if not available.",
  "implications": "One sentence: why this matters for patients or clinical practice",
  "source": "Journal/Source Name, Year, Study Type"
}
Be concise. Each field must be ONE sentence maximum. If information for a field is not available, use an empty string.`,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500
      });

      const contentBlock = response.content[0];
      const content = contentBlock && 'text' in contentBlock ? contentBlock.text : '';

      // Try to parse structured JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const details: Record<string, string> = {};
          if (parsed.keyFinding) details.keyFinding = parsed.keyFinding;
          if (parsed.method) details.method = parsed.method;
          if (parsed.implications) details.implications = parsed.implications;
          if (parsed.source) details.source = parsed.source;

          return {
            summary: parsed.summary || this.extractBasicContent(result, agentType),
            insights: [parsed.keyFinding, parsed.implications].filter(Boolean),
            structuredDetails: JSON.stringify(details)
          };
        }
      } catch (parseError) {
        console.warn('[AgentExecution] Failed to parse structured JSON, falling back to text parsing');
      }

      // Fallback: parse as plain text (backward compat)
      const lines = content.split('\n').filter((l: string) => l.trim());
      return {
        summary: lines[0] || this.extractBasicContent(result, agentType),
        insights: lines.slice(1, 4).map((l: string) => l.replace(/^[-*]\s*/, '')),
        structuredDetails: ''
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
    // Filter out junk content
    const clean = (val: string | undefined) => {
      if (!val) return '';
      if (val === 'No abstract available' || val === 'Not available') return '';
      return val;
    };

    switch (agentType) {
      case 'pubmed': {
        const abstract = clean(result.abstract);
        const title = result.title || 'Unknown';
        const journal = result.journal || result.source || '';
        const date = result.publishedDate || '';
        return `Analyze this PubMed research article and respond with structured JSON:
Title: ${title}
${abstract ? `Abstract: ${abstract}` : '(No abstract available - analyze based on title and metadata)'}
Journal: ${journal}
Date: ${date}`;
      }

      case 'clinical_trials': {
        const briefTitle = result.protocolSection?.identificationModule?.briefTitle || 'Unknown';
        const description = clean(result.protocolSection?.descriptionModule?.briefSummary);
        const phase = result.protocolSection?.designModule?.phases?.[0] || 'Unknown';
        const status = result.protocolSection?.statusModule?.overallStatus || 'Unknown';
        return `Analyze this clinical trial and respond with structured JSON:
Title: ${briefTitle}
${description ? `Description: ${description}` : '(No description available)'}
Phase: ${phase}
Status: ${status}`;
      }

      case 'web': {
        const title = result.title || 'Unknown';
        const description = clean(result.description);
        return `Analyze this medical article and respond with structured JSON:
Title: ${title}
${description ? `Description: ${description}` : '(No description available)'}`;
      }

      default:
        return 'Analyze this finding and respond with structured JSON.';
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
      } catch (error: any) {
        if (error?.code === '23505') {
          // unique_violation — duplicate caught by DB constraint (race condition)
          console.log(`[AgentExecution] Duplicate caught by DB constraint: ${finding.source?.url}`);
          continue;
        }
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