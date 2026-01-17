import { query, queryOne, transaction } from '../db/database.js';

export interface Conversation {
  id: string;
  user_id: string;
  topic_id?: string;
  title?: string;
  context?: any;
  message_count: number;
  created_at: Date;
  updated_at: Date;
  archived: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: Date;
}

export interface CreateConversationData {
  topic_id?: string;
  title?: string;
  context?: any;
}

export interface CreateMessageData {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

export class ConversationModel {
  // Get all conversations for a user
  static async getAllByUserId(userId: string, includeArchived = false): Promise<Conversation[]> {
    const whereClause = includeArchived ? '' : 'AND archived = false';
    return query<Conversation>(
      `SELECT * FROM conversations
       WHERE user_id = $1 ${whereClause}
       ORDER BY updated_at DESC`,
      [userId]
    );
  }

  // Get conversations for a specific topic
  static async getByTopicId(userId: string, topicId: string): Promise<Conversation[]> {
    return query<Conversation>(
      `SELECT * FROM conversations
       WHERE user_id = $1 AND topic_id = $2 AND archived = false
       ORDER BY updated_at DESC`,
      [userId, topicId]
    );
  }

  // Get a single conversation
  static async getById(id: string, userId: string): Promise<Conversation | null> {
    return queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  // Get conversation with messages
  static async getWithMessages(id: string, userId: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = await this.getById(id, userId);
    if (!conversation) return null;

    const messages = await query<Message>(
      `SELECT * FROM messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [id, userId]
    );

    return { conversation, messages };
  }

  // Create a new conversation
  static async create(userId: string, data: CreateConversationData): Promise<Conversation> {
    const conversation = await queryOne<Conversation>(
      `INSERT INTO conversations (user_id, topic_id, title, context)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        userId,
        data.topic_id || null,
        data.title || null,
        JSON.stringify(data.context || {})
      ]
    );

    if (!conversation) {
      throw new Error('Failed to create conversation');
    }

    return conversation;
  }

  // Update a conversation
  static async update(id: string, userId: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const allowedFields = ['title', 'context', 'archived'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'context') {
          setClause.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      return this.getById(id, userId);
    }

    values.push(id, userId);

    return queryOne<Conversation>(
      `UPDATE conversations
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
  }

  // Archive a conversation
  static async archive(id: string, userId: string, archived = true): Promise<Conversation | null> {
    return this.update(id, userId, { archived });
  }

  // Delete a conversation (and all its messages)
  static async delete(id: string, userId: string): Promise<boolean> {
    // Messages are deleted via CASCADE, but let's be explicit
    await query('DELETE FROM messages WHERE conversation_id = $1 AND user_id = $2', [id, userId]);
    const result = await query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.length > 0;
  }

  // Add a message to a conversation
  static async addMessage(conversationId: string, userId: string, data: CreateMessageData): Promise<Message> {
    // First verify the conversation belongs to the user
    const conversation = await this.getById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message = await queryOne<Message>(
      `INSERT INTO messages (conversation_id, user_id, role, content, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        conversationId,
        userId,
        data.role,
        data.content,
        JSON.stringify(data.metadata || {})
      ]
    );

    if (!message) {
      throw new Error('Failed to create message');
    }

    // Update conversation message count and updated_at
    await query(
      `UPDATE conversations
       SET message_count = message_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    return message;
  }

  // Get messages for a conversation
  static async getMessages(conversationId: string, userId: string, limit = 100, offset = 0): Promise<Message[]> {
    return query<Message>(
      `SELECT * FROM messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at ASC
       LIMIT $3 OFFSET $4`,
      [conversationId, userId, limit, offset]
    );
  }

  // Delete a specific message
  static async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const message = await queryOne<Message>(
      'SELECT conversation_id FROM messages WHERE id = $1 AND user_id = $2',
      [messageId, userId]
    );

    if (!message) return false;

    const result = await query(
      'DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING id',
      [messageId, userId]
    );

    if (result.length > 0) {
      // Update conversation message count
      await query(
        `UPDATE conversations
         SET message_count = message_count - 1
         WHERE id = $1 AND message_count > 0`,
        [message.conversation_id]
      );
    }

    return result.length > 0;
  }

  // Get conversation statistics
  static async getStats(userId: string): Promise<any> {
    const [total, byTopic, totalMessages] = await Promise.all([
      queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM conversations WHERE user_id = $1 AND archived = false',
        [userId]
      ),
      query<{ topic_id: string; count: number }>(
        `SELECT topic_id, COUNT(*) as count FROM conversations
         WHERE user_id = $1 AND archived = false AND topic_id IS NOT NULL
         GROUP BY topic_id`,
        [userId]
      ),
      queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM messages WHERE user_id = $1',
        [userId]
      )
    ]);

    return {
      total_conversations: total?.count || 0,
      total_messages: totalMessages?.count || 0,
      by_topic: byTopic || []
    };
  }
}
