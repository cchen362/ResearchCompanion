import { api } from '@/utils/api';
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
  private baseUrl = '/api/agents';

  /**
   * Transform backend agent to frontend Agent interface
   */
  private transformToFrontend(apiAgent: any): Agent {
    return {
      id: apiAgent.id,
      topicId: apiAgent.topic_id || '',
      name: apiAgent.name,
      type: apiAgent.type as Agent['type'],
      status: apiAgent.enabled ? 'idle' : 'disabled',
      config: apiAgent.config || {
        searchDepth: 10,
        updateFrequency: apiAgent.schedule || 'daily',
        sources: [],
        keywords: []
      },
      lastRun: apiAgent.last_run ? new Date(apiAgent.last_run).getTime() : null,
      nextScheduledRun: apiAgent.next_run ? new Date(apiAgent.next_run).getTime() : undefined,
      createdAt: new Date(apiAgent.created_at).getTime(),
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
    return {
      topic_id: agent.topicId || null,
      name: agent.name,
      type: agent.type,
      enabled: agent.status !== 'disabled',
      config: agent.config || {},
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
