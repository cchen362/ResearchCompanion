/**
 * Notifications Routes
 * Handles real-time notification streaming and management
 */

import express from 'express';
import { NotificationModel } from '../models/notification.model.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Server-Sent Events (SSE) endpoint for real-time notifications
 * GET /api/notifications/stream
 */
router.get('/stream', authenticateToken, async (req, res) => {
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

  const userId = req.user!.id;

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Send initial unread notifications
  try {
    const unreadNotifications = await NotificationModel.getUnread(userId);
    if (unreadNotifications.length > 0) {
      res.write(`data: ${JSON.stringify({
        type: 'initial',
        notifications: unreadNotifications
      })}\n\n`);
    }
  } catch (error) {
    console.error('[SSE] Error fetching initial notifications:', error);
  }

  // Keep connection alive with heartbeat
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000); // Every 30 seconds

  // Check for new notifications periodically
  let lastCheckTime = new Date();
  const notificationCheckInterval = setInterval(async () => {
    try {
      // Get notifications created since last check
      const recentNotifications = await NotificationModel.getRecent(userId, 10);
      const newNotifications = recentNotifications.filter(
        n => n.createdAt > lastCheckTime && !n.readAt
      );

      if (newNotifications.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'new',
          notifications: newNotifications
        })}\n\n`);
        lastCheckTime = new Date();
      }
    } catch (error) {
      console.error('[SSE] Error checking for new notifications:', error);
    }
  }, 5000); // Check every 5 seconds

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(notificationCheckInterval);
    console.log(`[SSE] Connection closed for user ${userId}`);
  });
});

/**
 * Get all notifications for the authenticated user
 * GET /api/notifications
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;

    let notifications;
    if (type) {
      notifications = await NotificationModel.getByType(userId, type, limit);
    } else {
      notifications = await NotificationModel.getRecent(userId, limit);
    }

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('[Notifications] Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * Get unread notifications count
 * GET /api/notifications/unread/count
 */
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await NotificationModel.getUnreadCount(userId);
    res.json({ success: true, count });
  } catch (error) {
    console.error('[Notifications] Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
});

/**
 * Get unread notifications
 * GET /api/notifications/unread
 */
router.get('/unread', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const notifications = await NotificationModel.getUnread(userId);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('[Notifications] Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread notifications'
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    const success = await NotificationModel.markAsRead(notificationId, userId);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Error marking as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await NotificationModel.markAllAsRead(userId);
    res.json({ success: true, count });
  } catch (error) {
    console.error('[Notifications] Error marking all as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * Dismiss notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    const success = await NotificationModel.dismiss(notificationId, userId);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Error dismissing notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss notification'
    });
  }
});

/**
 * Create test notification (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', authenticateToken, async (req, res) => {
    try {
      const userId = req.user!.id;
      const notification = await NotificationModel.create({
        userId,
        type: 'info',
        title: 'Test Notification',
        message: req.body.message || 'This is a test notification',
        priority: 'normal',
        data: { source: 'test', timestamp: new Date().toISOString() }
      });

      res.json({ success: true, notification });
    } catch (error) {
      console.error('[Notifications] Error creating test notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create test notification'
      });
    }
  });
}

export default router;