import { useEffect, useState } from 'react';
import { getAllTopics, getTopicsNeedingUpdate } from '@/utils/db/topics';
import { getAgentsToRun } from '@/utils/db/agents';
import { getMonthlyApiCost } from '@/utils/db/agents';
import type { Topic, Agent, ResearchFinding } from '@/types';
import { getDB } from '@/utils/db/database';

export default function Dashboard() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [pendingAgents, setPendingAgents] = useState<Agent[]>([]);
  const [recentFindings, setRecentFindings] = useState<ResearchFinding[]>([]);
  const [monthlyCost, setMonthlyCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
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