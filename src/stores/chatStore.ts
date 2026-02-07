/**
 * Chat Store — Navigation and streaming state only
 *
 * NO data storage: Messages and chats live on the server (PostgreSQL).
 * NO persist middleware: Nothing saved to localStorage.
 * NO service imports: Breaking the circular dependency chain.
 *
 * This store only tracks:
 * - Which chat is currently active (for navigation)
 * - Streaming state (for real-time token display)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ChatStore {
  // Navigation state
  activeChatId: string | null;
  activeTopicId: string | null;

  // Streaming state
  isStreaming: boolean;
  streamingContent: string;

  // Actions
  setActiveChat: (chatId: string | null, topicId: string | null) => void;
  startStreaming: () => void;
  updateStreamingContent: (content: string) => void;
  endStreaming: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>()(
  devtools(
    (set) => ({
      // Initial state
      activeChatId: null,
      activeTopicId: null,
      isStreaming: false,
      streamingContent: '',

      // Actions
      setActiveChat: (chatId, topicId) =>
        set({ activeChatId: chatId, activeTopicId: topicId }),

      startStreaming: () =>
        set({ isStreaming: true, streamingContent: '' }),

      updateStreamingContent: (content) =>
        set({ streamingContent: content }),

      endStreaming: () =>
        set({ isStreaming: false, streamingContent: '' }),

      reset: () =>
        set({
          activeChatId: null,
          activeTopicId: null,
          isStreaming: false,
          streamingContent: ''
        })
    }),
    { name: 'chat-store' }
  )
);
