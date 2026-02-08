/**
 * CacheManager - Centralized TTL-based cache management
 *
 * Phase 4 Refactoring: Storage Architecture
 *
 * This service provides:
 * - TTL-based cache expiration
 * - Automatic cache cleanup
 * - Consistent caching interface for all services
 * - Non-blocking error handling (cache failures don't break app)
 *
 * Architecture:
 * Services → CacheManager → IndexedDB (cache only)
 */

import { getDB } from '@/utils/db/database';
import { getCacheTTL, STORAGE_BOUNDARIES } from '@/config/storage.config';
import { logger } from '@/utils/logger';

/**
 * Cache entry structure stored in IndexedDB
 * Uses 'id' as the key field to match IndexedDB keyPath: 'id'
 */
export interface CacheEntry<T = unknown> {
  id: string;  // Must be 'id' to match IndexedDB keyPath
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds. If not specified, uses store default */
  ttl?: number;
  /** Skip cache and force fresh data */
  skipCache?: boolean;
}

class CacheManagerClass {
  private readonly DEFAULT_TTL = STORAGE_BOUNDARIES.indexedDB.defaultTTL;

  /**
   * Get a cached item by key
   * Returns null if not found or expired
   */
  async get<T>(store: string, key: string): Promise<T | null> {
    try {
      const db = await getDB();
      const entry = await db.get(store as any, key) as CacheEntry<T> | undefined;

      if (!entry) {
        return null;
      }

      // Check if expired
      if (!this.isValid(entry)) {
        // Clean up expired entry
        await this.delete(store, key);
        logger.debug(`[CacheManager] Cache expired for ${store}/${key}`);
        return null;
      }

      logger.debug(`[CacheManager] Cache hit for ${store}/${key}`);
      return entry.data;
    } catch (error) {
      // Cache errors are non-critical
      logger.warn(`[CacheManager] Failed to get ${store}/${key}:`, error);
      return null;
    }
  }

  /**
   * Store an item in cache with TTL
   */
  async set<T>(
    store: string,
    key: string,
    data: T,
    options?: CacheOptions
  ): Promise<void> {
    if (options?.skipCache) {
      return;
    }

    try {
      const db = await getDB();
      const ttl = options?.ttl ?? getCacheTTL(store);

      const entry: CacheEntry<T> = {
        id: key,  // Use 'id' to match IndexedDB keyPath
        data,
        timestamp: Date.now(),
        ttl
      };

      // For stores with in-line keys (keyPath), don't pass key as second argument
      // The key is taken from the object's keyPath property
      await db.put(store as any, entry);
      logger.debug(`[CacheManager] Cached ${store}/${key} (TTL: ${ttl}ms)`);
    } catch (error) {
      // Cache errors are non-critical
      logger.warn(`[CacheManager] Failed to cache ${store}/${key}:`, error);
    }
  }

  /**
   * Store multiple items in cache (batch operation)
   */
  async setMany<T extends { id: string }>(
    store: string,
    items: T[],
    options?: CacheOptions
  ): Promise<void> {
    if (options?.skipCache || !items.length) {
      return;
    }

    try {
      const db = await getDB();
      const tx = db.transaction(store as any, 'readwrite');
      const objStore = tx.objectStore(store as any);
      const ttl = options?.ttl ?? getCacheTTL(store);
      const timestamp = Date.now();

      for (const item of items) {
        const entry: CacheEntry<T> = {
          id: item.id,  // Use 'id' to match IndexedDB keyPath
          data: item,
          timestamp,
          ttl
        };
        await objStore.put(entry);  // Don't pass key - uses in-line keyPath
      }

      await tx.done;
      logger.debug(`[CacheManager] Cached ${items.length} items in ${store}`);
    } catch (error) {
      logger.warn(`[CacheManager] Failed to batch cache in ${store}:`, error);
    }
  }

  /**
   * Delete a cached item
   */
  async delete(store: string, key: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete(store as any, key);
      logger.debug(`[CacheManager] Deleted ${store}/${key}`);
    } catch (error) {
      logger.warn(`[CacheManager] Failed to delete ${store}/${key}:`, error);
    }
  }

  /**
   * Clear all cached items in a store
   */
  async clear(store: string): Promise<void> {
    try {
      const db = await getDB();
      await db.clear(store as any);
      logger.debug(`[CacheManager] Cleared cache for ${store}`);
    } catch (error) {
      logger.warn(`[CacheManager] Failed to clear ${store}:`, error);
    }
  }

  /**
   * Remove all expired entries from a store
   */
  async clearExpired(store: string): Promise<number> {
    try {
      const db = await getDB();
      const tx = db.transaction(store as any, 'readwrite');
      const objStore = tx.objectStore(store as any);
      const allKeys = await objStore.getAllKeys();
      let deletedCount = 0;

      for (const key of allKeys) {
        const entry = await objStore.get(key) as CacheEntry<unknown> | undefined;
        if (entry && !this.isValid(entry)) {
          await objStore.delete(key);
          deletedCount++;
        }
      }

      await tx.done;

      if (deletedCount > 0) {
        logger.debug(`[CacheManager] Cleared ${deletedCount} expired entries from ${store}`);
      }

      return deletedCount;
    } catch (error) {
      logger.warn(`[CacheManager] Failed to clear expired in ${store}:`, error);
      return 0;
    }
  }

  /**
   * Clear expired entries from all cache stores
   */
  async clearAllExpired(): Promise<void> {
    const stores = STORAGE_BOUNDARIES.indexedDB.stores;

    for (const store of stores) {
      await this.clearExpired(store);
    }
  }

  /**
   * Check if a cache entry is still valid
   */
  isValid(entry: CacheEntry<unknown>): boolean {
    if (!entry.timestamp || !entry.ttl) {
      return false;
    }
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get approximate size of cached data in a store (in bytes)
   */
  async getSize(store: string): Promise<number> {
    try {
      const db = await getDB();
      const data = await db.getAll(store as any);
      const json = JSON.stringify(data);
      return new Blob([json]).size;
    } catch (error) {
      logger.warn(`[CacheManager] Failed to get size for ${store}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics for a store
   */
  async getStats(store: string): Promise<{
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    sizeBytes: number;
  }> {
    try {
      const db = await getDB();
      const allEntries = await db.getAll(store as any) as CacheEntry<unknown>[];

      let validCount = 0;
      let expiredCount = 0;

      for (const entry of allEntries) {
        if (this.isValid(entry)) {
          validCount++;
        } else {
          expiredCount++;
        }
      }

      const sizeBytes = await this.getSize(store);

      return {
        totalEntries: allEntries.length,
        validEntries: validCount,
        expiredEntries: expiredCount,
        sizeBytes
      };
    } catch (error) {
      logger.warn(`[CacheManager] Failed to get stats for ${store}:`, error);
      return {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        sizeBytes: 0
      };
    }
  }

  /**
   * Get all valid cached items from a store
   * Filters out expired entries automatically
   */
  async getAll<T>(store: string): Promise<T[]> {
    try {
      const db = await getDB();
      const allEntries = await db.getAll(store as any) as CacheEntry<T>[];

      const validData: T[] = [];
      for (const entry of allEntries) {
        if (this.isValid(entry)) {
          validData.push(entry.data);
        }
      }

      logger.debug(`[CacheManager] Retrieved ${validData.length} valid entries from ${store}`);
      return validData;
    } catch (error) {
      logger.warn(`[CacheManager] Failed to get all from ${store}:`, error);
      return [];
    }
  }

  /**
   * Check if an item exists in cache and is valid
   */
  async has(store: string, key: string): Promise<boolean> {
    const item = await this.get(store, key);
    return item !== null;
  }
}

// Export singleton instance
export const cacheManager = new CacheManagerClass();
