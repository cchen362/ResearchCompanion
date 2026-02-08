/**
 * Topics Service - Consolidated
 *
 * Merged from:
 * - topics.service.ts (original)
 * - topics.api.service.ts (207 lines)
 * - utils/db/topics.ts (281 lines) - selective functions
 *
 * Architecture: Server-first with IndexedDB cache
 * Pattern: Singleton service with event-based communication
 */

import { api } from '@/services/api';
import { getDB } from '@/utils/db/database';
import { storageConfig } from '@/config/storage.config';
import { logger } from '@/utils/logger';
import type { Topic, DiseaseProfile, PatientContext } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface TopicsResponse {
  success: boolean;
  topics: Topic[];
}

interface TopicResponse {
  success: boolean;
  topic: Topic;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a unique UUID (compatible with PostgreSQL UUID type)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// TOPICS SERVICE CLASS
// ============================================================================

class TopicsService {
  private static instance: TopicsService;
  private baseUrl = '/topics';

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): TopicsService {
    if (!TopicsService.instance) {
      TopicsService.instance = new TopicsService();
    }
    return TopicsService.instance;
  }

  private get useServerStorage(): boolean {
    return storageConfig.useServerStorage;
  }

  // ==========================================================================
  // TRANSFORMATION HELPERS
  // ==========================================================================

  /**
   * Transform API response topic to match frontend Topic interface
   */
  private transformFromBackend(apiTopic: any): Topic {
    return {
      id: apiTopic.id,
      name: apiTopic.name,
      description: apiTopic.description,
      diseaseProfile: apiTopic.metadata?.diseaseProfile || apiTopic.diseaseProfile || {},
      patientContext: apiTopic.patient_context || apiTopic.patientContext || {},
      createdAt: apiTopic.created_at
        ? new Date(apiTopic.created_at).getTime()
        : (apiTopic.createdAt || Date.now()),
      updatedAt: apiTopic.updated_at
        ? new Date(apiTopic.updated_at).getTime()
        : (apiTopic.updatedAt || Date.now()),
      isSearching: apiTopic.metadata?.isSearching || apiTopic.isSearching || false,
      searchProgress: apiTopic.metadata?.searchProgress || apiTopic.searchProgress || 0,
      agents: apiTopic.agents || [],
      researchHistory: apiTopic.researchHistory || [],
      tags: apiTopic.tags || [],
      lastAgentRun: apiTopic.lastAgentRun,
      ...apiTopic.metadata // Spread any additional metadata
    };
  }

  /**
   * Transform frontend Topic to backend format
   */
  private transformToBackend(topic: Partial<Topic>): any {
    return {
      name: topic.name,
      description: topic.description || '',
      metadata: {
        diseaseProfile: topic.diseaseProfile || {},
        isSearching: topic.isSearching || false,
        searchProgress: topic.searchProgress || 0
      },
      patient_context: topic.patientContext || {},
      sort_order: 0
    };
  }

  // ==========================================================================
  // CACHE HELPERS
  // ==========================================================================

  private async cacheTopics(topics: Topic[]): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction('topics', 'readwrite');
      for (const topic of topics) {
        await tx.store.put({ ...topic, _cachedAt: Date.now() });
      }
      await tx.done;
    } catch (error) {
      logger.warn('[TopicsService] Failed to cache topics:', error);
    }
  }

  private async cacheTopic(topic: Topic): Promise<void> {
    try {
      const db = await getDB();
      await db.put('topics', { ...topic, _cachedAt: Date.now() });
    } catch (error) {
      logger.warn('[TopicsService] Failed to cache topic:', error);
    }
  }

  private async getCachedTopics(): Promise<Topic[]> {
    try {
      const db = await getDB();
      return await db.getAllFromIndex('topics', 'by-date');
    } catch (error) {
      logger.warn('[TopicsService] Failed to get cached topics:', error);
      return [];
    }
  }

  private async getCachedTopic(id: string): Promise<Topic | undefined> {
    try {
      const db = await getDB();
      return await db.get('topics', id);
    } catch (error) {
      logger.warn('[TopicsService] Failed to get cached topic:', error);
      return undefined;
    }
  }

  private async removeCachedTopic(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('topics', id);
    } catch (error) {
      logger.warn('[TopicsService] Failed to remove cached topic:', error);
    }
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get all topics
   */
  async getTopics(includeArchived = false): Promise<Topic[]> {
    if (this.useServerStorage) {
      try {
        const response = await api.get<TopicsResponse>(
          `${this.baseUrl}?includeArchived=${includeArchived}`
        );

        if (response.data.success) {
          const topics = response.data.topics.map(topic => this.transformFromBackend(topic));
          await this.cacheTopics(topics);
          return topics;
        }

        throw new Error('Failed to fetch topics');
      } catch (error) {
        // Fallback to cache if offline
        if (!navigator.onLine) {
          logger.debug('[TopicsService] Offline - using cached topics');
          return await this.getCachedTopics();
        }
        logger.error('[TopicsService] Error fetching topics:', error);
        throw error;
      }
    }

    // Local-only mode
    return await this.getCachedTopics();
  }

  /**
   * Get a single topic by ID
   */
  async getTopic(id: string, withStats = false): Promise<Topic | undefined> {
    if (this.useServerStorage) {
      try {
        const response = await api.get<TopicResponse>(
          `${this.baseUrl}/${id}?withStats=${withStats}`
        );

        if (response.data.success) {
          const topic = this.transformFromBackend(response.data.topic);
          await this.cacheTopic(topic);
          return topic;
        }

        return undefined;
      } catch (error) {
        if ((error as any).response?.status === 404) {
          return undefined;
        }
        // Fallback to cache if offline
        if (!navigator.onLine) {
          logger.debug('[TopicsService] Offline - using cached topic');
          return await this.getCachedTopic(id);
        }
        logger.error('[TopicsService] Error fetching topic:', error);
        throw error;
      }
    }

    // Local-only mode
    return await this.getCachedTopic(id);
  }

  /**
   * Create a new topic
   */
  async createTopic(
    name: string,
    diseaseProfile: DiseaseProfile,
    patientContext?: PatientContext
  ): Promise<Topic> {
    const topic: Partial<Topic> = {
      name,
      diseaseProfile,
      patientContext,
      agents: [],
      researchHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: []
    };

    if (this.useServerStorage) {
      try {
        const response = await api.post<TopicResponse>(
          this.baseUrl,
          this.transformToBackend(topic)
        );

        if (response.data.success) {
          const createdTopic = this.transformFromBackend(response.data.topic);
          await this.cacheTopic(createdTopic);

          // Dispatch event to notify UI components
          window.dispatchEvent(new CustomEvent('topic-created', {
            detail: { topic: createdTopic }
          }));

          return createdTopic;
        }

        throw new Error('Failed to create topic');
      } catch (error) {
        logger.error('[TopicsService] Error creating topic:', error);
        throw error;
      }
    }

    // Local-only mode
    const localTopic: Topic = {
      ...topic,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as Topic;

    await this.cacheTopic(localTopic);

    // Dispatch event to notify UI components
    window.dispatchEvent(new CustomEvent('topic-created', {
      detail: { topic: localTopic }
    }));

    return localTopic;
  }

  /**
   * Save/upsert a topic (for backward compatibility)
   */
  async saveTopic(topic: Topic): Promise<Topic> {
    if (topic.id) {
      return await this.updateTopic(topic.id, topic);
    }
    return await this.createTopic(
      topic.name,
      topic.diseaseProfile,
      topic.patientContext
    );
  }

  /**
   * Update an existing topic
   */
  async updateTopic(id: string, updates: Partial<Topic>): Promise<Topic> {
    if (this.useServerStorage) {
      try {
        const response = await api.put<TopicResponse>(
          `${this.baseUrl}/${id}`,
          this.transformToBackend(updates)
        );

        if (response.data.success) {
          const updatedTopic = this.transformFromBackend(response.data.topic);
          await this.cacheTopic(updatedTopic);
          return updatedTopic;
        }

        throw new Error('Failed to update topic');
      } catch (error) {
        logger.error('[TopicsService] Error updating topic:', error);
        throw error;
      }
    }

    // Local-only mode
    const existingTopic = await this.getCachedTopic(id);
    if (!existingTopic) {
      throw new Error(`Topic ${id} not found`);
    }

    const updatedTopic: Topic = {
      ...existingTopic,
      ...updates,
      updatedAt: Date.now()
    };

    await this.cacheTopic(updatedTopic);
    return updatedTopic;
  }

  /**
   * Delete a topic and all associated data
   */
  async deleteTopic(id: string): Promise<void> {
    logger.debug(`[TopicsService] Deleting topic ${id}`);

    if (this.useServerStorage) {
      try {
        const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

        if (!response.data.success) {
          throw new Error('Failed to delete topic');
        }

        // Clear from local cache
        await this.removeCachedTopic(id);

        // Dispatch event to notify UI components
        window.dispatchEvent(new CustomEvent('topic-deleted', {
          detail: { topicId: id }
        }));

        logger.debug(`[TopicsService] Successfully deleted topic ${id}`);
        return;
      } catch (error) {
        logger.error(`[TopicsService] Failed to delete topic ${id}:`, error);
        throw error;
      }
    }

    // Local-only mode: Delete topic and all associated data
    const db = await getDB();

    // Get all associated data
    const agents = await db.getAllFromIndex('agents', 'by-topic', id);
    const findings = await db.getAllFromIndex('findings', 'by-topic', id);
    const digests = await db.getAllFromIndex('digests', 'by-topic', id);
    const chats = await db.getAllFromIndex('chats', 'by-topic', id);

    // Get all notifications (filter for topic-related ones)
    const allNotifications = await db.getAll('notifications');
    const topicNotifications = allNotifications.filter(n =>
      n.data?.topicId === id ||
      n.title?.includes(id) ||
      (n.data && typeof n.data === 'object' && 'topicId' in n.data && n.data.topicId === id)
    );

    // Delete everything in a transaction
    const tx = db.transaction([
      'topics', 'agents', 'findings', 'digests',
      'chats', 'notifications'
    ], 'readwrite');

    // Delete the topic itself
    await tx.objectStore('topics').delete(id);

    // Delete associated agents
    for (const agent of agents) {
      await tx.objectStore('agents').delete(agent.id);
    }

    // Delete associated findings
    for (const finding of findings) {
      await tx.objectStore('findings').delete(finding.id);
    }

    // Delete associated digests
    for (const digest of digests) {
      await tx.objectStore('digests').delete(digest.id);
    }

    // Delete associated chats
    for (const chat of chats) {
      await tx.objectStore('chats').delete(chat.id);
    }

    // Delete associated notifications
    for (const notification of topicNotifications) {
      await tx.objectStore('notifications').delete(notification.id);
    }

    await tx.done;

    logger.debug(`[TopicsService] Deleted topic ${id} and all associated data:`, {
      agents: agents.length,
      findings: findings.length,
      digests: digests.length,
      chats: chats.length,
      notifications: topicNotifications.length
    });

    // Dispatch event to notify UI components
    window.dispatchEvent(new CustomEvent('topic-deleted', { detail: { topicId: id } }));
  }

  // ==========================================================================
  // SPECIALIZED QUERIES
  // ==========================================================================

  /**
   * Get active topics (updated in the last 30 days)
   */
  async getActiveTopics(): Promise<Topic[]> {
    const topics = await this.getTopics();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return topics.filter(topic => {
      const updatedAt = typeof topic.updatedAt === 'number'
        ? topic.updatedAt
        : new Date(topic.updatedAt || topic.createdAt).getTime();
      return updatedAt >= thirtyDaysAgo;
    });
  }

  /**
   * Get topics by disease category
   */
  async getTopicsByCategory(category: string): Promise<Topic[]> {
    const topics = await this.getTopics();
    return topics.filter(topic =>
      topic.diseaseProfile?.category?.includes(category)
    );
  }

  /**
   * Search topics by name
   */
  async searchTopicsByName(query: string): Promise<Topic[]> {
    const topics = await this.getTopics();
    const lowerQuery = query.toLowerCase();
    return topics.filter(topic =>
      topic.name.toLowerCase().includes(lowerQuery) ||
      topic.diseaseProfile?.name?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get topics that need agent updates
   */
  async getTopicsNeedingUpdate(hoursThreshold: number = 24): Promise<Topic[]> {
    const topics = await this.getTopics();
    const threshold = Date.now() - (hoursThreshold * 60 * 60 * 1000);

    return topics.filter(topic => {
      if (!topic.lastAgentRun) return true;
      return topic.lastAgentRun < threshold;
    });
  }

  // ==========================================================================
  // TOPIC OPERATIONS
  // ==========================================================================

  /**
   * Archive/unarchive a topic
   */
  async archiveTopic(id: string, archived = true): Promise<Topic> {
    if (this.useServerStorage) {
      try {
        const response = await api.post<TopicResponse>(
          `${this.baseUrl}/${id}/archive`,
          { archived }
        );

        if (response.data.success) {
          const topic = this.transformFromBackend(response.data.topic);
          await this.cacheTopic(topic);
          return topic;
        }

        throw new Error('Failed to archive topic');
      } catch (error) {
        logger.error('[TopicsService] Error archiving topic:', error);
        throw error;
      }
    }

    // For local mode, just update the topic
    return await this.updateTopic(id, { archived } as any);
  }

  /**
   * Reorder topics
   */
  async reorderTopics(topics: Array<{ id: string; sort_order: number }>): Promise<void> {
    if (this.useServerStorage) {
      try {
        const response = await api.put<{ success: boolean; message: string }>(
          `${this.baseUrl}/reorder`,
          { topics }
        );

        if (!response.data.success) {
          throw new Error('Failed to reorder topics');
        }
      } catch (error) {
        logger.error('[TopicsService] Error reordering topics:', error);
        throw error;
      }
    }

    // For local mode, update each topic's sort order
    for (const { id, sort_order } of topics) {
      await this.updateTopic(id, { sortOrder: sort_order } as any);
    }
  }

  /**
   * Add research finding to topic (updates research history)
   */
  async addResearchToTopic(topicId: string, findingId: string): Promise<void> {
    const topic = await this.getTopic(topicId);
    if (!topic) return;

    const db = await getDB();
    const finding = await db.get('findings', findingId);

    if (finding) {
      const researchHistory = [...(topic.researchHistory || []), finding];
      await this.updateTopic(topicId, {
        researchHistory,
        lastAgentRun: Date.now()
      });
    }
  }

  /**
   * Check if topic should be updated based on disease progression
   */
  shouldUpdateTopic(topic: Topic): boolean {
    const lastRun = topic.lastAgentRun || 0;
    const hoursSinceLastRun = (Date.now() - lastRun) / (1000 * 60 * 60);

    // Adaptive scheduling based on disease progression rate
    switch (topic.diseaseProfile?.progressionRate) {
      case 'rapid':
        return hoursSinceLastRun >= 12; // Check twice daily
      case 'moderate':
        return hoursSinceLastRun >= 24; // Check daily
      case 'slow':
        return hoursSinceLastRun >= 168; // Check weekly
      case 'variable':
      default:
        return hoursSinceLastRun >= 24; // Default to daily
    }
  }

  // ==========================================================================
  // BACKWARD COMPATIBILITY ALIASES
  // ==========================================================================

  /**
   * @deprecated Use updateTopic instead
   */
  async updateTopicById(id: string, updates: Partial<Topic>): Promise<Topic> {
    return await this.updateTopic(id, updates);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const topicsService = TopicsService.getInstance();

// ============================================================================
// LEGACY EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

// These exports allow existing code to continue working while we update imports

/**
 * @deprecated Import topicsService and use topicsService.getTopics() instead
 */
export const getAllTopics = () => topicsService.getTopics();

/**
 * @deprecated Import topicsService and use topicsService.getTopic() instead
 */
export const getTopic = (id: string) => topicsService.getTopic(id);

/**
 * @deprecated Import topicsService and use topicsService.createTopic() instead
 */
export const createTopic = (
  nameOrTopic: string | Topic,
  diseaseProfile?: DiseaseProfile,
  patientContext?: PatientContext
) => {
  if (typeof nameOrTopic === 'object') {
    return topicsService.saveTopic(nameOrTopic);
  }
  return topicsService.createTopic(nameOrTopic, diseaseProfile!, patientContext);
};

/**
 * @deprecated Import topicsService and use topicsService.updateTopic() instead
 */
export const updateTopic = (idOrTopic: string | Topic, updates?: Partial<Topic>) => {
  if (typeof idOrTopic === 'object') {
    return topicsService.updateTopic(idOrTopic.id, idOrTopic);
  }
  return topicsService.updateTopic(idOrTopic, updates!);
};

/**
 * @deprecated Import topicsService and use topicsService.deleteTopic() instead
 */
export const deleteTopic = (id: string) => topicsService.deleteTopic(id);

/**
 * @deprecated Import topicsService and use topicsService.searchTopicsByName() instead
 */
export const searchTopicsByName = (query: string) => topicsService.searchTopicsByName(query);

/**
 * @deprecated Import topicsService and use topicsService.getTopicsByCategory() instead
 */
export const getTopicsByCategory = (category: string) => topicsService.getTopicsByCategory(category);

/**
 * @deprecated Import topicsService and use topicsService.getTopicsNeedingUpdate() instead
 */
export const getTopicsNeedingUpdate = (hoursThreshold?: number) =>
  topicsService.getTopicsNeedingUpdate(hoursThreshold);

/**
 * @deprecated Import topicsService and use topicsService.addResearchToTopic() instead
 */
export const addResearchToTopic = (topicId: string, findingId: string) =>
  topicsService.addResearchToTopic(topicId, findingId);

/**
 * @deprecated Import topicsService and use topicsService.shouldUpdateTopic() instead
 */
export const shouldUpdateTopic = (topic: Topic) => topicsService.shouldUpdateTopic(topic);

/**
 * @deprecated Use topicsService directly
 */
export const topicsAPIService = topicsService;
