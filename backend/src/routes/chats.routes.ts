import express from 'express';
import { ChatModel } from '../models/chat.model.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateChatSchema = z.object({
  topic_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  context: z.record(z.string(), z.any()).optional()
});

const UpdateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'archived']).optional(),
  context: z.record(z.string(), z.any()).optional()
});

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  citations: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// GET /api/chats - Get all chats for the user
router.get('/chats', async (req, res) => {
  console.log('📋 [Backend] GET /chats - Loading chats:', {
    userId: (req as any).user?.id,
    topicId: req.query.topic_id,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;

    const chats = await ChatModel.getAll(userId, topicId);

    console.log('📋 [Backend] Chats loaded:', {
      count: chats.length,
      topicId: topicId,
      chatIds: chats.map(c => ({ id: c.id, title: c.title }))
    });

    res.json({
      success: true,
      chats
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chats'
    });
  }
});

// GET /api/chats/:id - Get a specific chat
router.get('/chats/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.id;

    const chat = await ChatModel.getById(chatId, userId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat'
    });
  }
});

// POST /api/chats - Create a new chat
router.post('/chats', async (req, res) => {
  console.log('📝 [Backend] POST /chats - Creating new chat:', {
    userId: (req as any).user?.id,
    topicId: req.body.topic_id,
    title: req.body.title,
    timestamp: new Date().toISOString()
  });

  try {
    const userId = (req as any).user.id;
    const data = CreateChatSchema.parse(req.body);

    // Log before creating
    console.log('📝 [Backend] Checking for existing chat for topic:', data.topic_id);

    const chat = await ChatModel.create(userId, data);

    console.log('✅ [Backend] Chat created successfully:', {
      chatId: chat.id,
      topicId: chat.topic_id,
      title: chat.title
    });

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('❌ [Backend] Error creating chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat'
    });
  }
});

// PUT /api/chats/:id - Update a chat
router.put('/chats/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.id;
    const data = UpdateChatSchema.parse(req.body);

    const chat = await ChatModel.update(chatId, userId, data);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update chat'
    });
  }
});

// DELETE /api/chats/:id - Delete a chat
router.delete('/chats/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.id;

    await ChatModel.delete(chatId, userId);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete chat'
    });
  }
});

// GET /api/chats/:id/messages - Get messages for a chat
router.get('/chats/:id/messages', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 100;

    const messages = await ChatModel.getMessages(chatId, userId, limit);

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

// POST /api/chats/:id/messages - Add a message to a chat
router.post('/chats/:id/messages', async (req, res) => {
  console.log('📨 [Backend] POST /chats/:id/messages received:', {
    chatId: req.params.id,
    userId: (req as any).user?.id,
    role: req.body.role,
    contentLength: req.body.content?.length,
    hasCitations: !!req.body.citations,
    hasMetadata: !!req.body.metadata,
    headers: {
      authorization: !!req.headers.authorization,
      contentType: req.headers['content-type']
    }
  });

  try {
    const userId = (req as any).user.id;
    const chatId = req.params.id;
    const data = AddMessageSchema.parse(req.body);

    console.log('📨 [Backend] Parsed message data:', {
      role: data.role,
      contentLength: data.content.length,
      citationsCount: data.citations?.length || 0
    });

    // Additional citation debugging
    if (data.citations && data.citations.length > 0) {
      const citationNumbers = data.citations
        .map((c: any) => c.citationNumber)
        .filter(Boolean)
        .sort((a: number, b: number) => a - b);
      console.log(`📝 [CITATION DEBUG - API] Received ${data.citations.length} citations from frontend: [${citationNumbers.join(', ')}]`);
      console.log(`📝 [CITATION DEBUG - API] First citation:`, data.citations[0]);
    }

    // Verify chat exists and belongs to user
    console.log('🔍 [Backend] Looking up chat:', { chatId, userId });
    const chat = await ChatModel.getById(chatId, userId);

    if (!chat) {
      console.error('❌ [Backend] Chat not found:', { chatId, userId });
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    console.log('✅ [Backend] Chat found, adding message...');
    const message = await ChatModel.addMessage(chatId, userId, data);

    console.log('✅ [Backend] Message added successfully:', {
      messageId: message.id,
      chatId: message.chat_id,
      role: message.role,
      timestamp: message.created_at
    });

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('❌ [Backend] Error adding message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

// DELETE /api/chats/:id/messages - Clear all messages in a chat
router.delete('/chats/:id/messages', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.id;

    // Verify chat exists and belongs to user
    const chat = await ChatModel.getById(chatId, userId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    // Clear all messages from the chat
    await ChatModel.clearMessages(chatId, userId);

    res.json({
      success: true,
      message: 'Messages cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear messages'
    });
  }
});

// Alternative route for topic-based URL structure
// DELETE /api/topics/:topicId/chats/:chatId/messages
router.delete('/topics/:topicId/chats/:chatId/messages', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.chatId;

    // Verify chat exists and belongs to user
    const chat = await ChatModel.getById(chatId, userId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    // Clear all messages from the chat
    await ChatModel.clearMessages(chatId, userId);

    res.json({
      success: true,
      message: 'Messages cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear messages'
    });
  }
});

export default router;