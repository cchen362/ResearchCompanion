import { getDB } from './database';
import { storageConfig } from '@/config/storage.config';
import { agentsAPIService } from '@/services/agents.api.service';
import type { Agent, AgentConfig, AgentType, AgentRun, ResearchFinding } from '@/types';
import { generateId } from './topics';

// Create a new agent for a topic
export async function createAgent(
  topicId: string,
  type: AgentType,
  name: string,
  description: string,
  config: AgentConfig
): Promise<Agent> {
  const db = await getDB();

  const agent: Agent = {
    id: generateId(),
    type,
    name,
    description,
    config,
    topicId,
    status: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Schedule first run immediately (agents should run on creation)
  agent.nextScheduledRun = Date.now();

  await db.add('agents', agent);
  return agent;
}

// Get all agents for a topic
export async function getAgentsByTopic(topicId: string): Promise<Agent[]> {
  if (storageConfig.useServerStorage) {
    return await agentsAPIService.getAgents(topicId);
  }
  const db = await getDB();
  return db.getAllFromIndex('agents', 'by-topic', topicId);
}

// Get agents that need to run
export async function getAgentsToRun(): Promise<Agent[]> {
  if (storageConfig.useServerStorage) {
    // For server storage, get all agents and filter
    const allAgents = await agentsAPIService.getAgents();
    const now = Date.now();
    return allAgents.filter(agent =>
      agent.status !== 'running' &&
      (!agent.nextScheduledRun || agent.nextScheduledRun <= now)
    );
  }
  const db = await getDB();
  const now = Date.now();
  const allAgents = await db.getAll('agents');

  return allAgents.filter(agent =>
    agent.status !== 'running' &&
    (!agent.nextScheduledRun || agent.nextScheduledRun <= now)
  );
}

// Get all agents that can be force-run (not currently running)
export async function getAgentsForForceRun(): Promise<Agent[]> {
  const db = await getDB();
  const allAgents = await db.getAll('agents');

  // Return all agents that aren't currently running
  return allAgents.filter(agent => agent.status !== 'running');
}

// Update agent after run
export async function updateAgentAfterRun(
  agentId: string,
  status: 'success' | 'partial' | 'failed',
  findingsCount: number,
  apiCost?: number,
  error?: string
): Promise<void> {
  const db = await getDB();
  const agent = await db.get('agents', agentId);

  if (agent) {
    agent.lastRun = Date.now();
    agent.status = 'idle';
    agent.nextScheduledRun = calculateNextRun(agent);
    agent.updatedAt = Date.now();

    // Record the run
    const run: AgentRun = {
      id: generateId(),
      agentId,
      startTime: agent.lastRun,
      endTime: Date.now(),
      status,
      findingsCount,
      apiCost,
      error
    };

    // Store run history (you might want a separate store for this)
    await db.put('agents', agent);

    // Track API usage
    if (apiCost && apiCost > 0) {
      await trackApiUsage(agentId, apiCost);
    }
  }
}

// Calculate next run time based on agent config
function calculateNextRun(agent: Agent): number {
  const now = Date.now();

  switch (agent.config.updateFrequency) {
    case 'hourly':
      return now + (60 * 60 * 1000);
    case 'daily':
      return now + (24 * 60 * 60 * 1000);
    case 'weekly':
      return now + (7 * 24 * 60 * 60 * 1000);
    case 'adaptive':
      // Use learning profile if available
      if (agent.learningProfile?.adaptedFrequency) {
        const hours = parseInt(agent.learningProfile.adaptedFrequency);
        return now + (hours * 60 * 60 * 1000);
      }
      // Default to daily for adaptive
      return now + (24 * 60 * 60 * 1000);
    default:
      return now + (24 * 60 * 60 * 1000);
  }
}

// Update agent learning profile based on user engagement
export async function updateAgentLearning(
  agentId: string,
  findingId: string,
  engagement: 'clicked' | 'dismissed' | 'shared'
): Promise<void> {
  const db = await getDB();
  const agent = await db.get('agents', agentId);
  const finding = await db.get('findings', findingId);

  if (agent && finding) {
    if (!agent.learningProfile) {
      agent.learningProfile = {
        preferredSources: [],
        engagementScores: {},
        userInteractionPatterns: {
          clickRate: 0,
          dismissRate: 0,
          shareRate: 0
        }
      };
    }

    // Update engagement scores
    const sourceName = finding.source.name;
    if (!agent.learningProfile.engagementScores[sourceName]) {
      agent.learningProfile.engagementScores[sourceName] = 0;
    }

    switch (engagement) {
      case 'clicked':
        agent.learningProfile.engagementScores[sourceName] += 1;
        agent.learningProfile.userInteractionPatterns.clickRate += 0.01;
        break;
      case 'shared':
        agent.learningProfile.engagementScores[sourceName] += 2;
        agent.learningProfile.userInteractionPatterns.shareRate += 0.01;
        break;
      case 'dismissed':
        agent.learningProfile.engagementScores[sourceName] -= 1;
        agent.learningProfile.userInteractionPatterns.dismissRate += 0.01;
        break;
    }

    // Update preferred sources
    const topSources = Object.entries(agent.learningProfile.engagementScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source]) => source);

    agent.learningProfile.preferredSources = topSources;

    // Adapt frequency based on engagement
    const totalRate = agent.learningProfile.userInteractionPatterns.clickRate +
                     agent.learningProfile.userInteractionPatterns.shareRate;

    if (totalRate > 0.5) {
      // High engagement - increase frequency
      agent.learningProfile.adaptedFrequency = '12'; // 12 hours
    } else if (totalRate > 0.3) {
      agent.learningProfile.adaptedFrequency = '24'; // Daily
    } else {
      agent.learningProfile.adaptedFrequency = '48'; // Every 2 days
    }

    await db.put('agents', agent);
  }
}

// Track API usage for cost management
async function trackApiUsage(agentId: string, cost: number): Promise<void> {
  const db = await getDB();

  await db.add('apiUsage', {
    id: generateId(),
    service: 'anthropic', // Default to anthropic, could be parameterized
    endpoint: 'agent-run',
    timestamp: Date.now(),
    cost,
    agentId,
    success: true
  });
}

// Get total cost for current month
export async function getMonthlyApiCost(): Promise<number> {
  const db = await getDB();
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const usage = await db.getAllFromIndex('apiUsage', 'by-date');
  const monthUsage = usage.filter(u => u.timestamp >= firstDayOfMonth);

  return monthUsage.reduce((total, u) => total + u.cost, 0) / 100; // Convert cents to dollars
}

// Check if within budget
export async function isWithinBudget(budgetLimit: number = 20): Promise<boolean> {
  const currentCost = await getMonthlyApiCost();
  return currentCost < budgetLimit;
}

// Set agent status
export async function setAgentStatus(
  agentId: string,
  status: 'idle' | 'running' | 'scheduled' | 'error'
): Promise<void> {
  const db = await getDB();
  const agent = await db.get('agents', agentId);

  if (agent) {
    agent.status = status;
    agent.updatedAt = Date.now();
    await db.put('agents', agent);
  }
}

// Update agent configuration
export async function updateAgentConfig(
  agentId: string,
  config: Partial<AgentConfig>
): Promise<void> {
  const db = await getDB();
  const agent = await db.get('agents', agentId);

  if (agent) {
    agent.config = { ...agent.config, ...config };
    agent.updatedAt = Date.now();
    agent.nextScheduledRun = calculateNextRun(agent);
    await db.put('agents', agent);
  }
}