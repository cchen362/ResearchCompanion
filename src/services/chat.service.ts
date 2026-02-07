/**
 * Chat Service — Server-first chat operations
 *
 * Pure API client: NO store imports, NO circular dependencies.
 * All chat data lives in PostgreSQL via /api/chats/* endpoints.
 * Follows the digest.service.ts pattern for transformations.
 */

import { api } from './api';
import { logger } from '@/utils/logger';
import type { FindingsChat, ChatMessage, SourceCitation, ChatContext } from '../types';

// ============================================
// API Response Types
// ============================================

interface ChatsResponse {
  success: boolean;
  chats: any[];
}

interface ChatResponse {
  success: boolean;
  chat: any;
}

interface MessagesResponse {
  success: boolean;
  messages: any[];
}

interface MessageResponse {
  success: boolean;
  message: any;
}

interface AIChatResponse {
  content: string;
  citations: SourceCitation[];
  suggestedQuestions: string[];
  relatedFindings: any[];
  citationMap: Record<string, number>;
  model: string;
  tokens: number;
}

// ============================================
// Stream Callback Types
// ============================================

interface StreamCallbacks {
  onToken: (token: string) => void;
  onCitation: (citation: SourceCitation) => void;
  onMetadata: (metadata: { suggestedQuestions?: string[]; relatedFindings?: any[]; citationMap?: Record<string, number> }) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

// ============================================
// Chat Service
// ============================================

class ChatService {
  private baseUrl = '/chats';

  // ==================== Transformations ====================

  /**
   * Transform backend snake_case chat to frontend camelCase format
   */
  transformToFrontend(apiChat: any): FindingsChat {
    return {
      id: apiChat.id,
      topicId: apiChat.topic_id || apiChat.topicId,
      title: apiChat.title || 'Untitled Chat',
      status: apiChat.status || 'active',
      createdAt: apiChat.created_at || apiChat.createdAt || new Date().toISOString(),
      lastMessageAt: apiChat.last_message_at || apiChat.lastMessageAt || new Date().toISOString(),
      messageCount: apiChat.message_count ?? apiChat.messageCount ?? 0,
      context: apiChat.context || {
        currentFindings: [],
        expandedTopics: [],
        recentInteractions: [],
        userPreferences: {}
      }
    };
  }

  /**
   * Transform backend message to frontend format
   * Citations come pre-parsed from chat.model.ts parseCitations()
   */
  transformMessageToFrontend(apiMsg: any): ChatMessage {
    return {
      id: apiMsg.id,
      role: apiMsg.role,
      content: apiMsg.content,
      timestamp: apiMsg.created_at || apiMsg.timestamp || new Date().toISOString(),
      citations: Array.isArray(apiMsg.citations) ? apiMsg.citations : [],
      metadata: apiMsg.metadata || {},
      suggestedQuestions: apiMsg.suggestedQuestions,
      referencedFindingIds: apiMsg.referencedFindingIds
    };
  }

  // ==================== Chat CRUD ====================

  async getChats(topicId?: string): Promise<FindingsChat[]> {
    try {
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.get<ChatsResponse>(`${this.baseUrl}${params}`);
      if (response.data.success) {
        return response.data.chats.map(c => this.transformToFrontend(c));
      }
      return [];
    } catch (error) {
      logger.error('[chatService] Failed to load chats:', error);
      return [];
    }
  }

  async getChat(chatId: string): Promise<FindingsChat | null> {
    try {
      const response = await api.get<ChatResponse>(`${this.baseUrl}/${chatId}`);
      if (response.data.success) {
        return this.transformToFrontend(response.data.chat);
      }
      return null;
    } catch (error) {
      logger.error('[chatService] Failed to load chat:', error);
      return null;
    }
  }

  async createChat(topicId: string, title?: string): Promise<FindingsChat> {
    const response = await api.post<ChatResponse>(this.baseUrl, {
      topic_id: topicId,
      title: title || 'New Chat',
      context: {}
    });
    if (response.data.success) {
      return this.transformToFrontend(response.data.chat);
    }
    throw new Error('Failed to create chat');
  }

  async updateChat(chatId: string, updates: { title?: string; status?: string; context?: ChatContext }): Promise<FindingsChat> {
    const response = await api.put<ChatResponse>(`${this.baseUrl}/${chatId}`, updates);
    if (response.data.success) {
      return this.transformToFrontend(response.data.chat);
    }
    throw new Error('Failed to update chat');
  }

  async deleteChat(chatId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${chatId}`);
  }

  // ==================== Message CRUD ====================

  async getMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
    try {
      const response = await api.get<MessagesResponse>(
        `${this.baseUrl}/${chatId}/messages?limit=${limit}`
      );
      if (response.data.success) {
        return response.data.messages.map(m => this.transformMessageToFrontend(m));
      }
      return [];
    } catch (error) {
      logger.error('[chatService] Failed to load messages:', error);
      return [];
    }
  }

  async saveMessage(
    chatId: string,
    message: { role: string; content: string; citations?: SourceCitation[]; metadata?: any }
  ): Promise<ChatMessage> {
    const response = await api.post<MessageResponse>(
      `${this.baseUrl}/${chatId}/messages`,
      {
        role: message.role,
        content: message.content,
        citations: message.citations || null,
        metadata: message.metadata || {}
      }
    );
    if (response.data.success) {
      return this.transformMessageToFrontend(response.data.message);
    }
    throw new Error('Failed to save message');
  }

  async clearMessages(chatId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${chatId}/messages`);
  }

  // ==================== AI Streaming ====================

  /**
   * Stream AI response using POST-based SSE.
   * Uses fetch() directly (not axios) because axios doesn't support streaming responses.
   * POST avoids the URI-too-large bug that affected the old GET-based EventSource approach.
   */
  async streamMessage(
    chatId: string,
    topicId: string,
    message: string,
    context: any,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const baseURL = api.defaults.baseURL || '/api';

    const response = await fetch(`${baseURL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, chatId, topicId, context })
    });

    if (!response.ok) {
      callbacks.onError(`HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            switch (parsed.type) {
              case 'token':
                callbacks.onToken(parsed.content);
                break;
              case 'citation':
                callbacks.onCitation(parsed.citation);
                break;
              case 'metadata':
                callbacks.onMetadata(parsed);
                break;
              case 'error':
                callbacks.onError(parsed.message || 'Unknown streaming error');
                break;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==================== Non-Streaming Fallback ====================

  /**
   * Send message without streaming (fallback if streaming fails).
   */
  async sendMessageNonStreaming(
    chatId: string,
    topicId: string,
    message: string,
    context: any
  ): Promise<AIChatResponse> {
    const response = await api.post('/chat/complete', {
      message,
      chatId,
      topicId,
      context,
      stream: false
    });
    return response.data;
  }

  // ==================== Export ====================

  async exportChat(chatId: string, topicName: string): Promise<string> {
    const messages = await this.getMessages(chatId);
    let md = `# Chat: ${topicName}\n`;
    md += `Exported: ${new Date().toLocaleDateString()}\n\n`;

    for (const msg of messages) {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      md += `## ${role}\n${msg.content}\n\n`;

      if (msg.citations && msg.citations.length > 0) {
        md += `**Sources:**\n`;
        for (const c of msg.citations) {
          const source = typeof c.source === 'string' ? c.source : c.source?.name || 'Unknown';
          md += `- [${c.citationNumber}] ${source}: ${c.citationText || ''}\n`;
        }
        md += '\n';
      }
    }

    return md;
  }
}

export const chatService = new ChatService();
