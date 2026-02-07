# 012 - Chat Architecture Rebuild & Personality Enhancement

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for rebuilding the Chat feature to match the server-first architecture and enhancing the bot personality for caregivers/parents. The current chat has broken persistence (messages lost on close/reopen), dual conflicting services, circular dependency workarounds, and a sterile bot persona.**

Agents MUST follow this guide exactly. NO deviations, NO quick fixes, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **Server SSH**: `ssh chee@100.94.82.35`
- **Project path**: `/home/chee/medical-pwa`
- **Backend container**: `medical-companion`
- **Postgres container**: `medcompanion-postgres`
- **DB credentials**: User `meduser`, Database `medcompanion`

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│ PHASES 1-6: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `cd backend && npm run build` after EACH backend change    │
│ - Run `npm run build` after EACH frontend change                 │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git after each phase                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: FULL BUILD VERIFICATION                                 │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - Fix any errors before proceeding                               │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 8: DEPLOYMENT TO DEBIAN SERVER                             │
│ - Push changes to remote repository                              │
│ - SSH into Debian server                                         │
│ - Pull updated repository                                        │
│ - Rebuild Docker containers                                      │
│ - Verify chat works end-to-end                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 9: PRODUCTION VERIFICATION                                 │
│ - Open chat panel → past messages load from server               │
│ - Send message → AI responds with warm tone + clickable citations│
│ - Close panel → reopen → messages still there                    │
│ - Refresh page → messages still there                            │
│ - Log out → log in → messages still there                        │
│ - Streaming tokens appear in real-time                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: Ready for Implementation
- **Created**: February 7, 2026
- **Priority**: HIGH - Core feature rebuild, completes server-first migration
- **Branch**: Create new branch `feat/chat-rebuild` from `fix/digest-findings-race-condition`
- **Predecessor**: Foundation Refactoring (4 phases complete)

---

## Root Cause Analysis

### Problem 1: Messages Lost on Close/Reopen

The `chatStore.ts` (758 lines) uses Zustand `persist` middleware to serialize its entire state to localStorage, including a `messages: Map<string, ChatMessage[]>`. This Map serialization is fragile:

| Layer | Issue |
|-------|-------|
| **Serialization** | Custom `setItem` at line 693 converts Map to array entries via `JSON.stringify` — loses data if any message contains non-serializable values |
| **Deserialization** | Custom `getItem` at line 669 tries to reconstruct the Map — fails silently if format is unexpected |
| **Race condition** | Component mounts → waits for hydration (polling every 50ms) → loads chats → creates/finds chat → loads messages. Multiple async operations compete |
| **Dynamic imports** | All stores loaded via `import()` in useEffect — no TypeScript type safety, `any` types throughout |

### Problem 2: Dual Service/Model Confusion

| Frontend Service | Backend Route | Backend Model | Status |
|-----------------|---------------|---------------|--------|
| `chat.api.service.ts` | `chats.routes.ts` (`/chats/*`) | `chat.model.ts` | Primary but deprecated stub |
| `chat.service.ts` | Routes that **don't exist** (`/topics/*/chats/*`) | N/A | Never actually works for CRUD |
| N/A | `conversations.routes.ts` (`/conversations/*`) | `conversation.model.ts` | Dead code, no citations |

### Problem 3: Circular Dependency Chain

```
ChatPanel → chatStore → chat.service → chatStore (CIRCULAR!)
```

Fixed by making ChatPanelMinimal use `import()` for everything, but this broke TypeScript checking and introduced race conditions.

### Problem 4: Sterile Bot Persona

Current system prompt (line 421, `chat.routes.ts`):
> "You are a knowledgeable medical research assistant..."
> "Professional and factual without using emojis or decorative symbols"

This is clinical and cold for caregivers navigating complex medical conditions for their loved ones.

---

## Architecture After Rebuild

```
ChatPanel.tsx (STATIC imports, server-first loading)
  ├── chatService (pure API client, NO store imports → NO circular deps)
  │   └── api.ts (axios instance with auth interceptors)
  ├── useChatStore (navigation + streaming state ONLY, NO persist)
  ├── findingsService (for loading citation context)
  ├── ChatMessage.tsx (citation rendering preserved, debug logs cleaned)
  ├── ChatInput.tsx (dead code removed, core behavior preserved)
  └── SuggestedQuestions.tsx (unchanged — genuinely clean)
```

**Storage**: PostgreSQL is the SOLE source of truth. No localStorage for chat data. No IndexedDB caching.

**Dependency Graph** — Zero circular dependencies:
```
chatService → api.ts (no store refs)
chatStore → (no service refs, no api refs)
ChatPanel → chatService + chatStore + findingsService (all safe)
```

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `cd backend && npm run build` after EACH backend file change
- [ ] Run `npm run build` after EACH frontend file change
- [ ] Preserve citation rendering: `find()` by `citationNumber` in ChatMessage.tsx
- [ ] Preserve citation JSONB storage in `chat_messages` table
- [ ] Preserve `extractCitations()` and `createCitationMapping()` in chat.routes.ts
- [ ] Keep emoji removal regex in ChatMessage.tsx (intentional design decision)
- [ ] Test with EXISTING chat data after deployment (must not lose past conversations)

## MUST NOT DO Rules

- [ ] Do NOT add new npm dependencies
- [ ] Do NOT modify the database schema (PostgreSQL tables are correct as-is)
- [ ] Do NOT change `extractCitations()` or `createCitationMapping()` functions
- [ ] Do NOT add IndexedDB caching for chat (keep it simple: server only)
- [ ] Do NOT add offline support for chat (app requires network for all features)
- [ ] Do NOT touch the digest system, agent system, or any non-chat code
- [ ] Do NOT use dynamic `import()` for stores or services in the new ChatPanel

---

## Phase 1: Backend Cleanup — Delete Dead Code & Clean Logging

**Goal**: Remove unused conversation model/routes, clean up console.log pollution, remove duplicate routes.

### Step 1.1: Delete conversation model

**DELETE** file: `backend/src/models/conversation.model.ts` (253 lines)

This file uses separate `conversations` and `messages` tables with no citation support. It is only referenced by `conversations.routes.ts`. Nothing on the frontend calls it.

### Step 1.2: Delete conversation routes

**DELETE** file: `backend/src/routes/conversations.routes.ts` (322 lines)

This file is the only consumer of `ConversationModel`. Frontend never calls `/api/conversations/*` endpoints.

### Step 1.3: Remove conversation route registration from server

**File**: `backend/src/index.ts`

Find and remove the import line:
```typescript
import conversationsRoutes from './routes/conversations.routes.js';
```

Find and remove the registration line:
```typescript
app.use('/api', authenticate, conversationsRoutes);
```

### Step 1.4: Clean up `chats.routes.ts` — Replace console.log + Remove duplicate route

**File**: `backend/src/routes/chats.routes.ts`

**1.4a**: Add logger import at the top of the file:
```typescript
import { logger } from '../utils/logger.js';
```

**1.4b**: Replace ALL `console.log` calls with `logger.info` and ALL `console.error` calls with `logger.error`. There are 21 calls total. Examples:

Replace:
```typescript
console.log('📋 [Backend] GET /chats - Loading chats:', {
```
With:
```typescript
logger.info('[chats.routes] GET /chats - Loading chats:', {
```

Replace:
```typescript
console.error('Error fetching chats:', error);
```
With:
```typescript
logger.error('[chats.routes] Error fetching chats:', error);
```

Remove all emoji prefixes (📋, 📝, ✅, ❌, 📨, 🔍) from log messages.

**1.4c**: Remove the duplicate alternative route (lines 299-329):
```typescript
// DELETE THIS ENTIRE BLOCK:
// Alternative route for topic-based URL structure
// DELETE /api/topics/:topicId/chats/:chatId/messages
router.delete('/topics/:topicId/chats/:chatId/messages', async (req, res) => {
  // ... entire handler
});
```

This route duplicates `DELETE /api/chats/:id/messages` and will never be called after the frontend consolidation.

### Step 1.5: Clean up `chat.model.ts` — Replace console.log + Remove redundant UPDATE

**File**: `backend/src/models/chat.model.ts`

**1.5a**: Add logger import at the top:
```typescript
import { logger } from '../utils/logger.js';
```

**1.5b**: Replace ALL `console.log`/`console.warn` calls with `logger.info`/`logger.warn` (17 calls total). Remove emoji prefixes.

**1.5c**: Check if the database trigger handles `message_count` increment. Look in `backend/src/db/init.sql` for:
```sql
CREATE OR REPLACE FUNCTION update_chat_on_new_message()
```

If the trigger already handles `message_count` increment and `last_message_at` update, remove the redundant manual UPDATE in `addMessage()` (lines 252-258):
```typescript
// REMOVE THIS if trigger handles it:
await query(
  `UPDATE chats
   SET last_message_at = CURRENT_TIMESTAMP,
       message_count = message_count + 1
   WHERE id = $1`,
  [chatId]
);
```

If the trigger does NOT handle message_count, KEEP the manual UPDATE. Verify by checking init.sql first.

### Step 1.6: Clean up `chat.routes.ts` — Replace console.log

**File**: `backend/src/routes/chat.routes.ts`

Add logger import if not already present:
```typescript
import { logger } from '../utils/logger.js';
```

Replace ALL `console.log` calls with `logger.info`/`logger.debug` (~20 calls). Remove emoji prefixes. The persona update happens in Phase 5 — do NOT modify `buildSystemPrompt()` yet.

### Step 1.7: Build verification

```bash
cd backend && npm run build
```

**Expected**: No compilation errors. The backend should compile cleanly without the deleted files.

**Checkpoint**: Commit with message `refactor(chat): delete dead conversation model/routes, clean backend logging`

---

## Phase 2: Frontend Service Consolidation

**Goal**: Create a single `chat.service.ts` that is a pure API client with NO store imports, using `/api/chats/*` endpoints exclusively. Delete the deprecated stub.

### Step 2.1: Rewrite `src/services/chat.service.ts`

**IMPORTANT**: The new service must have ZERO imports from stores. This is what breaks the circular dependency chain.

Delete the entire contents of `src/services/chat.service.ts` and replace with:

```typescript
/**
 * Chat Service — Server-first chat operations
 *
 * Pure API client: NO store imports, NO circular dependencies.
 * All chat data lives in PostgreSQL via /api/chats/* endpoints.
 * Follows the digest.service.ts pattern for transformations.
 */

import { api } from './api';
import { logger } from '@/utils/logger';
import type { FindingsChat, ChatMessage, SourceCitation, ChatContext } from '../types';

// ============================================
// API Response Types
// ============================================

interface ChatsResponse {
  success: boolean;
  chats: any[];
}

interface ChatResponse {
  success: boolean;
  chat: any;
}

interface MessagesResponse {
  success: boolean;
  messages: any[];
}

interface MessageResponse {
  success: boolean;
  message: any;
}

interface AIChatResponse {
  content: string;
  citations: SourceCitation[];
  suggestedQuestions: string[];
  relatedFindings: any[];
  citationMap: Record<string, number>;
  model: string;
  tokens: number;
}

// ============================================
// Stream Callback Types
// ============================================

interface StreamCallbacks {
  onToken: (token: string) => void;
  onCitation: (citation: SourceCitation) => void;
  onMetadata: (metadata: { suggestedQuestions?: string[]; relatedFindings?: any[]; citationMap?: Record<string, number> }) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

// ============================================
// Chat Service
// ============================================

class ChatService {
  private baseUrl = '/chats';

  // ==================== Transformations ====================

  /**
   * Transform backend snake_case chat to frontend camelCase format
   */
  transformToFrontend(apiChat: any): FindingsChat {
    return {
      id: apiChat.id,
      topicId: apiChat.topic_id || apiChat.topicId,
      title: apiChat.title || 'Untitled Chat',
      status: apiChat.status || 'active',
      createdAt: apiChat.created_at || apiChat.createdAt || new Date().toISOString(),
      lastMessageAt: apiChat.last_message_at || apiChat.lastMessageAt || new Date().toISOString(),
      messageCount: apiChat.message_count ?? apiChat.messageCount ?? 0,
      context: apiChat.context || {
        currentFindings: [],
        expandedTopics: [],
        recentInteractions: [],
        userPreferences: {}
      }
    };
  }

  /**
   * Transform backend message to frontend format
   * Citations come pre-parsed from chat.model.ts parseCitations()
   */
  transformMessageToFrontend(apiMsg: any): ChatMessage {
    return {
      id: apiMsg.id,
      role: apiMsg.role,
      content: apiMsg.content,
      timestamp: apiMsg.created_at || apiMsg.timestamp || new Date().toISOString(),
      citations: Array.isArray(apiMsg.citations) ? apiMsg.citations : [],
      metadata: apiMsg.metadata || {},
      suggestedQuestions: apiMsg.suggestedQuestions,
      referencedFindingIds: apiMsg.referencedFindingIds
    };
  }

  // ==================== Chat CRUD ====================

  async getChats(topicId?: string): Promise<FindingsChat[]> {
    try {
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.get<ChatsResponse>(`${this.baseUrl}${params}`);
      if (response.data.success) {
        return response.data.chats.map(c => this.transformToFrontend(c));
      }
      return [];
    } catch (error) {
      logger.error('[chatService] Failed to load chats:', error);
      return [];
    }
  }

  async getChat(chatId: string): Promise<FindingsChat | null> {
    try {
      const response = await api.get<ChatResponse>(`${this.baseUrl}/${chatId}`);
      if (response.data.success) {
        return this.transformToFrontend(response.data.chat);
      }
      return null;
    } catch (error) {
      logger.error('[chatService] Failed to load chat:', error);
      return null;
    }
  }

  async createChat(topicId: string, title?: string): Promise<FindingsChat> {
    const response = await api.post<ChatResponse>(this.baseUrl, {
      topic_id: topicId,
      title: title || 'New Chat',
      context: {}
    });
    if (response.data.success) {
      return this.transformToFrontend(response.data.chat);
    }
    throw new Error('Failed to create chat');
  }

  async updateChat(chatId: string, updates: { title?: string; status?: string; context?: ChatContext }): Promise<FindingsChat> {
    const response = await api.put<ChatResponse>(`${this.baseUrl}/${chatId}`, updates);
    if (response.data.success) {
      return this.transformToFrontend(response.data.chat);
    }
    throw new Error('Failed to update chat');
  }

  async deleteChat(chatId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${chatId}`);
  }

  // ==================== Message CRUD ====================

  async getMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
    try {
      const response = await api.get<MessagesResponse>(
        `${this.baseUrl}/${chatId}/messages?limit=${limit}`
      );
      if (response.data.success) {
        return response.data.messages.map(m => this.transformMessageToFrontend(m));
      }
      return [];
    } catch (error) {
      logger.error('[chatService] Failed to load messages:', error);
      return [];
    }
  }

  async saveMessage(
    chatId: string,
    message: { role: string; content: string; citations?: SourceCitation[]; metadata?: any }
  ): Promise<ChatMessage> {
    const response = await api.post<MessageResponse>(
      `${this.baseUrl}/${chatId}/messages`,
      {
        role: message.role,
        content: message.content,
        citations: message.citations || null,
        metadata: message.metadata || {}
      }
    );
    if (response.data.success) {
      return this.transformMessageToFrontend(response.data.message);
    }
    throw new Error('Failed to save message');
  }

  async clearMessages(chatId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${chatId}/messages`);
  }

  // ==================== AI Streaming ====================

  /**
   * Stream AI response using POST-based SSE.
   * Uses fetch() directly (not axios) because axios doesn't support streaming responses.
   * POST avoids the URI-too-large bug that affected the old GET-based EventSource approach.
   */
  async streamMessage(
    chatId: string,
    topicId: string,
    message: string,
    context: any,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const baseURL = api.defaults.baseURL || '/api';

    const response = await fetch(`${baseURL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, chatId, topicId, context })
    });

    if (!response.ok) {
      callbacks.onError(`HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            switch (parsed.type) {
              case 'token':
                callbacks.onToken(parsed.content);
                break;
              case 'citation':
                callbacks.onCitation(parsed.citation);
                break;
              case 'metadata':
                callbacks.onMetadata(parsed);
                break;
              case 'error':
                callbacks.onError(parsed.message || 'Unknown streaming error');
                break;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==================== Non-Streaming Fallback ====================

  /**
   * Send message without streaming (fallback if streaming fails).
   */
  async sendMessageNonStreaming(
    chatId: string,
    topicId: string,
    message: string,
    context: any
  ): Promise<AIChatResponse> {
    const response = await api.post('/chat/complete', {
      message,
      chatId,
      topicId,
      context,
      stream: false
    });
    return response.data;
  }

  // ==================== Export ====================

  async exportChat(chatId: string, topicName: string): Promise<string> {
    const messages = await this.getMessages(chatId);
    let md = `# Chat: ${topicName}\n`;
    md += `Exported: ${new Date().toLocaleDateString()}\n\n`;

    for (const msg of messages) {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      md += `## ${role}\n${msg.content}\n\n`;

      if (msg.citations && msg.citations.length > 0) {
        md += `**Sources:**\n`;
        for (const c of msg.citations) {
          const source = typeof c.source === 'string' ? c.source : c.source?.name || 'Unknown';
          md += `- [${c.citationNumber}] ${source}: ${c.citationText || ''}\n`;
        }
        md += '\n';
      }
    }

    return md;
  }
}

export const chatService = new ChatService();
```

### Step 2.2: Delete `src/services/chat.api.service.ts`

**DELETE** file: `src/services/chat.api.service.ts` (181 lines)

This deprecated stub is fully replaced by the new `chat.service.ts`.

### Step 2.3: Build verification

```bash
npm run build
```

**Expected**: Build WILL fail because `chatStore.ts` and `ChatPanelMinimal.tsx` still reference the deleted file and the old chatService API. This is expected — they are rewritten in Phase 3 and 4.

**Checkpoint**: Commit with message `refactor(chat): consolidate to single chat.service.ts, delete deprecated stub`

---

## Phase 3: Store Rewrite

**Goal**: Rewrite `chatStore.ts` from 758 lines to ~50 lines. Navigation + streaming state only. NO data storage, NO persist middleware, NO localStorage.

### Step 3.1: Rewrite `src/stores/chatStore.ts`

Delete the entire contents and replace with:

```typescript
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
```

### Step 3.2: Clean up stale localStorage data

**File**: `src/App.tsx` (or `src/AppWithAuth.tsx` — whichever is the root component)

Add a one-time cleanup in a useEffect near the top of the component:

```typescript
// One-time cleanup: remove stale chat localStorage data from old persist middleware
useEffect(() => {
  localStorage.removeItem('chat-store');
}, []);
```

### Step 3.3: Build verification

```bash
npm run build
```

**Expected**: Build WILL still fail because `ChatPanelMinimal.tsx` references the old store interface. This is expected — the component is rebuilt in Phase 4.

**Checkpoint**: Commit with message `refactor(chat): rewrite chatStore to navigation-only, remove persist middleware`

---

## Phase 4: Component Rebuild

**Goal**: Replace `ChatPanelMinimal.tsx` with a clean `ChatPanel.tsx` using static imports, server-first loading, and POST-based streaming.

### Step 4.1: Create new `src/components/ChatPanel.tsx`

Create this new file with the following implementation. Key design points:
- **ALL imports are static** — no dynamic `import()` calls
- **Server-first**: loads chats and messages from PostgreSQL API on mount
- **Cancellation-safe**: useEffect cleanup prevents stale state updates
- **Streaming**: uses `chatService.streamMessage()` with real-time token display
- **Citation flow preserved**: passes `onCitationClick` to ChatMessage, uses `findingsService` to resolve findings

```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MessageSquare, X, Download, Trash2 } from 'lucide-react';
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
}

export function ChatPanel({ topicId, topicName, className = '', onClose }: ChatPanelProps) {
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Start a conversation about {topicName}</p>
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
        className="border-t bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-900"
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
```

### Step 4.2: Update import references

**File**: `src/App.tsx` — Find the import:
```typescript
import { ChatPanel } from './components/ChatPanelMinimal';
```
Replace with:
```typescript
import { ChatPanel } from './components/ChatPanel';
```

Check if `src/AppWithAuth.tsx` also imports ChatPanel and update there too.

### Step 4.3: Clean up `ChatMessage.tsx`

**File**: `src/components/ChatMessage.tsx`

**4.3a**: Remove excessive debug logging. Delete lines 42-47:
```typescript
// DELETE:
logger.debug('[ChatMessage] Rendering message with citations:', {
  citationsArray: message.citations,
  citationCount: message.citations?.length || 0,
  firstCitation: message.citations?.[0]
});
```

Delete lines 63-67 (the per-citation debug log inside the map):
```typescript
// DELETE:
logger.debug(`[ChatMessage] Looking for citation [${num}]:`, {
  searchingFor: citationNum,
  found: !!citation,
  citationObject: citation
});
```

**4.3b**: Fix copy function citation numbering. In `convertToPlainText` (line 184), find:
```typescript
message.citations.forEach((citation, index) => {
  plainText += `[${index + 1}] ${citation.source || 'Source'}: ${citation.citationText || ''}\n`;
});
```

Replace with:
```typescript
message.citations
  .sort((a, b) => (a.citationNumber || 0) - (b.citationNumber || 0))
  .forEach((citation) => {
    const num = citation.citationNumber || '?';
    const source = typeof citation.source === 'string' ? citation.source : citation.source?.name || 'Source';
    plainText += `[${num}] ${source}: ${citation.citationText || ''}\n`;
  });
```

### Step 4.4: Clean up `ChatInput.tsx`

**File**: `src/components/ChatInput.tsx`

Remove dead code that is never executed (props `allowAttachments` and `allowVoice` default to `false`):

**4.4a**: Remove these state variables (keep the rest):
```typescript
// DELETE:
const [attachments, setAttachments] = useState<File[]>([]);
const [isRecording, setIsRecording] = useState(false);
const [recordingTime, setRecordingTime] = useState(0);
const [isDragging, setIsDragging] = useState(false);
```

**4.4b**: Remove these refs:
```typescript
// DELETE:
const fileInputRef = useRef<HTMLInputElement>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
```

**4.4c**: Remove the `handleSend` reference to attachments:
```typescript
// Change from:
if (message.trim() || attachments.length > 0) {
  onSendMessage(message.trim(), attachments);
  setMessage('');
  setAttachments([]);

// To:
if (message.trim()) {
  onSendMessage(message.trim());
  setMessage('');
```

**4.4d**: Remove these entire functions:
- `handleFileSelect` (lines 84-100)
- `removeAttachment` (lines 103-105)
- `handleDragOver`, `handleDragLeave`, `handleDrop` (lines 108-125)
- `startRecording` (lines 128-160)
- `stopRecording` (lines 163-176)
- `formatTime` (lines 179-183)
- `getFileIcon` (lines 186-191)

**4.4e**: Remove these JSX blocks from the render:
- Attachments display section (`{attachments.length > 0 && ...}`)
- Recording indicator section (`{isRecording && ...}`)
- Attachment button (`{allowAttachments && ...}`)
- Voice button (`{allowVoice && ...}`)
- `onDragOver`, `onDragLeave`, `onDrop` props from the input container div

**4.4f**: Remove the help text references to drag/voice:
```typescript
// Change from:
{allowAttachments && ' • Drag and drop files to attach'}
{allowVoice && ' • Click mic to record audio'}

// DELETE both lines
```

**4.4g**: Remove unused imports:
```typescript
// Remove from imports: Paperclip, Mic, MicOff, X, FileText, Image as ImageIcon
// Keep: Send, Loader2, AlertCircle (only if used), Badge (only if used)
```

**4.4h**: Simplify the props interface:
```typescript
// Remove from interface:
// allowAttachments?: boolean;
// allowVoice?: boolean;
// Keep all other props
```

Update the function signature to remove the deleted props.

### Step 4.5: Delete old component

**DELETE** file: `src/components/ChatPanelMinimal.tsx` (658 lines)

### Step 4.6: Verify `findingsService.getFinding()` exists

The new ChatPanel uses `findingsService.getFinding(findingId)` for citation clicks. Verify this method exists in `src/services/findings.service.ts`. If it doesn't exist, add a simple method:

```typescript
async getFinding(findingId: string): Promise<Finding | null> {
  try {
    const response = await api.get(`/findings/${findingId}`);
    if (response.data.success) {
      return this.transformToFrontend(response.data.finding);
    }
    return null;
  } catch (error) {
    logger.error('[findingsService] Failed to load finding:', error);
    return null;
  }
}
```

### Step 4.7: Build verification

```bash
npm run build
```

**Expected**: Clean build with zero errors. All imports resolved, no circular dependencies.

**Checkpoint**: Commit with message `feat(chat): rebuild ChatPanel with server-first loading and streaming`

---

## Phase 5: Bot Personality Enhancement

**Goal**: Update the AI system prompt for a warm, supportive companion persona while maintaining absolute factual integrity.

### Step 5.1: Update `buildSystemPrompt()` in `backend/src/routes/chat.routes.ts`

Find the system prompt string starting at line 421:
```typescript
let prompt = `You are a knowledgeable medical research assistant helping users understand and explore medical research findings.
```

Replace the ENTIRE prompt string (up to the citation instructions) with:

```typescript
let prompt = `You are a caring and knowledgeable medical research companion. You support caregivers, parents, and families who are navigating complex medical conditions by helping them understand research findings in plain, reassuring language.

CORE PRINCIPLE — Facts, Not Scores:
- Every claim you make MUST be grounded in the provided research findings
- Always cite your sources using the assigned citation numbers
- Never invent, embellish, or soften factual information
- If findings are concerning, present them honestly with proper context
- If information is missing or uncertain, say so clearly

Your personality:
- Warm and conversational, like a well-informed friend who genuinely cares
- Acknowledge the emotional weight of medical research when appropriate
- Be honest about uncertainties without being alarmist
- Use inclusive language to create partnership ("Let's look at what the research says...")
- Respect that caregivers often become experts in their conditions

Your communication style:
- Clear and accessible — explain medical terms naturally in context
- Use short paragraphs and breathing room in responses
- Lead with the most relevant information, providing context for difficult findings
- When findings are concerning, pair them with what IS known and constructive next steps
- Ask thoughtful follow-up questions to understand what matters most to the user

What you must NOT do:
- Don't sugarcoat or downplay concerning research findings — honesty builds trust
- Don't be overly cheerful or minimize real concerns
- Don't use emojis or decorative symbols
- Don't provide medical advice — always encourage consulting healthcare professionals
- Don't be condescending about the user's level of medical knowledge
- Don't invent information to fill gaps — be transparent about what the research does and doesn't cover

FORMATTING GUIDELINES:
- Use markdown formatting sparingly and appropriately
- Use ** for important medical terms or key findings
- Use ## for major section headers when organizing complex responses
- Use - for bullet points in lists
- Keep formatting professional and focused on readability

When you have limited information from the findings:
- Be transparent about what information is available vs. what is missing
- Provide specific, actionable suggestions for obtaining more information
- Share what IS known from the findings, even if incomplete
- Suggest specific questions the user could explore or search terms to use

CRITICAL CITATION INSTRUCTIONS:
When referencing research findings, you MUST use the EXACT citation numbers provided below.
Each finding has been assigned a specific citation number that you must use when referencing it.
DO NOT create your own citation numbers or use array positions.

Available research findings with their assigned citation numbers:`;
```

**IMPORTANT**: Do NOT modify anything after `Available research findings with their assigned citation numbers:` — the rest of the function that builds citation context and appends findings must remain exactly as-is.

### Step 5.2: Update suggested questions system prompt

Find the suggestions route handler (search for `'/suggestions'`). Update its system prompt to generate warmer, more empathetic suggested questions. For example:

Replace clinical questions like:
> "List treatment modalities for condition X"

With:
> "What are the most promising treatment options researchers are exploring?"
> "Are there any recent breakthroughs that could help with [condition]?"
> "What questions should I bring to my next doctor's appointment?"

### Step 5.3: Update title generation prompt

Find the title generation route handler (search for `'/generate-title'`). Update to generate warmer titles, e.g., "Understanding treatment options" instead of "Query: Treatment modalities".

### Step 5.4: Build verification

```bash
cd backend && npm run build
```

**Checkpoint**: Commit with message `feat(chat): add warm companion persona, maintain factual integrity`

---

## Phase 6: End-to-End Testing & Documentation

### Step 6.1: Full build

```bash
npm run build && cd backend && npm run build
```

Both must pass with zero errors.

### Step 6.2: Test scenarios

Run through these scenarios on the deployed server:

| # | Scenario | Expected Result | Pass? |
|---|----------|----------------|-------|
| 1 | Open chat panel | Messages load from server (not blank) | [ ] |
| 2 | Send a message | AI responds with warm tone + clickable citation buttons | [ ] |
| 3 | Click a citation | FindingDetailModal opens with correct finding | [ ] |
| 4 | Verify citation is blue pill button | Not plain text `[1]`, must be styled clickable button | [ ] |
| 5 | Close chat panel → reopen | **Previous messages still visible** (loaded from server) | [ ] |
| 6 | Refresh page → open chat | Messages still there (from PostgreSQL) | [ ] |
| 7 | Log out → log back in → open chat | Messages still there (user-scoped PostgreSQL) | [ ] |
| 8 | Clear browsing data → log in → open chat | Messages still there (PostgreSQL is source of truth) | [ ] |
| 9 | Streaming tokens | Tokens appear incrementally, not all at once | [ ] |
| 10 | Switch topics | Chat switches to correct topic's conversation | [ ] |
| 11 | Clear chat | Messages deleted, server returns empty | [ ] |
| 12 | Export chat | Markdown file downloads with citations | [ ] |
| 13 | Bot personality | Response is warm/supportive, not clinical | [ ] |
| 14 | Factual accuracy | Response cites findings accurately, doesn't invent info | [ ] |

### Step 6.3: Update documentation

**File**: `server_storage_fixes.md` — Add entry documenting the chat rebuild

**File**: `IMPLEMENTATION_PLANS/README.md` — Add Plan 012 to the table:
```markdown
| 012 | [Chat Architecture Rebuild](./012_CHAT_ARCHITECTURE_REBUILD.md) | **Ready** | Rebuild chat for server-first architecture + warm companion persona |
```

### Step 6.4: Deploy to production

```bash
# Push to remote
git push origin feat/chat-rebuild

# SSH to server
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull origin feat/chat-rebuild

# Rebuild
docker compose down && docker compose up -d --build

# Verify
docker logs medical-companion --tail 50 2>&1
```

---

## Rollback Plan

If something breaks after deployment:

1. **Frontend won't build**: The old `ChatPanelMinimal.tsx` and `chatStore.ts` are in git history. Revert the component/store changes while keeping backend cleanup.

2. **Messages not loading**: Check backend logs for errors in `chats.routes.ts`. The database schema and data are unchanged — no data loss is possible.

3. **Citations broken**: `ChatMessage.tsx` citation rendering is minimally changed (only debug logs removed). The `find()` by `citationNumber` logic is preserved. Revert ChatMessage.tsx changes if needed.

4. **Streaming not working**: The `sendMessageNonStreaming()` fallback method exists in the new chatService. Switch `handleSendMessage` to use it while debugging streaming.

---

## File Summary

| File | Action | Lines Before → After |
|------|--------|---------------------|
| `backend/src/models/conversation.model.ts` | DELETE | 253 → 0 |
| `backend/src/routes/conversations.routes.ts` | DELETE | 322 → 0 |
| `backend/src/index.ts` | MODIFY | ~150 → ~148 |
| `backend/src/routes/chats.routes.ts` | MODIFY | 331 → ~300 |
| `backend/src/routes/chat.routes.ts` | MODIFY | 802 → ~810 |
| `backend/src/models/chat.model.ts` | MODIFY | 292 → ~275 |
| `src/services/chat.api.service.ts` | DELETE | 181 → 0 |
| `src/services/chat.service.ts` | REWRITE | 507 → ~200 |
| `src/stores/chatStore.ts` | REWRITE | 758 → ~55 |
| `src/components/ChatPanelMinimal.tsx` | DELETE | 658 → 0 |
| `src/components/ChatPanel.tsx` | CREATE | 0 → ~280 |
| `src/components/ChatMessage.tsx` | MODIFY | 384 → ~370 |
| `src/components/ChatInput.tsx` | MODIFY | 358 → ~230 |
| `src/App.tsx` | MODIFY | — |

**Net**: ~2,920 lines removed, ~890 lines added = **~2,030 lines net reduction**

---

## Sign-Off Checklist

| Phase | Task | Completed | Date |
|-------|------|-----------|------|
| 1 | Backend cleanup: delete dead code, clean logging | [ ] | |
| 2 | Frontend service consolidation | [ ] | |
| 3 | Store rewrite: navigation-only, no persist | [ ] | |
| 4 | Component rebuild: static imports, streaming | [ ] | |
| 5 | Bot personality enhancement | [ ] | |
| 6 | End-to-end testing | [ ] | |
| 7 | Full build verification | [ ] | |
| 8 | Production deployment | [ ] | |
| 9 | Production verification (all 14 test scenarios) | [ ] | |

---

*Created: February 7, 2026*
*Plan Author: Claude Code Agent*
*Estimated Effort: 6 phases, significant but clean*
