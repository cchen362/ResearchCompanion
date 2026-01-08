import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Settings,
  Download,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2
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
    chatPanelWidth,
    chatViewMode,
    showChatContext,
    setChatPanelWidth,
    toggleChatContext,
    showToast
  } = useUIStore();

  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load chats on mount
  useEffect(() => {
    loadChats(topicId);
  }, [topicId, loadChats]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  return (
    <div
      ref={panelRef}
      className={`flex flex-col h-full ${isMaximized ? 'fixed inset-0 z-50 bg-white' : ''} ${className}`}
      style={{ width: isMaximized ? '100%' : '100%' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{topicName}</h2>
          {activeChat && (
            <Badge variant="outline" className="ml-2">
              {chatMessages.length} messages
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChatContext}
            title="Toggle context panel"
          >
            {showChatContext ? <ChevronRight /> : <ChevronLeft />}
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

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {!activeChat ? (
            // No active chat - show start prompt
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Start a Conversation</h3>
              <p className="text-muted-foreground text-center mb-4">
                Ask questions about your research findings and get AI-powered insights
              </p>
              <Button onClick={handleStartChat} disabled={isLoading}>
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
            </div>
          ) : (
            // Active chat - show messages
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredMessages.length === 0 && !isStreaming ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchQuery
                      ? 'No messages match your search'
                      : 'No messages yet. Start the conversation!'}
                  </div>
                ) : (
                  <>
                    {filteredMessages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        onCitationClick={(findingId) => {
                          // Handle citation click - could open finding detail
                          console.log('Citation clicked:', findingId);
                        }}
                      />
                    ))}

                    {/* Streaming message */}
                    {isStreaming && streamingMessage && (
                      <ChatMessage
                        message={{
                          ...streamingMessage,
                          id: 'streaming',
                          timestamp: new Date().toISOString(),
                          role: 'assistant'
                        } as any}
                        isStreaming={true}
                      />
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested questions */}
              {suggestedQuestions.length > 0 && !isStreaming && (
                <div className="px-4 py-2 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Suggested questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestedQuestion(question)}
                        className="text-left"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input area */}
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading || isStreaming}
                placeholder="Ask about your research findings..."
                showTypingIndicator={isStreaming}
              />
            </>
          )}
        </div>

        {/* Context panel */}
        {showChatContext && (
          <div className="w-64 border-l p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3">Context</h3>

            {/* Selected findings */}
            {selectedFindings.size > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Selected Findings</h4>
                <div className="space-y-2">
                  {Array.from(selectedFindings).slice(0, 5).map(id => (
                    <Card key={id} className="p-2">
                      <p className="text-xs text-muted-foreground">Finding {id.substring(0, 8)}</p>
                    </Card>
                  ))}
                  {selectedFindings.size > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{selectedFindings.size - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Conversation focus */}
            {context.conversationFocus && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Focus</h4>
                <Card className="p-2">
                  <p className="text-sm">{context.conversationFocus}</p>
                </Card>
              </div>
            )}

            {/* Chat stats */}
            <div>
              <h4 className="text-sm font-medium mb-2">Statistics</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Messages: {chatMessages.length}</p>
                <p>Citations: {chatMessages.reduce((acc, msg) => acc + (msg.citations?.length || 0), 0)}</p>
                <p>Started: {activeChat ? new Date(activeChat.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}