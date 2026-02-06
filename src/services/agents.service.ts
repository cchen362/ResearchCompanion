/**
 * AgentsService - Consolidated service for agent management and execution
 *
 * Phase 1 Refactoring: Service Layer Consolidation
 *
 * This service merges:
 * - agents.service.ts (old version with dual API/local paths)
 * - agentRunner.ts (611 lines of execution logic)
 * - agents.api.service.ts (239 lines of transformations)
 *
 * Architecture: Server-first with IndexedDB cache for offline support
 *
 * CRITICAL: Breaking the circular dependency with digestQueueService:
 * - OLD: agentRunner -> digestQueueService -> agentRunner (CIRCULAR!)
 * - NEW: agentsService emits 'agents-complete' event -> digestService listens and queues digest
 */

import { api } from './api';
import * as searchApi from './api';
import { getDB } from '@/utils/db/database';
import { findingsService } from './findings.service';
import { topicsService } from './topics.service';
import { logger } from '@/utils/logger';
import type { Agent, AgentConfig, AgentType, Topic, ResearchFinding } from '@/types';

// ==================== API Response Types ====================

interface AgentsResponse {
  success: boolean;
  agents: any[];
}

interface AgentResponse {
  success: boolean;
  agent: any;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

// ==================== Agents Service ====================

class AgentsService {
  private baseUrl = '/agents';

  // ==================== Transformation Functions ====================

  private transformToFrontend(apiAgent: any): Agent {
    const convertSearchDepth = (depth: number | string): 'quick' | 'standard' | 'deep' => {
      if (typeof depth === 'string') return depth as 'quick' | 'standard' | 'deep';
      if (depth <= 5) return 'quick';
      if (depth >= 20) return 'deep';
      return 'standard';
    };

    const config = apiAgent.config || {};
    const transformedConfig = {
      searchDepth: convertSearchDepth(config.searchDepth || 10),
      updateFrequency: config.updateFrequency || apiAgent.schedule || 'daily',
      priority: config.priority || 'medium',
      sources: config.sources || [],
      keywords: config.keywords || []
    };

    return {
      id: apiAgent.id,
      topicId: apiAgent.topic_id || '',
      name: apiAgent.name,
      type: apiAgent.type as Agent['type'],
      description: apiAgent.description || '',
      status: apiAgent.enabled ? 'idle' : 'disabled',
      config: transformedConfig,
      lastRun: apiAgent.last_run ? new Date(apiAgent.last_run).getTime() : undefined,
      nextScheduledRun: apiAgent.next_run ? new Date(apiAgent.next_run).getTime() : undefined,
      createdAt: new Date(apiAgent.created_at).getTime(),
      updatedAt: apiAgent.updated_at ? new Date(apiAgent.updated_at).getTime() : new Date(apiAgent.created_at).getTime(),
      metrics: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        findingsGenerated: 0,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        apiCostTotal: 0
      }
    };
  }

  private transformToBackend(agent: Partial<Agent>): any {
    const convertSearchDepthToNumeric = (depth?: string): number => {
      switch (depth) {
        case 'quick': return 5;
        case 'deep': return 20;
        case 'standard':
        default: return 10;
      }
    };

    const config = agent.config ? {
      ...agent.config,
      searchDepth: convertSearchDepthToNumeric(agent.config.searchDepth)
    } : {};

    return {
      topic_id: agent.topicId || null,
      name: agent.name,
      type: agent.type,
      description: agent.description,
      enabled: agent.status !== 'disabled',
      config: config,
      schedule: agent.config?.updateFrequency || 'daily',
      last_run: agent.lastRun,
      next_run: agent.nextRun
    };
  }

  // ==================== CRUD Operations ====================

  async getAgents(topicId?: string): Promise<Agent[]> {
    try {
      const url = topicId ? `${this.baseUrl}?topic_id=${topicId}` : this.baseUrl;
      const response = await api.get<AgentsResponse>(url);

      if (response.data.success) {
        const agents = response.data.agents.map(a => this.transformToFrontend(a));
        await this.cacheAgents(agents);
        return agents;
      }

      throw new Error('Failed to fetch agents');
    } catch (error) {
      if (!navigator.onLine) {
        return await this.getCachedAgents(topicId);
      }
      logger.error('[AgentsService] Error fetching agents:', error);
      throw error;
    }
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    try {
      const response = await api.get<AgentResponse>(`${this.baseUrl}/${id}`);

      if (response.data.success) {
        const agent = this.transformToFrontend(response.data.agent);
        await this.cacheAgent(agent);
        return agent;
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }

      if (!navigator.onLine) {
        return await this.getCachedAgent(id);
      }

      logger.error('[AgentsService] Error fetching agent:', error);
      throw error;
    }
  }

  async createAgent(
    topicId: string,
    type: AgentType,
    name: string,
    description: string,
    config: AgentConfig
  ): Promise<Agent> {
    try {
      const agentData: Partial<Agent> = {
        topicId,
        type,
        name,
        description,
        status: 'idle',
        config
      };

      const backendData = this.transformToBackend(agentData);
      const response = await api.post<AgentResponse>(this.baseUrl, backendData);

      if (response.data.success) {
        const agent = this.transformToFrontend(response.data.agent);
        await this.cacheAgent(agent);
        return agent;
      }

      throw new Error('Failed to create agent');
    } catch (error) {
      logger.error('[AgentsService] Error creating agent:', error);
      throw error;
    }
  }

  async saveAgent(agent: Agent): Promise<Agent> {
    try {
      const backendData = this.transformToBackend(agent);
      const response = await api.post<AgentResponse>(this.baseUrl, backendData);

      if (response.data.success) {
        const savedAgent = this.transformToFrontend(response.data.agent);
        await this.cacheAgent(savedAgent);
        return savedAgent;
      }

      throw new Error('Failed to save agent');
    } catch (error) {
      logger.error('[AgentsService] Error saving agent:', error);
      throw error;
    }
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<AgentResponse>(`${this.baseUrl}/${id}`, backendData);

      if (response.data.success) {
        const agent = this.transformToFrontend(response.data.agent);
        await this.cacheAgent(agent);
        return agent;
      }

      throw new Error('Failed to update agent');
    } catch (error) {
      logger.error('[AgentsService] Error updating agent:', error);
      throw error;
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete agent');
      }

      await this.removeCachedAgent(id);
    } catch (error) {
      logger.error('[AgentsService] Error deleting agent:', error);
      throw error;
    }
  }

  async createDefaultAgents(topicId: string): Promise<Agent[]> {
    try {
      const response = await api.post<AgentsResponse>(`${this.baseUrl}/defaults/${topicId}`);

      if (response.data.success) {
        const agents = response.data.agents.map(a => this.transformToFrontend(a));
        await this.cacheAgents(agents);
        return agents;
      }

      throw new Error('Failed to create default agents');
    } catch (error) {
      logger.error('[AgentsService] Error creating default agents:', error);
      throw error;
    }
  }

  async toggleAgent(id: string): Promise<Agent> {
    try {
      const response = await api.post<AgentResponse>(`${this.baseUrl}/${id}/toggle`);

      if (response.data.success) {
        const agent = this.transformToFrontend(response.data.agent);
        await this.cacheAgent(agent);
        return agent;
      }

      throw new Error('Failed to toggle agent');
    } catch (error) {
      logger.error('[AgentsService] Error toggling agent:', error);
      throw error;
    }
  }

  // ==================== Agent Status Operations ====================

  async setAgentStatus(
    agentId: string,
    status: 'idle' | 'running' | 'scheduled' | 'error' | 'disabled'
  ): Promise<void> {
    try {
      const agent = await this.getAgent(agentId);
      if (agent) {
        agent.status = status;
        await this.updateAgent(agentId, { status });
      }
    } catch (error) {
      logger.error('[AgentsService] Error setting agent status:', error);
    }
  }

  async updateAgentAfterRun(
    agentId: string,
    status: 'success' | 'partial' | 'failed',
    findingsCount: number,
    apiCost?: number,
    error?: string
  ): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${agentId}/run`);
    } catch (error) {
      logger.error('[AgentsService] Error updating agent after run:', error);
    }
  }

  async getAgentsToRun(): Promise<Agent[]> {
    const agents = await this.getAgents();
    const now = Date.now();
    return agents.filter(agent =>
      agent.status !== 'running' &&
      agent.status !== 'disabled' &&
      (!agent.nextScheduledRun || agent.nextScheduledRun <= now)
    );
  }

  async getAgentsForForceRun(): Promise<Agent[]> {
    const agents = await this.getAgents();
    return agents.filter(agent => agent.status !== 'running');
  }

  // ==================== Agent Execution (from agentRunner.ts) ====================

  /**
   * Run a single agent to fetch new findings
   * @param agent - The agent to run
   * @param topic - The topic to search for
   * @param options - Optional settings
   */
  async runAgent(
    agent: Agent,
    topic: Topic,
    options?: { skipDigestGeneration?: boolean }
  ): Promise<ResearchFinding[]> {
    logger.debug(`[AgentsService] Running agent ${agent.name} for topic ${topic.name}`);

    try {
      await this.setAgentStatus(agent.id, 'running');

      const findings: ResearchFinding[] = [];
      let duplicatesSkipped = 0;
      let existingFindings: ResearchFinding[] = [];
      const query = this.buildSearchQuery(topic, agent.type);

      // Step 1: Parse the search intent
      logger.debug('[AgentsService] Parsing search query:', query);
      const parsedQuery = await searchApi.parseSearchQuery(query);

      if (parsedQuery.needsClarification) {
        logger.debug('[AgentsService] Query needs clarification:', parsedQuery.suggestions);
        await this.updateAgentAfterRun(agent.id, 'failed', 0, 0, 'Query needs clarification');
        return [];
      }

      // Step 2: Perform searches based on agent type
      let searchResults: any[] = [];

      switch (agent.type) {
        case 'treatment_breakthrough':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting web search...`);
            const webResults = await searchApi.searchWeb(`${query} FDA approval new treatment`, 10);
            logger.debug(`[AgentsService] ${agent.name}: Web search returned ${webResults?.results?.length || 0} results`);
            searchResults = webResults?.results || [];
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Web search failed:`, error);
            searchResults = [];
          }
          break;

        case 'clinical_trial':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting clinical trials search...`);
            const trials = await searchApi.searchClinicalTrials(
              topic.diseaseProfile.name,
              'RECRUITING',
              topic.patientContext?.location
            );
            logger.debug(`[AgentsService] ${agent.name}: Clinical trials returned ${trials?.trials?.length || 0} results`);
            searchResults = trials?.trials || [];
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Search failed:`, error);
            searchResults = [];
          }
          break;

        case 'medical_literature':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting PubMed search...`);
            const literature = await searchApi.searchPubMed(query, 20);
            logger.debug(`[AgentsService] ${agent.name}: PubMed returned ${literature?.articles?.length || 0} results`);
            searchResults = literature?.articles || [];
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: PubMed search failed:`, error);
            searchResults = [];
          }
          break;

        case 'pattern_recognition':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Analyzing existing findings...`);
            searchResults = await this.analyzeExistingFindings(topic);
            logger.debug(`[AgentsService] ${agent.name}: Pattern analysis returned ${searchResults?.length || 0} results`);
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Analysis failed:`, error);
            searchResults = [];
          }
          break;

        default:
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting general search...`);
            const generalWeb = await searchApi.searchWeb(query, 10);
            const generalPubmed = await searchApi.searchPubMed(query, 10);
            searchResults = [...(generalWeb?.results || []), ...(generalPubmed?.articles || [])];
            logger.debug(`[AgentsService] ${agent.name}: General search returned ${searchResults.length} results`);
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Search failed:`, error);
            searchResults = [];
          }
      }

      logger.debug(`[AgentsService] Found ${searchResults.length} search results`);

      // Step 3: Process results
      if (searchResults.length > 0) {
        const summaryResponse = await searchApi.summarizeResults(searchResults, query);

        // Step 4: Convert to ResearchFinding format
        for (const result of searchResults) {
          const sourceObject = this.buildSourceObject(result);

          const finding: ResearchFinding = {
            id: '',
            agentId: agent.id,
            agentType: agent.type,
            topicId: topic.id,
            type: this.determineType(agent.type),
            title: result.title || result.briefTitle || 'Untitled',
            summary: (() => {
              const raw = result.snippet || result.summary || result.abstract || result.briefSummary || '';
              return raw === 'No abstract available' ? '' : raw;
            })(),
            details: (() => {
              const raw = result.details || result.summary || result.briefSummary || '';
              return raw === 'No abstract available' ? '' : raw;
            })(),
            source: sourceObject,
            isNew: true,
            timestamp: Date.now()
          };

          if (result.interventions) {
            finding.extractedEntities = {
              medications: result.interventions
            };
          }

          findings.push(finding);
        }

        // Step 5: Store findings with deduplication
        existingFindings = await findingsService.getFindings(topic.id);

        for (const finding of findings) {
          const isDuplicate = existingFindings.some(existing => {
            if (finding.source.url && existing.source.url) {
              return finding.source.url === existing.source.url;
            }
            return finding.title.toLowerCase() === existing.title.toLowerCase() &&
                   finding.source.name === existing.source.name;
          });

          if (!isDuplicate) {
            await findingsService.saveFinding(finding);
          } else {
            duplicatesSkipped++;
            logger.debug(`[AgentsService] Skipping duplicate finding: ${finding.title}`);
          }
        }

        const actualNewFindings = findings.length - duplicatesSkipped;

        if (actualNewFindings > 0 && !options?.skipDigestGeneration) {
          await this.createNotification(topic, actualNewFindings);
        }
      }

      // Update agent status
      const apiCost = this.calculateCost(searchResults.length);
      const actualNewCount = findings.length - duplicatesSkipped;
      await this.updateAgentAfterRun(agent.id, 'success', actualNewCount, apiCost);

      logger.debug(`[AgentsService] Agent run complete. Found ${actualNewCount} new findings (${duplicatesSkipped} duplicates skipped).`);

      return findings.filter(f =>
        !existingFindings.some(existing =>
          (f.source.url && existing.source.url && f.source.url === existing.source.url) ||
          (f.title.toLowerCase() === existing.title.toLowerCase() && f.source.name === existing.source.name)
        )
      );

    } catch (error) {
      logger.error(`[AgentsService] Agent ${agent.id} failed:`, error);
      await this.updateAgentAfterRun(
        agent.id,
        'failed',
        0,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Run all active research agents for a topic
   * CRITICAL: Emits 'agents-complete' event to trigger digest generation
   * (This breaks the circular dependency with digestQueueService)
   */
  async runAllAgents(topicId: string): Promise<ResearchFinding[]> {
    logger.debug(`[AgentsService] Running all research agents for topic ${topicId}`);

    const topic = await topicsService.getTopic(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    const allAgents = await this.getAgents(topicId);
    const activeAgents = allAgents.filter(a => a.status !== 'disabled');

    if (activeAgents.length === 0) {
      logger.debug('[AgentsService] No active agents found for topic');
      return [];
    }

    // Filter agents that haven't run recently
    const MIN_HOURS_BETWEEN_RUNS = 24;
    const now = Date.now();
    const runnableAgents = activeAgents.filter(agent => {
      if (!agent.lastRun) return true;

      const lastRunTime = new Date(agent.lastRun).getTime();
      const hoursSinceRun = (now - lastRunTime) / (1000 * 60 * 60);

      if (hoursSinceRun < MIN_HOURS_BETWEEN_RUNS) {
        logger.debug(`[AgentsService] ${agent.name}: Skipping - ran ${hoursSinceRun.toFixed(1)} hours ago`);
        return false;
      }

      return true;
    });

    if (runnableAgents.length === 0) {
      logger.debug('[AgentsService] All agents ran recently, skipping research');
      return [];
    }

    logger.debug(`[AgentsService] Running ${runnableAgents.length} of ${activeAgents.length} agents`);

    const allFindings: ResearchFinding[] = [];
    const errors: string[] = [];

    // Run agents in parallel
    const agentPromises = runnableAgents.map(async (agent) => {
      try {
        const findings = await this.runAgent(agent, topic, { skipDigestGeneration: true });

        await this.updateAgent(agent.id, {
          lastRun: new Date(),
          nextRun: new Date(Date.now() + MIN_HOURS_BETWEEN_RUNS * 60 * 60 * 1000)
        });

        return findings;
      } catch (error) {
        const errorMsg = `Agent ${agent.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error('[AgentsService]', errorMsg);
        errors.push(errorMsg);
        return [];
      }
    });

    const agentResults = await Promise.all(agentPromises);

    for (const findings of agentResults) {
      allFindings.push(...findings);
    }

    logger.debug(`[AgentsService] Research complete: ${allFindings.length} new findings from ${activeAgents.length} agents`);

    // CRITICAL: Emit event instead of calling digestQueueService directly
    // This breaks the circular dependency!
    if (allFindings.length > 0) {
      logger.debug(`[AgentsService] Emitting 'agents-complete' event for topic ${topicId} with ${allFindings.length} findings`);
      window.dispatchEvent(new CustomEvent('agents-complete', {
        detail: { topicId, findingsCount: allFindings.length }
      }));
    }

    return allFindings;
  }

  /**
   * Run specific research agents for a topic
   */
  async runAgentsByType(
    topicId: string,
    agentTypes: AgentType[]
  ): Promise<ResearchFinding[]> {
    logger.debug(`[AgentsService] Running specific research agents for topic ${topicId}:`, agentTypes);

    const topic = await topicsService.getTopic(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    const allAgents = await this.getAgents(topicId);
    const requestedAgents = allAgents.filter(
      a => agentTypes.includes(a.type as AgentType) && a.status !== 'disabled'
    );

    if (requestedAgents.length === 0) {
      logger.debug('[AgentsService] No matching active agents found');
      return [];
    }

    const allFindings: ResearchFinding[] = [];

    for (const agent of requestedAgents) {
      try {
        const findings = await this.runAgent(agent, topic, { skipDigestGeneration: true });
        allFindings.push(...findings);
      } catch (error) {
        logger.error(`[AgentsService] Agent ${agent.name} failed:`, error);
      }
    }

    // Emit event for digest generation
    if (allFindings.length > 0) {
      window.dispatchEvent(new CustomEvent('agents-complete', {
        detail: { topicId, findingsCount: allFindings.length }
      }));
    }

    return allFindings;
  }

  /**
   * Get or create default agents for a topic
   * Also repairs if fewer than 3 agents exist
   */
  async ensureDefaultAgents(topicId: string): Promise<Agent[]> {
    const existingAgents = await this.getAgents(topicId);
    const REQUIRED_AGENT_COUNT = 3;

    // If we have all required agents, return them
    if (existingAgents.length >= REQUIRED_AGENT_COUNT) {
      return existingAgents;
    }

    // If we have some but not all agents, call repair endpoint
    if (existingAgents.length > 0 && existingAgents.length < REQUIRED_AGENT_COUNT) {
      logger.debug(`[AgentsService] Found ${existingAgents.length}/${REQUIRED_AGENT_COUNT} agents, calling repair for topic ${topicId}`);
      try {
        const response = await api.post<AgentsResponse>(`${this.baseUrl}/repair/${topicId}`);
        if (response.data.success) {
          const agents = response.data.agents.map((a: any) => this.transformToFrontend(a));
          await this.cacheAgents(agents);
          logger.debug(`[AgentsService] Repair complete: now have ${agents.length} agents`);
          return agents;
        }
      } catch (error) {
        logger.error('[AgentsService] Error repairing agents:', error);
        // Fall through to return existing agents
      }
      return existingAgents;
    }

    // No agents exist, create defaults
    const topic = await topicsService.getTopic(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    const newAgents = await this.createDefaultAgents(topicId);
    logger.debug(`[AgentsService] Created ${newAgents.length} default agents for topic ${topicId}`);
    return newAgents;
  }

  // ==================== Helper Functions ====================

  private buildSearchQuery(topic: Topic, agentType: string): string {
    const baseQuery = topic.diseaseProfile.name;
    const modifiers: string[] = [];

    if (topic.patientContext?.ageGroup === 'pediatric') {
      modifiers.push('pediatric', 'children');
    }

    switch (agentType) {
      case 'treatment_breakthrough':
        // Terms optimized for finding recent treatments
        modifiers.push('treatment', 'therapy', 'drug');
        break;
      case 'clinical_trial':
        // Terms for finding active trials
        modifiers.push('clinical trial', 'recruiting', 'study');
        break;
      case 'medical_literature':
        // PubMed-optimized terms for finding review articles
        modifiers.push('review', 'meta-analysis');
        break;
      case 'pattern_recognition':
        // Terms for finding guidelines and consensus
        modifiers.push('guidelines', 'consensus', 'recommendations');
        break;
    }

    // DO NOT add year - let backend date filtering handle recency
    // DO NOT add "latest" or "recent" - these break PubMed searches

    return `${baseQuery} ${modifiers.join(' ')}`;
  }

  private async analyzeExistingFindings(topic: Topic): Promise<any[]> {
    const findings = await findingsService.getFindings(topic.id);
    const themes = new Map<string, number>();

    findings.forEach(f => {
      f.extractedEntities?.medications?.forEach(med => {
        themes.set(med, (themes.get(med) || 0) + 1);
      });
    });

    return Array.from(themes.entries())
      .filter(([_, count]) => count >= 2)
      .map(([medication, count]) => ({
        title: `Pattern: ${medication} mentioned ${count} times`,
        snippet: `This medication appears frequently in research for ${topic.diseaseProfile.name}`,
        url: '',
        source: 'Pattern Analysis'
      }));
  }

  private determineType(agentType: string): ResearchFinding['type'] {
    switch (agentType) {
      case 'treatment_breakthrough': return 'treatment';
      case 'clinical_trial': return 'trial';
      case 'medical_literature': return 'study';
      default: return 'study';
    }
  }

  private buildSourceObject(result: any): ResearchFinding['source'] {
    if (result.source && typeof result.source === 'object') {
      return {
        ...result.source,
        name: result.source.name || result.source.displayName || result.journal || 'Research Database',
        displayName: result.source.displayName || result.source.name || result.journal || 'Research Database',
        url: result.source.url || result.url || '',
        type: result.source.type || this.determineSourceType(result),
        publishDate: result.source.publishDate || result.publishedAt || result.publishDate || new Date().toISOString()
      };
    }

    const fallbackName = result.journal || result.sponsor || 'Research Database';
    return {
      name: fallbackName,
      displayName: fallbackName,
      url: result.url || '',
      type: this.determineSourceType(result),
      publishDate: result.publishedAt || result.publishDate || new Date().toISOString()
    };
  }

  private determineSourceType(result: any): ResearchFinding['source']['type'] {
    if (result.source?.type) return result.source.type as ResearchFinding['source']['type'];
    if (result.journal) return 'journal';
    if (result.nctId || result.metadata?.nctId) return 'clinical_trial';
    if (result.type === 'regulatory') return 'fda';
    if (result.type === 'research') return 'journal';
    if (result.type === 'clinical_trial') return 'clinical_trial';
    if (result.type === 'article') return 'medical_site';
    return 'medical_site';
  }

  private calculateCost(resultCount: number): number {
    return Math.ceil(resultCount * 0.3);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createNotification(topic: Topic, findingsCount: number): Promise<void> {
    try {
      const db = await getDB();
      const notification = {
        id: this.generateId(),
        type: 'agent_complete' as const,
        priority: 'medium' as const,
        title: `New research for ${topic.name}`,
        message: `Found ${findingsCount} new findings related to ${topic.diseaseProfile.name}`,
        createdAt: Date.now(),
        readAt: undefined,
        dismissedAt: undefined,
        actionUrl: undefined,
        data: { topicId: topic.id, findingsCount }
      };

      try {
        await db.add('notifications', notification);
      } catch {
        await db.put('notifications', notification);
      }

      window.dispatchEvent(new CustomEvent('notification-created', {
        detail: { notification }
      }));
      window.dispatchEvent(new CustomEvent('agent-complete', {
        detail: { topicId: topic.id, findingsCount }
      }));
    } catch (error) {
      logger.error('[AgentsService] Error in createNotification:', error);
    }
  }

  // ==================== Cache Operations ====================

  private async cacheAgent(agent: Agent): Promise<void> {
    try {
      const db = await getDB();
      await db.put('agents', { ...agent, _cachedAt: Date.now() });
    } catch (error) {
      logger.warn('[AgentsService] Failed to cache agent:', error);
    }
  }

  private async cacheAgents(agents: Agent[]): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction('agents', 'readwrite');
      const timestamp = Date.now();

      for (const agent of agents) {
        await tx.store.put({ ...agent, _cachedAt: timestamp });
      }

      await tx.done;
    } catch (error) {
      logger.warn('[AgentsService] Failed to cache agents:', error);
    }
  }

  private async getCachedAgent(id: string): Promise<Agent | undefined> {
    try {
      const db = await getDB();
      return await db.get('agents', id);
    } catch (error) {
      logger.warn('[AgentsService] Failed to get cached agent:', error);
      return undefined;
    }
  }

  private async getCachedAgents(topicId?: string): Promise<Agent[]> {
    try {
      const db = await getDB();
      if (topicId) {
        return await db.getAllFromIndex('agents', 'by-topic', topicId);
      }
      return await db.getAll('agents');
    } catch (error) {
      logger.warn('[AgentsService] Failed to get cached agents:', error);
      return [];
    }
  }

  private async removeCachedAgent(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('agents', id);
    } catch (error) {
      logger.warn('[AgentsService] Failed to remove cached agent:', error);
    }
  }
}

export const agentsService = new AgentsService();

// Legacy exports for backward compatibility during migration
export const runAgentWithAPI = agentsService.runAgent.bind(agentsService);
export const runAllResearchAgents = agentsService.runAllAgents.bind(agentsService);
export const runResearchAgents = agentsService.runAgentsByType.bind(agentsService);
export const ensureDefaultAgents = agentsService.ensureDefaultAgents.bind(agentsService);
