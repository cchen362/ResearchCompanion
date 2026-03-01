import { useState, useEffect } from 'react';
import { agentsService } from '@/services/agents.service';
import { longOperationApi } from '@/services/api';
import { topicsService } from '@/services/topics.service';
import AgentConfigModal from './AgentConfigModal';
import { notificationService } from '@/services/notification.service';
import { SourceIcon } from '@/components/digest/SourceIcon';
import { logger } from '@/utils/logger';
import type { Agent, DigestSourceType, Topic } from '@/types';

const AGENT_TYPE_CONFIG: Record<string, {
  sourceTypes: DigestSourceType[];
  description: string;
}> = {
  medical_literature: {
    sourceTypes: ['pubmed'],
    description: 'Searches PubMed for peer-reviewed studies and review articles',
  },
  clinical_trial: {
    sourceTypes: ['clinical_trial'],
    description: 'Monitors ClinicalTrials.gov for active and recruiting trials',
  },
  treatment_breakthrough: {
    sourceTypes: ['web', 'fda'],
    description: 'Searches web and FDA for emerging treatments and drug approvals',
  },
  pattern_recognition: {
    sourceTypes: [],
    description: 'Analyzes existing findings to detect recurring patterns',
  },
};

interface AgentMonitorProps {
  topics?: Topic[];
  selectedTopic?: Topic | null;
}

export default function AgentMonitor({ topics: passedTopics, selectedTopic }: AgentMonitorProps = {}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [topics, setTopics] = useState<Map<string, string>>(new Map()); // topicId -> topic name
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningAllProgress, setRunningAllProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadAgents();
    // Refresh every 30 seconds
    const interval = setInterval(loadAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAgents = async () => {
    try {
      const allAgents = await agentsService.getAgents();
      setAgents(allAgents);

      // Load topic names for each unique topicId
      const uniqueTopicIds = [...new Set(allAgents.map(a => a.topicId).filter(Boolean))];
      const topicMap = new Map<string, string>();

      if (passedTopics && passedTopics.length > 0) {
        for (const t of passedTopics) {
          topicMap.set(t.id, t.name);
        }
      } else {
        await Promise.all(uniqueTopicIds.map(async (topicId) => {
          try {
            const topic = await topicsService.getTopic(topicId);
            if (topic) topicMap.set(topicId, topic.name);
          } catch (error) {
            logger.error(`Error loading topic ${topicId}:`, error);
          }
        }));
      }

      setTopics(topicMap);
    } catch (error) {
      logger.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgent = async (agent: Agent) => {
    try {
      setRunningAgentId(agent.id);

      const response = await longOperationApi.post(`/agents/run/${agent.topicId}`);
      const { findingsCount = 0 } = response.data;

      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'Agents Complete',
        message: `Found ${findingsCount} new finding${findingsCount !== 1 ? 's' : ''} for ${topics.get(agent.topicId) || 'your topic'}`,
        priority: findingsCount > 10 ? 'high' : 'medium',
        data: { topicId: agent.topicId, findingsCount }
      });

      window.dispatchEvent(new CustomEvent('agent-complete', {
        detail: { topicId: agent.topicId, findingsCount }
      }));

      await loadAgents();
    } catch (error) {
      logger.error('Error running agent:', error);
      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'Agent Run Failed',
        message: 'Agent run failed. Please try again or check settings.',
        priority: 'high'
      });
    } finally {
      setRunningAgentId(null);
    }
  };

  const handleRunAllPending = async () => {
    const allAgents = await agentsService.getAgents();
    const topicIds = [...new Set(allAgents.filter(a => a.status !== 'disabled').map(a => a.topicId).filter(Boolean))];

    if (topicIds.length === 0) return;

    setIsRunningAll(true);
    setRunningAllProgress({ current: 0, total: topicIds.length });

    try {
      let totalFindings = 0;

      for (let i = 0; i < topicIds.length; i++) {
        try {
          const response = await longOperationApi.post(`/agents/run/${topicIds[i]}`);
          totalFindings += response.data.findingsCount || 0;
        } catch (error) {
          logger.error(`Error running agents for topic ${topicIds[i]}:`, error);
        }
        setRunningAllProgress({ current: i + 1, total: topicIds.length });
      }

      await loadAgents();

      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'All Agents Complete',
        message: `Found ${totalFindings} new finding${totalFindings !== 1 ? 's' : ''}.`,
        priority: totalFindings > 10 ? 'high' : 'medium'
      });

      window.dispatchEvent(new CustomEvent('agent-complete', {
        detail: { findingsCount: totalFindings }
      }));
    } catch (error) {
      logger.error('Error running agents:', error);
      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'Agent Run Failed',
        message: 'Failed to run agents. Please try again or check settings.',
        priority: 'high'
      });
      await loadAgents();
    } finally {
      setIsRunningAll(false);
      setRunningAllProgress({ current: 0, total: 0 });
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]';
    }
  };

  const getTypeIcon = (type: Agent['type']) => {
    switch (type) {
      case 'treatment_breakthrough':
        return '💊';
      case 'clinical_trial':
        return '🔬';
      case 'medical_literature':
        return '📚';
      case 'pattern_recognition':
        return '🔍';
      default:
        return '🤖';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--color-surface)] shadow-sm rounded-lg px-4 py-5 sm:px-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-[var(--color-text-primary)]">Autonomous Agents</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Monitor and manage your research agents
            </p>
          </div>
          <button
            onClick={handleRunAllPending}
            disabled={isRunningAll}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isRunningAll ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {runningAllProgress.total > 0
                  ? `Running (${runningAllProgress.current}/${runningAllProgress.total})...`
                  : 'Starting...'}
              </>
            ) : (
              'Run All Pending'
            )}
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-[var(--color-surface)] shadow-sm rounded-lg overflow-hidden border border-[var(--color-border-muted)]">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-2">{getTypeIcon(agent.type)}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{agent.name}</h3>
                  {AGENT_TYPE_CONFIG[agent.type]?.sourceTypes.length > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {AGENT_TYPE_CONFIG[agent.type].sourceTypes.map(st => (
                        <SourceIcon key={st} type={st} size="sm" showLabel />
                      ))}
                    </div>
                  )}
                  {topics.get(agent.topicId) && (
                    <p className="text-xs text-primary-600 mt-1">
                      Monitoring: {topics.get(agent.topicId)}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {agent.description || AGENT_TYPE_CONFIG[agent.type]?.description || ''}
              </p>

              <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
                <div className="flex justify-between">
                  <span>Update Frequency:</span>
                  <span className="font-medium">{agent.config.updateFrequency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Priority:</span>
                  <span className="font-medium">{agent.config.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span>Search Depth:</span>
                  <span className="font-medium">{agent.config.searchDepth}</span>
                </div>
                {agent.lastRun && (
                  <div className="flex justify-between">
                    <span>Last Run:</span>
                    <span className="font-medium">
                      {new Date(agent.lastRun).toLocaleString()}
                    </span>
                  </div>
                )}
                {agent.nextScheduledRun && (
                  <div className="flex justify-between">
                    <span>Next Run:</span>
                    <span className="font-medium">
                      {new Date(agent.nextScheduledRun).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => handleRunAgent(agent)}
                  disabled={agent.status === 'running' || runningAgentId === agent.id || isRunningAll}
                  className="flex-1 inline-flex justify-center items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
                >
                  {runningAgentId === agent.id ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Running...
                    </>
                  ) : isRunningAll ? (
                    'Waiting...'
                  ) : (
                    'Run Now'
                  )}
                </button>
                <button
                  onClick={() => setConfiguringAgent(agent)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-1 border border-[var(--color-border)] text-xs font-medium rounded-md text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Configure
                </button>
              </div>

              {agent.learningProfile && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Learning Profile</p>
                  <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
                    <div className="flex justify-between">
                      <span>Click Rate:</span>
                      <span>{(agent.learningProfile.userInteractionPatterns.clickRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Preferred Sources:</span>
                      <span className="text-right truncate ml-2">
                        {agent.learningProfile.preferredSources.slice(0, 2).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12 bg-[var(--color-surface)] rounded-lg shadow-sm border border-[var(--color-border-muted)]">
          <p className="text-[var(--color-text-muted)]">No agents configured yet. Add a topic to create agents automatically.</p>
        </div>
      )}

      {configuringAgent && (
        <AgentConfigModal
          agent={configuringAgent}
          onClose={() => setConfiguringAgent(null)}
          onUpdate={loadAgents}
        />
      )}
    </div>
  );
}