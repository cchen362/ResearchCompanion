import { useState, useEffect } from 'react';
import { getDB } from '@/utils/db/database';
import type { Notification } from '@/types';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    console.log('NotificationCenter mounted');
    loadNotifications();
    // Refresh every 2 seconds for more responsive updates
    const interval = setInterval(() => {
      loadNotifications();
    }, 2000);

    // Listen for custom notification events
    const handleNotificationCreated = () => {
      console.log('Notification event received, loading notifications...');
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
      const db = await getDB();
      // Use getAll instead of getAllFromIndex to ensure we get all notifications
      const allNotifications = await db.getAll('notifications');
      console.log('Loaded notifications using getAll:', allNotifications.length, 'total notifications');

      // Sort by createdAt manually (most recent first)
      allNotifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const recent = allNotifications.slice(0, 10); // First 10 after sorting (most recent)
      setNotifications(recent);

      const unread = recent.filter(n => !n.readAt).length;
      console.log('Unread notifications:', unread);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const db = await getDB();
      const notification = await db.get('notifications', notificationId);
      if (notification && !notification.readAt) {
        notification.readAt = Date.now();
        await db.put('notifications', notification);
        await loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const db = await getDB();
      const tx = db.transaction('notifications', 'readwrite');
      const store = tx.objectStore('notifications');

      for (const notification of notifications) {
        if (!notification.readAt) {
          notification.readAt = Date.now();
          await store.put(notification);
        }
      }

      await tx.done;
      await loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
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
        className="relative p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md transition-colors"
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
          <div className="absolute right-0 z-20 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-500"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No notifications yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`flex items-start space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        !notification.readAt ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <span className="text-lg flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.readAt ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {notification.priority === 'high' && (
                        <span className="flex-shrink-0 inline-block px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          High
                        </span>
                      )}
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