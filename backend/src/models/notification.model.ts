/**
 * Notification Model
 * Handles database operations for user notifications
 */

import { pool } from '../config/database.config.js';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationData {
  userId: string;
  type: 'agent_complete' | 'digest_ready' | 'error' | 'info';
  title: string;
  message?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: any;
}

export interface Notification extends NotificationData {
  id: string;
  readAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
}

export class NotificationModel {
  /**
   * Create a new notification
   */
  static async create(notificationData: NotificationData): Promise<Notification> {
    const id = uuidv4();
    const query = `
      INSERT INTO notifications (id, user_id, type, title, message, priority, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id,
      notificationData.userId,
      notificationData.type,
      notificationData.title,
      notificationData.message || null,
      notificationData.priority || 'normal',
      JSON.stringify(notificationData.data || {})
    ];

    try {
      const result = await pool.query(query, values);
      return this.mapRowToNotification(result.rows[0]);
    } catch (error) {
      console.error('[NotificationModel] Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get recent notifications for a user
   */
  static async getRecent(userId: string, limit: number = 10): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [userId, limit]);
      return result.rows.map((row: any) => this.mapRowToNotification(row));
    } catch (error) {
      console.error('[NotificationModel] Error getting recent notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notifications for a user
   */
  static async getUnread(userId: string): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1 AND read_at IS NULL
      ORDER BY created_at DESC
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows.map((row: any) => this.mapRowToNotification(row));
    } catch (error) {
      console.error('[NotificationModel] Error getting unread notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  static async getById(id: string, userId: string): Promise<Notification | null> {
    const query = `
      SELECT * FROM notifications
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await pool.query(query, [id, userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToNotification(result.rows[0]);
    } catch (error) {
      console.error('[NotificationModel] Error getting notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [id, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('[NotificationModel] Error marking as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND read_at IS NULL
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rowCount || 0;
    } catch (error) {
      console.error('[NotificationModel] Error marking all as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss a notification
   */
  static async dismiss(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE notifications
      SET dismissed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
      RETURNING id
    `;

    try {
      const result = await pool.query(query, [id, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('[NotificationModel] Error dismissing notification:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications (cleanup job)
   */
  static async deleteOld(daysToKeep: number = 30): Promise<number> {
    const query = `
      DELETE FROM notifications
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
    `;

    try {
      const result = await pool.query(query);
      return result.rowCount || 0;
    } catch (error) {
      console.error('[NotificationModel] Error deleting old notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read_at IS NULL
    `;

    try {
      const result = await pool.query(query, [userId]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('[NotificationModel] Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Get notifications by type for a user
   */
  static async getByType(userId: string, type: string, limit: number = 20): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    try {
      const result = await pool.query(query, [userId, type, limit]);
      return result.rows.map((row: any) => this.mapRowToNotification(row));
    } catch (error) {
      console.error('[NotificationModel] Error getting notifications by type:', error);
      throw error;
    }
  }

  /**
   * Create batch notifications (for multiple users)
   */
  static async createBatch(notifications: NotificationData[]): Promise<Notification[]> {
    if (notifications.length === 0) {
      return [];
    }

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramCounter = 1;

    for (const notification of notifications) {
      const id = uuidv4();
      placeholders.push(`($${paramCounter}, $${paramCounter + 1}, $${paramCounter + 2}, $${paramCounter + 3}, $${paramCounter + 4}, $${paramCounter + 5}, $${paramCounter + 6})`);
      values.push(
        id,
        notification.userId,
        notification.type,
        notification.title,
        notification.message || null,
        notification.priority || 'normal',
        JSON.stringify(notification.data || {})
      );
      paramCounter += 7;
    }

    const query = `
      INSERT INTO notifications (id, user_id, type, title, message, priority, data)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows.map((row: any) => this.mapRowToNotification(row));
    } catch (error) {
      console.error('[NotificationModel] Error creating batch notifications:', error);
      throw error;
    }
  }

  /**
   * Helper: Map database row to Notification object
   */
  private static mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}