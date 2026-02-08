/**
 * NotificationCenter - Notification dropdown component
 *
 * Phase 4 Refactoring: Updated to use notificationService instead of direct DB access
 */

import { useState, useEffect } from 'react';
import { notificationService } from '@/services/notification.service';
import { logger } from '@/utils/logger';
import type { Notification } from '@/types';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();

    // Auto-cleanup old notifications (older than 7 days)
    notificationService.deleteOld(7).then(deleted => {
      if (deleted > 0) {
        logger.debug(`[NotificationCenter] Auto-cleaned ${deleted} old notifications`);
        loadNotifications(); // Refresh after cleanup
      }
    });

    // Refresh every 2 seconds for more responsive updates
    const interval = setInterval(() => {
      loadNotifications();
    }, 2000);

    // Listen for custom notification events
    const handleNotificationCreated = () => {
      loadNotifications();
    };

    window.addEventListener('notification-created', handleNotificationCreated);
    window.addEventListener('agent-complete', handleNotificationCreated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-created', handleNotificationCreated);
      window.removeEventListener('agent-complete', handleNotificationCreated);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const recent = await notificationService.getNotifications(10);
      setNotifications(recent);

      const unread = recent.filter(n => !n.readAt).length;
      setUnreadCount(unread);
    } catch (error) {
      logger.error('[NotificationCenter] Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      await loadNotifications();
    } catch (error) {
      logger.error('[NotificationCenter] Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(notifications);
      await loadNotifications();
    } catch (error) {
      logger.error('[NotificationCenter] Error marking all as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    await notificationService.deleteNotification(id);
    await loadNotifications();
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all notifications?')) {
      await notificationService.clearAll();
      await loadNotifications();
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'breakthrough_treatment':
        return '💊';
      case 'new_trial':
        return '🔬';
      case 'contradiction_found':
        return '⚠️';
      case 'agent_complete':
        return '✅';
      case 'appointment_reminder':
        return '📅';
      case 'medication_reminder':
        return '💉';
      default:
        return '📬';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded-md transition-colors"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-80 bg-[var(--color-surface)] rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Notifications</h3>
                <div className="flex items-center">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary-600 hover:text-primary-500"
                    >
                      Mark all as read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-red-600 hover:text-red-500 ml-2"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No notifications yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`flex items-start space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        !notification.readAt ? 'bg-primary-50 hover:bg-primary-100' : 'hover:bg-[var(--color-surface-sunken)]'
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <span className="text-lg flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.readAt ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {notification.priority === 'high' && (
                        <span className="flex-shrink-0 inline-block px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          High
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification.id);
                        }}
                        className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-red-500 p-1"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}