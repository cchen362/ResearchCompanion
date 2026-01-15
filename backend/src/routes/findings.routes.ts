import express from 'express';
import { FindingModel } from '../models/finding.model.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const FindingSourceSchema = z.object({
  type: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  url: z.string().optional(),
  journal: z.string().optional(),
  publishDate: z.string().optional()
});

const CreateFindingSchema = z.object({
  topic_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  summary: z.string().optional(),
  source: FindingSourceSchema,
  metadata: z.record(z.string(), z.any()).optional(),
  relevance_score: z.number().min(0).max(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const UpdateFindingSchema = CreateFindingSchema.partial();

const BulkCreateFindingSchema = z.array(CreateFindingSchema);

// GET /api/findings - Get findings with filters
router.get('/findings', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Parse filters from query params
    const filters = {
      topic_id: req.query.topic_id as string | undefined,
      category: req.query.category as string | undefined,
      is_starred: req.query.is_starred === 'true' ? true : req.query.is_starred === 'false' ? false : undefined,
      is_read: req.query.is_read === 'true' ? true : req.query.is_read === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
      date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
      date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    const findings = await FindingModel.getFiltered(userId, filters);

    res.json({
      success: true,
      findings,
      count: findings.length
    });
  } catch (error) {
    console.error('Error fetching findings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch findings'
    });
  }
});

// GET /api/findings/stats - Get findings statistics
router.get('/findings/stats', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;

    const stats = await FindingModel.getStats(userId, topicId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching findings stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch findings statistics'
    });
  }
});

// GET /api/findings/search - Search findings
router.get('/findings/search', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { q, topic_id } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const findings = await FindingModel.search(userId, q, topic_id as string);

    res.json({
      success: true,
      findings,
      count: findings.length
    });
  } catch (error) {
    console.error('Error searching findings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search findings'
    });
  }
});

// GET /api/findings/:id - Get a single finding
router.get('/findings/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const finding = await FindingModel.getById(id, userId);

    if (!finding) {
      return res.status(404).json({
        success: false,
        error: 'Finding not found'
      });
    }

    res.json({
      success: true,
      finding
    });
  } catch (error) {
    console.error('Error fetching finding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch finding'
    });
  }
});

// POST /api/findings - Create a new finding
router.post('/findings', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate request body
    const validation = CreateFindingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const finding = await FindingModel.create(userId, validation.data);

    res.status(201).json({
      success: true,
      finding
    });
  } catch (error) {
    console.error('Error creating finding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create finding'
    });
  }
});

// POST /api/findings/bulk - Create multiple findings
router.post('/findings/bulk', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate request body
    const validation = BulkCreateFindingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const findings = await FindingModel.createBulk(userId, validation.data);

    res.status(201).json({
      success: true,
      findings,
      count: findings.length
    });
  } catch (error) {
    console.error('Error creating findings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create findings'
    });
  }
});

// PUT /api/findings/:id - Update a finding
router.put('/findings/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Validate request body
    const validation = UpdateFindingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const finding = await FindingModel.update(id, userId, validation.data);

    if (!finding) {
      return res.status(404).json({
        success: false,
        error: 'Finding not found'
      });
    }

    res.json({
      success: true,
      finding
    });
  } catch (error) {
    console.error('Error updating finding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update finding'
    });
  }
});

// DELETE /api/findings/:id - Delete a finding
router.delete('/findings/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const deleted = await FindingModel.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Finding not found'
      });
    }

    res.json({
      success: true,
      message: 'Finding deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting finding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete finding'
    });
  }
});

// POST /api/findings/bulk-delete - Delete multiple findings
router.post('/findings/bulk-delete', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array of finding IDs is required'
      });
    }

    const deletedCount = await FindingModel.deleteBulk(ids, userId);

    res.json({
      success: true,
      message: `${deletedCount} findings deleted successfully`,
      count: deletedCount
    });
  } catch (error) {
    console.error('Error deleting findings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete findings'
    });
  }
});

// POST /api/findings/:id/read - Mark finding as read/unread
router.post('/findings/:id/read', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { is_read = true } = req.body;

    const finding = await FindingModel.markAsRead(id, userId, is_read);

    if (!finding) {
      return res.status(404).json({
        success: false,
        error: 'Finding not found'
      });
    }

    res.json({
      success: true,
      finding
    });
  } catch (error) {
    console.error('Error marking finding as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark finding as read'
    });
  }
});

// POST /api/findings/:id/star - Toggle star status
router.post('/findings/:id/star', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const finding = await FindingModel.toggleStar(id, userId);

    if (!finding) {
      return res.status(404).json({
        success: false,
        error: 'Finding not found'
      });
    }

    res.json({
      success: true,
      finding
    });
  } catch (error) {
    console.error('Error toggling star:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle star'
    });
  }
});

export default router;