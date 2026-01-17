import { getDB } from '@/utils/db/database';
import { conversationsAPIService } from './conversations.api.service';
import { storageConfig } from '@/config/storage.config';
import type { FindingsChat, ChatMessage } from '@/types';

class ConversationsService {
  private get isUsingAPI() {
    return storageConfig.useServerStorage;
  }

  async getConversations(topicId?: string, includeArchived = false): Promise<FindingsChat[]> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.getConversations(topicId, includeArchived);
    }

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

    if (!includeArchived) {
      chats = chats.filter(c => c.status !== 'archived');
    }

    // Sort by last message timestamp
    chats.sort((a, b) => {
      const aTime = typeof a.lastMessageAt === 'number' ? a.lastMessageAt : new Date(a.lastMessageAt).getTime();
      const bTime = typeof b.lastMessageAt === 'number' ? b.lastMessageAt : new Date(b.lastMessageAt).getTime();
      return bTime - aTime;
    });

    return chats;
  }

  async getConversation(id: string, withMessages = true): Promise<FindingsChat | undefined> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.getConversation(id, withMessages);
    }

    const db = await getDB();
    const chat = await db.get('chats', id);

    if (chat && withMessages) {
      // Messages are stored in the chat object in local storage
      chat.messages = (chat as any).messages || [];
    }

    return chat;
  }

  async createConversation(chat: Partial<FindingsChat>): Promise<FindingsChat> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.createConversation(chat);
    }

    const db = await getDB();
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newChat: FindingsChat = {
      id: chatId,
      topicId: chat.topicId || '',
      title: chat.title || 'New Conversation',
      messages: [],
      createdAt: now,
      lastMessageAt: now,
      status: 'active',
      context: chat.context || {}
    };

    const tx = db.transaction('chats', 'readwrite');
    await tx.objectStore('chats').add(newChat);
    await tx.done;

    return newChat;
  }

  async updateConversation(id: string, updates: Partial<FindingsChat>): Promise<FindingsChat> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.updateConversation(id, updates);
    }

    const db = await getDB();
    const tx = db.transaction('chats', 'readwrite');
    const store = tx.objectStore('chats');

    const existingChat = await store.get(id);
    if (!existingChat) {
      throw new Error(`Conversation ${id} not found`);
    }

    const updatedChat = { ...existingChat, ...updates };
    await store.put(updatedChat);
    await tx.done;

    return updatedChat;
  }

  async deleteConversation(id: string): Promise<void> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.deleteConversation(id);
    }

    const db = await getDB();
    const tx = db.transaction('chats', 'readwrite');
    await tx.objectStore('chats').delete(id);
    await tx.done;
  }

  async archiveConversation(id: string, archived = true): Promise<FindingsChat> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.archiveConversation(id, archived);
    }

    return await this.updateConversation(id, {
      status: archived ? 'archived' : 'active'
    });
  }

  async getMessages(conversationId: string, limit = 100, offset = 0): Promise<ChatMessage[]> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.getMessages(conversationId, limit, offset);
    }

    const chat = await this.getConversation(conversationId, true);
    if (!chat) {
      return [];
    }

    const messages = chat.messages || [];
    return messages.slice(offset, offset + limit);
  }

  async addMessage(
    conversationId: string,
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: any;
    }
  ): Promise<ChatMessage> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.addMessage(conversationId, message);
    }

    const db = await getDB();
    const tx = db.transaction('chats', 'readwrite');
    const store = tx.objectStore('chats');

    const chat = await store.get(conversationId);
    if (!chat) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newMessage: ChatMessage = {
      id: messageId,
      role: message.role,
      content: message.content,
      timestamp: now,
      metadata: message.metadata || {}
    };

    const messages: ChatMessage[] = (chat as any).messages || [];
    messages.push(newMessage);

    chat.lastMessageAt = now;
    (chat as any).messages = messages;
    (chat as any).messageCount = messages.length;

    await store.put(chat);
    await tx.done;

    return newMessage;
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    if (this.isUsingAPI) {
      return await conversationsAPIService.deleteMessage(conversationId, messageId);
    }

    const db = await getDB();
    const tx = db.transaction('chats', 'readwrite');
    const store = tx.objectStore('chats');

    const chat = await store.get(conversationId);
    if (!chat) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const messages: ChatMessage[] = (chat as any).messages || [];
    (chat as any).messages = messages.filter(m => m.id !== messageId);
    (chat as any).messageCount = (chat as any).messages.length;

    await store.put(chat);
    await tx.done;
  }

  async getStats() {
    if (this.isUsingAPI) {
      return await conversationsAPIService.getStats();
    }

    // Local stats implementation
    const conversations = await this.getConversations(undefined, true);
    let totalMessages = 0;

    const byTopic = conversations.reduce((acc, c) => {
      const topicId = c.topicId;
      const existing = acc.find(item => item.topic_id === topicId);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ topic_id: topicId, count: 1 });
      }

      // Count messages
      totalMessages += (c as any).messageCount || c.messages?.length || 0;

      return acc;
    }, [] as Array<{ topic_id: string; count: number }>);

    return {
      total_conversations: conversations.length,
      total_messages: totalMessages,
      by_topic: byTopic
    };
  }
}

export const conversationsService = new ConversationsService();
