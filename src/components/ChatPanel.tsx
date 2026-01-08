import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../stores/chatStore';
import { useFindingsStore } from '../stores/findingsStore';
import { useUIStore } from '../stores/uiStore';
import { chatService } from '../services/chat.service';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import {
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  Download,
  Search,
  Plus,
  Loader2,
  Trash2
} from 'lucide-react';
import type { Finding } from '../types';

interface ChatPanelProps {
  topicId: string;
  topicName: string;
  className?: string;
  onClose?: () => void;
}

export function ChatPanel({ topicId, topicName, className = '', onClose }: ChatPanelProps) {
  const {
    activeChat,
    activeChatId,
    messages,
    isStreaming,
    streamingMessage,
    context,
    loadChats,
    createChat,
    setActiveChat,
    addMessage,
    updateContext
  } = useChatStore();

  const {
    selectedFindings,
    getSelectedFindings
  } = useFindingsStore();

  const {
    showToast
  } = useUIStore();

  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load chats on mount
  useEffect(() => {
    loadChats(topicId);
  }, [topicId, loadChats]);

  // Smart auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      // Only auto-scroll if user is already near the bottom
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, streamingMessage]);

  // Get messages for active chat
  const chatMessages = activeChatId ? messages.get(activeChatId) || [] : [];

  // Create new chat if needed
  const handleStartChat = useCallback(async () => {
    if (!activeChat) {
      setIsLoading(true);
      try {
        await createChat(topicId, `Chat about ${topicName}`);
      } catch (error) {
        showToast({
          type: 'error',
          message: 'Failed to create chat'
        });
      } finally {
        setIsLoading(false);
      }
    }
  }, [activeChat, createChat, topicId, topicName, showToast]);

  // Send message
  const handleSendMessage = useCallback(async (message: string) => {
    if (!activeChatId || !message.trim()) return;

    setIsLoading(true);

    try {
      // Update context with selected findings
      const selectedFindingsList = getSelectedFindings();
      if (selectedFindingsList.length > 0) {
        updateContext({
          currentFindings: selectedFindingsList.map(f => f.id)
        });
      }

      // Send message with streaming
      await chatService.sendMessage(
        {
          message,
          chatId: activeChatId,
          topicId,
          context,
          citations: selectedFindingsList.map(f => f.id),
          stream: true
        },
        {
          onToken: (token) => {
            // Token streaming handled by store
          },
          onComplete: async (message) => {
            // Get suggested questions
            const suggestions = await chatService.getSuggestedQuestions(topicId, context);
            setSuggestedQuestions(suggestions);
          },
          onError: (error) => {
            showToast({
              type: 'error',
              message: `Failed to send message: ${error.message}`
            });
          }
        }
      );
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to send message'
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeChatId, topicId, context, getSelectedFindings, updateContext, showToast]);

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    handleSendMessage(question);
    setSuggestedQuestions([]);
  };

  // Clear chat messages
  const handleClearChat = useCallback(() => {
    if (!activeChatId) return;

    if (window.confirm('Are you sure you want to clear all messages in this chat?')) {
      // Clear messages from store
      useChatStore.getState().clearMessages(activeChatId);
      setSuggestedQuestions([]);

      showToast({
        type: 'success',
        message: 'Chat cleared'
      });
    }
  }, [activeChatId, showToast]);

  // Export chat
  const handleExportChat = async () => {
    if (!activeChatId) return;

    try {
      const blob = await chatService.exportChat(activeChatId, 'txt');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_${topicName}_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      showToast({
        type: 'success',
        message: 'Chat exported successfully'
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to export chat'
      });
    }
  };

  // Filter messages based on search
  const filteredMessages = searchQuery
    ? chatMessages.filter(msg =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chatMessages;

  // Add escape key handler for fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    if (isMaximized) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isMaximized]);

  const chatContent = isMaximized ? (
    // Fullscreen mode - clean white background
    <div
      ref={panelRef}
      className="fixed inset-0 z-[10000] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold truncate max-w-[200px] md:max-w-none">{topicName}</h2>
          {activeChat && (
            <Badge variant="outline" className="ml-2 hidden md:inline-flex">
              {chatMessages.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            disabled={!activeChatId || chatMessages.length === 0}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleExportChat}
            disabled={!activeChatId || chatMessages.length === 0}
            title="Export chat"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {chatMessages.length > 5 && (
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1 text-sm border rounded-md"
            />
          </div>
        </div>
      )}

      {/* Main content area - no more context panel split */}
      <div className="flex-1 flex flex-col min-h-0">
        {!activeChat ? (
          // No active chat - show start prompt
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Start a Conversation</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Ask questions about your research findings and get AI-powered insights
            </p>
            <Button onClick={handleStartChat} disabled={isLoading} className="mb-6">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating chat...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Start New Chat
                </>
              )}
            </Button>

            {/* Suggested starting prompts */}
            <div className="mt-4 max-w-lg">
              <p className="text-xs text-muted-foreground mb-3 text-center">Or start with a question:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Summarize my research findings',
                  'What are the key themes?',
                  'Show contradictions',
                  'Next research steps'
                ].map((prompt, index) => (
                  <button
                    key={index}
                    onClick={async () => {
                      await handleStartChat();
                      // Small delay to ensure chat is created
                      setTimeout(() => handleSendMessage(prompt), 500);
                    }}
                    disabled={isLoading}
                    className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:border-primary/30 bg-background/50 hover:bg-primary/5 text-foreground/70 hover:text-foreground transition-all disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Active chat - show messages with proper scrolling
          <>
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 md:p-6"
            >
              <div className="mx-auto max-w-full md:max-w-4xl lg:max-w-5xl space-y-4">
                {filteredMessages.length === 0 && !isStreaming ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <p className="text-muted-foreground">No messages match your search</p>
                    ) : (
                      <>
                        <p className="text-muted-foreground mb-6">No messages yet. Start the conversation!</p>
                        {/* Initial conversation starters */}
                        <div className="space-y-2 max-w-lg mx-auto">
                          <p className="text-xs text-muted-foreground mb-3">Try asking:</p>
                          {[
                            'What are the latest research findings on this topic?',
                            'Can you summarize the key themes from my research?',
                            'What are the main contradictions in the findings?',
                            'What should I research next based on current findings?'
                          ].map((question, index) => (
                            <button
                              key={index}
                              onClick={() => handleSendMessage(question)}
                              className="w-full text-left px-3 py-2 text-sm text-foreground/80 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
                            >
                              <span className="opacity-60 mr-2">→</span>
                              {question}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {filteredMessages.map((message, index) => {
                      const isLastAssistantMessage =
                        message.role === 'assistant' &&
                        index === filteredMessages.length - 1 &&
                        !isStreaming;

                      return (
                        <div key={message.id} className={index > 0 ? 'mt-4' : ''}>
                          <ChatMessage
                            message={message}
                            onCitationClick={(findingId) => {
                              // Handle citation click - could open finding detail
                              console.log('Citation clicked:', findingId);
                            }}
                          />

                          {/* Inline suggested questions after last assistant message */}
                          {isLastAssistantMessage && suggestedQuestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {suggestedQuestions.slice(0, 3).map((question, qIndex) => (
                                <button
                                  key={qIndex}
                                  onClick={() => handleSuggestedQuestion(question)}
                                  className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:border-primary/30 bg-background/50 hover:bg-primary/5 text-foreground/70 hover:text-foreground transition-all"
                                >
                                  {question}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Streaming message */}
                    {isStreaming && streamingMessage && (
                      <div className={filteredMessages.length > 0 ? 'mt-4' : ''}>
                        <ChatMessage
                          message={{
                            ...streamingMessage,
                            id: 'streaming',
                            timestamp: new Date().toISOString(),
                            role: 'assistant'
                          } as any}
                          isStreaming={true}
                        />
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>


            {/* Input area */}
            <div className="border-t">
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading || isStreaming}
                placeholder="Ask about your research findings..."
                showTypingIndicator={isStreaming}
              />
            </div>
          </>
        )}
      </div>
    </div>
  ) : (
    // Normal mode - in sidebar
    <div
      ref={panelRef}
      className={`flex flex-col h-full min-w-[320px] ${className || ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold truncate max-w-[200px] md:max-w-none">{topicName}</h2>
          {activeChat && (
            <Badge variant="outline" className="ml-2 hidden md:inline-flex">
              {chatMessages.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            disabled={!activeChatId || chatMessages.length === 0}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleExportChat}
            disabled={!activeChatId || chatMessages.length === 0}
            title="Export chat"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {chatMessages.length > 5 && (
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1 text-sm border rounded-md"
            />
          </div>
        </div>
      )}

      {/* Main content area - no more context panel split */}
      <div className="flex-1 flex flex-col min-h-0">
        {!activeChat ? (
          // No active chat - show start prompt
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Start a Conversation</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Ask questions about your research findings and get AI-powered insights
            </p>
            <Button onClick={handleStartChat} disabled={isLoading} className="mb-6">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating chat...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Start New Chat
                </>
              )}
            </Button>

            {/* Suggested starting prompts */}
            <div className="mt-4 max-w-lg">
              <p className="text-xs text-muted-foreground mb-3 text-center">Or start with a question:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Summarize my research findings',
                  'What are the key themes?',
                  'Show contradictions',
                  'Next research steps'
                ].map((prompt, index) => (
                  <button
                    key={index}
                    onClick={async () => {
                      await handleStartChat();
                      // Small delay to ensure chat is created
                      setTimeout(() => handleSendMessage(prompt), 500);
                    }}
                    disabled={isLoading}
                    className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:border-primary/30 bg-background/50 hover:bg-primary/5 text-foreground/70 hover:text-foreground transition-all disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Active chat - show messages with proper scrolling
          <>
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 md:p-6"
            >
              <div className="mx-auto max-w-full md:max-w-4xl lg:max-w-5xl space-y-4">
                {filteredMessages.length === 0 && !isStreaming ? (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <p className="text-muted-foreground">No messages match your search</p>
                    ) : (
                      <>
                        <p className="text-muted-foreground mb-6">No messages yet. Start the conversation!</p>
                        {/* Initial conversation starters */}
                        <div className="space-y-2 max-w-lg mx-auto">
                          <p className="text-xs text-muted-foreground mb-3">Try asking:</p>
                          {[
                            'What are the latest research findings on this topic?',
                            'Can you summarize the key themes from my research?',
                            'What are the main contradictions in the findings?',
                            'What should I research next based on current findings?'
                          ].map((question, index) => (
                            <button
                              key={index}
                              onClick={() => handleSendMessage(question)}
                              className="w-full text-left px-3 py-2 text-sm text-foreground/80 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
                            >
                              <span className="opacity-60 mr-2">→</span>
                              {question}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {filteredMessages.map((message, index) => {
                      const isLastAssistantMessage =
                        message.role === 'assistant' &&
                        index === filteredMessages.length - 1 &&
                        !isStreaming;

                      return (
                        <div key={message.id} className={index > 0 ? 'mt-4' : ''}>
                          <ChatMessage
                            message={message}
                            onCitationClick={(findingId) => {
                              // Handle citation click - could open finding detail
                              console.log('Citation clicked:', findingId);
                            }}
                          />

                          {/* Inline suggested questions after last assistant message */}
                          {isLastAssistantMessage && suggestedQuestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {suggestedQuestions.slice(0, 3).map((question, qIndex) => (
                                <button
                                  key={qIndex}
                                  onClick={() => handleSuggestedQuestion(question)}
                                  className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:border-primary/30 bg-background/50 hover:bg-primary/5 text-foreground/70 hover:text-foreground transition-all"
                                >
                                  {question}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Streaming message */}
                    {isStreaming && streamingMessage && (
                      <div className={filteredMessages.length > 0 ? 'mt-4' : ''}>
                        <ChatMessage
                          message={{
                            ...streamingMessage,
                            id: 'streaming',
                            timestamp: new Date().toISOString(),
                            role: 'assistant'
                          } as any}
                          isStreaming={true}
                        />
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>


            {/* Input area */}
            <div className="border-t">
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading || isStreaming}
                placeholder="Ask about your research findings..."
                showTypingIndicator={isStreaming}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render both the placeholder and portal when maximized
  if (isMaximized) {
    const portalRoot = document.getElementById('portal-root');

    return (
      <>
        {/* Placeholder to keep parent container happy but hidden */}
        <div className="hidden" />

        {/* Fullscreen content via portal */}
        {portalRoot && createPortal(chatContent, portalRoot)}
      </>
    );
  }

  // Normal mode - render in place
  return chatContent;
}