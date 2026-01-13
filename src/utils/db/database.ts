import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { DB_VERSION, DB_NAME } from './version';
import type {
  Topic,
  Agent,
  ResearchFinding,
  TimelineEvent,
  AudioRecording,
  Notification,
  ApiUsage,
  UserPreferences,
  FamilyMember,
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
  timeline: {
    key: string;
    value: TimelineEvent;
    indexes: {
      'by-date': number;
      'by-type': string;
      'by-topic': string;
    };
  };
  audio: {
    key: string;
    value: AudioRecording;
    indexes: {
      'by-date': number;
      'by-event': string;
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
  apiUsage: {
    key: string;
    value: ApiUsage;
    indexes: {
      'by-date': number;
      'by-service': string;
      'by-agent': string;
    };
  };
  preferences: {
    key: string; // 'user-preferences'
    value: UserPreferences;
  };
  family: {
    key: string;
    value: FamilyMember;
    indexes: {
      'by-email': string;
      'by-role': string;
    };
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

      // Timeline store
      if (!db.objectStoreNames.contains('timeline')) {
        const timelineStore = db.createObjectStore('timeline', { keyPath: 'id' });
        timelineStore.createIndex('by-date', 'date');
        timelineStore.createIndex('by-type', 'type');
        timelineStore.createIndex('by-topic', 'topicId');
      }

      // Audio store
      if (!db.objectStoreNames.contains('audio')) {
        const audioStore = db.createObjectStore('audio', { keyPath: 'id' });
        audioStore.createIndex('by-date', 'recordedAt');
        audioStore.createIndex('by-event', 'linkedEventId');
      }

      // Notifications store
      if (!db.objectStoreNames.contains('notifications')) {
        const notificationsStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notificationsStore.createIndex('by-date', 'createdAt');
        notificationsStore.createIndex('by-read', 'readAt');
        notificationsStore.createIndex('by-priority', 'priority');
      }

      // API Usage store
      if (!db.objectStoreNames.contains('apiUsage')) {
        const apiStore = db.createObjectStore('apiUsage', { keyPath: 'id' });
        apiStore.createIndex('by-date', 'timestamp');
        apiStore.createIndex('by-service', 'service');
        apiStore.createIndex('by-agent', 'agentId');
      }

      // Preferences store
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'id' });
      }

      // Family store
      if (!db.objectStoreNames.contains('family')) {
        const familyStore = db.createObjectStore('family', { keyPath: 'id' });
        familyStore.createIndex('by-email', 'email', { unique: true });
        familyStore.createIndex('by-role', 'role');
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
    console.error('Database initialization error:', error);

    // Check for version error
    if (error.name === 'VersionError') {
      console.error('IndexedDB version mismatch detected!');
      console.error(`Attempted to open with version ${DB_VERSION}, but database may have different version`);
      console.error('Please clear your browser cache and reload the page.');

      // Show user-friendly error
      const message = 'Database version mismatch detected. Please clear your browser cache:\n\n' +
                     '1. Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to hard refresh\n' +
                     '2. Or go to Settings > Privacy > Clear browsing data\n' +
                     '3. Select "Cached images and files" and clear\n' +
                     '4. Reload the page';

      if (typeof window !== 'undefined' && window.alert) {
        window.alert(message);
      }
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
    console.log(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
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
  const stores = ['topics', 'agents', 'findings', 'timeline', 'audio',
                  'notifications', 'apiUsage', 'preferences', 'family', 'digests', 'chats', 'digestQueue'] as const;

  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
}

// Export all data for backup
export async function exportAllData(): Promise<Record<string, any[]>> {
  const db = await getDB();
  const data: Record<string, any[]> = {};

  const stores = ['topics', 'agents', 'findings', 'timeline', 'audio',
                  'notifications', 'apiUsage', 'preferences', 'family', 'digests', 'chats', 'digestQueue'] as const;

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