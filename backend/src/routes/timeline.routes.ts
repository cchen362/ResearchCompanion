import { Router } from 'express';
import { TimelineModel } from '../models/timeline.model.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * Get all timeline events for the authenticated user
 */
router.get('/timeline', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const events = await TimelineModel.getByUser(userId);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline events'
    });
  }
});

/**
 * Get timeline events for a specific topic
 */
router.get('/timeline/topic/:topicId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { topicId } = req.params;

    if (!topicId) {
      return res.status(400).json({
        success: false,
        error: 'Topic ID is required'
      });
    }

    const events = await TimelineModel.getByTopic(userId, topicId);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching topic timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topic timeline events'
    });
  }
});

/**
 * Get timeline events by type
 */
router.get('/timeline/type/:type', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { type } = req.params;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Event type is required'
      });
    }

    const events = await TimelineModel.getByType(userId, type);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching timeline by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline events by type'
    });
  }
});

/**
 * Get a single timeline event by ID
 */
router.get('/timeline/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const event = await TimelineModel.getById(userId, id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Timeline event not found'
      });
    }

    res.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error fetching timeline event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline event'
    });
  }
});

/**
 * Create a new timeline event
 */
router.post('/timeline', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { topicId, type, title, data, metadata } = req.body;

    // Validate required fields
    if (!topicId || !type || !title) {
      return res.status(400).json({
        success: false,
        error: 'Topic ID, type, and title are required'
      });
    }

    const event = await TimelineModel.create(
      userId,
      topicId,
      type,
      title,
      data,
      metadata
    );

    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error creating timeline event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create timeline event'
    });
  }
});

/**
 * Update a timeline event
 */
router.put('/timeline/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, description, event_date, data, metadata } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (event_date !== undefined) updates.event_date = new Date(event_date);
    if (data !== undefined) updates.data = data;
    if (metadata !== undefined) updates.metadata = metadata;

    const event = await TimelineModel.update(userId, id, updates);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Timeline event not found or not authorized'
      });
    }

    res.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error updating timeline event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update timeline event'
    });
  }
});

/**
 * Delete a timeline event
 */
router.delete('/timeline/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await TimelineModel.delete(userId, id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Timeline event not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Timeline event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting timeline event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete timeline event'
    });
  }
});

/**
 * Delete all timeline events for a topic
 */
router.delete('/timeline/topic/:topicId', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { topicId } = req.params;

    const count = await TimelineModel.deleteByTopic(userId, topicId);

    res.json({
      success: true,
      message: `Deleted ${count} timeline events for topic`,
      count
    });
  } catch (error) {
    console.error('Error deleting topic timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete topic timeline events'
    });
  }
});

export default router;