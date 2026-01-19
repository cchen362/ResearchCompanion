import { api } from './api';
import type {
  ChatMessage,
  FindingsChat,
  ChatContext,
  SourceCitation,
  Finding,
  ResearchFinding
} from '../types';

interface ChatRequest {
  message: string;
  chatId: string;
  topicId: string;
  context: ChatContext;
  citations?: string[]; // Finding IDs to cite
  stream?: boolean;
}

interface ChatResponse {
  message: ChatMessage;
  context: ChatContext;
}

interface StreamChunk {
  type: 'text' | 'citation' | 'end';
  content?: string;
  citation?: SourceCitation;
}

class ChatService {
  /**
   * Send a chat message and get a response
   */
  async sendMessage(
    request: ChatRequest,
    onStream?: (chunk: StreamChunk) => void
  ): Promise<ChatResponse> {
    try {
      // Get context findings with citations
      const contextFindings = await this.getContextFindings(
        request.topicId,
        request.context,
        request.citations
      );

      // Get recent messages for context
      const recentMessages = await this.getRecentMessages(request.chatId);

      // Prepare the API request with context
      const apiRequest = {
        message: request.message,
        chatId: request.chatId,
        topicId: request.topicId,
        context: {
          ...request.context,
          findings: contextFindings,
          recentMessages,
          currentFindings: request.citations || []
        },
        stream: request.stream
      };

      if (request.stream && onStream) {
        // Handle streaming response
        return await this.handleStreamingResponse(apiRequest, onStream);
      } else {
        // Handle regular response
        const response = await api.post('/api/chat', apiRequest);

        // Process citations if present
        if (response.data.message.citations) {
          response.data.message.citations = await this.processCitations(
            response.data.message.citations,
            request.topicId
          );
        }

        return response.data;
      }
    } catch (error) {
      console.error('Failed to send chat message:', error);
      throw error;
    }
  }

  /**
   * Handle streaming response from the API
   */
  private async handleStreamingResponse(
    request: any,
    onStream: (chunk: StreamChunk) => void
  ): Promise<ChatResponse> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`/api/chat/stream?${new URLSearchParams({
        message: request.message,
        chatId: request.chatId,
        topicId: request.topicId,
        context: JSON.stringify(request.context)
      })}`);

      let fullContent = '';
      const citations: SourceCitation[] = [];

      eventSource.onmessage = (event) => {
        try {
          const chunk: StreamChunk = JSON.parse(event.data);

          if (chunk.type === 'text' && chunk.content) {
            fullContent += chunk.content;
            onStream(chunk);
          } else if (chunk.type === 'citation' && chunk.citation) {
            citations.push(chunk.citation);
            onStream(chunk);
          } else if (chunk.type === 'end') {
            eventSource.close();

            // Create the final message
            const message: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: fullContent,
              timestamp: new Date().toISOString(),
              citations: citations.length > 0 ? citations : undefined
            };

            resolve({
              message,
              context: request.context
            });
          }
        } catch (error) {
          console.error('Error parsing stream chunk:', error);
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        reject(error);
      };
    });
  }

  /**
   * Get all chats for a topic
   */
  async getChats(topicId: string): Promise<FindingsChat[]> {
    try {
      const response = await api.get(`/topics/${topicId}/chats`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to get chats:', error);
      return [];
    }
  }

  /**
   * Get a specific chat by ID
   */
  async getChat(topicId: string, chatId: string): Promise<FindingsChat | null> {
    try {
      const response = await api.get(`/topics/${topicId}/chats/${chatId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get chat:', error);
      return null;
    }
  }

  /**
   * Create a new chat for a topic
   */
  async createChat(topicId: string, title?: string): Promise<FindingsChat> {
    try {
      const response = await api.post(`/topics/${topicId}/chats`, {
        title: title || 'New Chat',
        context: {
          currentFindings: [],
          recentTopics: []
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create chat:', error);
      throw error;
    }
  }

  /**
   * Update a chat
   */
  async updateChat(
    topicId: string,
    chatId: string,
    updates: Partial<FindingsChat>
  ): Promise<FindingsChat> {
    try {
      const response = await api.put(`/topics/${topicId}/chats/${chatId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update chat:', error);
      throw error;
    }
  }

  /**
   * Delete a chat
   */
  async deleteChat(topicId: string, chatId: string): Promise<void> {
    try {
      await api.delete(`/topics/${topicId}/chats/${chatId}`);
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  }

  /**
   * Get messages for a chat
   */
  async getMessages(topicId: string, chatId: string): Promise<ChatMessage[]> {
    try {
      const response = await api.get(`/topics/${topicId}/chats/${chatId}/messages`);

      // Process citations for each message
      const messages = response.data || [];
      for (const message of messages) {
        if (message.citations) {
          message.citations = await this.processCitations(message.citations, topicId);
        }
      }

      return messages;
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  /**
   * Save a message to a chat
   */
  async saveMessage(
    topicId: string,
    chatId: string,
    message: ChatMessage
  ): Promise<ChatMessage> {
    try {
      const response = await api.post(
        `/topics/${topicId}/chats/${chatId}/messages`,
        message
      );
      return response.data;
    } catch (error) {
      console.error('Failed to save message:', error);
      throw error;
    }
  }

  /**
   * Delete a message from a chat
   */
  async deleteMessage(
    topicId: string,
    chatId: string,
    messageId: string
  ): Promise<void> {
    try {
      await api.delete(`/topics/${topicId}/chats/${chatId}/messages/${messageId}`);
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }

  /**
   * Clear all messages in a chat
   */
  async clearMessages(topicId: string, chatId: string): Promise<void> {
    try {
      await api.delete(`/topics/${topicId}/chats/${chatId}/messages`);
    } catch (error) {
      console.error('Failed to clear messages:', error);
      throw error;
    }
  }

  /**
   * Search messages across all chats
   */
  async searchMessages(topicId: string, query: string): Promise<ChatMessage[]> {
    try {
      const response = await api.get(`/topics/${topicId}/messages/search`, {
        params: { q: query }
      });

      // Process citations for each message
      const messages = response.data || [];
      for (const message of messages) {
        if (message.citations) {
          message.citations = await this.processCitations(message.citations, topicId);
        }
      }

      return messages;
    } catch (error) {
      console.error('Failed to search messages:', error);
      return [];
    }
  }

  /**
   * Export chat history
   */
  async exportChat(
    topicId: string,
    chatId: string,
    format: 'json' | 'markdown' = 'markdown'
  ): Promise<string> {
    try {
      const response = await api.get(`/topics/${topicId}/chats/${chatId}/export`, {
        params: { format }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export chat:', error);
      throw error;
    }
  }

  /**
   * Get suggested questions based on context
   */
  async getSuggestedQuestions(
    topicId: string,
    context: ChatContext
  ): Promise<string[]> {
    try {
      const response = await api.post(`/topics/${topicId}/suggestions`, {
        context
      });
      return response.data || [];
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get findings relevant to the current context
   */
  private async getContextFindings(
    topicId: string,
    context: ChatContext,
    citationIds?: string[]
  ): Promise<ResearchFinding[]> {
    try {
      // Dynamically import findingsService to avoid circular dependency
      const { findingsService } = await import('./findings.service');

      // Get all findings for the topic using the unified service layer
      const allTopicFindings = await findingsService.getFindings(topicId);

      if (!allTopicFindings || allTopicFindings.length === 0) {
        console.log(`No findings found for topic ${topicId}`);
        return [];
      }

      const findings: ResearchFinding[] = [];
      const addedIds = new Set<string>();

      // Helper to add unique findings
      const addUnique = (finding: ResearchFinding) => {
        if (!addedIds.has(finding.id)) {
          findings.push(finding);
          addedIds.add(finding.id);
        }
      };

      // 1. Add explicitly cited findings first (highest priority)
      if (citationIds && citationIds.length > 0) {
        for (const citationId of citationIds) {
          const cited = allTopicFindings.find(f => f.id === citationId);
          if (cited) {
            addUnique(cited);
          } else {
            // Try to fetch individually if not in topic findings
            try {
              const individualFinding = await findingsService.getFinding(citationId);
              if (individualFinding) {
                addUnique(individualFinding);
              }
            } catch (err) {
              console.warn(`Could not fetch individual finding ${citationId}:`, err);
            }
          }
        }
      }

      // 2. Add current context findings (user selected)
      if (context.currentFindings && context.currentFindings.length > 0) {
        for (const contextId of context.currentFindings) {
          const contextual = allTopicFindings.find(f => f.id === contextId);
          if (contextual) {
            addUnique(contextual);
          }
        }
      }

      // 3. Add recent high-priority findings if we have room
      // Sort by date (most recent first) and priority
      const sortedFindings = [...allTopicFindings]
        .filter(f => !addedIds.has(f.id))
        .sort((a, b) => {
          // First sort by priority
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const aPriority = priorityOrder[a.priority || 'medium'];
          const bPriority = priorityOrder[b.priority || 'medium'];
          if (aPriority !== bPriority) return aPriority - bPriority;

          // Then by date (most recent first)
          const aDate = new Date(a.createdAt || 0).getTime();
          const bDate = new Date(b.createdAt || 0).getTime();
          return bDate - aDate;
        });

      // Add all remaining findings for complete context
      for (const finding of sortedFindings) {
        addUnique(finding);
      }

      console.log(`Loaded ${findings.length} findings for chat context from topic ${topicId}`);
      return findings;
    } catch (error) {
      console.error('Failed to get context findings:', error);
      // Return empty array on error to allow chat to continue
      return [];
    }
  }

  /**
   * Get recent messages from a chat for context
   */
  private async getRecentMessages(
    chatId: string,
    limit: number = 5
  ): Promise<Array<{ role: string; content: string }>> {
    try {
      // Import store lazily to avoid circular dependency
      const { useChatStore } = await import('../stores/chatStore');
      const chatStore = useChatStore.getState();
      const messages = chatStore.messages.get(chatId) || [];

      return messages
        .slice(-limit * 2) // Get last N message pairs
        .map(m => ({
          role: m.role,
          content: m.content.substring(0, 1000) // Truncate for context
        }));
    } catch (error) {
      console.error('Failed to get recent messages:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Process citations by enriching them with finding data
   */
  private async processCitations(
    citations: any[],
    topicId: string
  ): Promise<SourceCitation[]> {
    try {
      // Dynamically import findingsService to avoid circular dependency
      const { findingsService } = await import('./findings.service');

      const processed: SourceCitation[] = [];

      for (const raw of citations) {
        try {
          const finding = await findingsService.getFinding(raw.findingId);
          if (finding) {
            processed.push({
              id: raw.id || crypto.randomUUID(),
              findingId: raw.findingId,
              title: finding.title,
              source: finding.source,
              relevance: raw.relevance || 'Related research',
              snippet: raw.snippet || finding.keyInsights?.[0] || finding.content.substring(0, 200)
            });
          }
        } catch (err) {
          console.warn(`Could not process citation for finding ${raw.findingId}:`, err);
        }
      }

      return processed;
    } catch (error) {
      console.error('Failed to process citations:', error);
      return [];
    }
  }
}

export const chatService = new ChatService();