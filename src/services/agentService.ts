import type { Agent, ResearchFinding, Topic, AgentType } from '@/types';
import { getDB } from '@/utils/db/database';
import { generateId } from '@/utils/db/topics';
import {
  setAgentStatus,
  updateAgentAfterRun,
  isWithinBudget,
  getMonthlyApiCost
} from '@/utils/db/agents';

// Agent configuration defaults
const AGENT_CONFIGS = {
  treatment_breakthrough: {
    name: 'Treatment Breakthrough Monitor',
    description: 'Monitors FDA approvals, new therapies, and treatment guidelines',
    sources: ['fda.gov', 'clinicaltrials.gov', 'pubmed'],
    searchTerms: ['treatment', 'therapy', 'FDA approval', 'breakthrough'],
    updateFrequency: 'daily' as const
  },
  clinical_trial: {
    name: 'Clinical Trial Scanner',
    description: 'Tracks new trials, enrollment changes, and trial results',
    sources: ['clinicaltrials.gov', 'eu-trials', 'who-trials'],
    searchTerms: ['clinical trial', 'enrollment', 'recruiting', 'phase'],
    updateFrequency: 'daily' as const
  },
  medical_literature: {
    name: 'Medical Literature Researcher',
    description: 'Scans medical journals and research publications',
    sources: ['pubmed', 'nejm', 'lancet', 'nature medicine'],
    searchTerms: ['study', 'research', 'findings', 'analysis'],
    updateFrequency: 'weekly' as const
  },
  pattern_recognition: {
    name: 'Pattern & Insight Analyzer',
    description: 'Identifies patterns and connections across research',
    sources: ['all'],
    searchTerms: ['meta-analysis', 'systematic review', 'consensus'],
    updateFrequency: 'weekly' as const
  }
};

// API endpoints (these would be configured from environment)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Main agent execution function
export async function runAgent(agent: Agent, topic: Topic): Promise<ResearchFinding[]> {
  // Check budget before running
  const withinBudget = await isWithinBudget();
  if (!withinBudget) {
    console.warn(`Agent ${agent.id} skipped - monthly budget exceeded`);
    throw new Error('Monthly API budget exceeded');
  }

  try {
    await setAgentStatus(agent.id, 'running');

    // Call backend to execute real medical research
    const response = await fetch(`${API_BASE}/agent/run-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, topic })
    });

    if (!response.ok) {
      throw new Error('Agent execution failed');
    }

    const data = await response.json();

    // Process and store findings from real sources only
    const processedFindings = await processFindings(data.findings || [], agent, topic);

    // Update agent after successful run
    await updateAgentAfterRun(
      agent.id,
      'success',
      processedFindings.length,
      calculateApiCost(agent.config.searchDepth)
    );

    return processedFindings;
  } catch (error) {
    console.error(`Agent ${agent.id} failed:`, error);
    await updateAgentAfterRun(
      agent.id,
      'failed',
      0,
      0,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

// Process and deduplicate findings
async function processFindings(
  findings: ResearchFinding[],
  agent: Agent,
  topic: Topic
): Promise<ResearchFinding[]> {
  const db = await getDB();
  const processedFindings: ResearchFinding[] = [];

  // Get existing findings to check for duplicates
  const existingFindings = await db.getAllFromIndex('findings', 'by-topic', topic.id);
  const existingUrls = new Set(existingFindings.map(f => f.source.url).filter(Boolean));
  const existingTitles = new Set(existingFindings.map(f => f.title.toLowerCase()));

  for (const finding of findings) {
    // Check for duplicates by URL or title
    if (finding.source.url && existingUrls.has(finding.source.url)) {
      continue; // Skip duplicate
    }

    if (existingTitles.has(finding.title.toLowerCase())) {
      continue; // Skip duplicate title
    }

    // Set agent ID
    finding.agentId = agent.id;
    finding.timestamp = Date.now();

    // Store finding
    await db.add('findings', finding);
    processedFindings.push(finding);

    // Create notification for breakthrough treatments or new trials
    if (finding.type === 'treatment' || finding.type === 'trial') {
      await createNotification(finding, topic);
    }
  }

  return processedFindings;
}

// Create notification for important findings
async function createNotification(finding: ResearchFinding, topic: Topic): Promise<void> {
  const db = await getDB();

  await db.add('notifications', {
    id: generateId(),
    type: finding.type === 'treatment' ? 'breakthrough_treatment' : 'new_trial',
    priority: 'medium', // No arbitrary scoring
    title: `New ${finding.type} for ${topic.name}`,
    message: finding.summary,
    data: { findingId: finding.id, topicId: topic.id },
    createdAt: Date.now()
  });
}

// Calculate API cost based on search depth
function calculateApiCost(searchDepth: string): number {
  switch (searchDepth) {
    case 'quick':
      return 100; // 1 cent
    case 'deep':
      return 500; // 5 cents
    default:
      return 200; // 2 cents
  }
}

// Run all agents for a topic
export async function runAllAgentsForTopic(topic: Topic): Promise<void> {
  const db = await getDB();
  const agents = await db.getAllFromIndex('agents', 'by-topic', topic.id);

  for (const agent of agents) {
    try {
      await runAgent(agent, topic);
    } catch (error) {
      console.error(`Failed to run agent ${agent.name}:`, error);
    }
  }
}