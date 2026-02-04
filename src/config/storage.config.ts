/**
 * Storage Configuration
 *
 * Phase 4 Refactoring: Storage Architecture
 *
 * This file defines clear storage boundaries:
 * - PostgreSQL = Source of Truth (all persistent data via API)
 * - IndexedDB = Cache Only (with TTL, cleared on sync)
 * - LocalStorage = UI Preferences Only (via Zustand persist)
 * - Memory = Derived State Only (computed values)
 */

// Environment variable or feature flag to enable server storage
export const USE_SERVER_STORAGE = import.meta.env.VITE_USE_SERVER_STORAGE === 'true' || false;

// API base URL - Use relative path to leverage nginx proxy in production
// Check for Git Bash path conversion (C:/Program Files/Git/api) and fallback to /api
const envApiUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = (envApiUrl && envApiUrl.startsWith('C:'))
  ? '/api'  // Fallback if Git Bash converted the path
  : (envApiUrl || '/api');

// ============================================
// Storage Boundaries Configuration
// ============================================

/**
 * Defines what data goes where - enforced at architectural level
 */
export const STORAGE_BOUNDARIES = {
  /**
   * PostgreSQL (via API) - Source of truth for all persistent data
   */
  postgresql: {
    purpose: 'Source of truth for all persistent data',
    entities: [
      'users',
      'topics',
      'findings',
      'digests',
      'agents',
      'agent_runs',
      'chat_messages',
      'user_preferences'
    ] as const,
    sync: 'immediate' as const,
    retention: 'permanent' as const
  },

  /**
   * IndexedDB - Performance cache only, NOT a data store
   */
  indexedDB: {
    purpose: 'Performance cache only',
    stores: [
      'topics',
      'agents',
      'findings',
      'digests',
      'chats',
      'notifications',
      'offline_queue'
    ] as const,
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    maxTTL: 7 * 24 * 60 * 60 * 1000, // 7 days max
    maxSize: 50 * 1024 * 1024 // 50MB
  },

  /**
   * LocalStorage - UI preferences only (via Zustand persist)
   */
  localStorage: {
    purpose: 'UI preferences only',
    allowedKeys: [
      'research-store',  // selectedTopicId, selectedFindingId only
      'app-store',       // theme, digestTimeframe, explanationMode
      'ui-store',        // viewMode, sortBy, filterBy
      'chat-store',      // navigation state only
      'user-store'       // user preferences
    ] as const,
    maxSize: 5 * 1024 * 1024 // 5MB
  },

  /**
   * Memory - Derived/computed values only
   */
  memory: {
    purpose: 'Computed and derived values only',
    examples: [
      'filtered findings',
      'sorted results',
      'search results',
      'UI calculations',
      'computed aggregations'
    ] as const,
    retention: 'component_lifecycle' as const
  }
} as const;

// Type exports for TypeScript enforcement
export type PostgreSQLEntity = typeof STORAGE_BOUNDARIES.postgresql.entities[number];
export type IndexedDBStore = typeof STORAGE_BOUNDARIES.indexedDB.stores[number];
export type LocalStorageKey = typeof STORAGE_BOUNDARIES.localStorage.allowedKeys[number];

// ============================================
// Runtime Storage Configuration
// ============================================

export const storageConfig = {
  /**
   * When true, data is stored on the server (PostgreSQL) and synced across devices
   * When false, data is stored locally in IndexedDB (browser-only)
   */
  useServerStorage: USE_SERVER_STORAGE,

  /**
   * Whether to cache server data in IndexedDB for offline access
   * Only applicable when useServerStorage is true
   */
  enableOfflineCache: true,

  /**
   * Auto-sync interval in milliseconds (when using server storage)
   * Default: 30 seconds
   */
  syncInterval: 30000,

  /**
   * Maximum number of retry attempts for failed API calls
   */
  maxRetries: 3,

  /**
   * Retry delay in milliseconds
   */
  retryDelay: 1000,

  /**
   * Cache TTL configurations (in milliseconds)
   */
  cacheTTL: {
    default: STORAGE_BOUNDARIES.indexedDB.defaultTTL,
    topics: 24 * 60 * 60 * 1000,    // 24 hours - rarely change
    findings: 1 * 60 * 60 * 1000,   // 1 hour - changes more often
    digests: 4 * 60 * 60 * 1000,    // 4 hours - regenerated periodically
    agents: 24 * 60 * 60 * 1000,    // 24 hours - rarely change
    chats: 30 * 60 * 1000,          // 30 minutes - active data
    notifications: 15 * 60 * 1000   // 15 minutes - frequently updated
  }
};

// Helper function to determine which service to use
export function getStorageService<T>(localService: T, apiService: T): T {
  return storageConfig.useServerStorage ? apiService : localService;
}

/**
 * Get TTL for a specific cache store
 */
export function getCacheTTL(store: string): number {
  const ttl = storageConfig.cacheTTL[store as keyof typeof storageConfig.cacheTTL];
  return ttl ?? storageConfig.cacheTTL.default;
}