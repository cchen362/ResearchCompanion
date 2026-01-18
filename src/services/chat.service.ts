import { api } from './api';
import { useChatStore } from '../stores/chatStore';
import { findingsService } from './findings.service';
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
  citations: SourceCitation[];
  suggestedQuestions?: string[];
  relatedFindings?: string[];
}

interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onCitation?: (citation: SourceCitation) => void;
}

class ChatService {
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;

  /**
   * Send a message to the AI and get a response
   */
  async sendMessage(
    request: ChatRequest,
    callbacks?: StreamCallbacks
  ): Promise<ChatResponse> {
    const chatStore = useChatStore.getState();

    try {
      // Add user message to store immediately
      const userMessage = await chatStore.addMessage(request.chatId, {
        role: 'user',
        content: request.message,
        metadata: {
          topicId: request.topicId,
          timestamp: new Date().toISOString()
        }
      });

      // Get relevant findings for context
      const contextFindings = await this.getContextFindings(
        request.topicId,
        request.context,
        request.citations
      );

      // Prepare the request payload
      const payload = {
        message: request.message,
        chatId: request.chatId,
        topicId: request.topicId,
        context: {
          ...request.context,
          findings: contextFindings.map(f => ({
            id: f.id,
            title: f.title || f.summary || 'Untitled Finding',
            content: (f.content || f.details || f.summary || '').substring(0, 500), // Truncate for context
            priority: f.priority || 'medium',
            source: f.source?.displayName || f.source?.name || 'Unknown Source',
            type: f.type,
            createdAt: f.createdAt
          })),
          previousMessages: await this.getRecentMessages(request.chatId, 5)
        },
        stream: request.stream
      };

      if (request.stream && callbacks) {
        return await this.streamResponse(request.chatId, payload, callbacks);
      } else {
        return await this.getResponse(request.chatId, payload);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Get a non-streaming response from the AI
   */
  private async getResponse(
    chatId: string,
    payload: any
  ): Promise<ChatResponse> {
    const chatStore = useChatStore.getState();

    try {
      const response = await api.post('/chat/complete', payload);
      const data = response.data;
      console.log('🔍 [CHAT SERVICE] API response received:', {
        hasCitations: !!data.citations,
        citationsLength: data.citations?.length || 0,
        citations: data.citations,
        contentHasBrackets: /\[\d+\]/.test(data.content)
      });

      // Add AI message to store
      const aiMessage = await chatStore.addMessage(chatId, {
        role: 'assistant',
        content: data.content,
        citations: data.citations,
        metadata: {
          model: data.model || 'claude-sonnet-4-5-20250929',
          tokens: data.tokens,
          processingTime: data.processingTime
        }
      });
      console.log('🔍 [CHAT SERVICE] Message added to store:', {
        messageId: aiMessage.id,
        hasCitations: !!aiMessage.citations,
        citationsLength: aiMessage.citations?.length || 0,
        citations: aiMessage.citations
      });

      // Process citations - NO! Don't override backend citations
      // The backend already sends properly formatted citations
      // const citations = await this.processCitations(
      //   data.content,
      //   data.citations || []
      // );

      console.log('🔍 [CHAT SERVICE] Returning response with citations:', {
        backendCitations: data.citations,
        messageHasCitations: !!aiMessage.citations
      });

      return {
        message: aiMessage,
        citations: data.citations || [], // Use backend citations directly!
        suggestedQuestions: data.suggestedQuestions,
        relatedFindings: data.relatedFindings
      };
    } catch (error) {
      // Add error message to chat
      await chatStore.addMessage(chatId, {
        role: 'system',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }

  /**
   * Stream response from the AI using Server-Sent Events
   */
  private async streamResponse(
    chatId: string,
    payload: any,
    callbacks: StreamCallbacks
  ): Promise<ChatResponse> {
    const chatStore = useChatStore.getState();

    return new Promise((resolve, reject) => {
      // Create abort controller for cancellation
      this.abortController = new AbortController();

      // Start streaming indicator
      chatStore.startStreaming({
        role: 'assistant',
        content: '',
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          timestamp: new Date().toISOString()
        }
      });

      // Create event source for SSE
      const url = `${import.meta.env.VITE_API_URL || '/api'}/chat/stream`;

      // Get auth token for streaming request
      const token = localStorage.getItem('auth_token');

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let accumulatedContent = '';
        let citations: SourceCitation[] = [];
        let suggestedQuestions: string[] = [];
        let relatedFindings: string[] = [];

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                // Stream complete - save final message
                const finalMessage = await chatStore.addMessage(chatId, {
                  role: 'assistant',
                  content: accumulatedContent,
                  citations,
                  metadata: {
                    model: 'claude-sonnet-4-5-20250929',
                    timestamp: new Date().toISOString()
                  }
                });

                chatStore.endStreaming(finalMessage);
                callbacks.onComplete?.(finalMessage);

                resolve({
                  message: finalMessage,
                  citations,
                  suggestedQuestions,
                  relatedFindings
                });
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);

                  if (data === '[DONE]') {
                    continue;
                  }

                  try {
                    const parsed = JSON.parse(data);

                    if (parsed.type === 'token') {
                      accumulatedContent += parsed.content;
                      chatStore.updateStreamingMessage(accumulatedContent);
                      callbacks.onToken?.(parsed.content);
                    } else if (parsed.type === 'citation') {
                      const citation: SourceCitation = parsed.citation;
                      citations.push(citation);
                      callbacks.onCitation?.(citation);
                    } else if (parsed.type === 'metadata') {
                      if (parsed.suggestedQuestions) {
                        suggestedQuestions = parsed.suggestedQuestions;
                      }
                      if (parsed.relatedFindings) {
                        relatedFindings = parsed.relatedFindings;
                      }
                    }
                  } catch (e) {
                    console.warn('Failed to parse SSE data:', e);
                  }
                }
              }
            }
          } catch (error) {
            chatStore.endStreaming({} as ChatMessage);
            callbacks.onError?.(error as Error);
            reject(error);
          }
        };

        processStream();
      }).catch(error => {
        chatStore.endStreaming({} as ChatMessage);
        callbacks.onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * Cancel an ongoing stream
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const chatStore = useChatStore.getState();
    chatStore.endStreaming({} as ChatMessage);
  }

  /**
   * Get findings relevant to the current context
   */
  private async getContextFindings(
    topicId: string,
    context: ChatContext,
    citationIds?: string[]
  ): Promise<ResearchFinding[]> {
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
          const individualFinding = await findingsService.getFinding(citationId);
          if (individualFinding) {
            addUnique(individualFinding);
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

    // Add up to 20 findings total for context
    const remaining = Math.min(20 - findings.length, sortedFindings.length);
    for (let i = 0; i < remaining; i++) {
      addUnique(sortedFindings[i]);
    }

    console.log(`Loaded ${findings.length} findings for chat context from topic ${topicId}`);
    return findings;
  }

  /**
   * Get recent messages from a chat for context
   */
  private async getRecentMessages(
    chatId: string,
    limit: number = 5
  ): Promise<Array<{ role: string; content: string }>> {
    const chatStore = useChatStore.getState();
    const messages = chatStore.messages.get(chatId) || [];

    return messages
      .slice(-limit * 2) // Get last N message pairs
      .map(m => ({
        role: m.role,
        content: m.content.substring(0, 1000) // Truncate for context
      }));
  }

  /**
   * Process citations in the response
   */
  private async processCitations(
    content: string,
    rawCitations: any[]
  ): Promise<SourceCitation[]> {
    const citations: SourceCitation[] = [];

    for (const raw of rawCitations) {
      // Validate the finding exists using the service layer
      const finding = await findingsService.getFinding(raw.findingId);
      if (!finding) continue;

      // Find the citation in the content - use citationNumber from backend
      const citationPattern = new RegExp(`\\[${raw.citationNumber}\\]`, 'g');
      const matches = Array.from(content.matchAll(citationPattern));

      for (const match of matches) {
        citations.push({
          findingId: raw.findingId,
          highlightStart: match.index || 0,
          highlightEnd: (match.index || 0) + match[0].length,
          citationText: finding.title || (finding.content || finding.details || finding.summary || '').substring(0, 100),
          citationNumber: raw.citationNumber
        });
      }
    }

    return citations;
  }

  /**
   * Generate a title for a chat based on the first message
   */
  async generateChatTitle(chatId: string, firstMessage: string): Promise<string> {
    try {
      const response = await api.post('/chat/generate-title', {
        message: firstMessage,
        chatId
      });
      return response.data.title;
    } catch (error) {
      // Fallback to truncated message
      return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    }
  }

  /**
   * Get suggested questions based on the current context
   */
  async getSuggestedQuestions(
    topicId: string,
    context: ChatContext
  ): Promise<string[]> {
    try {
      const response = await api.post('/chat/suggestions', {
        topicId,
        context
      });
      return response.data.questions || [];
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return this.getDefaultQuestions(topicId);
    }
  }

  /**
   * Get default questions for a topic
   */
  private getDefaultQuestions(topicId: string): string[] {
    return [
      'What are the latest research findings?',
      'What patterns emerge from my research?',
      'What contradictions have been found in the research?',
      'What are the most promising treatments?',
      'Are there any relevant clinical trials?'
    ];
  }

  /**
   * Export chat conversation
   */
  async exportChat(
    chatId: string,
    format: 'txt' | 'json' | 'pdf' = 'txt'
  ): Promise<Blob> {
    const chatStore = useChatStore.getState();
    const chat = chatStore.chats.find(c => c.id === chatId);
    const messages = chatStore.messages.get(chatId) || [];

    if (!chat) {
      throw new Error('Chat not found');
    }

    switch (format) {
      case 'json':
        return new Blob(
          [JSON.stringify({ chat, messages }, null, 2)],
          { type: 'application/json' }
        );

      case 'txt':
        const text = messages.map(m =>
          `[${m.timestamp}] ${m.role.toUpperCase()}:\n${m.content}\n`
        ).join('\n---\n\n');
        return new Blob([text], { type: 'text/plain' });

      case 'pdf':
        // This would require a PDF generation library
        // For now, fallback to text
        return this.exportChat(chatId, 'txt');

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Search across all chats
   */
  async searchChats(query: string): Promise<Array<{
    chat: FindingsChat;
    matches: Array<{ message: ChatMessage; highlight: string }>;
  }>> {
    const chatStore = useChatStore.getState();
    const results: Array<{
      chat: FindingsChat;
      matches: Array<{ message: ChatMessage; highlight: string }>;
    }> = [];

    const searchTerm = query.toLowerCase();

    for (const chat of chatStore.chats) {
      const messages = chatStore.messages.get(chat.id) || [];
      const matches: Array<{ message: ChatMessage; highlight: string }> = [];

      for (const message of messages) {
        if (message.content.toLowerCase().includes(searchTerm)) {
          // Extract a snippet around the match
          const index = message.content.toLowerCase().indexOf(searchTerm);
          const start = Math.max(0, index - 50);
          const end = Math.min(message.content.length, index + searchTerm.length + 50);
          const highlight = message.content.substring(start, end);

          matches.push({ message, highlight });
        }
      }

      if (matches.length > 0) {
        results.push({ chat, matches });
      }
    }

    return results;
  }
}

// Export singleton instance
export const chatService = new ChatService();

// Export type for use in components
export type { ChatRequest, ChatResponse, StreamCallbacks };