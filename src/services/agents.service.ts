/**
 * AgentsService - Agent CRUD, status management, and IndexedDB caching.
 *
 * Agent execution is handled entirely by the backend:
 *   POST /api/agents/run/:topicId → backend/src/services/agent-execution.service.ts
 */

import { api } from './api';
import { getDB } from '@/utils/db/database';
import { topicsService } from './topics.service';
import { logger } from '@/utils/logger';
import type { Agent, AgentConfig, AgentType, Topic } from '@/types';

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

  // ==================== Agent Execution ====================
  // Consolidated to backend: POST /api/agents/run/:topicId
  // See backend/src/services/agent-execution.service.ts for the single execution code path

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

export const ensureDefaultAgents = agentsService.ensureDefaultAgents.bind(agentsService);
