/**
 * NotificationService - Notification management via service layer
 *
 * Phase 4 Refactoring: Storage Architecture
 *
 * This service replaces direct database access in NotificationCenter.tsx
 * and provides a clean API for notification operations.
 */

import { cacheManager } from './cache/CacheManager';
import { logger } from '@/utils/logger';
import type { Notification } from '@/types';

const STORE_NAME = 'notifications';

class NotificationServiceClass {
  /**
   * Get recent notifications
   */
  async getNotifications(limit: number = 10): Promise<Notification[]> {
    try {
      const allNotifications = await cacheManager.getAll<Notification>(STORE_NAME);

      // Sort by createdAt (most recent first)
      allNotifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Return limited set
      return allNotifications.slice(0, limit);
    } catch (error) {
      logger.error('[NotificationService] Error loading notifications:', error);
      return [];
    }
  }

  /**
   * Get a single notification by ID
   */
  async getNotification(id: string): Promise<Notification | null> {
    try {
      return await cacheManager.get<Notification>(STORE_NAME, id);
    } catch (error) {
      logger.error('[NotificationService] Error getting notification:', error);
      return null;
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };

    try {
      await cacheManager.set(STORE_NAME, newNotification.id, newNotification);

      // Dispatch event for components to react
      window.dispatchEvent(new CustomEvent('notification-created', {
        detail: newNotification
      }));

      logger.debug('[NotificationService] Created notification:', newNotification.id);
      return newNotification;
    } catch (error) {
      logger.error('[NotificationService] Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<void> {
    try {
      const notification = await cacheManager.get<Notification>(STORE_NAME, id);
      if (notification && !notification.readAt) {
        notification.readAt = Date.now();
        await cacheManager.set(STORE_NAME, id, notification);
        logger.debug('[NotificationService] Marked as read:', id);
      }
    } catch (error) {
      logger.error('[NotificationService] Error marking as read:', error);
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markAllAsRead(notifications: Notification[]): Promise<void> {
    try {
      const now = Date.now();
      for (const notification of notifications) {
        if (!notification.readAt) {
          notification.readAt = now;
          await cacheManager.set(STORE_NAME, notification.id, notification);
        }
      }
      logger.debug('[NotificationService] Marked all as read:', notifications.length);
    } catch (error) {
      logger.error('[NotificationService] Error marking all as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<void> {
    try {
      await cacheManager.delete(STORE_NAME, id);
      logger.debug('[NotificationService] Deleted notification:', id);
    } catch (error) {
      logger.error('[NotificationService] Error deleting notification:', error);
    }
  }

  /**
   * Delete old notifications (older than specified days)
   */
  async deleteOld(daysOld: number = 7): Promise<number> {
    try {
      const allNotifications = await cacheManager.getAll<Notification>(STORE_NAME);
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const notification of allNotifications) {
        if (notification.createdAt < cutoffTime) {
          await cacheManager.delete(STORE_NAME, notification.id);
          deletedCount++;
        }
      }

      logger.debug('[NotificationService] Deleted old notifications:', deletedCount);
      return deletedCount;
    } catch (error) {
      logger.error('[NotificationService] Error deleting old notifications:', error);
      return 0;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getNotifications(100);
      return notifications.filter(n => !n.readAt).length;
    } catch (error) {
      logger.error('[NotificationService] Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Get notification statistics
   * Note: Orphan detection is deprecated - returns 0 for orphaned
   */
  async getStats(): Promise<{ total: number; unread: number; orphaned: number }> {
    try {
      const notifications = await cacheManager.getAll<Notification>(STORE_NAME);
      const unread = notifications.filter(n => !n.readAt).length;

      return {
        total: notifications.length,
        unread,
        orphaned: 0 // Deprecated - orphan cleanup is no longer a feature
      };
    } catch (error) {
      logger.error('[NotificationService] Error getting stats:', error);
      return { total: 0, unread: 0, orphaned: 0 };
    }
  }

  /**
   * Cleanup orphaned notifications
   * @deprecated This feature is deprecated and returns 0
   */
  async cleanupOrphaned(): Promise<{ removed: number; kept: number }> {
    logger.warn('[NotificationService] cleanupOrphaned is deprecated');
    return { removed: 0, kept: 0 };
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    try {
      await cacheManager.clear(STORE_NAME);
      logger.debug('[NotificationService] Cleared all notifications');
    } catch (error) {
      logger.error('[NotificationService] Error clearing notifications:', error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationServiceClass();
