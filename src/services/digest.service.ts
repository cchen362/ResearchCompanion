/**
 * DigestService - Consolidated service for digest management
 *
 * Phase 1 Refactoring: Service Layer Consolidation
 *
 * This service merges:
 * - digest.service.ts (old version with dual API/local paths)
 * - digestQueue.service.ts (queue management - 794 lines)
 * - digestCache.service.ts (cache logic - 300 lines)
 * - digests.api.service.ts (transformations - 249 lines)
 *
 * Architecture: Server-first with IndexedDB cache for offline support
 *
 * CRITICAL: The circular dependency with agentRunner.ts has been broken
 * by using event-based communication instead of direct imports.
 * DigestService listens for 'agents-complete' events to trigger digest generation.
 */

import { api, longOperationApi } from './api';
import { getDB } from '@/utils/db/database';
import { findingsService } from './findings.service';
import { topicsService } from './topics.service';
import { logger } from '@/utils/logger';
import type {
  SmartDigest,
  DigestQueueItem,
  DigestQueueStatus,
  DigestPriority,
  DigestTimeframe,
  ResearchFinding,
  Topic
} from '@/types';

// ==================== API Response Types ====================

interface DigestsResponse {
  success: boolean;
  digests: any[];
}

interface DigestResponse {
  success: boolean;
  digest: any;
  deduplicated?: boolean;
  message?: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

interface StatsResponse {
  success: boolean;
  stats: {
    total: number;
    by_type: Array<{ type: string; count: number }>;
    by_topic: Array<{ topic_id: string; count: number }>;
  };
}

interface QueueStatusResponse {
  hasActiveQueue: boolean;
  queueId?: string;
  status?: DigestQueueStatus;
  createdAt?: string;
  startedAt?: string;
  timeframe?: string;
}

interface CreateQueueResponse {
  success: boolean;
  queueId?: string;
  status?: string;
  error?: string;
}

// ==================== Cache Configuration ====================

export interface DigestCacheConfig {
  maxAge: number;
  staleWhileRevalidate: boolean;
  autoRefresh: boolean;
  refreshThreshold: number;
}

const DEFAULT_CACHE_CONFIGS: Record<DigestTimeframe, DigestCacheConfig> = {
  'daily': {
    maxAge: 3 * 60 * 60 * 1000, // 3 hours
    staleWhileRevalidate: true,
    autoRefresh: false,
    refreshThreshold: 3
  },
  'weekly': {
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    staleWhileRevalidate: true,
    autoRefresh: false,
    refreshThreshold: 10
  },
  'monthly': {
    maxAge: 48 * 60 * 60 * 1000, // 48 hours
    staleWhileRevalidate: true,
    autoRefresh: false,
    refreshThreshold: 20
  },
  'all-time': {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    staleWhileRevalidate: true,
    autoRefresh: false,
    refreshThreshold: 50
  }
};

// ==================== Digest Service ====================

class DigestService {
  private static instance: DigestService;
  private baseUrl = '/digests';
  private queueBaseUrl = '/digest-queue';

  // Queue management state
  private processingQueue = false;
  private currentProcessingId: string | null = null;
  private queueLocks = new Set<string>();
  private queueProcessorInterval: NodeJS.Timeout | null = null;

  // Cache configuration
  private cacheConfigs: Map<string, DigestCacheConfig> = new Map();
  private digestVersions: Map<string, number> = new Map();

  private constructor() {
    // Initialize cache configs
    Object.entries(DEFAULT_CACHE_CONFIGS).forEach(([timeframe, config]) => {
      this.cacheConfigs.set(timeframe, config);
    });

    // Listen for agent completion events (breaks circular dependency)
    if (typeof window !== 'undefined') {
      window.addEventListener('agents-complete', this.handleAgentsComplete.bind(this));
    }
  }

  static getInstance(): DigestService {
    if (!DigestService.instance) {
      DigestService.instance = new DigestService();
    }
    return DigestService.instance;
  }

  // ==================== Transformation Functions ====================

  private transformToFrontend(apiDigest: any, responseContext?: { deduplicated?: boolean; source?: string }): SmartDigest {
    const digest: SmartDigest = {
      id: apiDigest.id,
      topicId: apiDigest.topic_id || '',
      timeframe: apiDigest.type || 'weekly',
      generatedAt: new Date(apiDigest.created_at).getTime(),
      executiveSummary: apiDigest.executive_summary || '',
      laymanSummary: apiDigest.metadata?.laymanSummary || '',
      themes: apiDigest.themes || [],
      keyTakeaways: apiDigest.metadata?.keyTakeaways || [],
      breakthroughs: apiDigest.breakthroughs || [],
      contradictions: apiDigest.contradictions || [],
      trends: apiDigest.metadata?.trends || {
        emerging: [],
        declining: [],
        stable: []
      },
      statistics: apiDigest.metadata?.statistics || {
        totalFindings: apiDigest.finding_ids?.length || 0,
        newFindings: 0,
        highRelevanceCount: 0,
        sourceCount: 0,
        avgConfidence: 0
      },
      topSources: apiDigest.metadata?.topSources || [],
      allFindingIds: apiDigest.finding_ids || [],
      userEngagement: apiDigest.metadata?.userEngagement
    };

    if (responseContext) {
      digest.cacheMetadata = {
        source: responseContext.source as 'postgresql' | 'indexeddb' | 'generated' || 'postgresql',
        isCached: responseContext.deduplicated || false,
        deduplicated: responseContext.deduplicated || false,
        originalGeneratedAt: new Date(apiDigest.created_at).getTime(),
        cacheRetrievedAt: Date.now()
      };
    }

    return digest;
  }

  private transformToBackend(digest: Partial<SmartDigest>): any {
    if (!digest) {
      throw new Error('Cannot transform undefined digest');
    }
    return {
      topic_id: digest.topicId || null,
      type: digest.timeframe || 'weekly',
      title: digest.executiveSummary?.substring(0, 100) || 'Research Digest',
      executive_summary: digest.executiveSummary || '',
      themes: digest.themes || [],
      contradictions: digest.contradictions || [],
      breakthroughs: digest.breakthroughs || [],
      knowledge_gaps: digest.knowledgeGaps || [],
      next_steps: digest.recommendations || [],
      finding_ids: digest.allFindingIds || [],
      metadata: {
        laymanSummary: digest.laymanSummary,
        keyTakeaways: digest.keyTakeaways,
        trendsAndPatterns: digest.trendsAndPatterns,
        statistics: digest.statistics,
        status: digest.status,
        progress: digest.progress
      }
    };
  }

  // ==================== CRUD Operations ====================

  async getDigests(topicId?: string, limit = 50): Promise<SmartDigest[]> {
    try {
      const params = new URLSearchParams();
      if (topicId) params.append('topic_id', topicId);
      if (limit) params.append('limit', String(limit));

      const queryString = params.toString();
      const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;

      const response = await api.get<DigestsResponse>(url);

      if (response.data.success) {
        const digests = response.data.digests.map(d => this.transformToFrontend(d));
        await this.cacheDigests(digests);
        return digests;
      }

      throw new Error('Failed to fetch digests');
    } catch (error) {
      if (!navigator.onLine) {
        return await this.getCachedDigests(topicId);
      }
      logger.error('[DigestService] Error fetching digests:', error);
      throw error;
    }
  }

  async getDigest(topicId: string, timeframe?: string): Promise<SmartDigest | undefined> {
    try {
      const url = timeframe
        ? `${this.baseUrl}/latest/${topicId}?timeframe=${timeframe}`
        : `${this.baseUrl}/latest/${topicId}`;

      const response = await api.get<DigestResponse>(url);

      if (response.data.success) {
        const digest = this.transformToFrontend(response.data.digest, {
          deduplicated: response.data.deduplicated,
          source: 'postgresql'
        });
        await this.cacheDigest(digest);
        return digest;
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }

      if (!navigator.onLine) {
        const cached = await this.getCachedDigest(topicId, (timeframe as DigestTimeframe) || 'weekly');
        return cached.digest || undefined;
      }

      logger.error('[DigestService] Error fetching digest:', error);
      throw error;
    }
  }

  async getDigestById(id: string): Promise<SmartDigest | undefined> {
    try {
      const response = await api.get<DigestResponse>(`${this.baseUrl}/${id}`);

      if (response.data.success) {
        const digest = this.transformToFrontend(response.data.digest);
        await this.cacheDigest(digest);
        return digest;
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      logger.error('[DigestService] Error fetching digest by ID:', error);
      throw error;
    }
  }

  async saveDigest(digest: SmartDigest): Promise<SmartDigest> {
    try {
      if (!digest) {
        throw new Error('Cannot save undefined digest');
      }

      const backendData = this.transformToBackend(digest);
      const response = await api.post<DigestResponse>(this.baseUrl, backendData);

      if (response.data.success) {
        const savedDigest = this.transformToFrontend(response.data.digest, {
          deduplicated: response.data.deduplicated,
          source: response.data.deduplicated ? 'postgresql' : 'generated'
        });
        await this.cacheDigest(savedDigest);
        return savedDigest;
      }

      throw new Error('Failed to save digest');
    } catch (error) {
      logger.error('[DigestService] Error saving digest:', error);
      throw error;
    }
  }

  async updateDigest(id: string, updates: Partial<SmartDigest>): Promise<SmartDigest> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<DigestResponse>(`${this.baseUrl}/${id}`, backendData);

      if (response.data.success) {
        const updatedDigest = this.transformToFrontend(response.data.digest);
        await this.cacheDigest(updatedDigest);
        return updatedDigest;
      }

      throw new Error('Failed to update digest');
    } catch (error) {
      logger.error('[DigestService] Error updating digest:', error);
      throw error;
    }
  }

  async deleteDigest(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete digest');
      }

      await this.removeCachedDigest(id);
    } catch (error) {
      logger.error('[DigestService] Error deleting digest:', error);
      throw error;
    }
  }

  async getStats(): Promise<StatsResponse['stats']> {
    try {
      const response = await api.get<StatsResponse>(`${this.baseUrl}/stats`);

      if (response.data.success) {
        return response.data.stats;
      }

      throw new Error('Failed to get stats');
    } catch (error) {
      logger.error('[DigestService] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Get all digests for a specific topic
   * Convenience method for AnalyticsView
   */
  async getDigestsForTopic(topicId: string): Promise<SmartDigest[]> {
    return this.getDigests(topicId);
  }

  /**
   * Generate a smart digest from topic and findings
   * This is a convenience method that queues digest generation and returns the result
   */
  async generateSmartDigest(topic: Topic, findings: ResearchFinding[]): Promise<SmartDigest> {
    const queueItem = await this.queueDigestGeneration(
      topic.id,
      'all-time',
      findings.map(f => f.id),
      'high',
      'user'
    );

    // Process the queue
    await this.processQueue();

    // Wait for digest to be generated (up to 2 minutes)
    const maxWaitTime = 120000;
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getQueueStatusByTopic(topic.id);

      if (!status || status.status === 'completed') {
        // Fetch the latest digest
        const digest = await this.getDigest(topic.id, 'all-time');
        if (digest) {
          return digest;
        }
        break;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Digest generation failed');
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Digest generation timed out');
  }

  // ==================== Queue Operations ====================

  async queueDigestGeneration(
    topicId: string,
    timeframe: DigestTimeframe,
    findingIds: string[],
    priority: DigestPriority = 'normal',
    requestedBy: 'user' | 'system' | 'background' = 'user'
  ): Promise<DigestQueueItem> {
    const lockKey = `queue_${topicId}_${timeframe}`;

    if (this.queueLocks.has(lockKey)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const existingQueue = await this.getQueueStatusByTopic(topicId);
      if (existingQueue) {
        return existingQueue;
      }
    }

    this.queueLocks.add(lockKey);

    try {
      // Check for existing active queue
      const queueStatus = await this.getQueueStatusAPI(topicId, timeframe);

      if (queueStatus.hasActiveQueue && queueStatus.queueId) {
        const existing: DigestQueueItem = {
          id: queueStatus.queueId,
          topicId,
          timeframe,
          status: queueStatus.status || 'pending',
          priority,
          createdAt: queueStatus.createdAt ? new Date(queueStatus.createdAt).getTime() : Date.now(),
          startedAt: queueStatus.startedAt ? new Date(queueStatus.startedAt).getTime() : undefined,
          attempts: 0,
          maxAttempts: 3,
          findingIds,
          requestedBy,
          estimatedCompletionTime: Date.now() + 30000,
          progress: {
            stage: queueStatus.status === 'processing' ? 'generating' : 'queued',
            percentage: queueStatus.status === 'processing' ? 50 : 0,
            message: queueStatus.status === 'processing' ? 'Generating digest...' : 'Waiting in queue...'
          }
        };
        return existing;
      }

      // Create new queue item
      const response = await api.post<CreateQueueResponse>(this.queueBaseUrl, {
        topicId,
        timeframe,
        digestType: 'smart',
        priority: priority === 'high' ? 5 : priority === 'normal' ? 3 : 1,
        metadata: { findingIds, requestedBy }
      });

      if (!response.data.success || !response.data.queueId) {
        throw new Error(response.data.error || 'Failed to create queue item');
      }

      const queueItem: DigestQueueItem = {
        id: response.data.queueId,
        topicId,
        timeframe,
        status: response.data.status as DigestQueueStatus || 'pending',
        priority,
        createdAt: Date.now(),
        attempts: 0,
        maxAttempts: 3,
        findingIds,
        requestedBy,
        estimatedCompletionTime: Date.now() + 30000,
        progress: {
          stage: 'queued',
          percentage: 0,
          message: 'Waiting in queue...'
        }
      };

      window.dispatchEvent(new CustomEvent('digest-queued', { detail: { queueItem } }));
      this.processQueue();

      return queueItem;
    } finally {
      this.queueLocks.delete(lockKey);
    }
  }

  async getQueueStatus(queueId: string): Promise<DigestQueueItem | null> {
    logger.warn('[DigestService] getQueueStatus by ID not yet implemented');
    return null;
  }

  async getQueueStatusByTopic(topicId: string): Promise<DigestQueueItem | null> {
    const queueStatus = await this.getQueueStatusAPI(topicId);

    if (!queueStatus.hasActiveQueue || !queueStatus.queueId) {
      return null;
    }

    return {
      id: queueStatus.queueId,
      topicId,
      timeframe: (queueStatus.timeframe as DigestTimeframe) || 'all-time',
      status: queueStatus.status || 'pending',
      priority: 'normal',
      createdAt: queueStatus.createdAt ? new Date(queueStatus.createdAt).getTime() : Date.now(),
      startedAt: queueStatus.startedAt ? new Date(queueStatus.startedAt).getTime() : undefined,
      attempts: 0,
      maxAttempts: 3,
      findingIds: [],
      requestedBy: 'user',
      estimatedCompletionTime: Date.now() + 30000,
      progress: {
        stage: queueStatus.status === 'processing' ? 'generating' : 'queued',
        percentage: queueStatus.status === 'processing' ? 50 : 0,
        message: queueStatus.status === 'processing' ? 'Generating digest...' : 'Waiting in queue...'
      }
    };
  }

  async cancelQueueItem(queueItemId: string): Promise<boolean> {
    try {
      const response = await api.delete(`${this.queueBaseUrl}/${queueItemId}`);
      return response.data.success;
    } catch (error) {
      logger.error('[DigestService] Error cancelling queue item:', error);
      return false;
    }
  }

  async queueDigestFromExistingFindings(
    topicId: string,
    timeframe: DigestTimeframe = 'weekly'
  ): Promise<DigestQueueItem> {
    const findings = await findingsService.getFindings(topicId, { limit: 100 });

    if (findings.length === 0) {
      throw new Error('No findings available to generate digest');
    }

    findings.sort((a, b) => b.timestamp - a.timestamp);
    const findingIds = findings.map(f => f.id);

    const queueItem = await this.queueDigestGeneration(
      topicId,
      timeframe,
      findingIds,
      'high',
      'user'
    );

    setTimeout(() => this.processQueue(), 100);
    return queueItem;
  }

  /**
   * Integrated method to refresh research and regenerate digest
   * NOTE: This no longer directly calls agentRunner - instead components should
   * call agentsService.runAllAgents() first, which will emit 'agents-complete'
   * event that this service listens for.
   */
  async refreshResearchAndDigest(
    topicId: string,
    timeframe: DigestTimeframe = 'all-time',
    priority: DigestPriority = 'high'
  ): Promise<DigestQueueItem> {
    // This method now just queues a digest from existing findings
    // To get new findings, the caller should first call agentsService.runAllAgents()
    // which will trigger 'agents-complete' event -> auto-queue digest
    logger.debug(`[DigestService] refreshResearchAndDigest called for topic ${topicId}`);
    logger.debug('[DigestService] NOTE: To fetch new findings, call agentsService.runAllAgents() first');

    return await this.queueDigestFromExistingFindings(topicId, timeframe);
  }

  // ==================== Queue Processing ====================

  async processQueue(): Promise<void> {
    if (this.processingQueue) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    this.processingQueue = true;

    try {
      const response = await api.get(`${this.queueBaseUrl}?limit=10`);
      const pendingItems = response.data.items?.filter((item: any) =>
        item.status === 'pending' || item.status === 'processing'
      ) || [];

      for (const item of pendingItems) {
        if (item.status === 'processing' && this.currentProcessingId !== item.id) {
          continue;
        }

        if (item.status === 'pending') {
          await this.processQueueItem(item);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private async processQueueItem(item: any): Promise<void> {
    this.currentProcessingId = item.id;

    try {
      await api.patch(`${this.queueBaseUrl}/${item.id}`, { status: 'processing' });

      const topic = await topicsService.getTopic(item.topicId);
      if (!topic) {
        throw new Error(`Topic ${item.topicId} not found`);
      }

      const findings = await findingsService.getFindings(item.topicId);
      if (findings.length === 0) {
        throw new Error('No findings available for digest generation');
      }

      const queueItem: DigestQueueItem = {
        id: item.id,
        topicId: item.topicId,
        timeframe: item.timeframe as DigestTimeframe,
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(item.createdAt).getTime(),
        startedAt: Date.now(),
        attempts: 1,
        maxAttempts: 3,
        findingIds: findings.map(f => f.id),
        requestedBy: 'user',
        estimatedCompletionTime: Date.now() + 60000,
        progress: { stage: 'generating', percentage: 10, message: 'Starting digest generation...' }
      };

      this.notifyProgressUpdate(queueItem);

      const digest = await this.generateDigestFromFindings(
        queueItem,
        topic,
        findings,
        item.timeframe as DigestTimeframe
      );

      const savedDigest = await this.saveDigest(digest);

      await api.patch(`${this.queueBaseUrl}/${item.id}`, {
        status: 'completed',
        resultId: savedDigest.id
      });

      queueItem.status = 'completed';
      queueItem.completedAt = Date.now();
      queueItem.progress = { stage: 'completed', percentage: 100, message: 'Digest generated successfully' };
      this.notifyCompletion(queueItem, savedDigest);

    } catch (error) {
      logger.error(`[DigestService] Failed to process queue item ${item.id}:`, error);

      await api.patch(`${this.queueBaseUrl}/${item.id}`, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.notifyFailure({
        id: item.id,
        topicId: item.topicId,
        timeframe: item.timeframe as DigestTimeframe,
        status: 'failed',
        priority: 'normal',
        createdAt: new Date(item.createdAt).getTime(),
        attempts: 1,
        maxAttempts: 3,
        findingIds: [],
        requestedBy: 'user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      if (this.currentProcessingId === item.id) {
        this.currentProcessingId = null;
      }
    }
  }

  private async generateDigestFromFindings(
    queueItem: DigestQueueItem,
    topic: Topic,
    findings: ResearchFinding[],
    timeframe: DigestTimeframe
  ): Promise<SmartDigest> {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let filteredFindings = findings;

    switch (timeframe) {
      case 'daily':
        filteredFindings = findings.filter(f => f.timestamp > now - day);
        break;
      case 'weekly':
        filteredFindings = findings.filter(f => f.timestamp > now - (7 * day));
        break;
      case 'monthly':
        filteredFindings = findings.filter(f => f.timestamp > now - (30 * day));
        break;
    }

    const response = await longOperationApi.post('/digest/generate-digest', {
      findings: filteredFindings,
      topic,
      timeframe
    });

    if (!response.data) {
      throw new Error('No digest data returned from backend');
    }

    return {
      ...response.data,
      topicId: topic.id
    };
  }

  // ==================== Cache Operations ====================

  async getCachedDigest(
    topicId: string,
    timeframe: DigestTimeframe
  ): Promise<{ digest: SmartDigest | null; isStale: boolean }> {
    try {
      const db = await getDB();
      const digests = await db.getAllFromIndex('digests', 'by-topic', topicId);
      const matchingDigests = digests.filter(d => d.timeframe === timeframe);

      if (matchingDigests.length === 0) {
        return { digest: null, isStale: false };
      }

      matchingDigests.sort((a, b) => b.generatedAt - a.generatedAt);
      const latestDigest = matchingDigests[0];

      const config = this.getCacheConfig(timeframe);
      const age = Date.now() - latestDigest.generatedAt;
      const isStale = age > config.maxAge;

      if (isStale && !config.staleWhileRevalidate) {
        return { digest: null, isStale: true };
      }

      return { digest: latestDigest, isStale };
    } catch (error) {
      logger.error('[DigestService] Error getting cached digest:', error);
      return { digest: null, isStale: false };
    }
  }

  async shouldRefreshDigest(
    topicId: string,
    timeframe: DigestTimeframe,
    currentDigest: SmartDigest | null
  ): Promise<boolean> {
    if (!currentDigest) return true;

    const config = this.getCacheConfig(timeframe);
    const age = Date.now() - currentDigest.generatedAt;

    const COOLDOWN_PERIOD = 30 * 1000;
    if (age < COOLDOWN_PERIOD) return false;

    const MINIMUM_AGE = 60 * 1000;
    if (age < MINIMUM_AGE) return false;

    if (age > config.maxAge) return true;

    const db = await getDB();
    const findings = await db.getAllFromIndex('findings', 'by-topic', topicId);
    const bufferTime = 1000;
    const newFindings = findings.filter(f => f.timestamp > (currentDigest.generatedAt + bufferTime));

    return newFindings.length >= config.refreshThreshold;
  }

  async invalidateCache(topicId: string, timeframe?: DigestTimeframe): Promise<void> {
    const db = await getDB();
    const digests = await db.getAllFromIndex('digests', 'by-topic', topicId);

    for (const digest of digests) {
      if (!timeframe || digest.timeframe === timeframe) {
        digest.generatedAt = 0;
        await db.put('digests', digest);
      }
    }
  }

  private async cacheDigest(digest: SmartDigest): Promise<void> {
    try {
      const db = await getDB();
      const versionKey = `${digest.topicId}_${digest.timeframe}`;
      const currentVersion = this.digestVersions.get(versionKey) || 0;
      this.digestVersions.set(versionKey, currentVersion + 1);

      await db.put('digests', {
        ...digest,
        version: currentVersion + 1,
        _cachedAt: Date.now()
      });

      await this.cleanupOldVersions(digest.topicId, digest.timeframe);
    } catch (error) {
      logger.warn('[DigestService] Failed to cache digest:', error);
    }
  }

  private async cacheDigests(digests: SmartDigest[]): Promise<void> {
    for (const digest of digests) {
      await this.cacheDigest(digest);
    }
  }

  private async getCachedDigests(topicId?: string): Promise<SmartDigest[]> {
    try {
      const db = await getDB();
      if (topicId) {
        return await db.getAllFromIndex('digests', 'by-topic', topicId);
      }
      return await db.getAll('digests');
    } catch (error) {
      logger.warn('[DigestService] Failed to get cached digests:', error);
      return [];
    }
  }

  private async removeCachedDigest(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('digests', id);
    } catch (error) {
      logger.warn('[DigestService] Failed to remove cached digest:', error);
    }
  }

  private async cleanupOldVersions(
    topicId: string,
    timeframe: DigestTimeframe,
    keepCount: number = 3
  ): Promise<void> {
    try {
      const db = await getDB();
      const digests = await db.getAllFromIndex('digests', 'by-topic', topicId);
      const matchingDigests = digests
        .filter(d => d.timeframe === timeframe)
        .sort((a, b) => b.generatedAt - a.generatedAt);

      if (matchingDigests.length > keepCount) {
        const toDelete = matchingDigests.slice(keepCount);
        for (const digest of toDelete) {
          await db.delete('digests', digest.id);
        }
      }
    } catch (error) {
      logger.warn('[DigestService] Failed to cleanup old versions:', error);
    }
  }

  private getCacheConfig(timeframe: DigestTimeframe): DigestCacheConfig {
    return this.cacheConfigs.get(timeframe) || DEFAULT_CACHE_CONFIGS[timeframe];
  }

  // ==================== API Helpers ====================

  private async getQueueStatusAPI(topicId: string, timeframe?: string): Promise<QueueStatusResponse> {
    try {
      const params = timeframe ? `?timeframe=${timeframe}` : '';
      const response = await api.get(`${this.queueBaseUrl}/status/${topicId}${params}`);
      return response.data;
    } catch (error) {
      return { hasActiveQueue: false };
    }
  }

  // ==================== Event Handlers ====================

  /**
   * Handle agent completion events (breaks circular dependency with agentRunner)
   */
  private async handleAgentsComplete(event: Event): Promise<void> {
    const { topicId, findingsCount } = (event as CustomEvent).detail;
    if (findingsCount > 0) {
      logger.debug(`[DigestService] Agents completed for topic ${topicId} with ${findingsCount} findings, queueing digest...`);
      try {
        await this.queueDigestFromExistingFindings(topicId, 'weekly');
      } catch (error) {
        logger.error('[DigestService] Failed to queue digest after agent completion:', error);
      }
    }
  }

  // ==================== Notification Methods ====================

  private notifyProgressUpdate(item: DigestQueueItem): void {
    window.dispatchEvent(new CustomEvent('digest-progress', { detail: { queueItem: item } }));
  }

  private notifyCompletion(item: DigestQueueItem, digest: SmartDigest): void {
    window.dispatchEvent(new CustomEvent('digest-completed', { detail: { queueItem: item, digest } }));
  }

  private notifyFailure(item: DigestQueueItem): void {
    window.dispatchEvent(new CustomEvent('digest-failed', { detail: { queueItem: item } }));
  }

  // ==================== Lifecycle Methods ====================

  public startPolling(): void {
    logger.debug('[DigestService] Initializing queue service after login');
    setTimeout(() => this.processQueue(), 1000);
  }

  public stopPolling(): void {
    logger.debug('[DigestService] Stopping queue polling on logout');
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
  }

  async warmCache(topicIds?: string[]): Promise<void> {
    // Cache warming handled by backend
  }
}

// Export singleton instance
export const digestService = DigestService.getInstance();

// Legacy exports for backward compatibility during migration
export const digestQueueService = digestService;
export const digestCacheService = digestService;
