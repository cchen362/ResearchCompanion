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

    // Build search query based on agent type and topic
    const searchQuery = buildSearchQuery(agent, topic);

    // Execute search based on agent configuration
    const findings = await executeAgentSearch(agent, searchQuery, topic);

    // Process and store findings
    const processedFindings = await processFindings(findings, agent, topic);

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

// Build search query based on agent and topic
function buildSearchQuery(agent: Agent, topic: Topic): string {
  const config = AGENT_CONFIGS[agent.type];
  const baseTerms = [topic.diseaseProfile.name];

  // Add patient context if available
  if (topic.patientContext) {
    if (topic.patientContext.ageGroup === 'pediatric') {
      baseTerms.push('pediatric', 'children');
    }
    if (topic.patientContext.currentStage === 'newly_diagnosed') {
      baseTerms.push('first-line', 'initial treatment');
    }
  }

  // Add agent-specific search terms
  const agentTerms = config.searchTerms;

  // Combine terms intelligently
  const query = `${baseTerms.join(' ')} ${agentTerms[0]}`;

  return query;
}

// Execute the actual search
async function executeAgentSearch(
  agent: Agent,
  query: string,
  topic: Topic
): Promise<ResearchFinding[]> {
  const findings: ResearchFinding[] = [];

  try {
    // Call appropriate APIs based on agent type
    switch (agent.type) {
      case 'treatment_breakthrough':
        findings.push(...await searchFDA(query, topic));
        findings.push(...await searchPubMed(query, topic, 'treatment'));
        break;

      case 'clinical_trial':
        findings.push(...await searchClinicalTrials(query, topic));
        break;

      case 'medical_literature':
        findings.push(...await searchPubMed(query, topic, 'research'));
        break;

      case 'pattern_recognition':
        // This would analyze existing findings
        findings.push(...await analyzePatterns(topic));
        break;
    }

    // Apply location filter if configured
    if (agent.config.locationFilter) {
      return filterByLocation(findings, agent.config.locationFilter);
    }

    return findings;
  } catch (error) {
    console.error('Search execution failed:', error);
    return [];
  }
}

// Search FDA for approvals and updates
async function searchFDA(query: string, topic: Topic): Promise<ResearchFinding[]> {
  // This would call the actual FDA API
  // For now, returning mock data
  return [{
    id: generateId(),
    agentId: '',
    topicId: topic.id,
    type: 'treatment',
    title: 'FDA Approval Update',
    summary: 'New treatment approval for rare disease',
    details: 'Detailed information about the approval...',
    source: {
      name: 'FDA',
      url: 'https://www.fda.gov',
      type: 'fda',
      credibilityScore: 1.0,
      publishDate: new Date().toISOString()
    },
    relevanceScore: 0.95,
    confidenceLevel: 'high',
    isNew: true,
    timestamp: Date.now()
  }];
}

// Search PubMed for medical literature
async function searchPubMed(
  query: string,
  topic: Topic,
  focus: 'treatment' | 'research'
): Promise<ResearchFinding[]> {
  try {
    const response = await fetch(`${API_BASE}/pubmed-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 })
    });

    if (!response.ok) {
      throw new Error('PubMed search failed');
    }

    const data = await response.json();

    // Transform PubMed results to ResearchFinding format
    return data.articles.map((article: any) => ({
      id: generateId(),
      agentId: '',
      topicId: topic.id,
      type: focus === 'treatment' ? 'treatment' : 'study',
      title: article.title,
      summary: article.abstract,
      details: article.fullText || article.abstract,
      source: {
        name: 'PubMed',
        url: article.url,
        type: 'journal',
        credibilityScore: 0.9,
        publishDate: article.publishDate,
        authors: article.authors,
        doi: article.doi
      },
      relevanceScore: calculateRelevance(article, topic),
      confidenceLevel: 'high',
      isNew: true,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('PubMed search error:', error);
    return [];
  }
}

// Search clinical trials
async function searchClinicalTrials(
  query: string,
  topic: Topic
): Promise<ResearchFinding[]> {
  try {
    const response = await fetch(`${API_BASE}/clinical-trials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        status: 'recruiting',
        location: topic.patientContext?.location
      })
    });

    if (!response.ok) {
      throw new Error('Clinical trials search failed');
    }

    const data = await response.json();

    return data.trials.map((trial: any) => ({
      id: generateId(),
      agentId: '',
      topicId: topic.id,
      type: 'trial',
      title: trial.title,
      summary: trial.briefSummary,
      details: trial.detailedDescription,
      source: {
        name: 'ClinicalTrials.gov',
        url: trial.url,
        type: 'clinical_trial',
        credibilityScore: 0.95,
        publishDate: trial.lastUpdateDate
      },
      relevanceScore: calculateTrialRelevance(trial, topic),
      confidenceLevel: 'high',
      isNew: true,
      extractedEntities: {
        medications: trial.interventions,
        institutions: [trial.sponsor]
      },
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Clinical trials search error:', error);
    return [];
  }
}

// Analyze patterns across existing findings
async function analyzePatterns(topic: Topic): Promise<ResearchFinding[]> {
  const db = await getDB();
  const existingFindings = await db.getAllFromIndex('findings', 'by-topic', topic.id);

  // Group findings by type and extract patterns
  const patterns: ResearchFinding[] = [];

  // Look for medication mentions across findings
  const medicationCounts = new Map<string, number>();
  existingFindings.forEach(f => {
    f.extractedEntities?.medications?.forEach(med => {
      medicationCounts.set(med, (medicationCounts.get(med) || 0) + 1);
    });
  });

  // Create pattern findings for frequently mentioned medications
  for (const [medication, count] of medicationCounts) {
    if (count >= 3) {
      patterns.push({
        id: generateId(),
        agentId: '',
        topicId: topic.id,
        type: 'study',
        title: `Pattern: ${medication} mentioned in ${count} studies`,
        summary: `Analysis shows ${medication} is frequently mentioned across research`,
        details: `This medication appears in multiple contexts and may warrant further investigation`,
        source: {
          name: 'Pattern Analysis',
          type: 'journal',
          credibilityScore: 0.8
        },
        relevanceScore: Math.min(count * 0.2, 1),
        confidenceLevel: count >= 5 ? 'high' : 'medium',
        isNew: true,
        timestamp: Date.now()
      });
    }
  }

  return patterns;
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

  for (const finding of findings) {
    // Check if this is truly new
    if (finding.source.url && existingUrls.has(finding.source.url)) {
      finding.isNew = false;
      continue; // Skip duplicates
    }

    // Set agent ID
    finding.agentId = agent.id;

    // Store finding
    await db.add('findings', finding);
    processedFindings.push(finding);

    // Create notification for high-relevance findings
    if (finding.relevanceScore > 0.8 && finding.type === 'treatment') {
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
    priority: finding.relevanceScore > 0.9 ? 'high' : 'medium',
    title: `New ${finding.type} for ${topic.name}`,
    message: finding.summary,
    data: { findingId: finding.id, topicId: topic.id },
    createdAt: Date.now()
  });
}

// Calculate relevance score
function calculateRelevance(article: any, topic: Topic): number {
  let score = 0.5; // Base score

  const lowerTitle = article.title.toLowerCase();
  const lowerAbstract = article.abstract?.toLowerCase() || '';

  // Check for disease name
  if (lowerTitle.includes(topic.diseaseProfile.name.toLowerCase())) {
    score += 0.2;
  }
  if (lowerAbstract.includes(topic.diseaseProfile.name.toLowerCase())) {
    score += 0.1;
  }

  // Check for patient context relevance
  if (topic.patientContext?.ageGroup === 'pediatric') {
    if (lowerTitle.includes('pediatric') || lowerTitle.includes('children')) {
      score += 0.15;
    }
  }

  // Recent publication bonus
  const publishDate = new Date(article.publishDate);
  const monthsOld = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsOld < 3) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

// Calculate trial relevance
function calculateTrialRelevance(trial: any, topic: Topic): number {
  let score = 0.5;

  // Location proximity
  if (topic.patientContext?.location && trial.location) {
    if (trial.location.country === topic.patientContext.location.country) {
      score += 0.2;
    }
    if (trial.location.state === topic.patientContext.location.state) {
      score += 0.1;
    }
  }

  // Age group match
  if (trial.ageRange && topic.patientContext?.age) {
    const age = topic.patientContext.age;
    if (age >= trial.ageRange.min && age <= trial.ageRange.max) {
      score += 0.15;
    }
  }

  // Recruiting status
  if (trial.status === 'recruiting') {
    score += 0.1;
  }

  return Math.min(score, 1);
}

// Filter findings by location
function filterByLocation(
  findings: ResearchFinding[],
  locationFilter: any
): ResearchFinding[] {
  // Implementation would filter based on location criteria
  return findings;
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