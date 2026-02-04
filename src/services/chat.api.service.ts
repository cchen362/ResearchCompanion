/**
 * Chat API Service - DEPRECATED STUB
 *
 * This service was marked for deletion in Phase 1 Service Layer Consolidation.
 * The chatStore dynamically imports this service when server storage is enabled.
 * This stub delegates to the consolidated chat.service.ts.
 *
 * TODO: Consolidate into chat.service.ts in Phase 2 (State Management)
 * The chatStore should be refactored to use chat.service.ts directly.
 */

import { api } from './api';
import { logger } from '@/utils/logger';
import type { FindingsChat, ChatMessage, ChatContext } from '@/types';

interface ChatsResponse {
  success: boolean;
  chats: any[];
}

interface ChatResponse {
  success: boolean;
  chat: any;
}

interface MessageResponse {
  success: boolean;
  message: any;
}

class ChatAPIService {
  private baseUrl = '/chats';

  /**
   * Transform API chat to frontend format
   */
  private transformChat(apiChat: any): FindingsChat {
    return {
      id: apiChat.id,
      topicId: apiChat.topic_id || apiChat.topicId,
      title: apiChat.title || 'Untitled Chat',
      messages: (apiChat.messages || []).map((m: any) => this.transformMessage(m)),
      context: apiChat.context || {
        currentFindings: [],
        expandedTopics: [],
        recentInteractions: [],
        userPreferences: {}
      },
      createdAt: apiChat.created_at ? new Date(apiChat.created_at) : new Date(),
      lastMessageAt: apiChat.last_message_at ? new Date(apiChat.last_message_at) : new Date()
    };
  }

  /**
   * Transform API message to frontend format
   */
  private transformMessage(apiMessage: any): ChatMessage {
    return {
      id: apiMessage.id,
      role: apiMessage.role,
      content: apiMessage.content,
      timestamp: apiMessage.created_at ? new Date(apiMessage.created_at) : new Date(),
      citations: apiMessage.citations || [],
      metadata: apiMessage.metadata
    };
  }

  async getChats(topicId?: string): Promise<FindingsChat[]> {
    try {
      const url = topicId ? `${this.baseUrl}?topicId=${topicId}` : this.baseUrl;
      const response = await api.get<ChatsResponse>(url);
      if (response.data.success) {
        return response.data.chats.map(chat => this.transformChat(chat));
      }
      return [];
    } catch (error) {
      logger.error('[ChatAPIService] Error fetching chats:', error);
      return [];
    }
  }

  async getChat(chatId: string): Promise<FindingsChat | null> {
    try {
      const response = await api.get<ChatResponse>(`${this.baseUrl}/${chatId}`);
      if (response.data.success) {
        return this.transformChat(response.data.chat);
      }
      return null;
    } catch (error) {
      logger.error('[ChatAPIService] Error fetching chat:', error);
      return null;
    }
  }

  async createChat(
    topicId: string,
    title: string,
    context: ChatContext
  ): Promise<FindingsChat> {
    try {
      const response = await api.post<ChatResponse>(this.baseUrl, {
        topic_id: topicId,
        title,
        context
      });

      if (response.data.success) {
        return this.transformChat(response.data.chat);
      }

      throw new Error('Failed to create chat');
    } catch (error) {
      logger.error('[ChatAPIService] Error creating chat:', error);
      throw error;
    }
  }

  async addMessage(
    chatId: string,
    message: Partial<ChatMessage>
  ): Promise<ChatMessage> {
    try {
      const response = await api.post<MessageResponse>(
        `${this.baseUrl}/${chatId}/messages`,
        {
          role: message.role,
          content: message.content,
          citations: message.citations
        }
      );

      if (response.data.success) {
        return this.transformMessage(response.data.message);
      }

      throw new Error('Failed to add message');
    } catch (error) {
      logger.error('[ChatAPIService] Error adding message:', error);
      throw error;
    }
  }

  async updateChat(chatId: string, updates: Partial<FindingsChat>): Promise<FindingsChat> {
    try {
      const response = await api.put<ChatResponse>(`${this.baseUrl}/${chatId}`, {
        title: updates.title,
        context: updates.context
      });

      if (response.data.success) {
        return this.transformChat(response.data.chat);
      }

      throw new Error('Failed to update chat');
    } catch (error) {
      logger.error('[ChatAPIService] Error updating chat:', error);
      throw error;
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${chatId}`);
    } catch (error) {
      logger.error('[ChatAPIService] Error deleting chat:', error);
      throw error;
    }
  }

  async updateContext(chatId: string, context: ChatContext): Promise<void> {
    try {
      await api.put(`${this.baseUrl}/${chatId}/context`, { context });
    } catch (error) {
      logger.error('[ChatAPIService] Error updating context:', error);
      throw error;
    }
  }
}

export const chatAPIService = new ChatAPIService();
