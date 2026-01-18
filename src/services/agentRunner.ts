import type { Agent, Topic, ResearchFinding, AgentType } from '@/types';
import * as api from './api';
import { generateId } from '@/utils/db/topics';
import { getDB } from '@/utils/db/database';
import { updateAgentAfterRun, setAgentStatus, isWithinBudget } from '@/utils/db/agents';
import { digestQueueService } from './digestQueue.service';
import { findingsService } from './findings.service';
import { topicsService } from './topics.service';
import { agentsService } from './agents.service';

/**
 * Run a comprehensive agent search with real API integration
 * @param agent - The agent to run
 * @param topic - The topic to search for
 * @param options - Optional settings
 * @param options.skipDigestGeneration - Skip auto-digest when running as part of bulk operations
 */
export async function runAgentWithAPI(
  agent: Agent,
  topic: Topic,
  options?: { skipDigestGeneration?: boolean }
): Promise<ResearchFinding[]> {
  console.log(`Running agent ${agent.name} for topic ${topic.name}`);

  // Check budget
  const withinBudget = await isWithinBudget();
  if (!withinBudget) {
    throw new Error('Monthly API budget exceeded');
  }

  try {
    await setAgentStatus(agent.id, 'running');

    const findings: ResearchFinding[] = [];
    let duplicatesSkipped = 0;  // Track duplicates at function scope
    let existingFindings: ResearchFinding[] = [];  // Define at function scope
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
        // Use higher limits to leverage PubMed API key benefits (backend configured: 20 PubMed, 10 web)
        const webResults = await api.searchWeb(`${query} FDA approval new treatment`, 10);
        const pubmedResults = await api.searchPubMed(`${query} treatment therapy`, 10);
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
        // Use higher limit to leverage PubMed API key benefits (backend configured: 20)
        const literature = await api.searchPubMed(query, 20);
        searchResults = literature.articles || [];
        break;

      case 'pattern_recognition':
        // Analyze existing findings for patterns
        searchResults = await analyzeExistingFindings(topic);
        break;

      default:
        // General search
        // Use higher limits to leverage PubMed API key benefits
        const generalWeb = await api.searchWeb(query, 10);
        const generalPubmed = await api.searchPubMed(query, 10);
        searchResults = [...(generalWeb.results || []), ...(generalPubmed.articles || [])];
    }

    console.log(`Found ${searchResults.length} search results`);

    // Step 3: Summarize the results
    if (searchResults.length > 0) {
      const summaryResponse = await api.summarizeResults(searchResults, query);
      const summary = summaryResponse.summary || '';

      // Step 4: Convert to ResearchFinding format
      for (const result of searchResults) {
        // DEBUG: Log what we receive from backend
        console.log('Backend result source:', result.source);

        // Preserve the complete source object from backend
        let sourceObject;
        if (result.source && typeof result.source === 'object') {
          // Backend provided a complete source object - preserve ALL fields
          sourceObject = {
            ...result.source, // Keep everything from backend
            // Ensure critical fields are present
            name: result.source.name || result.source.displayName || result.journal || 'Research Database',
            displayName: result.source.displayName || result.source.name || result.journal || 'Research Database',
            url: result.source.url || result.url || '',
            type: result.source.type || determineSourceType(result),
            publishDate: result.source.publishDate || result.publishedAt || result.publishDate || new Date().toISOString()
          };
        } else {
          // Fallback: construct source from available fields
          const fallbackName = result.journal || result.sponsor || 'Research Database';
          sourceObject = {
            name: fallbackName,
            displayName: fallbackName,
            url: result.url || '',
            type: determineSourceType(result),
            publishDate: result.publishedAt || result.publishDate || new Date().toISOString()
          };
        }

        const finding: ResearchFinding = {
          id: generateId(),
          agentId: agent.id,
          agentType: agent.type, // Add agent type for readable display names
          topicId: topic.id,
          type: determineType(agent.type),
          title: result.title || result.briefTitle || 'Untitled',
          summary: result.snippet || result.abstract || result.briefSummary || '',
          details: result.details || result.summary || result.briefSummary || '', // Ensure details has content
          source: sourceObject,
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

      // Step 5: Store findings in database with deduplication
      // Use findingsService to respect storage config (server vs local)
      existingFindings = await findingsService.getFindings(topic.id);

      duplicatesSkipped = 0;  // Reset counter for this batch
      for (const finding of findings) {
        // Check for duplicate by URL or title+source combination
        const isDuplicate = existingFindings.some(existing => {
          // Check by URL if available
          if (finding.source.url && existing.source.url) {
            return finding.source.url === existing.source.url;
          }

          // Check by title and source name
          return finding.title.toLowerCase() === existing.title.toLowerCase() &&
                 finding.source.name === existing.source.name;
        });

        if (!isDuplicate) {
          await findingsService.saveFinding(finding);
        } else {
          duplicatesSkipped++;
          console.log(`Skipping duplicate finding: ${finding.title}`);
        }
      }

      // Adjust the findings array to only include non-duplicates
      const actualNewFindings = findings.length - duplicatesSkipped;

      // Create notification for new findings
      if (actualNewFindings > 0) {
        await createNotification(topic, actualNewFindings, options?.skipDigestGeneration);
      }
    }

    // Update agent status
    const apiCost = calculateCost(searchResults.length);
    const actualNewCount = findings.length - (duplicatesSkipped || 0);
    await updateAgentAfterRun(agent.id, 'success', actualNewCount, apiCost);

    console.log(`Agent run complete. Found ${actualNewCount} new findings (${duplicatesSkipped || 0} duplicates skipped).`);

    // Return only the non-duplicate findings
    return findings.filter(f =>
      !existingFindings.some(existing =>
        (f.source.url && existing.source.url && f.source.url === existing.source.url) ||
        (f.title.toLowerCase() === existing.title.toLowerCase() && f.source.name === existing.source.name)
      )
    );

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
  // Use findingsService to respect storage config (server vs local)
  const findings = await findingsService.getFindings(topic.id);

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
 * @param topic - The topic the findings belong to
 * @param findingsCount - Number of new findings
 * @param skipDigestGeneration - If true, skip auto-digest (used in bulk operations)
 */
async function createNotification(
  topic: Topic,
  findingsCount: number,
  skipDigestGeneration?: boolean
): Promise<void> {
  try {
    const db = await getDB();
    const notification = {
      id: generateId(),
      type: 'agent_complete' as const,
      priority: 'medium' as const,
      title: `New research for ${topic.name}`,
      message: `Found ${findingsCount} new findings related to ${topic.diseaseProfile.name}`,
      createdAt: Date.now(),
      // Add optional fields to ensure complete object
      readAt: undefined,
      dismissedAt: undefined,
      actionUrl: undefined,
      data: { topicId: topic.id, findingsCount }
    };

    console.log('Creating notification with full object:', notification);

    // Try to save the notification
    try {
      const result = await db.add('notifications', notification);
      console.log('✅ Notification saved successfully with key:', result);

      // Verify it was saved
      const savedNotification = await db.get('notifications', notification.id);
      console.log('Verification - saved notification:', savedNotification);

      // Dispatch custom event to notify UI components
      console.log('Dispatching notification-created and agent-complete events');
      window.dispatchEvent(new CustomEvent('notification-created', {
        detail: { notification: savedNotification }
      }));
      window.dispatchEvent(new CustomEvent('agent-complete', {
        detail: { topicId: topic.id, findingsCount }
      }));

      // Auto-queue digest generation if we have findings (skip if in bulk mode)
      if (findingsCount > 0 && !skipDigestGeneration) {
        try {
          console.log(`Auto-queueing digest generation for topic ${topic.id} with ${findingsCount} findings`);
          await digestQueueService.queueDigestFromExistingFindings(topic.id, 'weekly');
          console.log('✅ Digest generation queued automatically');
        } catch (digestError) {
          console.error('Failed to auto-queue digest generation:', digestError);
          // Don't throw - digest generation failure shouldn't break the agent completion
        }
      } else if (skipDigestGeneration) {
        console.log('Skipping auto-digest (bulk operation mode)');
      }

    } catch (dbError) {
      console.error('❌ Failed to save notification to database:', dbError);
      console.error('Error details:', {
        name: (dbError as Error).name,
        message: (dbError as Error).message,
        stack: (dbError as Error).stack
      });

      // Try alternative approach: use put instead of add
      try {
        console.log('Trying put instead of add...');
        await db.put('notifications', notification);
        console.log('✅ Notification saved with put method');

        // Dispatch events even if we used put
        window.dispatchEvent(new CustomEvent('notification-created', {
          detail: { notification }
        }));
        window.dispatchEvent(new CustomEvent('agent-complete', {
          detail: { topicId: topic.id, findingsCount }
        }));

        // Auto-queue digest generation if we have findings (fallback path, skip if in bulk mode)
        if (findingsCount > 0 && !skipDigestGeneration) {
          try {
            console.log(`Auto-queueing digest generation for topic ${topic.id} with ${findingsCount} findings (fallback)`);
            await digestQueueService.queueDigestFromExistingFindings(topic.id, 'weekly');
            console.log('✅ Digest generation queued automatically (fallback)');
          } catch (digestError) {
            console.error('Failed to auto-queue digest generation (fallback):', digestError);
          }
        } else if (skipDigestGeneration) {
          console.log('Skipping auto-digest in fallback path (bulk operation mode)');
        }
      } catch (putError) {
        console.error('❌ Put also failed:', putError);
      }
    }

  } catch (error) {
    console.error('❌ Error in createNotification:', error);
  }
}

/**
 * Run all active research agents for a topic to fetch new findings
 * This is used by the integrated refresh functionality
 */
export async function runAllResearchAgents(topicId: string): Promise<ResearchFinding[]> {
  console.log(`Running all research agents for topic ${topicId}`);

  // Get the topic
  const topic = await topicsService.getTopic(topicId);
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  // Get all active agents for this topic
  const allAgents = await agentsService.getAgents(topicId);
  const activeAgents = allAgents.filter(a => a.status !== 'disabled');

  if (activeAgents.length === 0) {
    console.log('No active agents found for topic');
    return [];
  }

  const allFindings: ResearchFinding[] = [];
  const errors: string[] = [];

  // Run agents in parallel for better performance
  // Skip per-agent digest generation - we'll trigger once after all complete
  const agentPromises = activeAgents.map(async (agent) => {
    try {
      console.log(`Running agent ${agent.name} (${agent.type})`);
      const findings = await runAgentWithAPI(agent, topic, { skipDigestGeneration: true });
      return findings;
    } catch (error) {
      const errorMsg = `Agent ${agent.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return [];
    }
  });

  const agentResults = await Promise.all(agentPromises);

  // Combine all findings
  for (const findings of agentResults) {
    allFindings.push(...findings);
  }

  console.log(`Research complete: ${allFindings.length} new findings from ${activeAgents.length} agents`);

  if (errors.length > 0) {
    console.warn(`${errors.length} agents failed during research:`, errors);
  }

  // Trigger digest generation once AFTER all agents have completed
  // This ensures all findings are in the database before digest is generated
  if (allFindings.length > 0) {
    try {
      console.log(`Queueing digest generation after all ${activeAgents.length} agents completed`);
      await digestQueueService.queueDigestFromExistingFindings(topicId, 'weekly');
      console.log('✅ Digest queued after all agents completed');
    } catch (digestError) {
      console.error('Failed to queue digest after bulk agent run:', digestError);
      // Don't throw - digest failure shouldn't break the agent completion
    }
  }

  return allFindings;
}

/**
 * Run specific research agents for a topic
 */
export async function runResearchAgents(
  topicId: string,
  agentTypes: AgentType[]
): Promise<ResearchFinding[]> {
  console.log(`Running specific research agents for topic ${topicId}:`, agentTypes);

  // Get the topic
  const topic = await topicsService.getTopic(topicId);
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  // Get requested agents
  const allAgents = await agentsService.getAgents(topicId);
  const requestedAgents = allAgents.filter(
    a => agentTypes.includes(a.type as AgentType) && a.status !== 'disabled'
  );

  if (requestedAgents.length === 0) {
    console.log('No matching active agents found');
    return [];
  }

  const allFindings: ResearchFinding[] = [];

  // Run agents sequentially to avoid rate limits
  // Skip per-agent digest generation - we'll trigger once after all complete
  for (const agent of requestedAgents) {
    try {
      console.log(`Running agent ${agent.name}`);
      const findings = await runAgentWithAPI(agent, topic, { skipDigestGeneration: true });
      allFindings.push(...findings);
    } catch (error) {
      console.error(`Agent ${agent.name} failed:`, error);
      // Continue with other agents even if one fails
    }
  }

  // Trigger digest generation once AFTER all requested agents have completed
  if (allFindings.length > 0) {
    try {
      console.log(`Queueing digest generation after ${requestedAgents.length} agents completed`);
      await digestQueueService.queueDigestFromExistingFindings(topicId, 'weekly');
      console.log('✅ Digest queued after specific agents completed');
    } catch (digestError) {
      console.error('Failed to queue digest after specific agent run:', digestError);
    }
  }

  return allFindings;
}

/**
 * Get or create default agents for a topic
 */
export async function ensureDefaultAgents(topicId: string): Promise<Agent[]> {
  const existingAgents = await agentsService.getAgents(topicId);

  if (existingAgents.length > 0) {
    return existingAgents;
  }

  // Create default agents if none exist
  const topic = await topicsService.getTopic(topicId);
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  // Use the service to create default agents
  const newAgents = await agentsService.createDefaultAgents(topicId);

  console.log(`Created ${newAgents.length} default agents for topic ${topicId}`);
  return newAgents;
}