import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { FindingsChat, ChatMessage, ChatContext, SourceCitation } from '../types';
import { getDB } from '../utils/db/database';

interface ChatStore {
  // State
  chats: FindingsChat[];
  activeChat: FindingsChat | null;
  activeChatId: string | null;
  messages: Map<string, ChatMessage[]>;
  isStreaming: boolean;
  streamingMessage: Partial<ChatMessage> | null;
  context: ChatContext;

  // Actions - Chat Management
  loadChats: (topicId?: string) => Promise<void>;
  createChat: (topicId: string, initialMessage?: string) => Promise<FindingsChat>;
  setActiveChat: (chatId: string) => Promise<void>;
  updateChat: (chatId: string, updates: Partial<FindingsChat>) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearChats: () => Promise<void>;

  // Actions - Message Management
  loadMessages: (chatId: string) => Promise<void>;
  addMessage: (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<ChatMessage>;
  updateMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;

  // Actions - Streaming
  startStreaming: (partialMessage: Partial<ChatMessage>) => void;
  updateStreamingMessage: (content: string) => void;
  endStreaming: (finalMessage: ChatMessage) => void;

  // Actions - Context Management
  updateContext: (context: Partial<ChatContext>) => void;
  addFindingToContext: (findingId: string) => void;
  removeFindingFromContext: (findingId: string) => void;
  clearContext: () => void;

  // Actions - Citations
  addCitation: (messageId: string, citation: SourceCitation) => Promise<void>;
  removeCitation: (messageId: string, citationId: string) => Promise<void>;
}

const initialContext: ChatContext = {
  currentFindings: [],
  expandedTopics: [],
  recentInteractions: [],
  userPreferences: {},
  conversationFocus: undefined
};

export const useChatStore = create<ChatStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        chats: [],
        activeChat: null,
        activeChatId: null,
        messages: new Map(),
        isStreaming: false,
        streamingMessage: null,
        context: initialContext,

        // Chat Management
        loadChats: async (topicId?: string) => {
          try {
            const db = await getDB();
            const tx = db.transaction('chats', 'readonly');
            const store = tx.objectStore('chats');

            let chats: FindingsChat[];
            if (topicId) {
              const index = store.index('by-topic');
              chats = await index.getAll(topicId);
            } else {
              chats = await store.getAll();
            }

            // Sort by last message timestamp
            chats.sort((a, b) =>
              new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
            );

            set({ chats });
          } catch (error) {
            console.error('Failed to load chats:', error);
            throw error;
          }
        },

        createChat: async (topicId: string, initialMessage?: string) => {
          try {
            const db = await getDB();
            const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const newChat: FindingsChat = {
              id: chatId,
              topicId,
              title: initialMessage?.substring(0, 100) || 'New Conversation',
              status: 'active',
              createdAt: new Date().toISOString(),
              lastMessageAt: new Date().toISOString(),
              messageCount: 0,
              context: {
                currentFindings: [],
                expandedTopics: [],
                recentInteractions: [],
                userPreferences: {}
              }
            };

            const tx = db.transaction('chats', 'readwrite');
            await tx.objectStore('chats').add(newChat);
            await tx.done;

            const { chats } = get();
            set({
              chats: [newChat, ...chats],
              activeChat: newChat,
              activeChatId: chatId
            });

            // Initialize empty message array for this chat
            const messagesMap = get().messages;
            messagesMap.set(chatId, []);
            set({ messages: new Map(messagesMap) });

            return newChat;
          } catch (error) {
            console.error('Failed to create chat:', error);
            throw error;
          }
        },

        setActiveChat: async (chatId: string) => {
          try {
            const { chats } = get();
            const chat = chats.find(c => c.id === chatId);

            if (!chat) {
              throw new Error(`Chat ${chatId} not found`);
            }

            set({ activeChat: chat, activeChatId: chatId });

            // Load messages if not already loaded
            const { messages } = get();
            if (!messages.has(chatId)) {
              await get().loadMessages(chatId);
            }

            // Update context from chat
            if (chat.context) {
              set({ context: chat.context });
            }
          } catch (error) {
            console.error('Failed to set active chat:', error);
            throw error;
          }
        },

        updateChat: async (chatId: string, updates: Partial<FindingsChat>) => {
          try {
            const db = await getDB();
            const tx = db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');

            const existingChat = await store.get(chatId);
            if (!existingChat) {
              throw new Error(`Chat ${chatId} not found`);
            }

            const updatedChat = { ...existingChat, ...updates };
            await store.put(updatedChat);
            await tx.done;

            const { chats, activeChat } = get();
            const updatedChats = chats.map(c =>
              c.id === chatId ? updatedChat : c
            );

            set({
              chats: updatedChats,
              activeChat: activeChat?.id === chatId ? updatedChat : activeChat
            });
          } catch (error) {
            console.error('Failed to update chat:', error);
            throw error;
          }
        },

        deleteChat: async (chatId: string) => {
          try {
            const db = await getDB();
            const tx = db.transaction('chats', 'readwrite');
            await tx.objectStore('chats').delete(chatId);
            await tx.done;

            const { chats, activeChat, messages } = get();
            const updatedChats = chats.filter(c => c.id !== chatId);

            // Remove messages from memory
            const messagesMap = new Map(messages);
            messagesMap.delete(chatId);

            set({
              chats: updatedChats,
              activeChat: activeChat?.id === chatId ? null : activeChat,
              activeChatId: activeChat?.id === chatId ? null : get().activeChatId,
              messages: messagesMap
            });
          } catch (error) {
            console.error('Failed to delete chat:', error);
            throw error;
          }
        },

        clearChats: async () => {
          try {
            const db = await getDB();
            const tx = db.transaction('chats', 'readwrite');
            await tx.objectStore('chats').clear();
            await tx.done;

            set({
              chats: [],
              activeChat: null,
              activeChatId: null,
              messages: new Map(),
              context: initialContext
            });
          } catch (error) {
            console.error('Failed to clear chats:', error);
            throw error;
          }
        },

        // Message Management
        loadMessages: async (chatId: string) => {
          try {
            const db = await getDB();
            const chat = await db.get('chats', chatId);

            if (!chat) {
              throw new Error(`Chat ${chatId} not found`);
            }

            // For now, messages are stored in the chat object
            // In a real implementation, you might have a separate messages store
            const messages: ChatMessage[] = (chat as any).messages || [];

            const messagesMap = get().messages;
            messagesMap.set(chatId, messages);
            set({ messages: new Map(messagesMap) });
          } catch (error) {
            console.error('Failed to load messages:', error);
            // Initialize with empty array on error
            const messagesMap = get().messages;
            messagesMap.set(chatId, []);
            set({ messages: new Map(messagesMap) });
          }
        },

        addMessage: async (chatId: string, messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
          try {
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const timestamp = new Date().toISOString();

            const newMessage: ChatMessage = {
              ...messageData,
              id: messageId,
              timestamp
            };

            // Add to local state
            const { messages } = get();
            const chatMessages = messages.get(chatId) || [];
            const updatedMessages = [...chatMessages, newMessage];

            const messagesMap = new Map(messages);
            messagesMap.set(chatId, updatedMessages);
            set({ messages: messagesMap });

            // Update chat in database
            const db = await getDB();
            const tx = db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');

            const chat = await store.get(chatId);
            if (chat) {
              chat.lastMessageAt = timestamp;
              chat.messageCount = updatedMessages.length;
              (chat as any).messages = updatedMessages;
              await store.put(chat);
            }
            await tx.done;

            // Update chat in local state
            await get().updateChat(chatId, {
              lastMessageAt: timestamp,
              messageCount: updatedMessages.length
            });

            return newMessage;
          } catch (error) {
            console.error('Failed to add message:', error);
            throw error;
          }
        },

        updateMessage: async (chatId: string, messageId: string, updates: Partial<ChatMessage>) => {
          try {
            const { messages } = get();
            const chatMessages = messages.get(chatId) || [];

            const updatedMessages = chatMessages.map(msg =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            );

            const messagesMap = new Map(messages);
            messagesMap.set(chatId, updatedMessages);
            set({ messages: messagesMap });

            // Update in database
            const db = await getDB();
            const tx = db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');

            const chat = await store.get(chatId);
            if (chat) {
              (chat as any).messages = updatedMessages;
              await store.put(chat);
            }
            await tx.done;
          } catch (error) {
            console.error('Failed to update message:', error);
            throw error;
          }
        },

        deleteMessage: async (chatId: string, messageId: string) => {
          try {
            const { messages } = get();
            const chatMessages = messages.get(chatId) || [];

            const updatedMessages = chatMessages.filter(msg => msg.id !== messageId);

            const messagesMap = new Map(messages);
            messagesMap.set(chatId, updatedMessages);
            set({ messages: messagesMap });

            // Update in database
            const db = await getDB();
            const tx = db.transaction('chats', 'readwrite');
            const store = tx.objectStore('chats');

            const chat = await store.get(chatId);
            if (chat) {
              (chat as any).messages = updatedMessages;
              chat.messageCount = updatedMessages.length;
              await store.put(chat);
            }
            await tx.done;

            // Update chat message count
            await get().updateChat(chatId, {
              messageCount: updatedMessages.length
            });
          } catch (error) {
            console.error('Failed to delete message:', error);
            throw error;
          }
        },

        // Streaming
        startStreaming: (partialMessage: Partial<ChatMessage>) => {
          set({ isStreaming: true, streamingMessage: partialMessage });
        },

        updateStreamingMessage: (content: string) => {
          const { streamingMessage } = get();
          if (streamingMessage) {
            set({
              streamingMessage: { ...streamingMessage, content }
            });
          }
        },

        endStreaming: (finalMessage: ChatMessage) => {
          set({ isStreaming: false, streamingMessage: null });
        },

        // Context Management
        updateContext: (context: Partial<ChatContext>) => {
          const currentContext = get().context;
          const newContext = { ...currentContext, ...context };
          set({ context: newContext });

          // Update active chat's context if exists
          const { activeChat, activeChatId } = get();
          if (activeChat && activeChatId) {
            get().updateChat(activeChatId, { context: newContext });
          }
        },

        addFindingToContext: (findingId: string) => {
          const { context } = get();
          if (!context.currentFindings.includes(findingId)) {
            const newFindings = [...context.currentFindings, findingId];
            get().updateContext({ currentFindings: newFindings });
          }
        },

        removeFindingFromContext: (findingId: string) => {
          const { context } = get();
          const newFindings = context.currentFindings.filter(id => id !== findingId);
          get().updateContext({ currentFindings: newFindings });
        },

        clearContext: () => {
          set({ context: initialContext });
        },

        // Citations
        addCitation: async (messageId: string, citation: SourceCitation) => {
          const { activeChatId, messages } = get();
          if (!activeChatId) return;

          const chatMessages = messages.get(activeChatId) || [];
          const message = chatMessages.find(m => m.id === messageId);

          if (message) {
            const citations = message.citations || [];
            await get().updateMessage(activeChatId, messageId, {
              citations: [...citations, citation]
            });
          }
        },

        removeCitation: async (messageId: string, citationId: string) => {
          const { activeChatId, messages } = get();
          if (!activeChatId) return;

          const chatMessages = messages.get(activeChatId) || [];
          const message = chatMessages.find(m => m.id === messageId);

          if (message && message.citations) {
            const citations = message.citations.filter(c =>
              `${c.findingId}_${c.highlightStart}` !== citationId
            );
            await get().updateMessage(activeChatId, messageId, { citations });
          }
        }
      }),
      {
        name: 'chat-store',
        storage: {
          getItem: async (name) => {
            const value = localStorage.getItem(name);
            if (!value) return null;
            // Parse and handle Map serialization
            const parsed = JSON.parse(value);
            if (parsed.state?.messages) {
              parsed.state.messages = new Map(parsed.state.messages);
            }
            return parsed;
          },
          setItem: async (name, value) => {
            // Convert Map to array for serialization
            const toStore = { ...value };
            if (toStore.state?.messages instanceof Map) {
              toStore.state.messages = Array.from(toStore.state.messages.entries());
            }
            localStorage.setItem(name, JSON.stringify(toStore));
          },
          removeItem: async (name) => {
            localStorage.removeItem(name);
          },
        },
        partialize: (state) => ({
          activeChatId: state.activeChatId,
          context: state.context
        })
      }
    )
  )
);