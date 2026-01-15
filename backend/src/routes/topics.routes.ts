import express from 'express';
import { TopicModel } from '../models/topic.model.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateTopicSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  patient_context: z.object({
    age: z.number().optional(),
    gender: z.string().optional(),
    symptoms: z.array(z.string()).optional(),
    comorbidities: z.array(z.string()).optional(),
    medications: z.array(z.string()).optional(),
    familyHistory: z.array(z.string()).optional()
  }).optional(),
  sort_order: z.number().optional()
});

const UpdateTopicSchema = CreateTopicSchema.partial();

// GET /api/topics - Get all topics for the authenticated user
router.get('/topics', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const includeArchived = req.query.includeArchived === 'true';

    const topics = await TopicModel.getAllByUserId(userId, includeArchived);

    res.json({
      success: true,
      topics
    });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topics'
    });
  }
});

// GET /api/topics/:id - Get a single topic
router.get('/topics/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const withStats = req.query.withStats === 'true';

    const topic = withStats
      ? await TopicModel.getWithStats(id, userId)
      : await TopicModel.getById(id, userId);

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found'
      });
    }

    res.json({
      success: true,
      topic
    });
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topic'
    });
  }
});

// POST /api/topics - Create a new topic
router.post('/topics', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate request body
    const validation = CreateTopicSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const topic = await TopicModel.create(userId, validation.data);

    res.status(201).json({
      success: true,
      topic
    });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create topic'
    });
  }
});

// PUT /api/topics/:id - Update a topic
router.put('/topics/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Validate request body
    const validation = UpdateTopicSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const topic = await TopicModel.update(id, userId, validation.data);

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found'
      });
    }

    res.json({
      success: true,
      topic
    });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update topic'
    });
  }
});

// DELETE /api/topics/:id - Delete a topic
router.delete('/topics/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const deleted = await TopicModel.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found'
      });
    }

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete topic'
    });
  }
});

// POST /api/topics/:id/archive - Archive/unarchive a topic
router.post('/topics/:id/archive', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { archived = true } = req.body;

    const topic = await TopicModel.setArchived(id, userId, archived);

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found'
      });
    }

    res.json({
      success: true,
      topic
    });
  } catch (error) {
    console.error('Error archiving topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive topic'
    });
  }
});

// PUT /api/topics/reorder - Update sort order for multiple topics
router.put('/topics/reorder', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topics } = req.body;

    if (!Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        error: 'Topics array is required'
      });
    }

    await TopicModel.updateSortOrders(userId, topics);

    res.json({
      success: true,
      message: 'Topic order updated successfully'
    });
  } catch (error) {
    console.error('Error reordering topics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder topics'
    });
  }
});

export default router;