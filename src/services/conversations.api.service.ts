import { api } from '@/services/api';
import type { FindingsChat, ChatMessage } from '@/types';

interface ConversationsResponse {
  success: boolean;
  conversations: any[];
}

interface ConversationResponse {
  success: boolean;
  conversation: any;
  messages?: any[];
}

interface MessageResponse {
  success: boolean;
  message: any;
}

interface MessagesResponse {
  success: boolean;
  messages: any[];
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

interface StatsResponse {
  success: boolean;
  stats: {
    total_conversations: number;
    total_messages: number;
    by_topic: Array<{ topic_id: string; count: number }>;
  };
}

class ConversationsAPIService {
  private baseUrl = '/api/conversations';

  /**
   * Transform backend message to frontend ChatMessage interface
   */
  private transformMessageToFrontend(apiMessage: any): ChatMessage {
    return {
      id: apiMessage.id,
      role: apiMessage.role,
      content: apiMessage.content,
      timestamp: new Date(apiMessage.created_at).getTime(),
      metadata: apiMessage.metadata || {}
    };
  }

  /**
   * Transform backend conversation to frontend FindingsChat interface
   */
  private transformToFrontend(apiConversation: any, messages?: any[]): FindingsChat {
    return {
      id: apiConversation.id,
      topicId: apiConversation.topic_id || '',
      title: apiConversation.title || 'New Chat',
      messages: messages?.map(m => this.transformMessageToFrontend(m)) || [],
      createdAt: new Date(apiConversation.created_at).getTime(),
      lastMessageAt: new Date(apiConversation.updated_at).getTime(),
      status: apiConversation.archived ? 'archived' : 'active',
      context: apiConversation.context || {}
    };
  }

  /**
   * Transform frontend FindingsChat to backend format
   */
  private transformToBackend(chat: Partial<FindingsChat>): any {
    return {
      topic_id: chat.topicId || null,
      title: chat.title || 'New Chat',
      context: chat.context || {},
      archived: chat.status === 'archived'
    };
  }

  async getConversations(topicId?: string, includeArchived = false): Promise<FindingsChat[]> {
    try {
      const params = new URLSearchParams();
      if (topicId) params.append('topic_id', topicId);
      if (includeArchived) params.append('includeArchived', 'true');

      const queryString = params.toString();
      const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;

      const response = await api.get<ConversationsResponse>(url);

      if (response.data.success) {
        return response.data.conversations.map(c => this.transformToFrontend(c));
      }

      throw new Error('Failed to fetch conversations');
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversation(id: string, withMessages = true): Promise<FindingsChat | undefined> {
    try {
      const url = withMessages
        ? `${this.baseUrl}/${id}?withMessages=true`
        : `${this.baseUrl}/${id}`;

      const response = await api.get<ConversationResponse>(url);

      if (response.data.success) {
        return this.transformToFrontend(
          response.data.conversation,
          response.data.messages
        );
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  async createConversation(chat: Partial<FindingsChat>): Promise<FindingsChat> {
    try {
      const backendData = this.transformToBackend(chat);
      const response = await api.post<ConversationResponse>(this.baseUrl, backendData);

      if (response.data.success) {
        return this.transformToFrontend(response.data.conversation);
      }

      throw new Error('Failed to create conversation');
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async updateConversation(id: string, updates: Partial<FindingsChat>): Promise<FindingsChat> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<ConversationResponse>(
        `${this.baseUrl}/${id}`,
        backendData
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.conversation);
      }

      throw new Error('Failed to update conversation');
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  async archiveConversation(id: string, archived = true): Promise<FindingsChat> {
    try {
      const response = await api.post<ConversationResponse>(
        `${this.baseUrl}/${id}/archive`,
        { archived }
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.conversation);
      }

      throw new Error('Failed to archive conversation');
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string, limit = 100, offset = 0): Promise<ChatMessage[]> {
    try {
      const response = await api.get<MessagesResponse>(
        `${this.baseUrl}/${conversationId}/messages?limit=${limit}&offset=${offset}`
      );

      if (response.data.success) {
        return response.data.messages.map(m => this.transformMessageToFrontend(m));
      }

      throw new Error('Failed to fetch messages');
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async addMessage(conversationId: string, message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: any;
  }): Promise<ChatMessage> {
    try {
      const response = await api.post<MessageResponse>(
        `${this.baseUrl}/${conversationId}/messages`,
        message
      );

      if (response.data.success) {
        return this.transformMessageToFrontend(response.data.message);
      }

      throw new Error('Failed to add message');
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(
        `${this.baseUrl}/${conversationId}/messages/${messageId}`
      );

      if (!response.data.success) {
        throw new Error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  async getStats(): Promise<StatsResponse['stats']> {
    try {
      const response = await api.get<StatsResponse>(`${this.baseUrl}/stats`);

      if (response.data.success) {
        return response.data.stats;
      }

      throw new Error('Failed to get stats');
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
}

export const conversationsAPIService = new ConversationsAPIService();
