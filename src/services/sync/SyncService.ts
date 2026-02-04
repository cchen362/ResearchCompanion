/**
 * SyncService - Offline queue and sync management
 *
 * Phase 4 Refactoring: Storage Architecture
 *
 * This service provides:
 * - Queue operations when offline
 * - Persist queue in IndexedDB
 * - Auto-process queue when back online
 * - Retry with exponential backoff
 *
 * Note: Even though the app is server-first, this provides graceful degradation
 * for brief network interruptions.
 */

import { getDB } from '@/utils/db/database';
import { api } from '../api';
import { storageConfig } from '@/config/storage.config';
import { logger } from '@/utils/logger';

/**
 * Types of operations that can be queued
 */
export type SyncOperationType = 'create' | 'update' | 'delete';

/**
 * A sync operation waiting to be processed
 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entity: string;
  endpoint: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Status of the sync service
 */
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

const QUEUE_STORE = 'offline_queue';
const QUEUE_KEY = 'sync_queue';
const MAX_RETRIES = storageConfig.maxRetries;
const RETRY_DELAY = storageConfig.retryDelay;

class SyncServiceClass {
  private queue: SyncOperation[] = [];
  private isSyncing = false;
  private lastSyncAt: number | null = null;
  private lastError: string | null = null;
  private initialized = false;

  /**
   * Initialize the sync service
   * Should be called once on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load any persisted queue
      await this.loadQueue();

      // Set up online/offline listeners
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // Process queue if we're online
      if (navigator.onLine && this.queue.length > 0) {
        await this.processQueue();
      }

      this.initialized = true;
      logger.debug('[SyncService] Initialized with', this.queue.length, 'queued operations');
    } catch (error) {
      logger.error('[SyncService] Failed to initialize:', error);
    }
  }

  /**
   * Queue an operation for sync
   * Will execute immediately if online, queue if offline
   */
  async queueOperation(
    type: SyncOperationType,
    entity: string,
    endpoint: string,
    data: any
  ): Promise<boolean> {
    const operation: SyncOperation = {
      id: crypto.randomUUID(),
      type,
      entity,
      endpoint,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    // If online and not currently syncing, try to execute immediately
    if (navigator.onLine && !this.isSyncing) {
      try {
        await this.executeOperation(operation);
        return true;
      } catch (error) {
        // If immediate execution fails, queue it
        logger.warn('[SyncService] Immediate execution failed, queueing:', error);
      }
    }

    // Add to queue
    this.queue.push(operation);
    await this.persistQueue();

    logger.debug('[SyncService] Queued operation:', type, entity, operation.id);
    return false;
  }

  /**
   * Process all queued operations
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing || this.queue.length === 0 || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;
    logger.debug('[SyncService] Processing queue:', this.queue.length, 'operations');

    try {
      const failedOperations: SyncOperation[] = [];

      while (this.queue.length > 0) {
        const operation = this.queue[0];

        try {
          await this.executeOperation(operation);
          this.queue.shift(); // Remove successful operation
          logger.debug('[SyncService] Operation succeeded:', operation.id);
        } catch (error) {
          operation.retryCount++;
          operation.lastError = error instanceof Error ? error.message : String(error);

          if (operation.retryCount >= MAX_RETRIES) {
            // Max retries reached, move to failed
            this.queue.shift();
            failedOperations.push(operation);
            logger.error('[SyncService] Operation failed after max retries:', operation.id);
          } else if (!navigator.onLine) {
            // Went offline, stop processing
            logger.debug('[SyncService] Went offline, stopping queue processing');
            break;
          } else {
            // Wait before retry with exponential backoff
            const delay = RETRY_DELAY * Math.pow(2, operation.retryCount - 1);
            logger.debug('[SyncService] Retrying operation in', delay, 'ms');
            await this.sleep(delay);
          }
        }
      }

      // Log failed operations (could be sent to error tracking)
      if (failedOperations.length > 0) {
        logger.error('[SyncService] Failed operations:', failedOperations.length);
        this.lastError = `${failedOperations.length} operations failed after retries`;
      } else {
        this.lastError = null;
      }

      this.lastSyncAt = Date.now();
      await this.persistQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { type, endpoint, data } = operation;

    switch (type) {
      case 'create':
        await api.post(endpoint, data);
        break;
      case 'update':
        await api.put(`${endpoint}/${data.id}`, data);
        break;
      case 'delete':
        await api.delete(`${endpoint}/${data.id}`);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Load queue from IndexedDB
   */
  private async loadQueue(): Promise<void> {
    try {
      const db = await getDB();
      const stored = await db.get(QUEUE_STORE as any, QUEUE_KEY);
      if (stored && Array.isArray(stored)) {
        this.queue = stored;
      }
    } catch (error) {
      logger.warn('[SyncService] Failed to load queue:', error);
      this.queue = [];
    }
  }

  /**
   * Persist queue to IndexedDB
   */
  private async persistQueue(): Promise<void> {
    try {
      const db = await getDB();
      await db.put(QUEUE_STORE as any, this.queue, QUEUE_KEY);
    } catch (error) {
      logger.warn('[SyncService] Failed to persist queue:', error);
    }
  }

  /**
   * Handle coming back online
   */
  private async handleOnline(): Promise<void> {
    logger.debug('[SyncService] Back online, processing queue');
    await this.processQueue();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    logger.debug('[SyncService] Went offline');
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Public API ====================

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      queueLength: this.queue.length,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError
    };
  }

  /**
   * Get number of queued operations
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if there are pending operations
   */
  hasPendingOperations(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Clear all queued operations
   * Use with caution - operations will be lost
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
    logger.debug('[SyncService] Queue cleared');
  }

  /**
   * Force process queue now
   */
  async forceSync(): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('Cannot sync while offline');
    }
    await this.processQueue();
  }
}

// Export singleton instance
export const syncService = new SyncServiceClass();
