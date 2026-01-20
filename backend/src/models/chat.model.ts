import { query, queryOne } from '../db/database.js';
import { validateCitations, type Citation } from '../utils/validation/citations.js';

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
  // Helper method to parse citations from PostgreSQL JSONB
  private static parseCitations(citations: any): Citation[] | null {
    // Use the validation utility for consistent parsing
    const validated = validateCitations(citations);

    if (validated && validated.length > 0) {
      console.log(`✅ [CITATION PARSE] Successfully parsed ${validated.length} valid citations`);
    } else if (citations) {
      console.warn(`⚠️ [CITATION PARSE] No valid citations parsed from input`);
    }

    return validated;
  }

  // Helper method to parse metadata from PostgreSQL JSONB
  private static parseMetadata(metadata: any): any {
    if (!metadata) return {};

    if (typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata;
    }

    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return {};
      }
    }

    return {};
  }

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

    console.log(`📚 [CITATION DEBUG - getMessages] Retrieved ${messages.length} messages from DB`);

    // Parse JSON fields that PostgreSQL returns as strings
    return messages.map((msg, index) => {
      const parsedCitations = this.parseCitations(msg.citations);
      const citationCount = Array.isArray(parsedCitations) ? parsedCitations.length : 0;

      if (citationCount > 0 && parsedCitations) {
        const citationNumbers = parsedCitations.map((c: any) => c.citationNumber).filter(Boolean).sort((a: number, b: number) => a - b);
        console.log(`📖 [CITATION DEBUG - getMessages] Message ${index} (${msg.role}) has ${citationCount} citations: [${citationNumbers.join(', ')}]`);
      } else if (msg.role === 'assistant') {
        console.log(`⚠️ [CITATION DEBUG - getMessages] Assistant message ${index} has NO citations`);
      }

      return {
        ...msg,
        citations: parsedCitations,
        metadata: this.parseMetadata(msg.metadata)
      };
    });
  }

  // Add a message to a chat
  static async addMessage(
    chatId: string,
    userId: string,
    data: Partial<ChatMessage>
  ): Promise<ChatMessage> {
    // Validate citations before saving
    const validatedCitations = data.citations ? validateCitations(data.citations) : null;

    // Debug logging for citation tracking
    const citationCount = validatedCitations ? validatedCitations.length : 0;
    const citationNumbers = validatedCitations
      ? validatedCitations.map(c => c.citationNumber).filter(Boolean).sort((a, b) => a - b)
      : [];

    console.log(`📝 [CITATION DEBUG - addMessage] Saving message with ${citationCount} validated citations`);
    if (citationCount > 0) {
      console.log(`📝 [CITATION DEBUG - addMessage] Citation numbers: [${citationNumbers.join(', ')}]`);
      console.log(`📝 [CITATION DEBUG - addMessage] First citation:`, validatedCitations?.[0]);
    }

    const citationsJson = validatedCitations ? JSON.stringify(validatedCitations) : null;
    console.log(`📝 [CITATION DEBUG - addMessage] Serialized citations length: ${citationsJson ? citationsJson.length : 0} chars`);

    const message = await queryOne<ChatMessage>(
      `INSERT INTO chat_messages (
        chat_id, user_id, role, content, citations, metadata
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      RETURNING *`,
      [
        chatId,
        userId,
        data.role,
        data.content,
        citationsJson,
        JSON.stringify(data.metadata || {})
      ]
    );

    if (!message) {
      throw new Error('Failed to add message');
    }

    // Verify what was actually saved to database
    const savedCitationCount = typeof message.citations === 'string'
      ? (message.citations === 'null' ? 0 : JSON.parse(message.citations).length)
      : (Array.isArray(message.citations) ? message.citations.length : 0);

    console.log(`✅ [CITATION DEBUG - addMessage] Message saved to DB with ${savedCitationCount} citations`);
    if (savedCitationCount > 0) {
      const savedCitations = typeof message.citations === 'string' ? JSON.parse(message.citations) : message.citations;
      const savedNumbers = savedCitations.map((c: any) => c.citationNumber).filter(Boolean).sort((a: number, b: number) => a - b);
      console.log(`✅ [CITATION DEBUG - addMessage] Saved citation numbers: [${savedNumbers.join(', ')}]`);
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
    const parsedMessage = {
      ...message,
      citations: this.parseCitations(message.citations),
      metadata: this.parseMetadata(message.metadata)
    };

    const finalCitationCount = Array.isArray(parsedMessage.citations) ? parsedMessage.citations.length : 0;
    console.log(`✅ [CITATION DEBUG - addMessage] Returning message with ${finalCitationCount} citations to frontend`);

    return parsedMessage;
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