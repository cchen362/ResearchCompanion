import { useEffect, useState } from 'react';
import { getAllTopics, getTopicsNeedingUpdate } from '@/utils/db/topics';
import { getAgentsToRun } from '@/utils/db/agents';
import { getMonthlyApiCost } from '@/utils/db/agents';
import type { Topic, Agent, ResearchFinding } from '@/types';
import { getDB } from '@/utils/db/database';
import { Search, FileText, Bot, MessageSquare, TrendingUp, Plus } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

interface DashboardProps {
  setCurrentView?: (view: string) => void;
}

export default function Dashboard({ setCurrentView }: DashboardProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [pendingAgents, setPendingAgents] = useState<Agent[]>([]);
  const [recentFindings, setRecentFindings] = useState<ResearchFinding[]>([]);
  const [monthlyCost, setMonthlyCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const showToast = useUIStore(state => state.showToast);
  const setChatPanelOpen = useUIStore(state => state.setChatPanelOpen);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load topics
      const allTopics = await getAllTopics();
      setTopics(allTopics);

      // Load pending agents
      const agentsToRun = await getAgentsToRun();
      setPendingAgents(agentsToRun);

      // Load recent findings
      const db = await getDB();
      const findings = await db.getAllFromIndex('findings', 'by-date');
      const recent = findings.slice(-5).reverse(); // Last 5, most recent first
      setRecentFindings(recent);

      // Load monthly cost
      const cost = await getMonthlyApiCost();
      setMonthlyCost(cost);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Calculate some insights
  const newFindingsCount = recentFindings.filter(f => f.isNew).length;
  const hasNewFindings = newFindingsCount > 0;
  const needsAttention = pendingAgents.length > 3 || monthlyCost > 15;

  return (
    <div className="space-y-6">
      {/* Insights Banner - Only show if there's something to highlight */}
      {(hasNewFindings || pendingAgents.length > 0 || needsAttention) && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Welcome back!</h2>
              <div className="mt-1 text-sm text-gray-600 space-y-1">
                {hasNewFindings && (
                  <p>• You have {newFindingsCount} new finding{newFindingsCount > 1 ? 's' : ''} since your last visit</p>
                )}
                {pendingAgents.length > 0 && (
                  <p>• {pendingAgents.length} agent{pendingAgents.length > 1 ? 's are' : ' is'} ready to run</p>
                )}
                {monthlyCost > 15 && monthlyCost <= 20 && (
                  <p>• API usage is approaching monthly budget (${monthlyCost.toFixed(2)}/$20.00)</p>
                )}
                {monthlyCost > 20 && (
                  <p className="text-red-600">• Monthly budget exceeded (${monthlyCost.toFixed(2)}/$20.00)</p>
                )}
              </div>
            </div>
            {hasNewFindings && (
              <button
                onClick={() => {
                  if (setCurrentView) {
                    setCurrentView('findings');
                  }
                }}
                className="ml-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                View New Findings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Active Topics</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{topics.length}</dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Agents Pending</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{pendingAgents.length}</dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">New Findings</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {recentFindings.filter(f => f.isNew).length}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Monthly Cost</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ${monthlyCost.toFixed(2)}
            </dd>
            <div className="mt-2">
              <div className="text-xs text-gray-500">Budget: $20.00</div>
              <div className="mt-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    monthlyCost > 20 ? 'bg-red-600' : monthlyCost > 15 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((monthlyCost / 20) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <button
              onClick={() => {
                if (setCurrentView) {
                  setCurrentView('topics');
                }
              }}
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-8 w-8 text-indigo-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Add Topic</span>
            </button>

            <button
              onClick={() => {
                if (setCurrentView) {
                  setCurrentView('findings');
                }
              }}
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FileText className="h-8 w-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">View Findings</span>
            </button>

            <button
              onClick={() => {
                if (setCurrentView) {
                  setCurrentView('agents');
                }
              }}
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bot className="h-8 w-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Manage Agents</span>
            </button>

            <button
              onClick={() => {
                setChatPanelOpen(true);
                showToast({
                  type: 'info',
                  message: 'Chat panel opened',
                  duration: 2000
                });
              }}
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <MessageSquare className="h-8 w-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Open Chat</span>
            </button>

            <button
              onClick={async () => {
                if (pendingAgents.length > 0) {
                  showToast({
                    type: 'info',
                    message: `${pendingAgents.length} agents are ready to run. Go to Agents page to run them.`,
                    duration: 4000
                  });
                  if (setCurrentView) {
                    setCurrentView('agents');
                  }
                } else {
                  showToast({
                    type: 'info',
                    message: 'No agents pending. They run automatically when scheduled.',
                    duration: 3000
                  });
                }
              }}
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors relative"
            >
              <Search className="h-8 w-8 text-orange-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Run Research</span>
              {pendingAgents.length > 0 && (
                <span className="absolute top-3 right-3 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            <button
              onClick={() => {
                // Navigate to Analytics page (was incorrectly going to timeline)
                if (setCurrentView) {
                  setCurrentView('analytics');
                }
              }}
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <TrendingUp className="h-8 w-8 text-cyan-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">View Insights</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Findings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Research Findings</h3>
          {recentFindings.length === 0 ? (
            <p className="text-gray-500 text-sm">No findings yet. Add topics and run agents to see research.</p>
          ) : (
            <div className="space-y-4">
              {recentFindings.map(finding => (
                <div key={finding.id} className="border-l-4 border-indigo-500 pl-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{finding.title}</h4>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{finding.summary}</p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span className="font-medium">{finding.source.displayName || finding.source.name}</span>
                        <span>{finding.type}</span>
                        <span>{new Date(finding.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {finding.isNew && (
                      <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        New
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Topics Overview */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Active Topics</h3>
          {topics.length === 0 ? (
            <p className="text-gray-500 text-sm">No topics yet. Add a disease topic to start monitoring.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map(topic => (
                <div key={topic.id} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900">{topic.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{topic.diseaseProfile.name}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      topic.diseaseProfile.progressionRate === 'rapid' ? 'bg-red-100 text-red-800' :
                      topic.diseaseProfile.progressionRate === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {topic.diseaseProfile.progressionRate} progression
                    </span>
                    <span className="text-xs text-gray-500">
                      {topic.agents.length} agents
                    </span>
                  </div>
                  {topic.lastAgentRun && (
                    <p className="mt-2 text-xs text-gray-500">
                      Last update: {new Date(topic.lastAgentRun).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}