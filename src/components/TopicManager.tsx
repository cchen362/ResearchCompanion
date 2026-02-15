import { useState, useEffect } from 'react';
import { topicsService } from '@/services/topics.service';
import { agentsService } from '@/services/agents.service';
import { logger } from '@/utils/logger';
import type { Topic, DiseaseProfile, PatientContext } from '@/types';

interface TopicManagerProps {
  topics: Topic[];
  setTopics: (topics: Topic[]) => void;
  selectedTopic: Topic | null;
  setSelectedTopic: (topic: Topic | null) => void;
}

export default function TopicManager({ topics, setTopics, selectedTopic, setSelectedTopic }: TopicManagerProps) {
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (topics.length > 0) {
      const loadAgentCounts = async () => {
        const counts: Record<string, number> = {};
        const results = await Promise.all(
          topics.map(async (topic) => {
            const agents = await agentsService.getAgents(topic.id);
            return { topicId: topic.id, count: agents.length };
          })
        );
        results.forEach(({ topicId, count }) => { counts[topicId] = count; });
        setAgentCounts(counts);
      };
      loadAgentCounts();
    }
  }, [topics]);

  const loadTopics = async () => {
    try {
      const allTopics = await topicsService.getTopics();
      setTopics(allTopics);

      const counts: Record<string, number> = {};
      const results = await Promise.all(
        allTopics.map(async (topic) => {
          const agents = await agentsService.getAgents(topic.id);
          return { topicId: topic.id, count: agents.length };
        })
      );
      results.forEach(({ topicId, count }) => { counts[topicId] = count; });
      setAgentCounts(counts);
    } catch (error) {
      logger.error('[TopicManager] Error loading topics:', error);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this topic and all associated data?\n\nThis will permanently delete:\n• All research findings\n• All digests\n• All agents\n• All chat conversations\n• All associated data\n\nThis action cannot be undone.')) {
      try {
        logger.debug(`[TopicManager] Deleting topic ${id}`);
        await topicsService.deleteTopic(id);

        // Notify other components that the topic was deleted
        window.dispatchEvent(new CustomEvent('topic-deleted', { detail: { topicId: id } }));

        // Reload topics to reflect the deletion
        await loadTopics();

        logger.debug(`[TopicManager] Successfully deleted topic ${id}`);
      } catch (error) {
        logger.error('[TopicManager] Failed to delete topic:', error);
        alert('Failed to delete topic. Please try again or check the console for details.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--color-surface)] shadow-sm rounded-lg px-4 py-5 sm:px-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-[var(--color-text-primary)]">Disease Topics</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Manage the diseases and conditions you're monitoring
            </p>
          </div>
          <button
            onClick={() => setShowNewTopicForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Add Topic
          </button>
        </div>
      </div>

      {/* Topics Grid */}
      {topics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)]">No topics yet. Add a disease topic to start monitoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {topics.map(topic => (
            <div key={topic.id} className="rounded-lg border border-[var(--color-border-muted)] shadow-sm bg-[var(--color-surface)] hover:shadow-md transition-shadow p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary-600">
                    {topic.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{topic.name}</div>
                  <div className="text-sm text-[var(--color-text-muted)] truncate">{topic.diseaseProfile.name}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {topic.patientContext && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 capitalize">
                    {topic.patientContext.ageGroup}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700">
                  {agentCounts[topic.id] || 0} agents
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border-muted)] flex justify-end gap-2">
                <button
                  onClick={() => setEditingTopic(topic)}
                  className="text-primary-600 hover:text-primary-900 text-sm font-medium"
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
          ))}
        </div>
      )}

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

      if (!topic || !topic.id) {
        throw new Error('Topic was not created properly - no ID returned');
      }

      // Create default agents for the topic using backend's single source of truth
      // Backend defines all 3 agent types: treatment_breakthrough, clinical_trial, medical_literature
      try {
        await agentsService.createDefaultAgents(topic.id);
        logger.debug(`[TopicManager] Created default agents for topic ${topic.id}`);
      } catch (agentError) {
        logger.error('[TopicManager] Error creating default agents:', agentError);
        // Don't fail topic creation if agents fail - they can be repaired later
      }

      onSuccess();
    } catch (error) {
      logger.error('[TopicManager] Error creating topic:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create topic: ${errorMessage}\n\nPlease check:\n1. Backend server is running\n2. You are logged in (if using server storage)\n3. Network connection is working`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Add New Disease Topic</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Topic Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
              placeholder="e.g., My Child's Condition"
              required
            />
          </div>

          <div>
            <label htmlFor="disease" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Disease Name
            </label>
            <input
              type="text"
              id="disease"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
              placeholder="e.g., Mitochondrial Disease"
              required
            />
          </div>

          <div>
            <label htmlFor="progression" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              How Often to Check for Updates
            </label>
            <select
              id="progression"
              value={progressionRate}
              onChange={(e) => setProgressionRate(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
            >
              <option value="rapid">Hourly (Fast-changing conditions)</option>
              <option value="moderate">Daily (Most conditions)</option>
              <option value="slow">Weekly (Stable conditions)</option>
              <option value="variable">Adaptive (Let AI decide)</option>
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              This controls how frequently agents search for new research
            </p>
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Patient Age Group
            </label>
            <select
              id="age"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
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
              className="px-4 py-2 border border-[var(--color-border)] rounded-md shadow-sm text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
      logger.error('[TopicManager] Error updating topic:', error);
      alert('Failed to update topic. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Edit Disease Topic</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Topic Name
            </label>
            <input
              type="text"
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
              placeholder="e.g., My Child's Condition"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-disease" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Disease Name
            </label>
            <input
              type="text"
              id="edit-disease"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
              placeholder="e.g., Mitochondrial Disease"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-progression" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              How Often to Check for Updates
            </label>
            <select
              id="edit-progression"
              value={progressionRate}
              onChange={(e) => setProgressionRate(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
            >
              <option value="rapid">Hourly (Fast-changing conditions)</option>
              <option value="moderate">Daily (Most conditions)</option>
              <option value="slow">Weekly (Stable conditions)</option>
              <option value="variable">Adaptive (Let AI decide)</option>
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              This controls how frequently agents search for new research
            </p>
          </div>

          <div>
            <label htmlFor="edit-age" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Patient Age Group
            </label>
            <select
              id="edit-age"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
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
              className="px-4 py-2 border border-[var(--color-border)] rounded-md shadow-sm text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating...' : 'Update Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}