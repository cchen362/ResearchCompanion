import React, { useState, useEffect } from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';

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

        // Subscribe to messages
        const chatState = chatStoreModule.useChatStore.getState();
        const activeMessages = chatState.messages.get(chatState.activeChatId || '') || [];
        setMessages(activeMessages);

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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !stores) return;

    setIsLoading(true);
    try {
      // Dynamically import chat service
      const { chatService } = await import('../services/chat.service');
      const chatStore = stores.useChatStore.getState();

      // Send message
      await chatService.sendMessage({
        message: inputValue,
        chatId: chatStore.activeChatId!,
        topicId,
        context: chatStore.context,
        stream: true
      }, {
        onComplete: () => {
          setIsLoading(false);
          setInputValue('');
        },
        onError: (error) => {
          console.error('Failed to send message:', error);
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
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
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-50 ml-auto max-w-[80%]'
                    : 'bg-gray-50 mr-auto max-w-[80%]'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}