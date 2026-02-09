/**
 * Digest Queue Service - PostgreSQL Implementation
 * Manages digest generation queue in PostgreSQL for multi-device synchronization
 * Replaces IndexedDB-based queue management for reliable server-side state
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface QueueItem {
  id: string;
  userId: string;
  topicId: string;
  digestType: string;
  timeframe: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
  resultId?: string;
  metadata?: Record<string, any>;
}

export interface CreateQueueItemData {
  userId: string;
  topicId: string;
  digestType?: string;
  timeframe: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export class DigestQueueServicePG {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get active queue item for a topic (pending or processing)
   */
  async getActiveQueueForTopic(
    userId: string,
    topicId: string,
    timeframe: string
  ): Promise<QueueItem | null> {
    try {
      // First clean up stale items
      await this.cleanupStaleItems();

      const query = `
        SELECT
          id,
          user_id as "userId",
          topic_id as "topicId",
          digest_type as "digestType",
          timeframe,
          status,
          priority,
          created_at as "createdAt",
          started_at as "startedAt",
          completed_at as "completedAt",
          error,
          retry_count as "retryCount",
          result_id as "resultId",
          metadata
        FROM digest_queue
        WHERE
          user_id = $1
          AND topic_id = $2
          AND timeframe = $3
          AND status IN ('pending', 'processing')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId, topicId, timeframe]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[DigestQueueService] Error getting active queue:', error);
      return null;
    }
  }

  /**
   * Get queue status by topic ID (for backward compatibility)
   */
  async getQueueStatusByTopic(
    userId: string,
    topicId: string
  ): Promise<QueueItem | null> {
    try {
      const query = `
        SELECT
          id,
          user_id as "userId",
          topic_id as "topicId",
          digest_type as "digestType",
          timeframe,
          status,
          priority,
          created_at as "createdAt",
          started_at as "startedAt",
          completed_at as "completedAt",
          error,
          retry_count as "retryCount",
          result_id as "resultId",
          metadata
        FROM digest_queue
        WHERE
          user_id = $1
          AND topic_id = $2
          AND status IN ('pending', 'processing')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId, topicId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[DigestQueueService] Error getting queue status:', error);
      return null;
    }
  }

  /**
   * Create a new queue item (or return existing one)
   */
  async createQueueItem(data: CreateQueueItemData): Promise<QueueItem> {
    const id = uuidv4();

    try {
      // First check for ANY existing queue item (not just active)
      const existingQuery = `
        SELECT
          id,
          user_id as "userId",
          topic_id as "topicId",
          digest_type as "digestType",
          timeframe,
          status,
          priority,
          created_at as "createdAt",
          started_at as "startedAt",
          completed_at as "completedAt",
          error,
          retry_count as "retryCount",
          result_id as "resultId",
          metadata
        FROM digest_queue
        WHERE
          user_id = $1
          AND topic_id = $2
          AND digest_type = $3
          AND timeframe = $4
        LIMIT 1
      `;

      const existingResult = await this.pool.query(existingQuery, [
        data.userId,
        data.topicId,
        data.digestType || 'smart',
        data.timeframe
      ]);

      if (existingResult.rows[0]) {
        const existing = existingResult.rows[0];
        console.log('[DigestQueueService] Queue item already exists:', existing.id, 'status:', existing.status);

        // If it's completed or failed, check if it's recent before resetting
        if (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'cancelled') {
          const forceRegenerate = data.metadata?.force === true;

          // Don't reset if completed within the last 24 hours
          // UNLESS: force=true OR scheduler reports genuinely new findings
          if (existing.status === 'completed' && existing.completedAt) {
            const completedTime = new Date(existing.completedAt).getTime();
            const now = Date.now();
            const hoursSinceCompletion = (now - completedTime) / (1000 * 60 * 60);

            const hasNewFindings = data.metadata?.source === 'scheduled-agent-run'
              && (data.metadata?.findingsCount || 0) > 0;

            if (!forceRegenerate && !hasNewFindings && hoursSinceCompletion < 24) {
              console.log(`[DigestQueueService] Completed ${hoursSinceCompletion.toFixed(1)}h ago, no new findings, not resetting`);
              return existing;
            }

            if (hasNewFindings) {
              console.log(`[DigestQueueService] ${data.metadata?.findingsCount} new findings, resetting for re-generation`);
            }
          }

          if (forceRegenerate) {
            console.log(`[DigestQueueService] Force regenerate requested, resetting queue item`);
          }

          const resetQuery = `
            UPDATE digest_queue
            SET status = 'pending',
                started_at = NULL,
                completed_at = NULL,
                error = NULL,
                result_id = NULL,
                created_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
              id,
              user_id as "userId",
              topic_id as "topicId",
              digest_type as "digestType",
              timeframe,
              status,
              priority,
              created_at as "createdAt",
              metadata
          `;

          const resetResult = await this.pool.query(resetQuery, [existing.id]);
          console.log('[DigestQueueService] Reset existing queue item to pending:', existing.id);
          return resetResult.rows[0];
        }

        // Return existing if it's pending or processing
        return existing;
      }

      // No existing item, create new one
      const query = `
        INSERT INTO digest_queue (
          id, user_id, topic_id, digest_type, timeframe,
          status, priority, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          user_id as "userId",
          topic_id as "topicId",
          digest_type as "digestType",
          timeframe,
          status,
          priority,
          created_at as "createdAt",
          metadata
      `;

      const values = [
        id,
        data.userId,
        data.topicId,
        data.digestType || 'smart',
        data.timeframe,
        'pending',
        data.priority || 0,
        JSON.stringify(data.metadata || {})
      ];

      const result = await this.pool.query(query, values);
      console.log('[DigestQueueService] Created new queue item:', id);
      return result.rows[0];
    } catch (error: any) {
      console.error('[DigestQueueService] Error creating queue item:', error);
      throw error;
    }
  }

  /**
   * Get queue item by topic and timeframe (more reliable than by ID)
   */
  async getQueueByTopicAndTimeframe(
    userId: string,
    topicId: string,
    timeframe: string,
    digestType: string = 'smart'
  ): Promise<QueueItem | null> {
    try {
      const query = `
        SELECT
          id,
          user_id as "userId",
          topic_id as "topicId",
          digest_type as "digestType",
          timeframe,
          status,
          priority,
          created_at as "createdAt",
          started_at as "startedAt",
          completed_at as "completedAt",
          error,
          retry_count as "retryCount",
          result_id as "resultId",
          metadata
        FROM digest_queue
        WHERE
          user_id = $1
          AND topic_id = $2
          AND timeframe = $3
          AND digest_type = $4
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId, topicId, timeframe, digestType]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[DigestQueueService] Error getting queue by topic/timeframe:', error);
      return null;
    }
  }

  /**
   * Update queue item status (with fallback to find by topic/timeframe)
   */
  async updateQueueStatus(
    queueId: string,
    status: QueueItem['status'],
    error?: string,
    resultId?: string,
    fallbackData?: { userId: string; topicId: string; timeframe: string }
  ): Promise<boolean> {
    try {
      let query: string;
      let values: any[];

      // First, try to update by ID
      if (status === 'processing') {
        query = `
          UPDATE digest_queue
          SET status = $2, started_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `;
        values = [queueId, status];
      } else if (status === 'completed') {
        query = `
          UPDATE digest_queue
          SET status = $2, completed_at = CURRENT_TIMESTAMP, result_id = $3
          WHERE id = $1
        `;
        values = [queueId, status, resultId];
      } else if (status === 'failed' || status === 'cancelled') {
        query = `
          UPDATE digest_queue
          SET status = $2, completed_at = CURRENT_TIMESTAMP, error = $3,
              retry_count = retry_count + 1
          WHERE id = $1
        `;
        values = [queueId, status, error];
      } else {
        query = `UPDATE digest_queue SET status = $2 WHERE id = $1`;
        values = [queueId, status];
      }

      let result = await this.pool.query(query, values);

      // If no rows updated and we have fallback data, try to find by topic/timeframe
      if ((result.rowCount || 0) === 0 && fallbackData) {
        console.log(`[DigestQueueService] Queue ${queueId} not found, trying fallback lookup`);

        const queue = await this.getQueueByTopicAndTimeframe(
          fallbackData.userId,
          fallbackData.topicId,
          fallbackData.timeframe
        );

        if (queue) {
          console.log(`[DigestQueueService] Found queue by fallback: ${queue.id}`);
          // Update with the found queue ID
          values[0] = queue.id;
          result = await this.pool.query(query, values);
        }
      }

      const success = (result.rowCount || 0) > 0;
      if (success) {
        console.log(`[DigestQueueService] Updated queue to ${status}`);
      } else {
        console.log(`[DigestQueueService] Failed to update queue to ${status}`);
      }

      return success;
    } catch (error) {
      console.error('[DigestQueueService] Error updating queue status:', error);
      return false;
    }
  }

  /**
   * Delete completed/failed/cancelled queue items older than 24 hours
   */
  async cleanupOldItems(): Promise<number> {
    try {
      const query = `
        DELETE FROM digest_queue
        WHERE
          status IN ('completed', 'failed', 'cancelled')
          AND completed_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `;

      const result = await this.pool.query(query);
      const rowCount = result.rowCount || 0;
      if (rowCount > 0) {
        console.log(`[DigestQueueService] Cleaned up ${rowCount} old queue items`);
      }
      return rowCount;
    } catch (error) {
      console.error('[DigestQueueService] Error cleaning up old items:', error);
      return 0;
    }
  }

  /**
   * Cancel stale pending items (older than 1 hour)
   */
  async cleanupStaleItems(): Promise<number> {
    try {
      const query = `
        UPDATE digest_queue
        SET
          status = 'cancelled',
          completed_at = CURRENT_TIMESTAMP,
          error = 'Cancelled due to timeout (stale queue item)'
        WHERE
          status = 'pending'
          AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `;

      const result = await this.pool.query(query);
      const rowCount = result.rowCount || 0;
      if (rowCount > 0) {
        console.log(`[DigestQueueService] Cancelled ${rowCount} stale queue items`);
      }
      return rowCount;
    } catch (error) {
      console.error('[DigestQueueService] Error cleaning up stale items:', error);
      return 0;
    }
  }

  /**
   * Get all queue items for a user
   */
  async getUserQueueItems(
    userId: string,
    limit: number = 10
  ): Promise<QueueItem[]> {
    try {
      const query = `
        SELECT
          id,
          user_id as "userId",
          topic_id as "topicId",
          digest_type as "digestType",
          timeframe,
          status,
          priority,
          created_at as "createdAt",
          started_at as "startedAt",
          completed_at as "completedAt",
          error,
          retry_count as "retryCount",
          result_id as "resultId",
          metadata
        FROM digest_queue
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('[DigestQueueService] Error getting user queue items:', error);
      return [];
    }
  }

  /**
   * Check if queue table exists (for migration purposes)
   */
  async checkTableExists(): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'digest_queue'
        )
      `;

      const result = await this.pool.query(query);
      return result.rows[0].exists;
    } catch (error) {
      console.error('[DigestQueueService] Error checking table existence:', error);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    try {
      const query = `
        SELECT
          status,
          COUNT(*) as count,
          MIN(created_at) as oldest,
          MAX(created_at) as newest
        FROM digest_queue
        GROUP BY status
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('[DigestQueueService] Error getting queue stats:', error);
      return [];
    }
  }
}

// Export singleton instance
export default DigestQueueServicePG;