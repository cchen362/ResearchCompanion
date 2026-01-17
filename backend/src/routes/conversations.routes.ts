import express from 'express';
import { ConversationModel } from '../models/conversation.model.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateConversationSchema = z.object({
  topic_id: z.string().uuid().nullable().optional(),
  title: z.string().optional(),
  context: z.record(z.string(), z.any()).optional()
});

const UpdateConversationSchema = CreateConversationSchema.partial().extend({
  archived: z.boolean().optional()
});

const CreateMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional()
});

// GET /api/conversations - Get all conversations for the authenticated user
router.get('/conversations', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;
    const includeArchived = req.query.includeArchived === 'true';

    let conversations;
    if (topicId) {
      conversations = await ConversationModel.getByTopicId(userId, topicId);
    } else {
      conversations = await ConversationModel.getAllByUserId(userId, includeArchived);
    }

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// GET /api/conversations/stats - Get conversation statistics
router.get('/conversations/stats', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const stats = await ConversationModel.getStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching conversation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation statistics'
    });
  }
});

// GET /api/conversations/:id - Get a single conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const withMessages = req.query.withMessages === 'true';

    if (withMessages) {
      const result = await ConversationModel.getWithMessages(id, userId);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }
      return res.json({
        success: true,
        conversation: result.conversation,
        messages: result.messages
      });
    }

    const conversation = await ConversationModel.getById(id, userId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation'
    });
  }
});

// GET /api/conversations/:id/messages - Get messages for a conversation
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const messages = await ConversationModel.getMessages(id, userId, limit, offset);

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// POST /api/conversations - Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Validate request body
    const validation = CreateConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const conversation = await ConversationModel.create(userId, validation.data);

    res.status(201).json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});

// POST /api/conversations/:id/messages - Add a message to a conversation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Validate request body
    const validation = CreateMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const message = await ConversationModel.addMessage(id, userId, validation.data);

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add message'
    });
  }
});

// PUT /api/conversations/:id - Update a conversation
router.put('/conversations/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // Validate request body
    const validation = UpdateConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const conversation = await ConversationModel.update(id, userId, validation.data);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation'
    });
  }
});

// POST /api/conversations/:id/archive - Archive/unarchive a conversation
router.post('/conversations/:id/archive', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { archived = true } = req.body;

    const conversation = await ConversationModel.archive(id, userId, archived);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error archiving conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive conversation'
    });
  }
});

// DELETE /api/conversations/:id - Delete a conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const deleted = await ConversationModel.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

// DELETE /api/conversations/:convId/messages/:msgId - Delete a specific message
router.delete('/conversations/:convId/messages/:msgId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { msgId } = req.params;

    const deleted = await ConversationModel.deleteMessage(msgId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
});

export default router;
