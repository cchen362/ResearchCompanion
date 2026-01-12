import type { Agent, Topic, ResearchFinding } from '@/types';
import * as api from './api';
import { generateId } from '@/utils/db/topics';
import { getDB } from '@/utils/db/database';
import { updateAgentAfterRun, setAgentStatus, isWithinBudget } from '@/utils/db/agents';

/**
 * Run a comprehensive agent search with real API integration
 */
export async function runAgentWithAPI(agent: Agent, topic: Topic): Promise<ResearchFinding[]> {
  console.log(`Running agent ${agent.name} for topic ${topic.name}`);

  // Check budget
  const withinBudget = await isWithinBudget();
  if (!withinBudget) {
    throw new Error('Monthly API budget exceeded');
  }

  try {
    await setAgentStatus(agent.id, 'running');

    const findings: ResearchFinding[] = [];
    const query = buildSearchQuery(topic, agent.type);

    // Step 1: Parse the search intent
    console.log('Parsing search query:', query);
    const parsedQuery = await api.parseSearchQuery(query);

    if (parsedQuery.needsClarification) {
      console.log('Query needs clarification:', parsedQuery.suggestions);
      // For now, skip unclear queries
      await updateAgentAfterRun(agent.id, 'failed', 0, 0, 'Query needs clarification');
      return [];
    }

    // Step 2: Perform searches based on agent type
    let searchResults: any[] = [];

    switch (agent.type) {
      case 'treatment_breakthrough':
        // Search for FDA approvals and new treatments
        const webResults = await api.searchWeb(`${query} FDA approval new treatment`, 5);
        const pubmedResults = await api.searchPubMed(`${query} treatment therapy`, 5);
        searchResults = [...(webResults.results || []), ...(pubmedResults.articles || [])];
        break;

      case 'clinical_trial':
        // Search for clinical trials
        const trials = await api.searchClinicalTrials(
          topic.diseaseProfile.name,
          'RECRUITING',
          topic.patientContext?.location
        );
        searchResults = trials.trials || [];
        break;

      case 'medical_literature':
        // Search medical literature
        const literature = await api.searchPubMed(query, 10);
        searchResults = literature.articles || [];
        break;

      case 'pattern_recognition':
        // Analyze existing findings for patterns
        searchResults = await analyzeExistingFindings(topic);
        break;

      default:
        // General search
        const generalWeb = await api.searchWeb(query, 5);
        const generalPubmed = await api.searchPubMed(query, 5);
        searchResults = [...(generalWeb.results || []), ...(generalPubmed.articles || [])];
    }

    console.log(`Found ${searchResults.length} search results`);

    // Step 3: Summarize the results
    if (searchResults.length > 0) {
      const summaryResponse = await api.summarizeResults(searchResults, query);
      const summary = summaryResponse.summary || '';

      // Step 4: Convert to ResearchFinding format
      for (const result of searchResults) {
        // Handle source properly - backend returns it as an object
        const sourceName = result.source?.displayName || result.source?.name || result.journal || 'Unknown Source';
        const sourceUrl = result.source?.url || result.url || '';

        const finding: ResearchFinding = {
          id: generateId(),
          agentId: agent.id,
          topicId: topic.id,
          type: determineType(agent.type),
          title: result.title || result.briefTitle || 'Untitled',
          summary: result.snippet || result.abstract || result.briefSummary || '',
          details: summary,
          source: {
            name: sourceName,
            url: sourceUrl,
            type: determineSourceType(result),
            publishDate: result.publishedAt || result.publishDate || result.pubdate || new Date().toISOString()
          },
          // relevanceScore and confidenceLevel removed - misleading metrics
          isNew: true,
          timestamp: Date.now()
        };

        // Extract entities if available
        if (result.interventions) {
          finding.extractedEntities = {
            medications: result.interventions
          };
        }

        findings.push(finding);
      }

      // Step 5: Store findings in database
      const db = await getDB();
      for (const finding of findings) {
        await db.add('findings', finding);
      }

      // Create notification for new findings
      if (findings.length > 0) {
        await createNotification(topic, findings.length);
      }
    }

    // Update agent status
    const apiCost = calculateCost(searchResults.length);
    await updateAgentAfterRun(agent.id, 'success', findings.length, apiCost);

    console.log(`Agent run complete. Found ${findings.length} new findings.`);
    return findings;

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

/**
 * Build an optimized search query for the agent
 */
function buildSearchQuery(topic: Topic, agentType: string): string {
  const baseQuery = topic.diseaseProfile.name;
  const modifiers: string[] = [];

  // Add patient context
  if (topic.patientContext?.ageGroup === 'pediatric') {
    modifiers.push('pediatric', 'children');
  }

  // Add agent-specific terms
  switch (agentType) {
    case 'treatment_breakthrough':
      modifiers.push('new treatment', 'FDA approval', 'breakthrough therapy');
      break;
    case 'clinical_trial':
      modifiers.push('clinical trial', 'recruiting', 'enrollment');
      break;
    case 'medical_literature':
      modifiers.push('research', 'study', 'meta-analysis');
      break;
    case 'pattern_recognition':
      modifiers.push('systematic review', 'consensus', 'guidelines');
      break;
  }

  // Add recency - use current year
  const currentYear = new Date().getFullYear();
  modifiers.push(currentYear.toString(), 'latest', 'recent');

  return `${baseQuery} ${modifiers.join(' ')}`;
}

/**
 * Analyze existing findings for patterns
 */
async function analyzeExistingFindings(topic: Topic): Promise<any[]> {
  const db = await getDB();
  const findings = await db.getAllFromIndex('findings', 'by-topic', topic.id);

  // Group by common themes
  const themes = new Map<string, number>();
  findings.forEach(f => {
    f.extractedEntities?.medications?.forEach(med => {
      themes.set(med, (themes.get(med) || 0) + 1);
    });
  });

  // Return synthetic results for patterns
  return Array.from(themes.entries())
    .filter(([_, count]) => count >= 2)
    .map(([medication, count]) => ({
      title: `Pattern: ${medication} mentioned ${count} times`,
      snippet: `This medication appears frequently in research for ${topic.diseaseProfile.name}`,
      url: '',
      source: 'Pattern Analysis'
    }));
}

/**
 * Determine the type of finding based on agent type
 */
function determineType(agentType: string): ResearchFinding['type'] {
  switch (agentType) {
    case 'treatment_breakthrough':
      return 'treatment';
    case 'clinical_trial':
      return 'trial';
    case 'medical_literature':
      return 'study';
    default:
      return 'study';
  }
}

/**
 * Determine source type from result
 */
function determineSourceType(result: any): ResearchFinding['source']['type'] {
  // Check if source is an object from backend
  if (result.source?.type) {
    return result.source.type as ResearchFinding['source']['type'];
  }

  // Fallback checks for other fields
  if (result.journal) return 'journal';
  if (result.nctId || result.metadata?.nctId) return 'clinical_trial';
  if (result.type === 'regulatory') return 'fda';
  if (result.type === 'research') return 'journal';
  if (result.type === 'clinical_trial') return 'clinical_trial';
  if (result.type === 'article') return 'medical_site';

  return 'medical_site';
}

// calculateRelevance function removed - relevanceScore metric is deprecated and misleading for medical information

/**
 * Calculate API cost
 */
function calculateCost(resultCount: number): number {
  // Rough estimate: $0.001 per search, $0.002 per summary
  return Math.ceil(resultCount * 0.3); // In cents
}

/**
 * Create notification for important findings
 */
async function createNotification(topic: Topic, findingsCount: number): Promise<void> {
  const db = await getDB();
  await db.add('notifications', {
    id: generateId(),
    type: 'agent_complete',
    priority: 'medium',
    title: `New research for ${topic.name}`,
    message: `Found ${findingsCount} new findings related to ${topic.diseaseProfile.name}`,
    createdAt: Date.now()
  });
}