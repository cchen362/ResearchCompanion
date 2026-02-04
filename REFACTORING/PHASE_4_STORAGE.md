# Phase 4: Storage Architecture

**Duration**: Week 4 (February 25 - March 3, 2026)
**Goal**: Define clear storage boundaries, implement sync strategy, remove all ambiguity

---

## The Problem

Currently, data lives in **4 different places** with no clear rules:

1. **PostgreSQL** - Supposed to be primary storage
2. **IndexedDB** - Sometimes cache, sometimes primary
3. **LocalStorage** - Via Zustand persist, unclear what belongs
4. **Memory** - Component state, duplicating stored data

This causes:
- **Data inconsistency** - Different values in different stores
- **Sync conflicts** - No clear source of truth
- **Performance issues** - Redundant storage operations
- **Offline confusion** - What works offline vs online?

---

## The Solution

**Clear, enforced storage boundaries**:

```
PostgreSQL = Source of Truth (all persistent data)
IndexedDB = Cache Only (with TTL, cleared on sync)
LocalStorage = UI Preferences Only (theme, layout)
Memory = Derived State Only (computed values)
```

---

## Step-by-Step Implementation

### Day 1: Define Storage Strategy

#### 1. Create Storage Configuration

**File**: `src/config/storage.config.ts`

```typescript
export const STORAGE_CONFIG = {
  // What goes where
  postgresql: {
    purpose: 'Source of truth for all persistent data',
    stores: [
      'users',
      'topics',
      'findings',
      'digests',
      'agents',
      'agent_runs',
      'chat_messages',
      'user_preferences'
    ],
    sync: 'immediate', // Write immediately to server
    retention: 'permanent'
  },

  indexedDB: {
    purpose: 'Performance cache only',
    stores: [
      'findings_cache',
      'digests_cache',
      'topics_cache',
      'offline_queue'
    ],
    sync: 'on_change', // Sync when data changes
    retention: '24_hours', // Cache TTL
    maxSize: '50MB'
  },

  localStorage: {
    purpose: 'UI state and non-sensitive preferences',
    keys: [
      'theme',
      'viewMode',
      'sortBy',
      'filterBy',
      'sidebarCollapsed',
      'selectedTopicId' // Navigation state only
    ],
    maxSize: '5MB',
    retention: 'permanent'
  },

  memory: {
    purpose: 'Computed and derived values only',
    examples: [
      'filtered findings',
      'sorted results',
      'search results',
      'UI calculations'
    ],
    retention: 'component_lifecycle'
  }
} as const;

// Enforce at TypeScript level
export type PostgreSQLStore = typeof STORAGE_CONFIG.postgresql.stores[number];
export type IndexedDBStore = typeof STORAGE_CONFIG.indexedDB.stores[number];
export type LocalStorageKey = typeof STORAGE_CONFIG.localStorage.keys[number];
```

#### 2. Create Cache Manager

**File**: `src/services/cache/CacheManager.ts`

```typescript
import { getDB } from '@/utils/db/database';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async get<T>(store: string, key: string): Promise<T | null> {
    const db = await getDB();
    const entry = await db.get(store, key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      await this.delete(store, key);
      return null;
    }

    return entry.data;
  }

  async set<T>(
    store: string,
    key: string,
    data: T,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    const db = await getDB();
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    await db.put(store, entry, key);
  }

  async delete(store: string, key: string): Promise<void> {
    const db = await getDB();
    await db.delete(store, key);
  }

  async clear(store: string): Promise<void> {
    const db = await getDB();
    await db.clear(store);
  }

  async clearExpired(store: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(store, 'readwrite');
    const allKeys = await tx.store.getAllKeys();

    for (const key of allKeys) {
      const entry = await tx.store.get(key) as CacheEntry<any>;
      if (entry && Date.now() - entry.timestamp > entry.ttl) {
        await tx.store.delete(key);
      }
    }

    await tx.done;
  }

  async getSize(store: string): Promise<number> {
    const db = await getDB();
    const data = await db.getAll(store);
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  }
}

export const cacheManager = new CacheManager();
```

### Day 2: Implement Sync Strategy

#### 3. Create Sync Service

**File**: `src/services/sync/SyncService.ts`

```typescript
import { apiClient } from '../api.client';
import { cacheManager } from '../cache/CacheManager';
import { getDB } from '@/utils/db/database';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: number;
}

export class SyncService {
  private syncQueue: SyncOperation[] = [];
  private isSyncing = false;

  // Sync from server to local cache
  async syncFromServer(entity: string): Promise<void> {
    try {
      const { data } = await apiClient.get(`/${entity}`);

      // Update cache
      await cacheManager.clear(`${entity}_cache`);
      for (const item of data) {
        await cacheManager.set(`${entity}_cache`, item.id, item);
      }

      console.log(`Synced ${data.length} ${entity} from server`);
    } catch (error) {
      console.error(`Failed to sync ${entity}:`, error);
      throw error;
    }
  }

  // Queue operations for offline sync
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp'>): Promise<void> {
    const op: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    this.syncQueue.push(op);

    // If online, sync immediately
    if (navigator.onLine && !this.isSyncing) {
      await this.processQueue();
    } else {
      // Store in IndexedDB for offline
      await this.persistQueue();
    }
  }

  // Process queued operations
  async processQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;

    try {
      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue[0];

        try {
          await this.executeOperation(operation);
          this.syncQueue.shift(); // Remove successful operation
        } catch (error) {
          console.error('Sync operation failed:', operation, error);

          // If it's a network error, stop trying
          if (!navigator.onLine) {
            break;
          }

          // Otherwise, skip this operation
          this.syncQueue.shift();
        }
      }

      await this.persistQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { type, entity, data } = operation;

    switch (type) {
      case 'create':
        await apiClient.post(`/${entity}`, data);
        break;
      case 'update':
        await apiClient.put(`/${entity}/${data.id}`, data);
        break;
      case 'delete':
        await apiClient.delete(`/${entity}/${data.id}`);
        break;
    }
  }

  private async persistQueue(): Promise<void> {
    const db = await getDB();
    await db.put('offline_queue', this.syncQueue, 'sync_queue');
  }

  async loadQueue(): Promise<void> {
    const db = await getDB();
    const queue = await db.get('offline_queue', 'sync_queue');
    if (queue) {
      this.syncQueue = queue;
    }
  }

  // Initialize sync on app start
  async initialize(): Promise<void> {
    await this.loadQueue();

    // Process queue if online
    if (navigator.onLine) {
      await this.processQueue();
    }

    // Listen for online/offline events
    window.addEventListener('online', () => this.processQueue());
  }
}

export const syncService = new SyncService();
```

### Day 3: Update Service Layer

#### 4. Update Storage Service Pattern

**File**: `src/services/storage.service.ts` (Updated)

```typescript
import { apiClient } from './api.client';
import { cacheManager } from './cache/CacheManager';
import { syncService } from './sync/SyncService';

export class StorageService {
  constructor(
    private entity: string,
    private cacheStore: string
  ) {}

  async get(id: string): Promise<any> {
    // Try cache first for performance
    const cached = await cacheManager.get(this.cacheStore, id);
    if (cached) {
      console.log(`Cache hit: ${this.entity}/${id}`);
      return cached;
    }

    // Fetch from server
    try {
      const { data } = await apiClient.get(`/${this.entity}/${id}`);

      // Update cache
      await cacheManager.set(this.cacheStore, id, data);

      return data;
    } catch (error) {
      // If offline, return null (no stale data)
      if (!navigator.onLine) {
        console.warn(`Offline: Cannot fetch ${this.entity}/${id}`);
        return null;
      }
      throw error;
    }
  }

  async getAll(filter?: any): Promise<any[]> {
    try {
      // Always try server first for list operations
      const { data } = await apiClient.get(`/${this.entity}`, {
        params: filter
      });

      // Update cache
      await cacheManager.clear(this.cacheStore);
      for (const item of data) {
        await cacheManager.set(this.cacheStore, item.id, item);
      }

      return data;
    } catch (error) {
      // If offline, return cached data
      if (!navigator.onLine) {
        console.warn(`Offline: Using cached ${this.entity}`);
        const db = await getDB();
        const cached = await db.getAll(this.cacheStore);
        return cached.map(entry => entry.data);
      }
      throw error;
    }
  }

  async create(item: any): Promise<any> {
    if (!navigator.onLine) {
      // Queue for later sync
      await syncService.queueOperation({
        type: 'create',
        entity: this.entity,
        data: item
      });

      // Optimistically add to cache with temp ID
      const tempId = `temp_${crypto.randomUUID()}`;
      const tempItem = { ...item, id: tempId };
      await cacheManager.set(this.cacheStore, tempId, tempItem);

      return tempItem;
    }

    // Online: create immediately
    const { data } = await apiClient.post(`/${this.entity}`, item);
    await cacheManager.set(this.cacheStore, data.id, data);
    return data;
  }

  async update(id: string, updates: any): Promise<any> {
    if (!navigator.onLine) {
      // Queue for later sync
      await syncService.queueOperation({
        type: 'update',
        entity: this.entity,
        data: { id, ...updates }
      });

      // Optimistically update cache
      const existing = await cacheManager.get(this.cacheStore, id);
      if (existing) {
        const updated = { ...existing, ...updates };
        await cacheManager.set(this.cacheStore, id, updated);
        return updated;
      }

      throw new Error('Cannot update non-existent item offline');
    }

    // Online: update immediately
    const { data } = await apiClient.put(`/${this.entity}/${id}`, updates);
    await cacheManager.set(this.cacheStore, data.id, data);
    return data;
  }

  async delete(id: string): Promise<void> {
    if (!navigator.onLine) {
      // Queue for later sync
      await syncService.queueOperation({
        type: 'delete',
        entity: this.entity,
        data: { id }
      });

      // Optimistically remove from cache
      await cacheManager.delete(this.cacheStore, id);
      return;
    }

    // Online: delete immediately
    await apiClient.delete(`/${this.entity}/${id}`);
    await cacheManager.delete(this.cacheStore, id);
  }
}
```

### Day 4: Update Zustand Stores

#### 5. Remove LocalStorage Persistence from Data Stores

**File**: `src/stores/researchStore.ts` (Updated)

```typescript
import { create } from 'zustand';
// Remove persist middleware for data stores!

export const useResearchStore = create<ResearchStore>((set, get) => ({
  // State (no persistence, fetch from server)
  findings: new Map(),
  topics: [],
  digests: new Map(),
  agents: new Map(),
  selectedTopicId: null,
  selectedFindingId: null,

  // Actions remain the same
  loadTopics: async () => {
    const topics = await topicsService.getTopics();
    set({ topics });
  },
  // ... rest of actions
}));

// Separate navigation state that CAN persist
export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      selectedTopicId: null,
      selectedFindingId: null,

      selectTopic: (id) => set({ selectedTopicId: id }),
      selectFinding: (id) => set({ selectedFindingId: id })
    }),
    {
      name: 'navigation-store',
      partialize: (state) => ({
        selectedTopicId: state.selectedTopicId
        // Don't persist selectedFindingId
      })
    }
  )
);
```

#### 6. Update App Store

**File**: `src/stores/appStore.ts` (Updated)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Only UI preferences persist to localStorage
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // These persist
      theme: 'system',
      viewMode: 'grid',
      sortBy: 'date',
      filterBy: 'all',
      sidebarCollapsed: false,
      autoGenerateDigest: true,

      // These DON'T persist (fetch from server)
      user: null,
      isAuthenticated: false,

      // Actions
      setTheme: (theme) => set({ theme }),
      setViewMode: (mode) => set({ viewMode: mode }),
      // ... other actions
    }),
    {
      name: 'app-preferences',
      partialize: (state) => ({
        // Only persist UI preferences
        theme: state.theme,
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        filterBy: state.filterBy,
        sidebarCollapsed: state.sidebarCollapsed,
        autoGenerateDigest: state.autoGenerateDigest
      })
    }
  )
);
```

### Day 5: Clean Up & Enforce

#### 7. Create Storage Validator

**File**: `src/utils/storage/validator.ts`

```typescript
import { STORAGE_CONFIG } from '@/config/storage.config';

// Validate at build time
export function validateStorageUsage(): void {
  // This would be run in a test or build script

  // Check localStorage usage
  const localStorageKeys = Object.keys(localStorage);
  const allowedKeys = STORAGE_CONFIG.localStorage.keys;

  const invalidKeys = localStorageKeys.filter(
    key => !allowedKeys.includes(key as any) &&
           !key.startsWith('app-preferences') // Zustand keys
  );

  if (invalidKeys.length > 0) {
    console.error('Invalid localStorage keys:', invalidKeys);
    throw new Error('LocalStorage contains unauthorized keys');
  }

  // Check IndexedDB usage
  validateIndexedDBUsage();
}

async function validateIndexedDBUsage(): Promise<void> {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);

  const allowedStores = [
    ...STORAGE_CONFIG.indexedDB.stores,
    'offline_queue' // System store
  ];

  const invalidStores = storeNames.filter(
    name => !allowedStores.includes(name as any)
  );

  if (invalidStores.length > 0) {
    console.error('Invalid IndexedDB stores:', invalidStores);
    throw new Error('IndexedDB contains unauthorized stores');
  }
}
```

#### 8. Remove Direct Database Access

Update all components to remove direct database access:

**Before**:
```typescript
// In component
import { getDB } from '@/utils/db/database';

const db = await getDB();
const findings = await db.getAll('findings');
```

**After**:
```typescript
// In component
import { findingsService } from '@/services/findings.service';

const findings = await findingsService.getFindings();
```

#### 9. Clean Up Database Utils

**Delete these files**:
```
src/utils/db/
  ├── findings.ts (redundant)
  ├── topics.ts (redundant)
  ├── agents.ts (redundant)
  ├── digests.ts (redundant)
  ├── cleanup.ts (unused)
  ├── migration.ts (unused)
  └── databaseV5.ts (unused)
```

**Keep only**:
```
src/utils/db/
  └── database.ts (IndexedDB initialization only)
```

---

## Transaction Boundaries

### Implement Proper Transactions

**File**: `src/services/transactions/TransactionManager.ts`

```typescript
export class TransactionManager {
  async executeTransaction<T>(
    operations: (() => Promise<any>)[]
  ): Promise<T> {
    const results: any[] = [];
    const rollbacks: (() => Promise<void>)[] = [];

    try {
      for (const operation of operations) {
        const result = await operation();
        results.push(result);

        // Store rollback function
        rollbacks.push(async () => {
          // Implement rollback logic
        });
      }

      return results as T;
    } catch (error) {
      // Rollback in reverse order
      for (const rollback of rollbacks.reverse()) {
        try {
          await rollback();
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      throw error;
    }
  }
}
```

---

## Remove Console.log Statements

### Create Logger Service

**File**: `src/services/logger.service.ts`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class LoggerService {
  private isDevelopment = process.env.NODE_ENV === 'development';

  debug(...args: any[]): void {
    if (this.isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    console.log('[INFO]', ...args);
  }

  warn(...args: any[]): void {
    console.warn('[WARN]', ...args);
  }

  error(...args: any[]): void {
    console.error('[ERROR]', ...args);
    // Could send to error tracking service
  }
}

export const logger = new LoggerService();
```

Replace all `console.log` with `logger.debug` throughout the codebase.

---

## Testing Checklist

After Phase 4, verify:

### Storage Boundaries
- [ ] PostgreSQL is source of truth
- [ ] IndexedDB only has cache stores
- [ ] LocalStorage only has UI preferences
- [ ] No direct database access in components

### Sync Behavior
- [ ] Online operations work correctly
- [ ] Offline operations queue properly
- [ ] Sync happens on reconnection
- [ ] Cache expires after 24 hours

### Performance
- [ ] Cache hits improve performance
- [ ] No redundant storage operations
- [ ] Sync doesn't block UI

### Data Consistency
- [ ] Same data across all views
- [ ] No stale data displayed
- [ ] Proper error handling

---

## Success Criteria

Phase 4 is complete when:

1. ✅ Clear storage boundaries enforced
2. ✅ Sync strategy implemented
3. ✅ Cache manager working with TTL
4. ✅ No direct database access in components
5. ✅ Transaction support added
6. ✅ All console.log replaced with logger
7. ✅ Storage validator implemented

---

## Final Cleanup

### Delete These Files
```
src/utils/db/findings.ts
src/utils/db/topics.ts
src/utils/db/agents.ts
src/utils/db/digests.ts
src/utils/db/cleanup.ts
src/utils/db/migration.ts
src/utils/db/databaseV5.ts
```

### Keep These Files
```
src/utils/db/database.ts (IndexedDB init only)
src/config/storage.config.ts
src/services/cache/CacheManager.ts
src/services/sync/SyncService.ts
src/services/logger.service.ts
```

---

## Deployment Considerations

After Phase 4:

1. **Clear all browser storage** on deployment
2. **Run migration** to sync existing data
3. **Monitor** for sync issues
4. **Document** storage architecture for team

---

**Remember**: Clear boundaries prevent confusion. Every piece of data should have exactly ONE place it belongs.