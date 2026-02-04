/**
 * StorageService - Base class for all consolidated services
 *
 * Phase 1 Refactoring: Service Layer Consolidation
 * Phase 4 Refactoring: Updated to use CacheManager for centralized caching
 *
 * This class provides:
 * - Server-first data access with IndexedDB cache fallback
 * - Unified caching strategy via CacheManager
 * - Consistent error handling pattern
 *
 * Architecture:
 * Component → service.ts (extends StorageService) → Backend (with CacheManager)
 */

import { api } from './api';
import { cacheManager, type CacheOptions } from './cache/CacheManager';
import { getCacheTTL } from '@/config/storage.config';
import { logger } from '@/utils/logger';

export interface StorageServiceOptions {
  /** Store name in IndexedDB for caching */
  storeName: string;
  /** API endpoint (e.g., '/findings', '/agents') */
  apiEndpoint: string;
  /** Cache duration in milliseconds (uses store-specific TTL if not specified) */
  cacheDuration?: number;
}

export class StorageService<T extends { id: string }> {
  protected storeName: string;
  protected apiEndpoint: string;
  protected cacheDuration: number;

  constructor(options: StorageServiceOptions) {
    this.storeName = options.storeName;
    this.apiEndpoint = options.apiEndpoint;
    // Use store-specific TTL from config, or provided value
    this.cacheDuration = options.cacheDuration ?? getCacheTTL(options.storeName);
  }

  /**
   * Get a single item by ID
   * Server-first with cache fallback when offline
   */
  async get(id: string): Promise<T | undefined> {
    try {
      const { data } = await api.get(`${this.apiEndpoint}/${id}`);
      await this.cacheItem(data);
      return data;
    } catch (error) {
      // Fallback to cache if offline
      if (!navigator.onLine) {
        logger.debug(`[${this.storeName}] Offline, using cache for ${id}`);
        return await this.getCached(id);
      }
      throw error;
    }
  }

  /**
   * Get all items with optional query params
   * Server-first with cache fallback when offline
   */
  async getAll(params?: Record<string, any>): Promise<T[]> {
    try {
      const { data } = await api.get(this.apiEndpoint, { params });
      await this.cacheAll(data);
      return data;
    } catch (error) {
      // Fallback to cache if offline
      if (!navigator.onLine) {
        logger.debug(`[${this.storeName}] Offline, using cache`);
        return await this.getAllCached(params);
      }
      throw error;
    }
  }

  /**
   * Create a new item
   */
  async create(item: Partial<T>): Promise<T> {
    const { data } = await api.post(this.apiEndpoint, item);
    await this.cacheItem(data);
    return data;
  }

  /**
   * Update an existing item
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    const { data } = await api.put(`${this.apiEndpoint}/${id}`, updates);
    await this.cacheItem(data);
    return data;
  }

  /**
   * Delete an item
   */
  async delete(id: string): Promise<void> {
    await api.delete(`${this.apiEndpoint}/${id}`);
    await this.removeCached(id);
  }

  // ==================== Cache Helpers (using CacheManager) ====================

  /**
   * Cache a single item using CacheManager
   */
  protected async cacheItem(item: T, options?: CacheOptions): Promise<void> {
    await cacheManager.set(this.storeName, item.id, item, {
      ttl: options?.ttl ?? this.cacheDuration,
      ...options
    });
  }

  /**
   * Get a cached item using CacheManager
   */
  protected async getCached(id: string): Promise<T | undefined> {
    const cached = await cacheManager.get<T>(this.storeName, id);
    return cached ?? undefined;
  }

  /**
   * Cache multiple items using CacheManager
   */
  protected async cacheAll(items: T[], options?: CacheOptions): Promise<void> {
    if (!items || items.length === 0) return;

    await cacheManager.setMany(this.storeName, items, {
      ttl: options?.ttl ?? this.cacheDuration,
      ...options
    });
  }

  /**
   * Get all cached items using CacheManager
   * Filters out expired entries automatically
   */
  protected async getAllCached(params?: Record<string, any>): Promise<T[]> {
    let items = await cacheManager.getAll<T>(this.storeName);

    // Apply basic filtering if params provided
    if (params) {
      items = this.filterCachedItems(items, params);
    }

    return items;
  }

  /**
   * Remove a cached item using CacheManager
   */
  protected async removeCached(id: string): Promise<void> {
    await cacheManager.delete(this.storeName, id);
  }

  /**
   * Clear all cached items for this store
   */
  protected async clearCache(): Promise<void> {
    await cacheManager.clear(this.storeName);
  }

  /**
   * Clear expired entries from cache
   */
  protected async clearExpiredCache(): Promise<number> {
    return await cacheManager.clearExpired(this.storeName);
  }

  /**
   * Check if an item exists in cache
   */
  protected async hasCached(id: string): Promise<boolean> {
    return await cacheManager.has(this.storeName, id);
  }

  /**
   * Filter cached items based on params
   * Override in subclass for custom filtering logic
   */
  protected filterCachedItems(items: T[], params: Record<string, any>): T[] {
    return items.filter(item => {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && (item as any)[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  // ==================== Utility Methods ====================

  /**
   * Check if we're online
   */
  protected isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Get cache statistics for this store
   */
  async getCacheStats() {
    return await cacheManager.getStats(this.storeName);
  }
}
