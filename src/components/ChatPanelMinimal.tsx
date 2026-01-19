import React, { useState, useEffect } from 'react';
import { Loader2, MessageSquare, X, Download, Trash2, Maximize2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Button } from './ui/button';
import { FindingDetailModal } from './FindingDetailModal';

interface ChatPanelProps {
  topicId: string;
  topicName: string;
  className?: string;
  onClose?: () => void;
}

// Minimal chat panel with NO store imports to break all circular dependencies
export function ChatPanel({ topicId, topicName, className = '', onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stores, setStores] = useState<any>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dynamically load ALL stores and services after component mounts
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        console.log('[ChatPanelMinimal] Loading stores dynamically...');

        // Load stores dynamically to avoid ANY circular dependencies
        const [chatStoreModule, findingsStoreModule, uiStoreModule] = await Promise.all([
          import('../stores/chatStore'),
          import('../stores/findingsStore'),
          import('../stores/uiStore')
        ]);

        setStores({
          useChatStore: chatStoreModule.useChatStore,
          useFindingsStore: findingsStoreModule.useFindingsStore,
          useUIStore: uiStoreModule.useUIStore
        });

        console.log('[ChatPanelMinimal] All stores loaded successfully');

        // Now load initial data
        const chatStore = chatStoreModule.useChatStore.getState();
        await chatStore.loadChats(topicId);

        if (!chatStore.activeChat) {
          await chatStore.createChat(topicId);
        }

        // Load messages for the active chat
        if (chatStore.activeChatId) {
          await chatStore.loadMessages(chatStore.activeChatId);

          // After loading, get the messages from the updated state
          // Use a small delay to ensure state has been updated
          await new Promise(resolve => setTimeout(resolve, 100));

          const updatedState = chatStoreModule.useChatStore.getState();
          const loadedMessages = updatedState.messages.get(chatStore.activeChatId) || [];
          setMessages(loadedMessages);
          console.log('[ChatPanelMinimal] Messages loaded after API call:', loadedMessages.length);
        }

        // Load findings for the topic so citations can be resolved
        const findingsStore = findingsStoreModule.useFindingsStore.getState();
        await findingsStore.loadFindings(topicId);
        console.log('[ChatPanelMinimal] Loaded findings for topic:', findingsStore.findings.length);

        const unsubscribe = chatStoreModule.useChatStore.subscribe(
          (state) => state.messages,
          (messages) => {
            const currentState = chatStoreModule.useChatStore.getState();
            const activeMessages = messages.get(currentState.activeChatId || '') || [];
            setMessages(activeMessages);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('[ChatPanelMinimal] Failed to load dependencies:', error);
      }
    };

    loadDependencies();
  }, [topicId]);

  const handleCitationClick = async (findingId: string) => {
    console.log('Citation clicked - Finding ID:', findingId);

    // Try to get the finding from the findings store
    if (stores) {
      const findingsStore = stores.useFindingsStore.getState();

      // First, try to load findings if not already loaded
      if (findingsStore.findings.length === 0) {
        console.log('Loading findings for topic...');
        await findingsStore.loadFindings(topicId);
      }

      let finding = findingsStore.findings.find((f: any) => f.id === findingId);

      // If not found in local store, try fetching from API
      if (!finding) {
        console.log('Finding not in local store, fetching from API...');
        try {
          const { findingsAPIService } = await import('../services/findings.api.service');
          const apiFindings = await findingsAPIService.getFindings(topicId);

          // Find the specific finding from the API response
          finding = apiFindings.find((f: any) => f.id === findingId);

          if (finding) {
            console.log('Found finding from API:', finding);

            // Optionally add to store for future use
            findingsStore.addFinding(finding);
          }
        } catch (error) {
          console.error('Failed to fetch finding from API:', error);
        }
      }

      if (finding) {
        console.log('Found finding to display:', finding);

        // Open the modal with the finding details
        setSelectedFinding(finding);
        setIsModalOpen(true);

        // Also set in UI store if available
        const uiStore = stores.useUIStore.getState();
        if (uiStore.setSelectedFinding) {
          uiStore.setSelectedFinding(finding);
        }
      } else {
        console.log('Finding not found in store or API. Finding ID:', findingId);
        // Could show a toast notification here instead of alert
        console.warn('Finding details not available. The finding may have been deleted or is not accessible.');
      }
    }
  };

  const handleExport = async () => {
    try {
      if (!stores) return;

      // Dynamically import chat service for export
      const { chatService } = await import('../services/chat.service');
      const chatStore = stores.useChatStore.getState();

      if (!chatStore.activeChatId) {
        console.error('No active chat to export');
        return;
      }

      // Get chat export as markdown
      const markdown = await chatService.exportChat(
        topicId,
        chatStore.activeChatId,
        'markdown'
      );

      // Create blob and download
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${topicName}-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export chat. Please try again.');
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear this chat? This cannot be undone.')) return;

    try {
      if (!stores) return;

      // Dynamically import chat service for clearing
      const { chatService } = await import('../services/chat.service');
      const chatStore = stores.useChatStore.getState();

      if (!chatStore.activeChatId) {
        console.error('No active chat to clear');
        return;
      }

      // Clear messages
      await chatService.clearMessages(topicId, chatStore.activeChatId);
      setMessages([]);
      setSuggestedQuestions([]);

      // Reload chat to reset state
      await chatStore.loadChats(topicId);
    } catch (error) {
      console.error('Clear failed:', error);
      alert('Failed to clear chat. Please try again.');
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const message = messageText || inputValue;
    if (!message.trim() || !stores) return;

    setIsLoading(true);
    try {
      // Dynamically import chat service
      const { chatService } = await import('../services/chat.service');
      const chatStore = stores.useChatStore.getState();

      // Load findings directly from API to ensure we have server data
      const { findingsService } = await import('../services/findings.service');
      console.log('[ChatPanel] Loading findings for topic from API...');

      let topicFindings: any[] = [];
      try {
        const allFindings = await findingsService.getFindings(topicId);
        // Get up to 20 findings for context (backend expects these for citations)
        topicFindings = allFindings.slice(0, 20); // Limit to 20 to match backend's citation range
        console.log('[ChatPanel] Loaded findings from API:', {
          totalCount: allFindings.length,
          usingCount: topicFindings.length
        });
      } catch (error) {
        console.error('[ChatPanel] Failed to load findings:', error);
        // Fall back to empty array if loading fails
        topicFindings = [];
      }

      console.log('[ChatPanel] Sending findings context:', {
        count: topicFindings.length,
        findingIds: topicFindings.map((f: any) => f.id)
      });

      // Transform findings to match backend schema
      const transformedFindings = topicFindings.map((f: any) => ({
        id: f.id,
        title: f.title || '',
        content: f.details || f.summary || '',
        source: f.source?.displayName || f.source?.name || 'Unknown Source',
        type: f.type || 'research',
        createdAt: f.timestamp ? new Date(f.timestamp).toISOString() : new Date().toISOString(),
        priority: f.priority || 'medium'
      }));

      // Create context with actual findings in the correct 'findings' field
      const contextWithFindings = {
        findings: transformedFindings, // Use 'findings' field as expected by backend schema
        currentFindings: topicFindings.map((f: any) => f.id), // Just IDs for backward compat
        expandedTopics: [],
        recentInteractions: [],
        userPreferences: {},
      };

      // First add the user message to the local state
      const userMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');

      // Use the API service which handles auth properly
      const { api } = await import('../services/api');

      // Use non-streaming API for now to avoid URI too large issue
      const response = await api.post('/chat/complete', {
        message: userMessage.content,
        chatId: chatStore.activeChatId!,
        topicId,
        context: contextWithFindings, // Use context with actual findings
        stream: false // Use non-streaming endpoint
      });

      setIsLoading(false);

      // Add AI response to messages
      const aiMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.data.content,
        citations: response.data.citations,
        timestamp: new Date()
      };

      // Debug logging for citations
      console.log('📚 [ChatPanel] AI Response Citations:', {
        totalCitations: response.data.citations?.length || 0,
        citations: response.data.citations,
        contentPreview: response.data.content.substring(0, 200)
      });

      // Extract all citation numbers mentioned in the content
      const mentionedCitations = new Set<number>();
      const citationPattern = /\[(\d+)\]/g;
      let match;
      while ((match = citationPattern.exec(response.data.content)) !== null) {
        mentionedCitations.add(parseInt(match[1]));
      }

      console.log('🔍 [ChatPanel] Citation Analysis:', {
        mentionedInText: Array.from(mentionedCitations).sort((a, b) => a - b),
        providedInArray: response.data.citations?.map((c: any) => c.citationNumber).sort((a: any, b: any) => a - b) || [],
        missing: Array.from(mentionedCitations).filter(num =>
          !response.data.citations?.some((c: any) => c.citationNumber === num)
        )
      });

      setMessages(prev => [...prev, aiMessage]);

      // Set suggested questions if available
      if (response.data.suggestedQuestions && response.data.suggestedQuestions.length > 0) {
        setSuggestedQuestions(response.data.suggestedQuestions);
      }

      // Save to store if needed
      if (stores) {
        const chatStore = stores.useChatStore.getState();
        if (chatStore.addMessage) {
          await chatStore.addMessage(chatStore.activeChatId!, userMessage);
          await chatStore.addMessage(chatStore.activeChatId!, aiMessage);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);

      // Show error message to user
      const errorMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  if (!stores) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
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
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Start a conversation about {topicName}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id || idx}
                message={msg}
                onCitationClick={handleCitationClick}
                isStreaming={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggested Questions */}
      {suggestedQuestions.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => {
                  handleSendMessage(question);
                  setSuggestedQuestions([]);
                }}
                className="text-sm px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t">
        <ChatInput
          onSendMessage={(text) => {
            handleSendMessage(text);
          }}
          disabled={isLoading}
          placeholder="Type your message..."
          maxLength={4000}
          showTypingIndicator={isLoading}
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