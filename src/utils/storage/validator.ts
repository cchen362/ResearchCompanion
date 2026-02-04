/**
 * Storage Validator - Development-time validation of storage usage
 *
 * Phase 4 Refactoring: Storage Architecture
 *
 * This utility validates that storage is being used correctly according to
 * the defined storage boundaries. Only runs in development mode.
 */

import { STORAGE_BOUNDARIES } from '@/config/storage.config';
import { logger } from '@/utils/logger';

/**
 * Validates localStorage usage against allowed keys
 * Only runs in development mode
 */
export function validateLocalStorageUsage(): void {
  if (import.meta.env.PROD) return; // Skip in production

  const allowedKeys = STORAGE_BOUNDARIES.localStorage.allowedKeys;
  const violations: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !allowedKeys.some(allowed => key.startsWith(allowed))) {
      violations.push(key);
    }
  }

  if (violations.length > 0) {
    logger.warn('[StorageValidator] Unauthorized localStorage keys detected:', violations);
    logger.warn('[StorageValidator] Allowed keys:', allowedKeys);
  } else {
    logger.debug('[StorageValidator] localStorage validation passed');
  }
}

/**
 * Validates that IndexedDB is only being used as a cache
 * Checks for entries older than maxTTL
 */
export async function validateIndexedDBUsage(): Promise<void> {
  if (import.meta.env.PROD) return; // Skip in production

  try {
    const { getDB } = await import('@/utils/db/database');
    const db = await getDB();
    const maxTTL = STORAGE_BOUNDARIES.indexedDB.maxTTL;
    const now = Date.now();
    const staleEntries: { store: string; count: number }[] = [];

    for (const storeName of STORAGE_BOUNDARIES.indexedDB.stores) {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const entries = await store.getAll();

        const staleCount = entries.filter(entry => {
          const cachedAt = entry._cachedAt || entry.createdAt || 0;
          return (now - cachedAt) > maxTTL;
        }).length;

        if (staleCount > 0) {
          staleEntries.push({ store: storeName, count: staleCount });
        }
      } catch {
        // Store might not exist, skip
      }
    }

    if (staleEntries.length > 0) {
      logger.warn('[StorageValidator] Stale IndexedDB entries detected (older than 7 days):');
      staleEntries.forEach(({ store, count }) => {
        logger.warn(`  - ${store}: ${count} entries`);
      });
    } else {
      logger.debug('[StorageValidator] IndexedDB validation passed');
    }
  } catch (error) {
    logger.error('[StorageValidator] Error validating IndexedDB:', error);
  }
}

/**
 * Run all storage validations
 * Call this on app initialization in development mode
 */
export async function validateStorageUsage(): Promise<void> {
  if (import.meta.env.PROD) return; // Skip in production

  logger.debug('[StorageValidator] Running storage validation...');

  // Validate localStorage
  validateLocalStorageUsage();

  // Validate IndexedDB (async)
  await validateIndexedDBUsage();

  logger.debug('[StorageValidator] Storage validation complete');
}

/**
 * Storage statistics for debugging
 */
export async function getStorageStats(): Promise<{
  localStorage: { keys: string[]; totalSize: number };
  indexedDB: { stores: { name: string; count: number }[] };
}> {
  const stats = {
    localStorage: {
      keys: [] as string[],
      totalSize: 0
    },
    indexedDB: {
      stores: [] as { name: string; count: number }[]
    }
  };

  // localStorage stats
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      stats.localStorage.keys.push(key);
      stats.localStorage.totalSize += (localStorage.getItem(key) || '').length;
    }
  }

  // IndexedDB stats
  try {
    const { getDB } = await import('@/utils/db/database');
    const db = await getDB();

    for (const storeName of STORAGE_BOUNDARIES.indexedDB.stores) {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const count = await tx.objectStore(storeName).count();
        stats.indexedDB.stores.push({ name: storeName, count });
      } catch {
        // Store might not exist
        stats.indexedDB.stores.push({ name: storeName, count: 0 });
      }
    }
  } catch (error) {
    logger.error('[StorageValidator] Error getting IndexedDB stats:', error);
  }

  return stats;
}
