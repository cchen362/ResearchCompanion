import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { DB_VERSION, DB_NAME } from './version';
import DatabaseMigrationHandler from './migration';
import { authService } from '@/services/auth.service';
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

// Updated database schema with userId fields
interface MedCompanionDB extends DBSchema {
  topics: {
    key: string;
    value: Topic & { userId?: string };
    indexes: {
      'by-date': number;
      'by-name': string;
      'by-user': string;
      'by-user-date': [string, number];
    };
  };
  agents: {
    key: string;
    value: Agent & { userId?: string };
    indexes: {
      'by-topic': string;
      'by-type': string;
      'by-next-run': number;
      'by-user': string;
      'by-user-topic': [string, string];
    };
  };
  findings: {
    key: string;
    value: ResearchFinding & { userId?: string };
    indexes: {
      'by-topic': string;
      'by-agent': string;
      'by-date': number;
      'by-relevance': number;
      'by-user': string;
      'by-user-topic': [string, string];
    };
  };
  timeline: {
    key: string;
    value: TimelineEvent & { userId?: string };
    indexes: {
      'by-date': number;
      'by-type': string;
      'by-topic': string;
      'by-user': string;
      'by-user-date': [string, number];
    };
  };
  audio: {
    key: string;
    value: AudioRecording & { userId?: string };
    indexes: {
      'by-date': number;
      'by-event': string;
      'by-user': string;
      'by-user-date': [string, number];
    };
  };
  notifications: {
    key: string;
    value: Notification & { userId?: string };
    indexes: {
      'by-date': number;
      'by-read': number;
      'by-priority': string;
      'by-user': string;
      'by-user-date': [string, number];
    };
  };
  apiUsage: {
    key: string;
    value: ApiUsage & { userId?: string };
    indexes: {
      'by-date': number;
      'by-service': string;
      'by-agent': string;
      'by-user': string;
    };
  };
  preferences: {
    key: string; // 'user-preferences-{userId}'
    value: UserPreferences & { userId?: string };
    indexes: {
      'by-user': string;
    };
  };
  family: {
    key: string;
    value: FamilyMember & { userId?: string };
    indexes: {
      'by-email': string;
      'by-role': string;
      'by-user': string;
    };
  };
  digests: {
    key: string;
    value: SmartDigest & { userId?: string };
    indexes: {
      'by-topic': string;
      'by-date': number;
      'by-timeframe': string;
      'by-user': string;
      'by-user-topic': [string, string];
    };
  };
  chats: {
    key: string;
    value: FindingsChat & { userId?: string };
    indexes: {
      'by-topic': string;
      'by-date': number;
      'by-status': string;
      'by-user': string;
      'by-user-topic': [string, string];
    };
  };
  digestQueue: {
    key: string;
    value: DigestQueueItem & { userId?: string };
    indexes: {
      'by-topic': string;
      'by-status': string;
      'by-priority': number;
      'by-created': number;
      'by-user': string;
      'by-user-topic': [string, string];
    };
  };
}

let dbInstance: IDBPDatabase<MedCompanionDB> | null = null;

// Helper to get current user ID
export function getCurrentUserId(): string {
  const user = authService.getUser();
  if (!user) {
    throw new Error('No authenticated user');
  }
  return user.id;
}

// Initialize the database with version 5 schema
export async function initDB(): Promise<IDBPDatabase<MedCompanionDB>> {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB<MedCompanionDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

        // Handle version 5 upgrade - Add userId to all stores
        if (oldVersion < 5 && newVersion >= 5) {
          // Topics store
          if (db.objectStoreNames.contains('topics')) {
            const topicsStore = db.transaction.objectStore('topics');
            if (!topicsStore.indexNames.contains('by-user')) {
              topicsStore.createIndex('by-user', 'userId');
              topicsStore.createIndex('by-user-date', ['userId', 'updatedAt']);
            }
          }

          // Agents store
          if (db.objectStoreNames.contains('agents')) {
            const agentsStore = db.transaction.objectStore('agents');
            if (!agentsStore.indexNames.contains('by-user')) {
              agentsStore.createIndex('by-user', 'userId');
              agentsStore.createIndex('by-user-topic', ['userId', 'topicId']);
            }
          }

          // Findings store
          if (db.objectStoreNames.contains('findings')) {
            const findingsStore = db.transaction.objectStore('findings');
            if (!findingsStore.indexNames.contains('by-user')) {
              findingsStore.createIndex('by-user', 'userId');
              findingsStore.createIndex('by-user-topic', ['userId', 'topicId']);
            }
          }

          // Timeline store
          if (db.objectStoreNames.contains('timeline')) {
            const timelineStore = db.transaction.objectStore('timeline');
            if (!timelineStore.indexNames.contains('by-user')) {
              timelineStore.createIndex('by-user', 'userId');
              timelineStore.createIndex('by-user-date', ['userId', 'date']);
            }
          }

          // Audio store
          if (db.objectStoreNames.contains('audio')) {
            const audioStore = db.transaction.objectStore('audio');
            if (!audioStore.indexNames.contains('by-user')) {
              audioStore.createIndex('by-user', 'userId');
              audioStore.createIndex('by-user-date', ['userId', 'recordedAt']);
            }
          }

          // Notifications store
          if (db.objectStoreNames.contains('notifications')) {
            const notificationsStore = db.transaction.objectStore('notifications');
            if (!notificationsStore.indexNames.contains('by-user')) {
              notificationsStore.createIndex('by-user', 'userId');
              notificationsStore.createIndex('by-user-date', ['userId', 'createdAt']);
            }
          }

          // API Usage store
          if (db.objectStoreNames.contains('apiUsage')) {
            const apiStore = db.transaction.objectStore('apiUsage');
            if (!apiStore.indexNames.contains('by-user')) {
              apiStore.createIndex('by-user', 'userId');
            }
          }

          // Preferences store
          if (db.objectStoreNames.contains('preferences')) {
            const prefsStore = db.transaction.objectStore('preferences');
            if (!prefsStore.indexNames.contains('by-user')) {
              prefsStore.createIndex('by-user', 'userId');
            }
          }

          // Family store
          if (db.objectStoreNames.contains('family')) {
            const familyStore = db.transaction.objectStore('family');
            if (!familyStore.indexNames.contains('by-user')) {
              familyStore.createIndex('by-user', 'userId');
            }
          }

          // Digests store
          if (db.objectStoreNames.contains('digests')) {
            const digestsStore = db.transaction.objectStore('digests');
            if (!digestsStore.indexNames.contains('by-user')) {
              digestsStore.createIndex('by-user', 'userId');
              digestsStore.createIndex('by-user-topic', ['userId', 'topicId']);
            }
          }

          // Chats store
          if (db.objectStoreNames.contains('chats')) {
            const chatsStore = db.transaction.objectStore('chats');
            if (!chatsStore.indexNames.contains('by-user')) {
              chatsStore.createIndex('by-user', 'userId');
              chatsStore.createIndex('by-user-topic', ['userId', 'topicId']);
            }
          }

          // Digest Queue store
          if (db.objectStoreNames.contains('digestQueue')) {
            const queueStore = db.transaction.objectStore('digestQueue');
            if (!queueStore.indexNames.contains('by-user')) {
              queueStore.createIndex('by-user', 'userId');
              queueStore.createIndex('by-user-topic', ['userId', 'topicId']);
            }
          }
        }

        // Create stores if they don't exist (for fresh installs)
        if (!db.objectStoreNames.contains('topics')) {
          const topicsStore = db.createObjectStore('topics', { keyPath: 'id' });
          topicsStore.createIndex('by-date', 'updatedAt');
          topicsStore.createIndex('by-name', 'name');
          topicsStore.createIndex('by-user', 'userId');
          topicsStore.createIndex('by-user-date', ['userId', 'updatedAt']);
        }

        if (!db.objectStoreNames.contains('agents')) {
          const agentsStore = db.createObjectStore('agents', { keyPath: 'id' });
          agentsStore.createIndex('by-topic', 'topicId');
          agentsStore.createIndex('by-type', 'type');
          agentsStore.createIndex('by-next-run', 'nextScheduledRun');
          agentsStore.createIndex('by-user', 'userId');
          agentsStore.createIndex('by-user-topic', ['userId', 'topicId']);
        }

        if (!db.objectStoreNames.contains('findings')) {
          const findingsStore = db.createObjectStore('findings', { keyPath: 'id' });
          findingsStore.createIndex('by-topic', 'topicId');
          findingsStore.createIndex('by-agent', 'agentId');
          findingsStore.createIndex('by-date', 'timestamp');
          findingsStore.createIndex('by-relevance', 'relevanceScore');
          findingsStore.createIndex('by-user', 'userId');
          findingsStore.createIndex('by-user-topic', ['userId', 'topicId']);
        }

        if (!db.objectStoreNames.contains('timeline')) {
          const timelineStore = db.createObjectStore('timeline', { keyPath: 'id' });
          timelineStore.createIndex('by-date', 'date');
          timelineStore.createIndex('by-type', 'type');
          timelineStore.createIndex('by-topic', 'topicId');
          timelineStore.createIndex('by-user', 'userId');
          timelineStore.createIndex('by-user-date', ['userId', 'date']);
        }

        if (!db.objectStoreNames.contains('audio')) {
          const audioStore = db.createObjectStore('audio', { keyPath: 'id' });
          audioStore.createIndex('by-date', 'recordedAt');
          audioStore.createIndex('by-event', 'linkedEventId');
          audioStore.createIndex('by-user', 'userId');
          audioStore.createIndex('by-user-date', ['userId', 'recordedAt']);
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notificationsStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notificationsStore.createIndex('by-date', 'createdAt');
          notificationsStore.createIndex('by-read', 'readAt');
          notificationsStore.createIndex('by-priority', 'priority');
          notificationsStore.createIndex('by-user', 'userId');
          notificationsStore.createIndex('by-user-date', ['userId', 'createdAt']);
        }

        if (!db.objectStoreNames.contains('apiUsage')) {
          const apiStore = db.createObjectStore('apiUsage', { keyPath: 'id' });
          apiStore.createIndex('by-date', 'timestamp');
          apiStore.createIndex('by-service', 'service');
          apiStore.createIndex('by-agent', 'agentId');
          apiStore.createIndex('by-user', 'userId');
        }

        if (!db.objectStoreNames.contains('preferences')) {
          const prefsStore = db.createObjectStore('preferences', { keyPath: 'id' });
          prefsStore.createIndex('by-user', 'userId');
        }

        if (!db.objectStoreNames.contains('family')) {
          const familyStore = db.createObjectStore('family', { keyPath: 'id' });
          familyStore.createIndex('by-email', 'email', { unique: true });
          familyStore.createIndex('by-role', 'role');
          familyStore.createIndex('by-user', 'userId');
        }

        if (!db.objectStoreNames.contains('digests')) {
          const digestsStore = db.createObjectStore('digests', { keyPath: 'id' });
          digestsStore.createIndex('by-topic', 'topicId');
          digestsStore.createIndex('by-date', 'generatedAt');
          digestsStore.createIndex('by-timeframe', 'timeframe');
          digestsStore.createIndex('by-user', 'userId');
          digestsStore.createIndex('by-user-topic', ['userId', 'topicId']);
        }

        if (!db.objectStoreNames.contains('chats')) {
          const chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
          chatsStore.createIndex('by-topic', 'topicId');
          chatsStore.createIndex('by-date', 'lastMessageAt');
          chatsStore.createIndex('by-status', 'status');
          chatsStore.createIndex('by-user', 'userId');
          chatsStore.createIndex('by-user-topic', ['userId', 'topicId']);
        }

        if (!db.objectStoreNames.contains('digestQueue')) {
          const queueStore = db.createObjectStore('digestQueue', { keyPath: 'id' });
          queueStore.createIndex('by-topic', 'topicId');
          queueStore.createIndex('by-status', 'status');
          queueStore.createIndex('by-priority', 'priority');
          queueStore.createIndex('by-created', 'createdAt');
          queueStore.createIndex('by-user', 'userId');
          queueStore.createIndex('by-user-topic', ['userId', 'topicId']);
        }
      },
    });

    return dbInstance;
  } catch (error: any) {
    console.error('Database initialization error:', error);

    if (error.name === 'VersionError') {
      console.error('IndexedDB version mismatch detected!');
      await DatabaseMigrationHandler.handleVersionMismatch(error);
      return null as any;
    }

    throw error;
  }
}

// Export the database instance getter
export function getDB(): IDBPDatabase<MedCompanionDB> | null {
  return dbInstance;
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  }
  return false;
}

// Migrate existing data to include userId
export async function migrateDataForUser(userId: string): Promise<void> {
  const db = await initDB();

  // Start a transaction for all stores
  const stores = ['topics', 'agents', 'findings', 'timeline', 'audio',
                  'notifications', 'apiUsage', 'preferences', 'family',
                  'digests', 'chats', 'digestQueue'];

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    // Get all records
    const records = await store.getAll();

    // Update each record with userId if it doesn't have one
    for (const record of records) {
      if (!record.userId) {
        record.userId = userId;
        await store.put(record);
      }
    }

    await tx.done;
  }

  console.log('Data migration completed for user:', userId);
}