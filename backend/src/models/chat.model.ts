import { query, queryOne } from '../db/database.js';

export interface Chat {
  id: string;
  user_id: string;
  topic_id: string;
  title: string;
  status: 'active' | 'archived';
  context: any;
  message_count: number;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: any;
  metadata?: any;
  created_at: Date;
}

export class ChatModel {
  // Get all chats for a user
  static async getAll(userId: string, topicId?: string): Promise<Chat[]> {
    let queryStr = 'SELECT * FROM chats WHERE user_id = $1';
    const params: any[] = [userId];

    if (topicId) {
      queryStr += ' AND topic_id = $2';
      params.push(topicId);
    }

    queryStr += ' ORDER BY last_message_at DESC';
    return query<Chat>(queryStr, params);
  }

  // Get a single chat
  static async getById(id: string, userId: string): Promise<Chat | null> {
    return queryOne<Chat>(
      'SELECT * FROM chats WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  // Create a new chat
  static async create(userId: string, data: Partial<Chat>): Promise<Chat> {
    const chat = await queryOne<Chat>(
      `INSERT INTO chats (
        user_id, topic_id, title, status, context, message_count, last_message_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        userId,
        data.topic_id,
        data.title || 'New Chat',
        data.status || 'active',
        JSON.stringify(data.context || {}),
        0
      ]
    );

    if (!chat) {
      throw new Error('Failed to create chat');
    }

    return chat;
  }

  // Update a chat
  static async update(id: string, userId: string, data: Partial<Chat>): Promise<Chat | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(data.title);
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (data.context !== undefined) {
      updates.push(`context = $${paramCount++}`);
      values.push(JSON.stringify(data.context));
    }

    if (data.message_count !== undefined) {
      updates.push(`message_count = $${paramCount++}`);
      values.push(data.message_count);
    }

    updates.push(`last_message_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id, userId);

    return queryOne<Chat>(
      `UPDATE chats
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
  }

  // Delete a chat
  static async delete(id: string, userId: string): Promise<boolean> {
    // First delete all messages
    await query('DELETE FROM chat_messages WHERE chat_id = $1', [id]);

    // Then delete the chat
    const result = await query(
      'DELETE FROM chats WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    return true;
  }

  // Get messages for a chat
  static async getMessages(chatId: string, userId: string, limit = 100): Promise<ChatMessage[]> {
    const messages = await query<ChatMessage>(
      `SELECT cm.* FROM chat_messages cm
       JOIN chats c ON cm.chat_id = c.id
       WHERE cm.chat_id = $1 AND c.user_id = $2
       ORDER BY cm.created_at ASC
       LIMIT $3`,
      [chatId, userId, limit]
    );

    // Parse JSON fields that PostgreSQL returns as strings
    return messages.map(msg => ({
      ...msg,
      citations: typeof msg.citations === 'string' ? JSON.parse(msg.citations) : msg.citations,
      metadata: typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
    }));
  }

  // Add a message to a chat
  static async addMessage(
    chatId: string,
    userId: string,
    data: Partial<ChatMessage>
  ): Promise<ChatMessage> {
    const message = await queryOne<ChatMessage>(
      `INSERT INTO chat_messages (
        chat_id, user_id, role, content, citations, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        chatId,
        userId,
        data.role,
        data.content,
        JSON.stringify(data.citations || null),
        JSON.stringify(data.metadata || {})
      ]
    );

    if (!message) {
      throw new Error('Failed to add message');
    }

    // Update chat's last message time and count
    await query(
      `UPDATE chats
       SET last_message_at = CURRENT_TIMESTAMP,
           message_count = message_count + 1
       WHERE id = $1`,
      [chatId]
    );

    // Parse JSON fields that PostgreSQL returns as strings
    return {
      ...message,
      citations: typeof message.citations === 'string' ? JSON.parse(message.citations) : message.citations,
      metadata: typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata
    };
  }

  // Clear all messages in a chat
  static async clearMessages(chatId: string, userId: string): Promise<void> {
    // Delete all messages for this chat
    await query(
      `DELETE FROM chat_messages
       WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId]
    );

    // Reset message count and last message time
    await query(
      `UPDATE chats
       SET message_count = 0,
           last_message_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [chatId, userId]
    );
  }
}