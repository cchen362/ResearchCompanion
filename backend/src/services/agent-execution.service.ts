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

import { v4 as uuidv4 } from 'uuid';
import { FindingModel } from '../models/finding.model.js';
import { aiService } from './ai.service.js';
import type { Agent } from '../models/agent.model.js';
import type { Finding } from '../models/finding.model.js';
import { searchService } from './search.service.js';
import { TopicModel } from '../models/topic.model.js';

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

export class AgentExecutionService {
  private lastRequestTime: { [key: string]: number } = {};

  /**
   * Run all agents for a topic and return findings
   */
  async runAgentsForTopic(
    topicId: string,
    userId: string,
    agents: Agent[],
    topicName?: string  // Display/logging only — NOT used for search queries
  ): Promise<Finding[]> {
    const allFindings: Finding[] = [];
    const errors: string[] = [];

    // Resolve the actual medical condition from topic metadata (single source of truth for queries)
    let searchBaseName = '';
    try {
      const topic = await TopicModel.getById(topicId, userId);
      if (topic) {
        const metadata = typeof topic.metadata === 'string' ? JSON.parse(topic.metadata) : (topic.metadata || {});
        searchBaseName = (metadata?.diseaseProfile?.name || '').trim();
      }
    } catch (error) {
      console.warn(`[AgentExecution] Failed to look up topic ${topicId}, falling back to topicName`);
    }

    // Fallback chain: diseaseProfile.name → topicName → abort
    searchBaseName = searchBaseName || (topicName || '').trim();
    const displayName = topicName || searchBaseName || topicId;

    if (!searchBaseName) {
      console.error(`[AgentExecution] No disease name available for topic ${topicId}, aborting`);
      return [];
    }

    console.log(`[AgentExecution] Running ${agents.length} agents for "${displayName}" (searching: "${searchBaseName}")`);

    // Run agents sequentially to respect rate limits
    for (const agent of agents) {
      try {
        console.log(`[AgentExecution] Running agent: ${agent.name} (${agent.type})`);

        const findings = await this.runSingleAgent(
          agent,
          topicId,
          userId,
          searchBaseName
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
    userId: string,
    topicName?: string
  ): Promise<Finding[]> {
    // Build search query from topic name + agent type modifiers
    const searchQuery = this.buildSearchQuery(agent, topicName);

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
      } else {
        // Fallback: dedup by title + source name when URL is missing
        const title = result.title || '';
        const sourceName = result.source?.name || '';
        if (title && sourceName) {
          const exists = await FindingModel.existsByTitleAndSource(userId, topicId, title, sourceName);
          if (exists) {
            console.log(`[AgentExecution] Skipping duplicate (title match): "${title.substring(0, 60)}..."`);
            continue;
          }
        }
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
  private buildSearchQuery(agent: Agent, topicName?: string): string {
    const params = agent.config || {};

    // If agent has explicit query configured, use it as-is
    if (params.query) {
      return params.query;
    }

    // Base query: topic name (the medical condition), NOT agent display name
    const baseQuery = topicName || agent.name;
    const modifiers: string[] = [];

    // Type-specific modifiers
    // Clinical trials: NO modifiers — query.cond already searches the condition field
    // PubMed: keep modifiers focused on article quality, not generic filler
    switch (agent.type) {
      case 'treatment_breakthrough':
      case 'web':
        modifiers.push('treatment', 'therapy');
        break;
      case 'clinical_trial':
      case 'clinical_trials':
        // No modifiers — searchClinicalTrials uses query.cond which is condition-specific
        break;
      case 'medical_literature':
      case 'pubmed':
        modifiers.push('review');
        break;
    }

    // Add custom keywords if configured
    if (params.keywords && Array.isArray(params.keywords)) {
      modifiers.push(...params.keywords);
    }

    // DO NOT add year or "latest"/"recent" - these break PubMed searches (Plan 006)

    const query = `${baseQuery} ${modifiers.join(' ')}`.trim();
    console.log(`[AgentExecution] Built query for ${agent.name}: "${query}"`);
    return query;
  }

  /**
   * Search PubMed for research articles via searchService delegation
   */
  private async searchPubMed(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('pubmed');
    try {
      const results = await searchService.searchPubMed(query, maxResults);
      // Adapt searchService output → raw PubMedArticle shape for downstream consumers
      return results.map((r: any) => ({
        id: r.metadata?.pmid || r.id?.replace('pubmed_', '') || r.id,
        title: r.title,
        abstract: r.summary || '',
        authors: r.metadata?.authors || [],
        journal: r.source?.journal || r.source?.name || 'Unknown Journal',
        publishedDate: r.publishedAt || new Date().toISOString(),
        doi: r.metadata?.doi || ''
      }));
    } catch (error) {
      console.error('[AgentExecution] PubMed search error:', error);
      return [];
    }
  }

  /**
   * Search ClinicalTrials.gov for clinical trials via searchService delegation
   */
  private async searchClinicalTrials(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('clinical');
    try {
      // query = topic name (no modifiers for clinical trials), maps to condition param
      const results = await searchService.searchClinicalTrials(query);
      // Adapt searchService output → raw ClinicalTrials.gov nested shape for downstream consumers
      return results.map((r: any) => ({
        protocolSection: {
          identificationModule: {
            briefTitle: r.title || 'Untitled Trial',
            nctId: r.metadata?.nctId || r.id?.replace('trial_', '') || ''
          },
          statusModule: {
            overallStatus: r.metadata?.status || 'Unknown',
            statusVerifiedDate: r.publishedAt || new Date().toISOString()
          },
          designModule: {
            phases: r.metadata?.phase ? r.metadata.phase.split(', ') : []
          },
          descriptionModule: {
            briefSummary: r.summary || ''
          }
        }
      }));
    } catch (error) {
      console.error('[AgentExecution] Clinical Trials search error:', error);
      return [];
    }
  }

  /**
   * Search web using Brave Search API via searchService delegation
   */
  private async searchWeb(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('web');
    try {
      const results = await searchService.searchWeb(query, maxResults);
      // Adapt searchService output → raw Brave API shape for downstream consumers
      return results.map((r: any) => ({
        url: r.source?.url || '',
        title: r.title || '',
        description: r.summary || r.snippet || '',
        site: r.source?.name || r.source?.displayName || 'Web',
        publishedDate: r.publishedAt || new Date().toISOString()
      }));
    } catch (error: any) {
      console.error(`[AgentExecution] Web search error:`, error.message || error);
      return [];
    }
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

export const agentExecutionService = new AgentExecutionService();