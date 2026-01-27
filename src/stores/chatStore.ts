import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { FindingsChat, ChatMessage, ChatContext, SourceCitation } from '../types';
import { getDB } from '../utils/db/database';
// Removed chatAPIService import to avoid circular dependency
import { storageConfig } from '../config/storage.config';

interface ChatStore {
  // State
  chats: FindingsChat[];
  activeChat: FindingsChat | null;
  activeChatId: string | null;
  messages: Map<string, ChatMessage[]>;
  isStreaming: boolean;
  streamingMessage: Partial<ChatMessage> | null;
  context: ChatContext;
  isHydrated: boolean; // Track hydration state
  hydrationPromise: Promise<void> | null; // Promise that resolves when hydrated

  // Actions - Chat Management
  loadChats: (topicId?: string) => Promise<void>;
  createChat: (topicId: string, initialMessage?: string) => Promise<FindingsChat>;
  getChatByTopicId: (topicId: string) => FindingsChat | undefined;
  setActiveChat: (chatId: string) => Promise<void>;
  updateChat: (chatId: string, updates: Partial<FindingsChat>) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearChats: () => Promise<void>;

  // Actions - Message Management
  loadMessages: (chatId: string) => Promise<void>;
  addMessage: (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<ChatMessage>;
  updateMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  clearMessages: (chatId: string) => void;

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

  // Actions - Hydration
  waitForHydration: () => Promise<void>;
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
        isHydrated: false,
        hydrationPromise: null,

        // Chat Management
        loadChats: async (topicId?: string) => {
          try {
            let chats: FindingsChat[];

            if (storageConfig.useServerStorage) {
              // Use API when server storage is enabled
              const { chatAPIService } = await import('../services/chat.api.service');
              chats = await chatAPIService.getChats(topicId);
            } else {
              // Fall back to IndexedDB for local storage
              const db = await getDB();
              const tx = db.transaction('chats', 'readonly');
              const store = tx.objectStore('chats');

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
            }

            set({ chats });
          } catch (error) {
            console.error('Failed to load chats:', error);
            throw error;
          }
        },

        createChat: async (topicId: string, initialMessage?: string) => {
          try {
            let newChat: FindingsChat;

            if (storageConfig.useServerStorage) {
              // Use API when server storage is enabled
              const context = {
                currentFindings: [],
                expandedTopics: [],
                recentInteractions: [],
                userPreferences: {}
              };

              const { chatAPIService } = await import('../services/chat.api.service');
              newChat = await chatAPIService.createChat(
                topicId,
                initialMessage?.substring(0, 100) || 'New Conversation',
                context
              );
            } else {
              // Fall back to IndexedDB for local storage
              const db = await getDB();
              const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

              newChat = {
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
            }

            const { chats } = get();
            set({
              chats: [newChat, ...chats],
              activeChat: newChat,
              activeChatId: newChat.id
            });

            // Initialize empty message array for this chat
            const messagesMap = get().messages;
            messagesMap.set(newChat.id, []);
            set({ messages: new Map(messagesMap) });

            return newChat;
          } catch (error) {
            console.error('Failed to create chat:', error);
            throw error;
          }
        },

        getChatByTopicId: (topicId: string) => {
          const { chats } = get();
          return chats.find(c => c.topicId === topicId);
        },

        setActiveChat: async (chatId: string) => {
          console.log('🔄 [chatStore] Setting active chat:', chatId);
          try {
            const { chats } = get();
            let chat = chats.find(c => c.id === chatId);

            // If chat not in memory, try to load from server
            if (!chat && storageConfig.useServerStorage) {
              console.log('🌐 [chatStore] Chat not in memory, loading from server...');
              const { chatAPIService } = await import('../services/chat.api.service');
              const topicChats = await chatAPIService.getChats(undefined); // Get all chats
              chat = topicChats.find(c => c.id === chatId);

              if (chat) {
                // Add to local state
                set({ chats: [...get().chats, chat] });
              }
            }

            if (!chat) {
              console.error(`❌ [chatStore] Chat ${chatId} not found`);
              throw new Error(`Chat ${chatId} not found`);
            }

            console.log('✅ [chatStore] Active chat set:', chat.title);
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
            let updatedChat: FindingsChat;

            if (storageConfig.useServerStorage) {
              // Use API when server storage is enabled
              const { chatAPIService } = await import('../services/chat.api.service');
              updatedChat = await chatAPIService.updateChat(chatId, updates);
            } else {
              // Fall back to IndexedDB for local storage
              const db = await getDB();
              const tx = db.transaction('chats', 'readwrite');
              const store = tx.objectStore('chats');

              const existingChat = await store.get(chatId);
              if (!existingChat) {
                throw new Error(`Chat ${chatId} not found`);
              }

              updatedChat = { ...existingChat, ...updates };
              await store.put(updatedChat);
              await tx.done;
            }

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
            if (storageConfig.useServerStorage) {
              // Use API when server storage is enabled
              const { chatAPIService } = await import('../services/chat.api.service');
              await chatAPIService.deleteChat(chatId);
            } else {
              // Fall back to IndexedDB for local storage
              const db = await getDB();
              const tx = db.transaction('chats', 'readwrite');
              await tx.objectStore('chats').delete(chatId);
              await tx.done;
            }

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
          console.log('📨 [chatStore] Loading messages for chat:', chatId);
          try {
            let messages: ChatMessage[];

            if (storageConfig.useServerStorage) {
              // Use API when server storage is enabled
              console.log('📡 [chatStore] Fetching messages from API...');
              const { chatAPIService } = await import('../services/chat.api.service');
              messages = await chatAPIService.getMessages(chatId);
              console.log('✅ [chatStore] Loaded messages from API:', {
                count: messages.length,
                hasMessages: messages.length > 0,
                firstMessageCitations: messages[0]?.citations?.length || 0
              });
            } else {
              // Fall back to IndexedDB for local storage
              const db = await getDB();
              const chat = await db.get('chats', chatId);

              if (!chat) {
                throw new Error(`Chat ${chatId} not found`);
              }

              // For now, messages are stored in the chat object
              // In a real implementation, you might have a separate messages store
              messages = (chat as any).messages || [];
            }

            const messagesMap = get().messages;
            messagesMap.set(chatId, messages);
            set({ messages: new Map(messagesMap) });
          } catch (error) {
            console.error('❌ [chatStore] Failed to load messages:', error);
            // Initialize with empty array on error
            const messagesMap = get().messages;
            messagesMap.set(chatId, []);
            set({ messages: new Map(messagesMap) });
          }
        },

        addMessage: async (chatId: string, messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
          console.log('📨 [chatStore] addMessage called:', {
            chatId,
            role: messageData.role,
            contentLength: messageData.content.length,
            hasCitations: !!messageData.citations?.length,
            useServerStorage: storageConfig.useServerStorage
          });

          try {
            let newMessage: ChatMessage;

            if (storageConfig.useServerStorage) {
              console.log('🌐 [chatStore] Using server storage, calling API...');
              // Use API when server storage is enabled
              const { chatAPIService } = await import('../services/chat.api.service');
              console.log('🌐 [chatStore] Calling chatAPIService.addMessage...');
              newMessage = await chatAPIService.addMessage(
                chatId,
                messageData.role,
                messageData.content,
                messageData.citations,
                messageData.metadata
              );
              console.log('✅ [chatStore] Message saved to server:', {
                messageId: newMessage.id,
                timestamp: newMessage.timestamp
              });
            } else {
              console.log('💾 [chatStore] Using local IndexedDB storage...');
              // Fall back to IndexedDB for local storage
              const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const timestamp = new Date().toISOString();

              newMessage = {
                ...messageData,
                id: messageId,
                timestamp
              };

              // Update chat in database
              const db = await getDB();
              const tx = db.transaction('chats', 'readwrite');
              const store = tx.objectStore('chats');

              const chat = await store.get(chatId);
              if (chat) {
                const chatMessages = (chat as any).messages || [];
                const updatedMessages = [...chatMessages, newMessage];

                chat.lastMessageAt = timestamp;
                chat.messageCount = updatedMessages.length;
                (chat as any).messages = updatedMessages;
                await store.put(chat);
              }
              await tx.done;
            }

            // Add to local state
            const { messages, chats, activeChat } = get();
            const chatMessages = messages.get(chatId) || [];
            const updatedMessages = [...chatMessages, newMessage];

            const messagesMap = new Map(messages);
            messagesMap.set(chatId, updatedMessages);

            // Update chat in local state without hitting the database again
            const updatedChats = chats.map(c =>
              c.id === chatId
                ? { ...c, lastMessageAt: newMessage.timestamp, messageCount: updatedMessages.length }
                : c
            );

            set({
              messages: messagesMap,
              chats: updatedChats,
              activeChat: activeChat?.id === chatId
                ? { ...activeChat, lastMessageAt: newMessage.timestamp, messageCount: updatedMessages.length }
                : activeChat
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

            // Only update in database if using local storage
            if (!storageConfig.useServerStorage) {
              const db = await getDB();
              const tx = db.transaction('chats', 'readwrite');
              const store = tx.objectStore('chats');

              const chat = await store.get(chatId);
              if (chat) {
                (chat as any).messages = updatedMessages;
                await store.put(chat);
              }
              await tx.done;
            }
            // For server storage, we would need to implement an API endpoint to update messages
          } catch (error) {
            console.error('Failed to update message:', error);
            throw error;
          }
        },

        deleteMessage: async (chatId: string, messageId: string) => {
          try {
            const { messages, chats, activeChat } = get();
            const chatMessages = messages.get(chatId) || [];

            const updatedMessages = chatMessages.filter(msg => msg.id !== messageId);

            const messagesMap = new Map(messages);
            messagesMap.set(chatId, updatedMessages);

            // Update chat message count in local state
            const updatedChats = chats.map(c =>
              c.id === chatId
                ? { ...c, messageCount: updatedMessages.length }
                : c
            );

            set({
              messages: messagesMap,
              chats: updatedChats,
              activeChat: activeChat?.id === chatId
                ? { ...activeChat, messageCount: updatedMessages.length }
                : activeChat
            });

            // Only update in database if using local storage
            if (!storageConfig.useServerStorage) {
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
            }
            // For server storage, we would need to implement an API endpoint to delete messages
          } catch (error) {
            console.error('Failed to delete message:', error);
            throw error;
          }
        },

        clearMessages: (chatId: string) => {
          const { messages } = get();
          const messagesMap = new Map(messages);
          messagesMap.set(chatId, []);
          set({ messages: messagesMap });

          // Note: We're not updating the database here since this is meant to be
          // a temporary UI clear. Messages will reload from DB if needed.
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
        },

        // Hydration Management
        waitForHydration: async () => {
          const state = get();

          // If already hydrated, return immediately
          if (state.isHydrated) {
            console.log('✅ [chatStore] Already hydrated');
            return;
          }

          // If hydration promise exists, wait for it
          if (state.hydrationPromise) {
            console.log('⏳ [chatStore] Waiting for existing hydration...');
            return state.hydrationPromise;
          }

          // Create new hydration promise
          console.log('🔄 [chatStore] Creating hydration promise...');
          const promise = new Promise<void>((resolve) => {
            const checkHydration = setInterval(() => {
              if (get().isHydrated) {
                clearInterval(checkHydration);
                console.log('✅ [chatStore] Hydration complete!');
                resolve();
              }
            }, 50);

            // Timeout after 3 seconds
            setTimeout(() => {
              clearInterval(checkHydration);
              console.warn('⚠️ [chatStore] Hydration timeout - proceeding anyway');
              set({ isHydrated: true });
              resolve();
            }, 3000);
          });

          set({ hydrationPromise: promise });
          return promise;
        }
      }),
      {
        name: 'chat-store',
        storage: {
          getItem: async (name) => {
            const value = localStorage.getItem(name);
            if (!value) return null;

            try {
              const parsed = JSON.parse(value);

              // Handle Map deserialization properly
              if (parsed.state?.messages && Array.isArray(parsed.state.messages)) {
                console.log('🔄 [chatStore] Deserializing messages Map from localStorage:', {
                  entriesCount: parsed.state.messages.length
                });
                parsed.state.messages = new Map(parsed.state.messages);
              } else if (parsed.state?.messages && !(parsed.state.messages instanceof Map)) {
                console.warn('⚠️ [chatStore] Messages in unexpected format, creating new Map');
                parsed.state.messages = new Map();
              }

              return parsed;
            } catch (error) {
              console.error('❌ [chatStore] Error deserializing from localStorage:', error);
              return null;
            }
          },
          setItem: async (name, value) => {
            try {
              // Deep clone the value to avoid mutating the original
              const toStore = JSON.parse(JSON.stringify({
                ...value,
                state: {
                  ...value.state,
                  messages: value.state?.messages instanceof Map
                    ? Array.from(value.state.messages.entries())
                    : value.state?.messages
                }
              }));

              const serialized = JSON.stringify(toStore);
              console.log('💾 [chatStore] Serializing to localStorage:', {
                messageMapSize: value.state?.messages?.size || 0,
                serializedLength: serialized.length
              });

              localStorage.setItem(name, serialized);
            } catch (error) {
              console.error('❌ [chatStore] Error serializing to localStorage:', error);
            }
          },
          removeItem: async (name) => {
            localStorage.removeItem(name);
          },
        },
        partialize: (state) => ({
          chats: state.chats,           // Persist full chat list
          activeChat: state.activeChat, // Persist active chat object
          activeChatId: state.activeChatId,
          context: state.context,
          messages: state.messages      // Persist messages Map
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error('❌ [chatStore] Rehydration error:', error);
            // Set hydrated to true even on error to prevent infinite waiting
            useChatStore.setState({ isHydrated: true });
          } else {
            console.log('🔄 [chatStore] Rehydrated from localStorage:', {
              chatsCount: state?.chats?.length || 0,
              hasActiveChat: !!state?.activeChat,
              activeChatId: state?.activeChatId,
              hasContext: !!state?.context,
              messageCount: state?.messages ? state.messages.size : 0,
              messagesForActiveChat: state?.messages && state?.activeChatId ?
                (state.messages.get(state.activeChatId)?.length || 0) : 0
            });

            // If we have a persisted activeChatId, load messages for it
            if (state?.activeChatId && !state?.messages?.has(state.activeChatId)) {
              console.log('📨 [chatStore] Auto-loading messages for persisted chat:', state.activeChatId);
              // Messages will be loaded by ChatPanelMinimal
            }

            // Mark as hydrated - this is the crucial fix!
            console.log('✅ [chatStore] Setting isHydrated to true');
            useChatStore.setState({ isHydrated: true });
          }
        }
      }
    )
  )
);