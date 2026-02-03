/**
 * Digest Queue Routes
 * API endpoints for managing digest generation queue in PostgreSQL
 */

import express from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import DigestQueueServicePG from '../services/digestQueue.service.pg.js';
import { authenticate } from '../middleware/auth.js';

// Validation schemas
const CreateQueueItemSchema = z.object({
  topicId: z.string().uuid(),
  digestType: z.enum(['smart', 'simple']).optional().default('smart'),
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'all']),
  priority: z.number().int().min(0).max(10).optional().default(0),
  metadata: z.record(z.string(), z.any()).optional()
});

const UpdateQueueStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  error: z.string().optional(),
  resultId: z.string().uuid().optional()
});

export function createDigestQueueRouter(pool: Pool) {
  const router = express.Router();
  const queueService = new DigestQueueServicePG(pool);

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * GET /api/digest-queue/status/:topicId
   * Get active queue status for a topic
   */
  router.get('/status/:topicId', async (req, res) => {
    try {
      const { topicId } = req.params;
      const { timeframe } = req.query;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log(`[DigestQueue] Checking queue status for topic ${topicId}, timeframe ${timeframe}`);

      // Get active queue item
      const queueItem = timeframe
        ? await queueService.getActiveQueueForTopic(userId, topicId, timeframe as string)
        : await queueService.getQueueStatusByTopic(userId, topicId);

      if (!queueItem) {
        return res.json({
          hasActiveQueue: false,
          message: 'No active digest generation for this topic'
        });
      }

      // Return queue status
      res.json({
        hasActiveQueue: true,
        queueId: queueItem.id,
        status: queueItem.status,
        createdAt: queueItem.createdAt,
        startedAt: queueItem.startedAt,
        timeframe: queueItem.timeframe,
        digestType: queueItem.digestType
      });
    } catch (error) {
      console.error('[DigestQueue] Error checking queue status:', error);
      res.status(500).json({ error: 'Failed to check queue status' });
    }
  });

  /**
   * POST /api/digest-queue
   * Create a new queue item
   */
  router.post('/', async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = CreateQueueItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validation.error.issues
        });
      }

      const { topicId, digestType, timeframe, priority, metadata } = validation.data;

      console.log(`[DigestQueue] Creating queue item for topic ${topicId}, timeframe ${timeframe}`);

      // Create queue item
      const queueItem = await queueService.createQueueItem({
        userId,
        topicId,
        digestType,
        timeframe,
        priority,
        metadata
      });

      res.status(201).json({
        success: true,
        queueId: queueItem.id,
        status: queueItem.status,
        message: 'Digest generation queued successfully'
      });
    } catch (error: any) {
      console.error('[DigestQueue] Error creating queue item:', error);

      // Handle duplicate queue gracefully
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'A digest is already being generated for this topic',
          code: 'QUEUE_EXISTS'
        });
      }

      res.status(500).json({ error: 'Failed to queue digest generation' });
    }
  });

  /**
   * PATCH /api/digest-queue/:queueId
   * Update queue item status
   */
  router.patch('/:queueId', async (req, res) => {
    try {
      const { queueId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = UpdateQueueStatusSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validation.error.issues
        });
      }

      const { status, error, resultId } = validation.data;

      console.log(`[DigestQueue] Updating queue ${queueId} to status ${status}`);

      // Update queue status
      const updated = await queueService.updateQueueStatus(
        queueId,
        status,
        error,
        resultId
      );

      if (!updated) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      res.json({
        success: true,
        message: `Queue status updated to ${status}`
      });
    } catch (error) {
      console.error('[DigestQueue] Error updating queue status:', error);
      res.status(500).json({ error: 'Failed to update queue status' });
    }
  });

  /**
   * DELETE /api/digest-queue/:queueId
   * Cancel a queue item (sets status to cancelled)
   */
  router.delete('/:queueId', async (req, res) => {
    try {
      const { queueId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log(`[DigestQueue] Cancelling queue item ${queueId}`);

      // Cancel the queue item
      const cancelled = await queueService.updateQueueStatus(
        queueId,
        'cancelled',
        'Cancelled by user'
      );

      if (!cancelled) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      res.json({
        success: true,
        message: 'Queue item cancelled successfully'
      });
    } catch (error) {
      console.error('[DigestQueue] Error cancelling queue item:', error);
      res.status(500).json({ error: 'Failed to cancel queue item' });
    }
  });

  /**
   * GET /api/digest-queue
   * Get user's queue items
   */
  router.get('/', async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = parseInt(req.query.limit as string) || 10;

      console.log(`[DigestQueue] Fetching queue items for user ${userId}`);

      const items = await queueService.getUserQueueItems(userId, limit);

      res.json({
        items,
        count: items.length
      });
    } catch (error) {
      console.error('[DigestQueue] Error fetching queue items:', error);
      res.status(500).json({ error: 'Failed to fetch queue items' });
    }
  });

  /**
   * POST /api/digest-queue/cleanup
   * Trigger cleanup of old/stale queue items
   */
  router.post('/cleanup', async (req, res) => {
    try {
      console.log('[DigestQueue] Running queue cleanup');

      const [staleCount, oldCount] = await Promise.all([
        queueService.cleanupStaleItems(),
        queueService.cleanupOldItems()
      ]);

      res.json({
        success: true,
        staleCancelled: staleCount,
        oldDeleted: oldCount,
        message: `Cleaned up ${staleCount + oldCount} queue items`
      });
    } catch (error) {
      console.error('[DigestQueue] Error during cleanup:', error);
      res.status(500).json({ error: 'Failed to cleanup queue' });
    }
  });

  /**
   * GET /api/digest-queue/stats
   * Get queue statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      console.log('[DigestQueue] Fetching queue statistics');

      const stats = await queueService.getQueueStats();

      res.json({
        stats,
        summary: {
          total: stats.reduce((sum: number, s: any) => sum + parseInt(s.count), 0),
          pending: stats.find((s: any) => s.status === 'pending')?.count || 0,
          processing: stats.find((s: any) => s.status === 'processing')?.count || 0,
          completed: stats.find((s: any) => s.status === 'completed')?.count || 0,
          failed: stats.find((s: any) => s.status === 'failed')?.count || 0,
          cancelled: stats.find((s: any) => s.status === 'cancelled')?.count || 0
        }
      });
    } catch (error) {
      console.error('[DigestQueue] Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch queue statistics' });
    }
  });

  return router;
}

export default createDigestQueueRouter;