/**
 * useTopics - Hook for topics data and selection
 *
 * Phase 2 Refactoring: Wraps researchStore and uiStore for topic management.
 *
 * Key principles:
 * 1. Single source of truth from researchStore
 * 2. Loading state from uiStore (centralized)
 * 3. Auto-load topics on mount (with hydration gate)
 * 4. No useState - all state comes from stores
 *
 * Usage:
 * ```typescript
 * function TopicSelector() {
 *   const {
 *     topics,
 *     selectedTopicId,
 *     selectedTopic,
 *     selectTopic,
 *     isLoading
 *   } = useTopics();
 *
 *   return (
 *     <select value={selectedTopicId} onChange={(e) => selectTopic(e.target.value)}>
 *       {topics.map(topic => (
 *         <option key={topic.id} value={topic.id}>{topic.name}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect } from 'react';
import { useResearchStore } from '@/stores/researchStore';
import { useUIStore } from '@/stores/uiStore';
import { useStoreHydration } from './useStoreHydration';
import { topicsService } from '@/services/topics.service';
import { logger } from '@/utils/logger';
import type { Topic } from '@/types';

interface UseTopicsReturn {
  // Data
  topics: Topic[];
  totalCount: number;

  // Selection
  selectedTopicId: string | null;
  selectedTopic: Topic | null;
  selectTopic: (topicId: string | null) => void;

  // Loading state
  isLoading: boolean;

  // Actions
  loadTopics: () => Promise<void>;
  refreshTopics: () => Promise<void>;
  createTopic: (topic: Partial<Topic>) => Promise<Topic | null>;
  updateTopic: (id: string, updates: Partial<Topic>) => Promise<Topic | null>;
  deleteTopic: (id: string) => Promise<boolean>;
}

/**
 * Hook for managing topics.
 *
 * @param autoLoad - If true, automatically load topics on mount (default: true)
 */
export function useTopics(autoLoad = true): UseTopicsReturn {
  // Check hydration status
  const isHydrated = useStoreHydration();

  // Get store state and actions
  const {
    topics,
    selectedTopicId,
    getSelectedTopic,
    selectTopic,
    loadTopics: loadTopicsFromStore
  } = useResearchStore();

  const { loading, setLoading } = useUIStore();

  // Get selected topic object
  const selectedTopic = getSelectedTopic();

  /**
   * Load topics from server
   */
  const loadTopics = useCallback(async () => {
    setLoading('topics', true);
    try {
      await loadTopicsFromStore();
    } finally {
      setLoading('topics', false);
    }
  }, [loadTopicsFromStore, setLoading]);

  /**
   * Refresh topics (same as load)
   */
  const refreshTopics = useCallback(async () => {
    await loadTopics();
  }, [loadTopics]);

  /**
   * Create a new topic
   */
  const createTopic = useCallback(async (topicData: Partial<Topic>): Promise<Topic | null> => {
    try {
      const newTopic = await topicsService.createTopic(topicData);
      if (newTopic) {
        // Reload topics to get the new one
        await loadTopicsFromStore();
      }
      return newTopic;
    } catch (error) {
      logger.error('[useTopics] Error creating topic:', error);
      return null;
    }
  }, [loadTopicsFromStore]);

  /**
   * Update an existing topic
   */
  const updateTopic = useCallback(async (
    id: string,
    updates: Partial<Topic>
  ): Promise<Topic | null> => {
    try {
      const updatedTopic = await topicsService.updateTopic(id, updates);
      if (updatedTopic) {
        // Reload topics to get the updated data
        await loadTopicsFromStore();
      }
      return updatedTopic;
    } catch (error) {
      logger.error('[useTopics] Error updating topic:', error);
      return null;
    }
  }, [loadTopicsFromStore]);

  /**
   * Delete a topic
   */
  const deleteTopic = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await topicsService.deleteTopic(id);
      if (success) {
        // Clear selection if this topic was selected
        if (selectedTopicId === id) {
          selectTopic(null);
        }
        // Reload topics
        await loadTopicsFromStore();
      }
      return success;
    } catch (error) {
      logger.error('[useTopics] Error deleting topic:', error);
      return false;
    }
  }, [selectedTopicId, selectTopic, loadTopicsFromStore]);

  // Auto-load topics on mount if enabled
  useEffect(() => {
    if (!autoLoad) return;
    if (!isHydrated) return; // Wait for hydration

    // Only load if we don't have topics yet
    if (topics.length === 0 && !loading.topics) {
      loadTopics();
    }
  }, [autoLoad, isHydrated, topics.length, loading.topics, loadTopics]);

  return {
    // Data
    topics,
    totalCount: topics.length,

    // Selection
    selectedTopicId,
    selectedTopic,
    selectTopic,

    // Loading state
    isLoading: loading.topics,

    // Actions
    loadTopics,
    refreshTopics,
    createTopic,
    updateTopic,
    deleteTopic
  };
}
