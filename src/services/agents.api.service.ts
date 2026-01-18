import { api } from '@/services/api';
import type { Agent } from '@/types';

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

class AgentsAPIService {
  private baseUrl = '/agents';

  /**
   * Transform backend agent to frontend Agent interface
   */
  private transformToFrontend(apiAgent: any): Agent {
    // Convert numeric searchDepth to string enum
    const convertSearchDepth = (depth: number | string): 'quick' | 'standard' | 'deep' => {
      if (typeof depth === 'string') return depth as 'quick' | 'standard' | 'deep';
      if (depth <= 5) return 'quick';
      if (depth >= 20) return 'deep';
      return 'standard'; // Default for 10 or any other value
    };

    // Build config with proper types
    const config = apiAgent.config || {};
    const transformedConfig = {
      searchDepth: convertSearchDepth(config.searchDepth || 10),
      updateFrequency: config.updateFrequency || apiAgent.schedule || 'daily',
      priority: config.priority || 'medium', // Default to medium if not set
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

  /**
   * Transform frontend Agent to backend format
   */
  private transformToBackend(agent: Partial<Agent>): any {
    // Convert string searchDepth back to numeric for backend
    const convertSearchDepthToNumeric = (depth?: string): number => {
      switch (depth) {
        case 'quick': return 5;
        case 'deep': return 20;
        case 'standard':
        default: return 10;
      }
    };

    // Build backend config
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
      schedule: agent.config?.updateFrequency || 'daily'
    };
  }

  async getAgents(topicId?: string): Promise<Agent[]> {
    try {
      const url = topicId
        ? `${this.baseUrl}?topic_id=${topicId}`
        : this.baseUrl;

      const response = await api.get<AgentsResponse>(url);

      if (response.data.success) {
        return response.data.agents.map(a => this.transformToFrontend(a));
      }

      throw new Error('Failed to fetch agents');
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    try {
      const response = await api.get<AgentResponse>(`${this.baseUrl}/${id}`);

      if (response.data.success) {
        return this.transformToFrontend(response.data.agent);
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      console.error('Error fetching agent:', error);
      throw error;
    }
  }

  async saveAgent(agent: Agent): Promise<Agent> {
    try {
      const backendData = this.transformToBackend(agent);

      // Always create new - POST to let server assign UUID
      // For updates, use updateAgent() method
      const response = await api.post<AgentResponse>(this.baseUrl, backendData);
      if (response.data.success) {
        return this.transformToFrontend(response.data.agent);
      }

      throw new Error('Failed to save agent');
    } catch (error) {
      console.error('Error saving agent:', error);
      throw error;
    }
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<AgentResponse>(
        `${this.baseUrl}/${id}`,
        backendData
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.agent);
      }

      throw new Error('Failed to update agent');
    } catch (error) {
      console.error('Error updating agent:', error);
      throw error;
    }
  }

  async createDefaultAgents(topicId: string): Promise<Agent[]> {
    try {
      const response = await api.post<AgentsResponse>(
        `${this.baseUrl}/defaults/${topicId}`
      );

      if (response.data.success) {
        return response.data.agents.map(a => this.transformToFrontend(a));
      }

      throw new Error('Failed to create default agents');
    } catch (error) {
      console.error('Error creating default agents:', error);
      throw error;
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  async toggleAgent(id: string): Promise<Agent> {
    try {
      const response = await api.post<AgentResponse>(`${this.baseUrl}/${id}/toggle`);

      if (response.data.success) {
        return this.transformToFrontend(response.data.agent);
      }

      throw new Error('Failed to toggle agent');
    } catch (error) {
      console.error('Error toggling agent:', error);
      throw error;
    }
  }

  async updateLastRun(id: string): Promise<Agent> {
    try {
      const response = await api.post<AgentResponse>(`${this.baseUrl}/${id}/run`);

      if (response.data.success) {
        return this.transformToFrontend(response.data.agent);
      }

      throw new Error('Failed to update last run');
    } catch (error) {
      console.error('Error updating last run:', error);
      throw error;
    }
  }
}

export const agentsAPIService = new AgentsAPIService();
