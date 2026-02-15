import express from 'express';
import { DigestModel } from '../models/digest.model.js';
import { z } from 'zod';
import DigestQueueServicePG from '../services/digestQueue.service.pg.js';
import { pool } from '../db/database.js';
import { TopicModel } from '../models/topic.model.js';
import { FindingModel } from '../models/finding.model.js';

const router = express.Router();
const queueService = new DigestQueueServicePG(pool);

// Validation schemas
const CreateDigestSchema = z.object({
  topic_id: z.string().uuid().nullable().optional(),
  type: z.string().min(1).max(50),
  title: z.string().optional(),
  whats_new: z.any().optional(),
  key_takeaways: z.array(z.any()).optional(),
  finding_ids: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  featured_discovery: z.any().optional(),
  notable_findings: z.array(z.any()).optional(),
  source_breakdown: z.any().optional(),
  for_your_doctor: z.any().optional(),
});

const UpdateDigestSchema = CreateDigestSchema.partial();

// GET /api/digests - Get all digests for the authenticated user
router.get('/digests', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    let digests;
    if (topicId) {
      digests = await DigestModel.getByTopicId(userId, topicId, limit);
    } else {
      digests = await DigestModel.getAllByUserId(userId, limit);
    }

    res.json({
      success: true,
      digests
    });
  } catch (error) {
    console.error('Error fetching digests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digests'
    });
  }
});

// GET /api/digests/latest/:topicId - Get latest digest for a topic with queue status
router.get('/digests/latest/:topicId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topicId } = req.params;
    const { timeframe } = req.query; // Get timeframe from query params

    console.log(`[DIGEST] Fetching latest digest for topic ${topicId}, timeframe ${timeframe || 'any'}`);

    // Get latest digest, optionally filtered by timeframe
    let digest;
    if (timeframe) {
      // Get all digests for the topic
      const digests = await DigestModel.getByTopicId(userId, topicId, 10);

      // Filter by timeframe (stored in type field and/or metadata)
      digest = digests.find(d =>
        d.type === timeframe ||
        d.metadata?.timeframe === timeframe
      );

      if (digest) {
        console.log(`[DIGEST CACHE] HIT - Found cached ${timeframe} digest: ${digest.id}`);
      } else {
        console.log(`[DIGEST CACHE] MISS - No ${timeframe} digest found for topic ${topicId}`);
      }
    } else {
      // No timeframe specified, get the latest digest regardless of type
      digest = await DigestModel.getLatestByTopicId(userId, topicId);

      if (digest) {
        console.log(`[DIGEST CACHE] HIT - Found cached digest: ${digest.id}`);
      } else {
        console.log(`[DIGEST CACHE] MISS - No digest found for topic ${topicId}`);
      }
    }

    // Check for active queue status
    let queueStatus = null;
    let isGenerating = false;

    try {
      if (timeframe) {
        // Check for active queue with specific timeframe
        const queueItem = await queueService.getActiveQueueForTopic(userId, topicId, timeframe as string);
        if (queueItem) {
          console.log(`[DIGEST QUEUE] Active queue found for topic ${topicId}: ${queueItem.status}`);
          queueStatus = {
            queueId: queueItem.id,
            status: queueItem.status,
            createdAt: queueItem.createdAt,
            startedAt: queueItem.startedAt
          };
          isGenerating = queueItem.status === 'processing';
        } else {
          console.log(`[DIGEST QUEUE] No active queue for topic ${topicId}`);
        }
      } else {
        // Check for any active queue for the topic
        const queueItem = await queueService.getQueueStatusByTopic(userId, topicId);
        if (queueItem) {
          console.log(`[DIGEST QUEUE] Active queue found for topic ${topicId}: ${queueItem.status}`);
          queueStatus = {
            queueId: queueItem.id,
            status: queueItem.status,
            timeframe: queueItem.timeframe,
            createdAt: queueItem.createdAt,
            startedAt: queueItem.startedAt
          };
          isGenerating = queueItem.status === 'processing';
        }
      }
    } catch (queueError) {
      console.error('[DIGEST QUEUE] Error checking queue status:', queueError);
      // Don't fail the request if queue check fails
    }

    if (!digest && !queueStatus) {
      return res.status(404).json({
        success: false,
        error: `No digest found for this topic${timeframe ? ` with timeframe: ${timeframe}` : ''}`,
        isGenerating: false,
        queueStatus: null
      });
    }

    // Temporal enrichment: personalize whats_new based on time away
    if (digest) {
      try {
        const topic = await TopicModel.getById(topicId, userId);
        const lastViewed = topic?.last_digest_viewed_at;
        if (lastViewed && digest.whats_new) {
          const daysAway = Math.floor((Date.now() - new Date(lastViewed).getTime()) / 86400000);
          if (daysAway > 1) {
            const newCount = await FindingModel.countSince(userId, topicId, new Date(lastViewed));
            if (newCount > 0) {
              const whatsNew = typeof digest.whats_new === 'string'
                ? JSON.parse(digest.whats_new) : digest.whats_new;
              const restTech = whatsNew.technical?.replace(/^[^.]+\./, '').trim() || '';
              const restExpl = whatsNew.explained?.replace(/^[^.]+\./, '').trim() || '';
              whatsNew.technical = `${newCount} new findings in your ${daysAway} days away. ${restTech}`;
              whatsNew.explained = `${newCount} new findings in your ${daysAway} days away. ${restExpl}`;
              digest.whats_new = whatsNew;
            }
          }
        }
      } catch (temporalErr) {
        console.error('[DIGEST] Temporal enrichment failed:', temporalErr);
      }

      // Track that user viewed this digest
      try {
        await TopicModel.updateLastDigestViewed(topicId, userId);
      } catch (trackErr) {
        console.error('[DIGEST] Failed to track digest view:', trackErr);
      }
    }

    // Return digest with queue status included
    res.json({
      success: true,
      digest,
      isGenerating,
      queueStatus
    });
  } catch (error) {
    console.error('Error fetching latest digest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest digest'
    });
  }
});

// GET /api/digests/stats - Get digest statistics
router.get('/digests/stats', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const stats = await DigestModel.getStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching digest stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digest statistics'
    });
  }
});

// GET /api/digests/:id - Get a single digest
router.get('/digests/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const digest = await DigestModel.getById(id, userId);

    if (!digest) {
      return res.status(404).json({
        success: false,
        error: 'Digest not found'
      });
    }

    res.json({
      success: true,
      digest
    });
  } catch (error) {
    console.error('Error fetching digest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch digest'
    });
  }
});

// POST /api/digests - Create a new digest (save generated digest)
router.post('/digests', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate request body
    const validation = CreateDigestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    // DEDUPLICATION CHECK: Check queue status FIRST, then check for recent digest
    if (validation.data.topic_id && validation.data.type) {
      console.log('[DIGEST DEDUP] Checking queue status and existing digest...');

      // CRITICAL: Check if there's an active queue BEFORE deduplicating
      const activeQueue = await queueService.getQueueByTopicAndTimeframe(
        userId,
        validation.data.topic_id,
        validation.data.type,
        'smart'
      );

      // If there's a pending, processing, or RECENTLY completed queue, DON'T deduplicate
      let skipDeduplication = false;

      if (activeQueue && (activeQueue.status === 'pending' || activeQueue.status === 'processing')) {
        console.log(`[DIGEST DEDUP] Active queue found (${activeQueue.status}), skipping deduplication`);
        skipDeduplication = true;
      } else if (activeQueue && activeQueue.status === 'completed' && activeQueue.completedAt) {
        // Check if completed within last 5 minutes (fresh generation)
        const completedTime = new Date(activeQueue.completedAt).getTime();
        const minutesSinceCompletion = (Date.now() - completedTime) / (1000 * 60);

        if (minutesSinceCompletion < 5) {
          console.log(`[DIGEST DEDUP] Queue completed ${minutesSinceCompletion.toFixed(1)} minutes ago, skipping deduplication for fresh digest`);
          skipDeduplication = true;
        }
      }

      if (!skipDeduplication) {
        // Only deduplicate if no active queue
        // Get digests for this topic created in the last 7 days
        const recentDigests = await DigestModel.getByTopicId(
          userId,
          validation.data.topic_id,
          10
        );

        // Check if there's a digest of the same type created within the timeframe
        const timeThreshold = {
          'daily': 24 * 60 * 60 * 1000,    // 24 hours
          'weekly': 7 * 24 * 60 * 60 * 1000, // 7 days
          'monthly': 30 * 24 * 60 * 60 * 1000, // 30 days
          'all-time': 7 * 24 * 60 * 60 * 1000  // Default to 7 days for all-time
        };

        const threshold = timeThreshold[validation.data.type as keyof typeof timeThreshold] || timeThreshold['weekly'];
        const now = Date.now();

        const existingDigest = recentDigests.find(d => {
          const digestAge = now - new Date(d.created_at).getTime();
          return d.type === validation.data.type && digestAge < threshold;
        });

        if (existingDigest) {
          console.log('[DIGEST DEDUP] Found existing digest AND no active queue, returning existing');
          console.log(`[DIGEST DEDUP] Existing digest ID: ${existingDigest.id}, created: ${existingDigest.created_at}`);

          // Return the existing digest instead of creating a new one
          return res.status(200).json({
            success: true,
            digest: existingDigest,
            deduplicated: true,
            message: `Using existing ${validation.data.type} digest from ${new Date(existingDigest.created_at).toLocaleDateString()}`
          });
        }

        console.log('[DIGEST DEDUP] No recent digest found, creating new one');
      }
    }

    // Ensure timeframe is stored in metadata for filtering
    const digestData = {
      ...validation.data,
      metadata: {
        ...validation.data.metadata,
        timeframe: validation.data.type // Store the timeframe in metadata as well
      }
    };

    const digest = await DigestModel.create(userId, digestData);

    console.log(`[DIGEST CREATE] New digest created with ID: ${digest.id}`);
    console.log(`[DIGEST CREATE] Finding IDs saved: ${digest.finding_ids?.length || 0}`);

    // UPDATE QUEUE with result_id if there's an active queue for this topic
    if (validation.data.topic_id && validation.data.type) {
      try {
        const queueItem = await queueService.getQueueByTopicAndTimeframe(
          userId,
          validation.data.topic_id,
          validation.data.type,
          'smart'
        );

        if (queueItem && (queueItem.status === 'processing' || queueItem.status === 'pending')) {
          console.log(`[DIGEST CREATE] Updating queue ${queueItem.id} with result_id: ${digest.id}`);
          await queueService.updateQueueStatus(
            queueItem.id,
            'completed',
            undefined,
            digest.id
          );
        }
      } catch (queueError) {
        console.error('[DIGEST CREATE] Error updating queue:', queueError);
        // Don't fail the digest creation if queue update fails
      }
    }

    res.status(201).json({
      success: true,
      digest
    });
  } catch (error) {
    console.error('Error creating digest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create digest'
    });
  }
});

// PUT /api/digests/:id - Update a digest
router.put('/digests/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Validate request body
    const validation = UpdateDigestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const digest = await DigestModel.update(id, userId, validation.data);

    if (!digest) {
      return res.status(404).json({
        success: false,
        error: 'Digest not found'
      });
    }

    res.json({
      success: true,
      digest
    });
  } catch (error) {
    console.error('Error updating digest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update digest'
    });
  }
});

// DELETE /api/digests/:id - Delete a digest
router.delete('/digests/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const deleted = await DigestModel.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Digest not found'
      });
    }

    res.json({
      success: true,
      message: 'Digest deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting digest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete digest'
    });
  }
});

export default router;
