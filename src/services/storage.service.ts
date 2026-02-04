/**
 * StorageService - Base class for all consolidated services
 *
 * Phase 1 Refactoring: Service Layer Consolidation
 *
 * This class provides:
 * - Server-first data access with IndexedDB cache fallback
 * - Unified caching strategy across all services
 * - Consistent error handling pattern
 *
 * Architecture:
 * Component → service.ts (extends StorageService) → Backend (with IndexedDB cache)
 */

import { api } from './api';
import { getDB } from '@/utils/db/database';
import type { IDBPDatabase } from 'idb';

export interface StorageServiceOptions {
  /** Store name in IndexedDB for caching */
  storeName: string;
  /** API endpoint (e.g., '/findings', '/agents') */
  apiEndpoint: string;
  /** Cache duration in milliseconds (default: 5 minutes) */
  cacheDuration?: number;
}

export class StorageService<T extends { id: string }> {
  protected storeName: string;
  protected apiEndpoint: string;
  protected cacheDuration: number;

  constructor(options: StorageServiceOptions) {
    this.storeName = options.storeName;
    this.apiEndpoint = options.apiEndpoint;
    this.cacheDuration = options.cacheDuration ?? 5 * 60 * 1000; // 5 minutes default
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

  // ==================== Cache Helpers ====================

  /**
   * Cache a single item in IndexedDB
   */
  protected async cacheItem(item: T): Promise<void> {
    try {
      const db = await getDB();
      await db.put(this.storeName as any, {
        ...item,
        _cachedAt: Date.now()
      });
    } catch (error) {
      // Cache errors are non-critical, just log
      console.warn(`Failed to cache item in ${this.storeName}:`, error);
    }
  }

  /**
   * Get a cached item from IndexedDB
   */
  protected async getCached(id: string): Promise<T | undefined> {
    try {
      const db = await getDB();
      const item = await db.get(this.storeName as any, id);
      if (item && this.isCacheValid(item)) {
        return item;
      }
      return undefined;
    } catch (error) {
      console.warn(`Failed to get cached item from ${this.storeName}:`, error);
      return undefined;
    }
  }

  /**
   * Cache multiple items in IndexedDB
   */
  protected async cacheAll(items: T[]): Promise<void> {
    if (!items || items.length === 0) return;

    try {
      const db = await getDB();
      const tx = db.transaction(this.storeName as any, 'readwrite');
      const store = tx.objectStore(this.storeName as any);
      const timestamp = Date.now();

      for (const item of items) {
        await store.put({ ...item, _cachedAt: timestamp });
      }

      await tx.done;
    } catch (error) {
      console.warn(`Failed to cache items in ${this.storeName}:`, error);
    }
  }

  /**
   * Get all cached items from IndexedDB
   */
  protected async getAllCached(params?: Record<string, any>): Promise<T[]> {
    try {
      const db = await getDB();
      let items = await db.getAll(this.storeName as any);

      // Filter out stale cache entries
      items = items.filter(item => this.isCacheValid(item));

      // Apply basic filtering if params provided
      if (params) {
        items = this.filterCachedItems(items, params);
      }

      return items;
    } catch (error) {
      console.warn(`Failed to get cached items from ${this.storeName}:`, error);
      return [];
    }
  }

  /**
   * Remove a cached item from IndexedDB
   */
  protected async removeCached(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete(this.storeName as any, id);
    } catch (error) {
      console.warn(`Failed to remove cached item from ${this.storeName}:`, error);
    }
  }

  /**
   * Clear all cached items for this store
   */
  protected async clearCache(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear(this.storeName as any);
    } catch (error) {
      console.warn(`Failed to clear cache for ${this.storeName}:`, error);
    }
  }

  /**
   * Check if a cached item is still valid
   */
  protected isCacheValid(item: any): boolean {
    if (!item._cachedAt) return false;
    return Date.now() - item._cachedAt < this.cacheDuration;
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
   * Get database instance for direct access when needed
   */
  protected async getDB(): Promise<IDBPDatabase<any>> {
    return await getDB();
  }

  /**
   * Check if we're online
   */
  protected isOnline(): boolean {
    return navigator.onLine;
  }
}
