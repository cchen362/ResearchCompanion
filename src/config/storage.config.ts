/**
 * Storage Configuration
 *
 * Controls whether to use local IndexedDB or server API for data storage.
 * Set USE_SERVER_STORAGE to true to enable PostgreSQL backend storage.
 */

// Environment variable or feature flag to enable server storage
export const USE_SERVER_STORAGE = import.meta.env.VITE_USE_SERVER_STORAGE === 'true' || false;

// API base URL - Use relative path to leverage nginx proxy in production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Storage configuration
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
};

// Helper function to determine which service to use
export function getStorageService<T>(localService: T, apiService: T): T {
  return storageConfig.useServerStorage ? apiService : localService;
}