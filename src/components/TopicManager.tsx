import { useState, useEffect } from 'react';
import { topicsService } from '@/services/topics.service';
import { agentsService } from '@/services/agents.service';
import type { Topic, DiseaseProfile, PatientContext, AgentType } from '@/types';

interface TopicManagerProps {
  onTopicsChange?: () => void;
}

export default function TopicManager({ onTopicsChange }: TopicManagerProps = {}) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const allTopics = await topicsService.getTopics();
      setTopics(allTopics);

      // Fetch agent counts for each topic
      const counts: Record<string, number> = {};
      for (const topic of allTopics) {
        const agents = await agentsService.getAgents(topic.id);
        counts[topic.id] = agents.length;
      }
      setAgentCounts(counts);

      // Notify parent component about topics change
      if (onTopicsChange) {
        onTopicsChange();
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this topic and all associated data?')) {
      await topicsService.deleteTopic(id);
      await loadTopics();
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
            <h2 className="text-lg leading-6 font-medium text-gray-900">Disease Topics</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage the diseases and conditions you're monitoring
            </p>
          </div>
          <button
            onClick={() => setShowNewTopicForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add Topic
          </button>
        </div>
      </div>

      {/* Topics List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {topics.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No topics yet. Add a disease topic to start monitoring.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {topics.map(topic => (
              <li key={topic.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {topic.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                          <div className="text-sm text-gray-500">{topic.diseaseProfile.name}</div>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex sm:space-x-4">
                          {topic.patientContext && (
                            <p className="flex items-center text-sm text-gray-500">
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded capitalize">
                                {topic.patientContext.ageGroup}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>{agentCounts[topic.id] || 0} agents</p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex space-x-2">
                      <button
                        onClick={() => setEditingTopic(topic)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="text-red-600 hover:text-red-900 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New Topic Form Modal */}
      {showNewTopicForm && (
        <NewTopicForm
          onClose={() => setShowNewTopicForm(false)}
          onSuccess={() => {
            setShowNewTopicForm(false);
            loadTopics();
          }}
        />
      )}

      {/* Edit Topic Form Modal */}
      {editingTopic && (
        <EditTopicForm
          topic={editingTopic}
          onClose={() => setEditingTopic(null)}
          onSuccess={() => {
            setEditingTopic(null);
            loadTopics();
          }}
        />
      )}
    </div>
  );
}

function NewTopicForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [diseaseName, setDiseaseName] = useState('');
  const [progressionRate, setProgressionRate] = useState<'rapid' | 'moderate' | 'slow' | 'variable'>('moderate');
  const [ageGroup, setAgeGroup] = useState<'pediatric' | 'adolescent' | 'adult' | 'elderly'>('adult');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !diseaseName) return;

    setCreating(true);
    try {
      const diseaseProfile: DiseaseProfile = {
        name: diseaseName,
        rareDisease: false, // Default to false
        progressionRate,
        category: ['genetic'] // Default, could be expanded
      };

      const patientContext: PatientContext = {
        ageGroup,
        currentStage: 'monitoring'
      };

      // Create topic object
      const topicData: Topic = {
        id: '', // Will be assigned by server
        name,
        diseaseProfile,
        patientContext,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const topic = await topicsService.saveTopic(topicData);

      // Create default agents for the topic
      const agentTypes: AgentType[] = ['treatment_breakthrough', 'clinical_trial'];

      for (const type of agentTypes) {
        await agentsService.saveAgent({
          id: '', // Will be assigned by server
          topicId: topic.id,
          name: `${type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Agent`,
          type,
          status: 'idle',
          config: {
            updateFrequency: progressionRate === 'rapid' ? 'hourly' :
                           progressionRate === 'moderate' ? 'daily' : 'weekly',
            searchDepth: 10,
            sources: [],
            keywords: []
          },
          lastRun: null,
          createdAt: Date.now(),
          metrics: {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            findingsGenerated: 0,
            lastSuccessAt: null,
            lastErrorAt: null,
            lastError: null,
            apiCostTotal: 0
          }
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating topic:', error);
      alert('Failed to create topic. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Disease Topic</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Topic Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="e.g., My Child's Condition"
              required
            />
          </div>

          <div>
            <label htmlFor="disease" className="block text-sm font-medium text-gray-700">
              Disease Name
            </label>
            <input
              type="text"
              id="disease"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="e.g., Mitochondrial Disease"
              required
            />
          </div>

          <div>
            <label htmlFor="progression" className="block text-sm font-medium text-gray-700">
              How Often to Check for Updates
            </label>
            <select
              id="progression"
              value={progressionRate}
              onChange={(e) => setProgressionRate(e.target.value as any)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="rapid">Hourly (Fast-changing conditions)</option>
              <option value="moderate">Daily (Most conditions)</option>
              <option value="slow">Weekly (Stable conditions)</option>
              <option value="variable">Adaptive (Let AI decide)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              This controls how frequently agents search for new research
            </p>
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700">
              Patient Age Group
            </label>
            <select
              id="age"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as any)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="pediatric">Pediatric</option>
              <option value="adolescent">Adolescent</option>
              <option value="adult">Adult</option>
              <option value="elderly">Elderly</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTopicForm({ topic, onClose, onSuccess }: { topic: Topic; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(topic.name);
  const [diseaseName, setDiseaseName] = useState(topic.diseaseProfile.name);
  const [progressionRate, setProgressionRate] = useState<'rapid' | 'moderate' | 'slow' | 'variable'>(topic.diseaseProfile.progressionRate);
  const [ageGroup, setAgeGroup] = useState<'pediatric' | 'adolescent' | 'adult' | 'elderly'>(topic.patientContext?.ageGroup || 'adult');
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !diseaseName) return;

    setUpdating(true);
    try {
      const updatedTopic: Topic = {
        ...topic,
        name,
        diseaseProfile: {
          ...topic.diseaseProfile,
          name: diseaseName,
          rareDisease: topic.diseaseProfile.rareDisease, // Keep existing value
          progressionRate
        },
        patientContext: {
          ...topic.patientContext,
          ageGroup,
          currentStage: topic.patientContext?.currentStage || 'monitoring'
        }
      };

      await topicsService.updateTopicById(topic.id, updatedTopic);
      onSuccess();
    } catch (error) {
      console.error('Error updating topic:', error);
      alert('Failed to update topic. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Disease Topic</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
              Topic Name
            </label>
            <input
              type="text"
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="e.g., My Child's Condition"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-disease" className="block text-sm font-medium text-gray-700">
              Disease Name
            </label>
            <input
              type="text"
              id="edit-disease"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="e.g., Mitochondrial Disease"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-progression" className="block text-sm font-medium text-gray-700">
              How Often to Check for Updates
            </label>
            <select
              id="edit-progression"
              value={progressionRate}
              onChange={(e) => setProgressionRate(e.target.value as any)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="rapid">Hourly (Fast-changing conditions)</option>
              <option value="moderate">Daily (Most conditions)</option>
              <option value="slow">Weekly (Stable conditions)</option>
              <option value="variable">Adaptive (Let AI decide)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              This controls how frequently agents search for new research
            </p>
          </div>

          <div>
            <label htmlFor="edit-age" className="block text-sm font-medium text-gray-700">
              Patient Age Group
            </label>
            <select
              id="edit-age"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as any)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="pediatric">Pediatric</option>
              <option value="adolescent">Adolescent</option>
              <option value="adult">Adult</option>
              <option value="elderly">Elderly</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating...' : 'Update Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}