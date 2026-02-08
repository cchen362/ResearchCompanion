import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MessageSquare, X, Download, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Button } from './ui/button';
import { FindingDetailModal } from './FindingDetailModal';
import { SuggestedQuestions } from './chat/SuggestedQuestions';
import { useToast } from './ui/use-toast';
import { logger } from '@/utils/logger';
import { chatService } from '@/services/chat.service';
import { useChatStore } from '@/stores/chatStore';
import { findingsService } from '@/services/findings.service';
import type { ChatMessage, FindingsChat, SourceCitation } from '@/types';

interface ChatPanelProps {
  topicId: string;
  topicName: string;
  className?: string;
  onClose?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export function ChatPanel({ topicId, topicName, className = '', onClose, onToggleFullscreen, isFullscreen }: ChatPanelProps) {
  // ---- State ----
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<FindingsChat | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [citationMap, setCitationMap] = useState<Record<string, number>>({});
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Store: streaming state only
  const { isStreaming, streamingContent, setActiveChat: setActiveChatInStore,
          startStreaming, updateStreamingContent, endStreaming } = useChatStore();

  // ---- Initialize: Load or create chat, load messages from server ----
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsInitializing(true);
      try {
        // 1. Load chats for this topic from PostgreSQL
        const chats = await chatService.getChats(topicId);
        if (cancelled) return;

        let activeChat: FindingsChat;

        if (chats.length > 0) {
          // Use the most recent chat (already sorted by last_message_at DESC)
          activeChat = chats[0];
          logger.info('[ChatPanel] Found existing chat:', activeChat.id);
        } else {
          // Create a new chat
          activeChat = await chatService.createChat(topicId, `Chat about ${topicName}`);
          logger.info('[ChatPanel] Created new chat:', activeChat.id);
        }

        if (cancelled) return;
        setChat(activeChat);
        setActiveChatInStore(activeChat.id, topicId);

        // 2. Load messages from PostgreSQL
        const loadedMessages = await chatService.getMessages(activeChat.id);
        if (cancelled) return;

        logger.info('[ChatPanel] Loaded messages from server:', loadedMessages.length);
        setMessages(loadedMessages);
      } catch (error) {
        logger.error('[ChatPanel] Failed to initialize:', error);
        if (!cancelled) {
          toast({
            title: 'Failed to load chat',
            description: 'Could not connect to the server. Please try again.',
            variant: 'destructive'
          });
        }
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    initialize();

    // Listen for topic deletion
    const handleTopicDeleted = (event: any) => {
      if (event.detail?.topicId === topicId) {
        setMessages([]);
        setChat(null);
        setActiveChatInStore(null, null);
        toast({
          title: 'Topic Deleted',
          description: 'The current topic has been deleted.',
          variant: 'destructive'
        });
      }
    };
    window.addEventListener('topic-deleted', handleTopicDeleted);

    return () => {
      cancelled = true;
      window.removeEventListener('topic-deleted', handleTopicDeleted);
    };
  }, [topicId]);

  // ---- Auto-scroll to bottom ----
  useEffect(() => {
    if (messagesContainerRef.current && (messages.length > 0 || isStreaming)) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, streamingContent]);

  // ---- Send message with streaming ----
  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || !chat || isLoading) return;

    setIsLoading(true);
    setSuggestedQuestions([]);

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp_user_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 1. Save user message to server immediately
      const savedUserMsg = await chatService.saveMessage(chat.id, {
        role: 'user',
        content: messageText
      });

      // Replace temp message with server-assigned ID
      setMessages(prev =>
        prev.map(m => m.id === userMessage.id ? savedUserMsg : m)
      );

      // 2. Load findings for AI context
      let topicFindings: any[] = [];
      try {
        const allFindings = await findingsService.getFindings(topicId);
        topicFindings = allFindings.slice(0, 50);
      } catch (e) {
        logger.warn('[ChatPanel] Could not load findings for context');
      }

      const transformedFindings = topicFindings.map((f: any) => ({
        id: f.id,
        title: f.title || '',
        content: f.details || f.summary || '',
        source: f.source?.displayName || f.source?.name || 'Unknown Source',
        type: f.type || 'research',
        createdAt: f.timestamp ? new Date(f.timestamp).toISOString() : new Date().toISOString(),
        priority: f.priority || 'medium'
      }));

      const context = {
        findings: transformedFindings,
        currentFindings: topicFindings.map((f: any) => f.id),
        previousMessages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        citationMap
      };

      // 3. Stream AI response
      let fullContent = '';
      const allCitations: SourceCitation[] = [];
      let streamMetadata: any = {};

      startStreaming();

      await chatService.streamMessage(chat.id, topicId, messageText, context, {
        onToken: (token) => {
          fullContent += token;
          updateStreamingContent(fullContent);
        },
        onCitation: (citation) => {
          allCitations.push(citation);
        },
        onMetadata: (metadata) => {
          streamMetadata = metadata;
          if (metadata.suggestedQuestions) setSuggestedQuestions(metadata.suggestedQuestions);
          if (metadata.citationMap) setCitationMap(metadata.citationMap);
        },
        onError: (error) => {
          logger.error('[ChatPanel] Streaming error:', error);
          endStreaming();
          setIsLoading(false);

          const errorMessage: ChatMessage = {
            id: `temp_error_${Date.now()}`,
            role: 'assistant',
            content: `I'm sorry, I ran into an issue: ${error}. Let me try again if you'd like.`,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, errorMessage]);
        },
        onDone: async () => {
          endStreaming();

          // Build final message
          const aiMessage: ChatMessage = {
            id: `temp_ai_${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            citations: allCitations,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, aiMessage]);

          // 4. Save AI message to server
          try {
            const savedAiMsg = await chatService.saveMessage(chat.id, {
              role: 'assistant',
              content: fullContent,
              citations: allCitations,
              metadata: {
                model: streamMetadata.model,
                tokens: streamMetadata.tokens
              }
            });

            // Replace temp with server-assigned ID
            setMessages(prev =>
              prev.map(m => m.id === aiMessage.id ? savedAiMsg : m)
            );
          } catch (saveError) {
            logger.error('[ChatPanel] Failed to save AI message:', saveError);
            toast({
              title: 'Message not saved',
              description: 'The response was generated but could not be saved. It may not appear after refresh.',
              variant: 'destructive'
            });
          }

          setIsLoading(false);
        }
      });
    } catch (error: any) {
      logger.error('[ChatPanel] Send failed:', error);
      endStreaming();
      setIsLoading(false);

      const errorMessage: ChatMessage = {
        id: `temp_error_${Date.now()}`,
        role: 'assistant',
        content: `I'm sorry, something went wrong: ${error.message || 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [chat, topicId, messages, citationMap, isLoading]);

  // ---- Citation click ----
  const handleCitationClick = useCallback(async (findingId: string) => {
    try {
      // Try to load from findings service
      const finding = await findingsService.getFinding(findingId);
      if (finding) {
        setSelectedFinding(finding);
        setIsModalOpen(true);
      } else {
        logger.warn('[ChatPanel] Finding not found:', findingId);
        toast({
          title: 'Finding not available',
          description: 'This research finding may have been removed.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      logger.error('[ChatPanel] Error loading finding:', error);
    }
  }, []);

  // ---- Export chat ----
  const handleExport = useCallback(async () => {
    if (!chat) return;
    try {
      const markdown = await chatService.exportChat(chat.id, topicName);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${topicName}-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('[ChatPanel] Export failed:', error);
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  }, [chat, topicName]);

  // ---- Clear messages ----
  const handleClear = useCallback(async () => {
    if (!chat || !confirm('Clear this chat? This cannot be undone.')) return;
    try {
      await chatService.clearMessages(chat.id);
      setMessages([]);
      setSuggestedQuestions([]);
    } catch (error) {
      logger.error('[ChatPanel] Clear failed:', error);
      toast({ title: 'Failed to clear chat', variant: 'destructive' });
    }
  }, [chat]);

  // ---- Loading state ----
  if (isInitializing) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className={`flex flex-col h-full bg-[var(--color-surface)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h2 className="font-semibold">{topicName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleExport}
            title="Export chat"
            disabled={messages.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleClear}
            title="Clear chat"
            disabled={messages.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {onToggleFullscreen && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          )}
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="bg-primary-50 rounded-2xl p-6 mb-6">
              <MessageSquare className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm">
              Ask questions about {topicName} — your research findings are included as context.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <ChatMessageComponent
                key={msg.id || idx}
                message={msg}
                onCitationClick={handleCitationClick}
                isStreaming={false}
              />
            ))}
            {/* Streaming message */}
            {isStreaming && streamingContent && (
              <ChatMessageComponent
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  timestamp: new Date().toISOString()
                }}
                isStreaming={true}
                onCitationClick={handleCitationClick}
              />
            )}
          </div>
        )}
      </div>

      {/* Suggested Questions */}
      <SuggestedQuestions
        questions={suggestedQuestions}
        onQuestionClick={(question) => {
          handleSendMessage(question);
          setSuggestedQuestions([]);
        }}
        className="border-t bg-gradient-to-b from-[var(--color-surface-sunken)]/50 to-[var(--color-surface)]"
        autoHideDelay={15000}
      />

      {/* Input */}
      <div className="border-t">
        <ChatInput
          onSendMessage={(text) => handleSendMessage(text)}
          disabled={isLoading || isStreaming}
          placeholder="Ask about your research..."
          maxLength={4000}
          showTypingIndicator={isStreaming}
          className="border-0"
        />
      </div>

      {/* Finding Detail Modal */}
      <FindingDetailModal
        finding={selectedFinding}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedFinding(null);
        }}
      />
    </div>
  );
}
