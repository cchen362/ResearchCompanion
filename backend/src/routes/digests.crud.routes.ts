import express from 'express';
import { DigestModel } from '../models/digest.model.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateDigestSchema = z.object({
  topic_id: z.string().uuid().nullable().optional(),
  type: z.string().min(1).max(50),
  title: z.string().optional(),
  executive_summary: z.string().optional(),
  themes: z.array(z.any()).optional(),
  contradictions: z.array(z.any()).optional(),
  breakthroughs: z.array(z.any()).optional(),
  knowledge_gaps: z.array(z.any()).optional(),
  next_steps: z.array(z.any()).optional(),
  finding_ids: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
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

// GET /api/digests/latest/:topicId - Get latest digest for a topic
router.get('/digests/latest/:topicId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topicId } = req.params;

    const digest = await DigestModel.getLatestByTopicId(userId, topicId);

    if (!digest) {
      return res.status(404).json({
        success: false,
        error: 'No digest found for this topic'
      });
    }

    res.json({
      success: true,
      digest
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

    // DEDUPLICATION CHECK: Check if a recent digest already exists
    if (validation.data.topic_id && validation.data.type) {
      console.log('[DIGEST DEDUP] Checking for existing digest...');

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
        console.log('[DIGEST DEDUP] Found existing digest, returning it instead of creating new');
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

    const digest = await DigestModel.create(userId, validation.data);

    console.log(`[DIGEST CREATE] New digest created with ID: ${digest.id}`);
    console.log(`[DIGEST CREATE] Finding IDs saved: ${digest.finding_ids?.length || 0}`);

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
