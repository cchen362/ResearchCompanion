import { useState, useEffect } from 'react';
import { getDB } from '@/utils/db/database';
import { getAgentsToRun, setAgentStatus } from '@/utils/db/agents';
import { runAgentWithAPI } from '@/services/agentRunner';
import { getTopic } from '@/utils/db/topics';
import AgentConfigModal from './AgentConfigModal';
import { useUIStore } from '@/stores/uiStore';
import type { Agent } from '@/types';

export default function AgentMonitor() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningAllProgress, setRunningAllProgress] = useState({ current: 0, total: 0 });
  const showToast = useUIStore(state => state.showToast);

  useEffect(() => {
    loadAgents();
    // Refresh every 30 seconds
    const interval = setInterval(loadAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAgents = async () => {
    try {
      const db = await getDB();
      const allAgents = await db.getAll('agents');
      setAgents(allAgents);
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgent = async (agent: Agent) => {
    try {
      setRunningAgentId(agent.id);
      const topic = await getTopic(agent.topicId);

      if (!topic) {
        throw new Error('Topic not found');
      }

      showToast({
        type: 'info',
        message: `Running ${agent.name}...`,
        duration: 3000
      });

      const findings = await runAgentWithAPI(agent, topic);

      showToast({
        type: 'success',
        message: `Agent completed successfully! Found ${findings.length} new findings.`,
        duration: 5000
      });

      await loadAgents();
    } catch (error) {
      console.error('Error running agent:', error);
      showToast({
        type: 'error',
        message: 'Failed to run agent. Check console for details.',
        duration: 5000
      });
    } finally {
      setRunningAgentId(null);
    }
  };

  const handleRunAllPending = async () => {
    const pendingAgents = await getAgentsToRun();

    if (pendingAgents.length === 0) {
      // No agents to run - show informative message
      showToast({
        type: 'info',
        message: 'No pending agents to run. Agents run automatically when scheduled.',
        duration: 4000
      });
      return;
    }

    setIsRunningAll(true);
    setRunningAllProgress({ current: 0, total: pendingAgents.length });

    showToast({
      type: 'info',
      message: `Starting to run ${pendingAgents.length} agent${pendingAgents.length > 1 ? 's' : ''}...`,
      duration: 3000
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingAgents.length; i++) {
      const agent = pendingAgents[i];
      setRunningAllProgress({ current: i + 1, total: pendingAgents.length });

      const topic = await getTopic(agent.topicId);
      if (topic) {
        try {
          showToast({
            type: 'info',
            message: `Running ${agent.name} (${i + 1}/${pendingAgents.length})...`,
            duration: 2000
          });
          await runAgentWithAPI(agent, topic);
          successCount++;
        } catch (error) {
          console.error(`Failed to run agent ${agent.id}:`, error);
          failCount++;
        }
      }
    }

    await loadAgents();
    setIsRunningAll(false);
    setRunningAllProgress({ current: 0, total: 0 });

    // Show final result
    if (failCount === 0) {
      showToast({
        type: 'success',
        message: `Successfully ran all ${successCount} agent${successCount > 1 ? 's' : ''}!`,
        duration: 5000
      });
    } else {
      showToast({
        type: 'warning',
        message: `Completed: ${successCount} succeeded, ${failCount} failed.`,
        duration: 5000
      });
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
        return 'bg-gray-100 text-gray-800';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg px-4 py-5 sm:px-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">Autonomous Agents</h2>
            <p className="mt-1 text-sm text-gray-500">
              Monitor and manage your research agents
            </p>
          </div>
          <button
            onClick={handleRunAllPending}
            disabled={isRunningAll}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-2">{getTypeIcon(agent.type)}</span>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{agent.name}</h3>
                  <p className="text-xs text-gray-500">
                    {agent.type.split('_').map(word =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{agent.description}</p>

              <div className="space-y-2 text-xs text-gray-500">
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
                  className="flex-1 inline-flex justify-center items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
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
                  className="flex-1 inline-flex justify-center items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Configure
                </button>
              </div>

              {agent.learningProfile && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Learning Profile</p>
                  <div className="space-y-1 text-xs text-gray-500">
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
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No agents configured yet. Add a topic to create agents automatically.</p>
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