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
const transformMessage = (message: any): ChatMessage => ({
  id: message.id,
  chatId: message.chat_id,
  role: message.role,
  content: message.content,
  // Parse citations if they come as JSON string from PostgreSQL
  citations: typeof message.citations === 'string'
    ? JSON.parse(message.citations)
    : message.citations,
  // Also handle metadata if it's JSON string
  metadata: typeof message.metadata === 'string'
    ? JSON.parse(message.metadata)
    : message.metadata,
  timestamp: message.created_at
});

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
    try {
      const response = await api.post(`/chats/${chatId}/messages`, {
        role,
        content,
        citations,
        metadata
      });
      return transformMessage(response.data.message);
    } catch (error) {
      console.error('Failed to add message:', error);
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