import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { DB_VERSION, DB_NAME } from './version';
import DatabaseMigrationHandler from './migration';
import { logger } from '@/utils/logger';
import type {
  Topic,
  Agent,
  ResearchFinding,
  Notification,
  UserPreferences,
  SmartDigest,
  FindingsChat,
  DigestQueueItem
} from '@/types';

// Define the database schema
interface MedCompanionDB extends DBSchema {
  topics: {
    key: string;
    value: Topic;
    indexes: {
      'by-date': number;
      'by-name': string;
    };
  };
  agents: {
    key: string;
    value: Agent;
    indexes: {
      'by-topic': string;
      'by-type': string;
      'by-next-run': number;
    };
  };
  findings: {
    key: string;
    value: ResearchFinding;
    indexes: {
      'by-topic': string;
      'by-agent': string;
      'by-date': number;
      'by-relevance': number;
    };
  };
  notifications: {
    key: string;
    value: Notification;
    indexes: {
      'by-date': number;
      'by-read': number;
      'by-priority': string;
    };
  };
  preferences: {
    key: string; // 'user-preferences'
    value: UserPreferences;
  };
  digests: {
    key: string;
    value: SmartDigest;
    indexes: {
      'by-topic': string;
      'by-date': number;
      'by-timeframe': string;
    };
  };
  chats: {
    key: string;
    value: FindingsChat;
    indexes: {
      'by-topic': string;
      'by-date': number;
      'by-status': string;
    };
  };
  digestQueue: {
    key: string;
    value: DigestQueueItem;
    indexes: {
      'by-topic': string;
      'by-status': string;
      'by-priority': number;
      'by-created': number;
    };
  };
}

// DB_NAME and DB_VERSION are now imported from './version' - DO NOT DEFINE HERE

let dbInstance: IDBPDatabase<MedCompanionDB> | null = null;

// Initialize the database
export async function initDB(): Promise<IDBPDatabase<MedCompanionDB>> {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB<MedCompanionDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // Topics store
      if (!db.objectStoreNames.contains('topics')) {
        const topicsStore = db.createObjectStore('topics', { keyPath: 'id' });
        topicsStore.createIndex('by-date', 'updatedAt');
        topicsStore.createIndex('by-name', 'name');
      }

      // Agents store
      if (!db.objectStoreNames.contains('agents')) {
        const agentsStore = db.createObjectStore('agents', { keyPath: 'id' });
        agentsStore.createIndex('by-topic', 'topicId');
        agentsStore.createIndex('by-type', 'type');
        agentsStore.createIndex('by-next-run', 'nextScheduledRun');
      }

      // Findings store
      if (!db.objectStoreNames.contains('findings')) {
        const findingsStore = db.createObjectStore('findings', { keyPath: 'id' });
        findingsStore.createIndex('by-topic', 'topicId');
        findingsStore.createIndex('by-agent', 'agentId');
        findingsStore.createIndex('by-date', 'timestamp');
        findingsStore.createIndex('by-relevance', 'relevanceScore');
      }

      // Migration v8: Delete deprecated timeline store
      if (db.objectStoreNames.contains('timeline')) {
        db.deleteObjectStore('timeline');
        logger.info('Migration v8: Deleted deprecated timeline store');
      }

      // Notifications store
      if (!db.objectStoreNames.contains('notifications')) {
        const notificationsStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notificationsStore.createIndex('by-date', 'createdAt');
        notificationsStore.createIndex('by-read', 'readAt');
        notificationsStore.createIndex('by-priority', 'priority');
      }

      // Preferences store
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
      }

      // Digests store
      if (!db.objectStoreNames.contains('digests')) {
        const digestsStore = db.createObjectStore('digests', { keyPath: 'id' });
        digestsStore.createIndex('by-topic', 'topicId');
        digestsStore.createIndex('by-date', 'generatedAt');
        digestsStore.createIndex('by-timeframe', 'timeframe');
      }

      // Chats store
      if (!db.objectStoreNames.contains('chats')) {
        const chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
        chatsStore.createIndex('by-topic', 'topicId');
        chatsStore.createIndex('by-date', 'lastMessageAt');
        chatsStore.createIndex('by-status', 'status');
      }

      // Digest Queue store (added in version 3)
      if (!db.objectStoreNames.contains('digestQueue')) {
        const queueStore = db.createObjectStore('digestQueue', { keyPath: 'id' });
        queueStore.createIndex('by-topic', 'topicId');
        queueStore.createIndex('by-status', 'status');
        queueStore.createIndex('by-priority', 'priority');
        queueStore.createIndex('by-created', 'createdAt');
      }
    },
  });

    return dbInstance;
  } catch (error: any) {
    logger.error('Database initialization error:', error);

    // Check for version error and handle it automatically
    if (error.name === 'VersionError') {
      logger.error('IndexedDB version mismatch detected!');
      logger.error(`Attempted to open with version ${DB_VERSION}, but database may have different version`);

      // Automatically handle the version mismatch
      await DatabaseMigrationHandler.handleVersionMismatch(error);

      // Note: The handler will reload the page, so code won't continue past here
      return null as any; // TypeScript satisfaction
    }

    throw error;
  }
}

// Get the database instance
export async function getDB(): Promise<IDBPDatabase<MedCompanionDB>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    const isPersisted = await navigator.storage.persist();
    logger.debug(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  }
  return false;
}

// Check storage estimate
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      percentUsed
    };
  }

  return {
    usage: 0,
    quota: 0,
    percentUsed: 0
  };
}

// Clear all data (use with caution)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = ['topics', 'agents', 'findings',
                  'notifications', 'preferences', 'digests', 'chats', 'digestQueue'] as const;

  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
}

// Export all data for backup
export async function exportAllData(): Promise<Record<string, any[]>> {
  const db = await getDB();
  const data: Record<string, any[]> = {};

  const stores = ['topics', 'agents', 'findings',
                  'notifications', 'preferences', 'digests', 'chats', 'digestQueue'] as const;

  for (const store of stores) {
    data[store] = await db.getAll(store);
  }

  return data;
}

// Import data from backup
export async function importData(data: Record<string, any[]>): Promise<void> {
  const db = await getDB();

  for (const [storeName, records] of Object.entries(data)) {
    const tx = db.transaction(storeName as any, 'readwrite');
    const store = tx.objectStore(storeName as any);

    for (const record of records) {
      await store.put(record);
    }

    await tx.done;
  }
}