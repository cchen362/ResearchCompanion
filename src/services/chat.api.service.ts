import { api } from './api';
import type { FindingsChat, ChatMessage } from '@/types';

// Transform backend chat to frontend format
const transformChat = (chat: any): FindingsChat => ({
  id: chat.id,
  topicId: chat.topic_id,
  title: chat.title,
  status: chat.status,
  createdAt: chat.created_at,
  lastMessageAt: chat.last_message_at,
  messageCount: chat.message_count,
  context: chat.context || {}
});

// Transform backend message to frontend format
const transformMessage = (message: any): ChatMessage => {
  // Robust citation parsing with validation
  let citations = message.citations;

  if (typeof citations === 'string') {
    try {
      citations = citations === 'null' ? null : JSON.parse(citations);
    } catch (error) {
      console.error('❌ [transformMessage] Failed to parse citations:', error);
      console.error('❌ [transformMessage] Raw citations:', citations);
      citations = null;
    }
  }

  // Validate citations array
  if (citations && Array.isArray(citations)) {
    const citationNumbers = citations
      .map((c: any) => c?.citationNumber)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);
    console.log(`📝 [transformMessage] Message ${message.id} has ${citations.length} citations: [${citationNumbers.join(', ')}]`);
  } else if (message.role === 'assistant' && !citations) {
    console.warn(`⚠️ [transformMessage] Assistant message ${message.id} has no citations`);
  }

  // Robust metadata parsing
  let metadata = message.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = {};
    }
  }

  return {
    id: message.id,
    chatId: message.chat_id,
    role: message.role,
    content: message.content,
    citations: citations,
    metadata: metadata || {},
    timestamp: message.created_at
  };
};

class ChatAPIService {
  // Get all chats for a topic
  async getChats(topicId?: string): Promise<FindingsChat[]> {
    try {
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.get(`/chats${params}`);
      return response.data.chats.map(transformChat);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      throw error;
    }
  }

  // Get a specific chat
  async getChat(chatId: string): Promise<FindingsChat> {
    try {
      const response = await api.get(`/chats/${chatId}`);
      return transformChat(response.data.chat);
    } catch (error) {
      console.error('Failed to fetch chat:', error);
      throw error;
    }
  }

  // Create a new chat
  async createChat(topicId: string, title?: string, context?: any): Promise<FindingsChat> {
    try {
      const response = await api.post('/chats', {
        topic_id: topicId,
        title: title || 'New Chat',
        context: context || {}
      });
      return transformChat(response.data.chat);
    } catch (error) {
      console.error('Failed to create chat:', error);
      throw error;
    }
  }

  // Update a chat
  async updateChat(chatId: string, updates: Partial<FindingsChat>): Promise<FindingsChat> {
    try {
      const response = await api.put(`/chats/${chatId}`, {
        title: updates.title,
        status: updates.status,
        context: updates.context
      });
      return transformChat(response.data.chat);
    } catch (error) {
      console.error('Failed to update chat:', error);
      throw error;
    }
  }

  // Delete a chat
  async deleteChat(chatId: string): Promise<void> {
    try {
      await api.delete(`/chats/${chatId}`);
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  }

  // Get messages for a chat
  async getMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
    try {
      const response = await api.get(`/chats/${chatId}/messages?limit=${limit}`);
      // Messages are already in chronological order (ASC) from database
      return response.data.messages.map(transformMessage);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  }

  // Add a message to a chat
  async addMessage(
    chatId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    citations?: any,
    metadata?: any
  ): Promise<ChatMessage> {
    console.log('🚀 [chatAPIService] addMessage called:', {
      chatId,
      role,
      contentLength: content.length,
      hasCitations: !!citations,
      citationsCount: citations?.length || 0,
      hasMetadata: !!metadata
    });

    // Log citation details if present
    if (citations && Array.isArray(citations)) {
      const citationNumbers = citations
        .map((c: any) => c?.citationNumber)
        .filter(Boolean)
        .sort((a: number, b: number) => a - b);
      console.log(`📝 [chatAPIService] Sending ${citations.length} citations: [${citationNumbers.join(', ')}]`);
      if (citations.length > 0) {
        console.log(`📝 [chatAPIService] First citation:`, citations[0]);
      }
    }

    try {
      const payload = {
        role,
        content,
        citations: citations || null, // Ensure null instead of undefined
        metadata: metadata || {}
      };
      console.log('📤 [chatAPIService] Sending POST request to:', `/chats/${chatId}/messages`);
      console.log('📤 [chatAPIService] Payload:', {
        role: payload.role,
        contentLength: payload.content.length,
        citationsCount: payload.citations?.length || 0
      });

      const response = await api.post(`/chats/${chatId}/messages`, payload);

      console.log('📥 [chatAPIService] Response received:', {
        status: response.status,
        hasMessage: !!response.data?.message,
        messageId: response.data?.message?.id
      });

      const transformedMessage = transformMessage(response.data.message);
      console.log('✅ [chatAPIService] Message transformed and returning:', {
        id: transformedMessage.id,
        timestamp: transformedMessage.timestamp
      });

      return transformedMessage;
    } catch (error: any) {
      console.error('❌ [chatAPIService] Failed to add message:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  }

  // Save multiple messages (for bulk operations)
  async saveMessages(chatId: string, messages: Partial<ChatMessage>[]): Promise<void> {
    try {
      // Save messages one by one (could be optimized with bulk endpoint)
      for (const message of messages) {
        await this.addMessage(
          chatId,
          message.role as any,
          message.content || '',
          message.citations,
          message.metadata
        );
      }
    } catch (error) {
      console.error('Failed to save messages:', error);
      throw error;
    }
  }
}

export const chatAPIService = new ChatAPIService();