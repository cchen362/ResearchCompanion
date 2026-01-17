import { getDB } from '@/utils/db/database';
import {
  createAgent as createLocalAgent,
  getAgentsByTopic,
  getAgentsToRun,
  getAgentsForForceRun,
  updateAgentAfterRun as updateLocalAgentAfterRun,
  setAgentStatus as setLocalAgentStatus,
  updateAgentConfig as updateLocalAgentConfig
} from '@/utils/db/agents';
import { agentsAPIService } from './agents.api.service';
import { storageConfig } from '@/config/storage.config';
import type { Agent, AgentConfig, AgentType } from '@/types';

class AgentsService {
  private get isUsingAPI() {
    return storageConfig.useServerStorage;
  }

  async getAgents(topicId?: string): Promise<Agent[]> {
    if (this.isUsingAPI) {
      return await agentsAPIService.getAgents(topicId);
    }

    if (topicId) {
      return await getAgentsByTopic(topicId);
    }

    const db = await getDB();
    return await db.getAll('agents');
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    if (this.isUsingAPI) {
      return await agentsAPIService.getAgent(id);
    }

    const db = await getDB();
    return await db.get('agents', id);
  }

  async createAgent(
    topicId: string,
    type: AgentType,
    name: string,
    description: string,
    config: AgentConfig
  ): Promise<Agent> {
    if (this.isUsingAPI) {
      const agent: Partial<Agent> = {
        topicId,
        type,
        name,
        status: 'idle',
        config
      };
      return await agentsAPIService.saveAgent(agent as Agent);
    }

    return await createLocalAgent(topicId, type, name, description, config);
  }

  async saveAgent(agent: Agent): Promise<Agent> {
    if (this.isUsingAPI) {
      return await agentsAPIService.saveAgent(agent);
    }

    const db = await getDB();
    await db.put('agents', agent);
    return agent;
  }

  async createDefaultAgents(topicId: string): Promise<Agent[]> {
    if (this.isUsingAPI) {
      return await agentsAPIService.createDefaultAgents(topicId);
    }

    // Create default agents locally
    const defaultAgents: Agent[] = [];
    const agentTypes: Array<{ type: AgentType; name: string; description: string }> = [
      {
        type: 'treatment_breakthrough',
        name: 'Treatment Breakthrough Monitor',
        description: 'Monitors FDA approvals, new therapies, and treatment guidelines'
      },
      {
        type: 'clinical_trial',
        name: 'Clinical Trial Scanner',
        description: 'Tracks new trials, enrollment changes, and trial results'
      },
      {
        type: 'medical_literature',
        name: 'Medical Literature Researcher',
        description: 'Scans medical journals and research publications'
      },
      {
        type: 'pattern_recognition',
        name: 'Pattern & Insight Analyzer',
        description: 'Identifies patterns and connections across research'
      }
    ];

    for (const agentDef of agentTypes) {
      const agent = await createLocalAgent(
        topicId,
        agentDef.type,
        agentDef.name,
        agentDef.description,
        {
          searchDepth: 10,
          updateFrequency: agentDef.type === 'treatment_breakthrough' ? 'daily' : 'weekly',
          sources: [],
          keywords: []
        }
      );
      defaultAgents.push(agent);
    }

    return defaultAgents;
  }

  async deleteAgent(id: string): Promise<void> {
    if (this.isUsingAPI) {
      return await agentsAPIService.deleteAgent(id);
    }

    const db = await getDB();
    await db.delete('agents', id);
  }

  async toggleAgent(id: string): Promise<Agent> {
    if (this.isUsingAPI) {
      return await agentsAPIService.toggleAgent(id);
    }

    const db = await getDB();
    const agent = await db.get('agents', id);
    if (agent) {
      agent.status = agent.status === 'disabled' ? 'idle' : 'disabled';
      agent.updatedAt = Date.now();
      await db.put('agents', agent);
      return agent;
    }
    throw new Error('Agent not found');
  }

  async setAgentStatus(
    agentId: string,
    status: 'idle' | 'running' | 'scheduled' | 'error' | 'disabled'
  ): Promise<void> {
    if (this.isUsingAPI) {
      const agent = await agentsAPIService.getAgent(agentId);
      if (agent) {
        agent.status = status;
        await agentsAPIService.saveAgent(agent);
      }
      return;
    }

    await setLocalAgentStatus(agentId, status as 'idle' | 'running' | 'scheduled' | 'error');
  }

  async updateAgentAfterRun(
    agentId: string,
    status: 'success' | 'partial' | 'failed',
    findingsCount: number,
    apiCost?: number,
    error?: string
  ): Promise<void> {
    if (this.isUsingAPI) {
      await agentsAPIService.updateLastRun(agentId);
      return;
    }

    await updateLocalAgentAfterRun(agentId, status, findingsCount, apiCost, error);
  }

  async updateAgentConfig(agentId: string, config: Partial<AgentConfig>): Promise<void> {
    if (this.isUsingAPI) {
      const agent = await agentsAPIService.getAgent(agentId);
      if (agent) {
        agent.config = { ...agent.config, ...config };
        await agentsAPIService.saveAgent(agent);
      }
      return;
    }

    await updateLocalAgentConfig(agentId, config);
  }

  async getAgentsToRun(): Promise<Agent[]> {
    if (this.isUsingAPI) {
      // For API, we'd need a server-side endpoint for this
      // For now, fetch all agents and filter client-side
      const agents = await agentsAPIService.getAgents();
      const now = Date.now();
      return agents.filter(agent =>
        agent.status !== 'running' &&
        agent.status !== 'disabled' &&
        (!agent.nextScheduledRun || agent.nextScheduledRun <= now)
      );
    }

    return await getAgentsToRun();
  }

  async getAgentsForForceRun(): Promise<Agent[]> {
    if (this.isUsingAPI) {
      const agents = await agentsAPIService.getAgents();
      return agents.filter(agent => agent.status !== 'running');
    }

    return await getAgentsForForceRun();
  }
}

export const agentsService = new AgentsService();
