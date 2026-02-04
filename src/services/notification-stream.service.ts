/**
 * Notification Stream Service
 * Handles Server-Sent Events (SSE) connection for real-time notifications
 */

import { api } from './api';
import { toast } from '@/components/ui/use-toast';
import { logger } from '@/utils/logger';

export interface ServerNotification {
  id: string;
  userId: string;
  type: 'agent_complete' | 'digest_ready' | 'error' | 'info';
  title: string;
  message?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: any;
  readAt?: Date;
  createdAt: Date;
}

interface NotificationEvent {
  type: 'connected' | 'initial' | 'new';
  notifications?: ServerNotification[];
  timestamp?: string;
}

class NotificationStreamService {
  private eventSource: EventSource | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // Start with 5 seconds
  private isConnected = false;
  private listeners: Set<(notification: ServerNotification) => void> = new Set();

  /**
   * Connect to the notification stream
   */
  connect(): void {
    if (this.eventSource) {
      logger.debug('[NotificationStream] Already connected');
      return;
    }

    // Get auth token
    const token = localStorage.getItem('token');
    if (!token) {
      logger.warn('[NotificationStream] No auth token, skipping connection');
      return;
    }

    try {
      // Create SSE connection
      const baseUrl = api.defaults.baseURL || '';
      const streamUrl = `${baseUrl}/notifications/stream`;

      // EventSource doesn't support headers, so pass token as query param
      // Note: In production, consider using cookies instead for better security
      this.eventSource = new EventSource(`${streamUrl}?token=${encodeURIComponent(token)}`);

      this.setupEventHandlers();

    } catch (error) {
      logger.error('[NotificationStream] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Set up event handlers for SSE connection
   */
  private setupEventHandlers(): void {
    if (!this.eventSource) return;

    // Connection opened
    this.eventSource.onopen = () => {
      logger.debug('[NotificationStream] Connected to notification stream');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000; // Reset delay
    };

    // Handle messages
    this.eventSource.onmessage = (event) => {
      try {
        const data: NotificationEvent = JSON.parse(event.data);
        this.handleNotificationEvent(data);
      } catch (error) {
        logger.error('[NotificationStream] Error parsing message:', error);
      }
    };

    // Handle errors
    this.eventSource.onerror = (error) => {
      logger.error('[NotificationStream] Connection error:', error);
      this.isConnected = false;
      this.eventSource?.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };
  }

  /**
   * Handle notification events from server
   */
  private handleNotificationEvent(event: NotificationEvent): void {
    switch (event.type) {
      case 'connected':
        logger.debug('[NotificationStream] Connection confirmed at', event.timestamp);
        break;

      case 'initial':
        if (event.notifications && event.notifications.length > 0) {
          logger.debug(`[NotificationStream] Received ${event.notifications.length} initial notifications`);
          event.notifications.forEach(notification => {
            this.processNotification(notification, false); // Don't show toasts for initial load
          });
        }
        break;

      case 'new':
        if (event.notifications && event.notifications.length > 0) {
          logger.debug(`[NotificationStream] Received ${event.notifications.length} new notifications`);
          event.notifications.forEach(notification => {
            this.processNotification(notification, true); // Show toasts for new notifications
          });
        }
        break;

      default:
        logger.warn('[NotificationStream] Unknown event type:', event.type);
    }
  }

  /**
   * Process individual notification
   */
  private processNotification(notification: ServerNotification, showToast: boolean): void {
    // Dispatch custom event for UI components to handle
    window.dispatchEvent(new CustomEvent('server-notification', {
      detail: { notification }
    }));

    // Notify listeners
    this.listeners.forEach(listener => listener(notification));

    // Show toast for important notifications
    if (showToast) {
      this.showNotificationToast(notification);
    }
  }

  /**
   * Show toast notification
   */
  private showNotificationToast(notification: ServerNotification): void {
    // Determine toast variant based on type and priority
    let variant: 'default' | 'destructive' = 'default';
    if (notification.type === 'error' || notification.priority === 'urgent') {
      variant = 'destructive';
    }

    // Special handling for agent completion notifications
    if (notification.type === 'agent_complete' && notification.data) {
      const { topicName, findingsCount } = notification.data;

      toast({
        title: notification.title,
        description: notification.message || `Found ${findingsCount} new findings for ${topicName}`,
        variant,
        action: {
          label: 'View',
          onClick: () => {
            // Navigate to research page for this topic
            if (notification.data.topicId) {
              window.location.href = `/research?topic=${notification.data.topicId}`;
            }
          }
        }
      });
    } else if (notification.type === 'digest_ready' && notification.data) {
      toast({
        title: notification.title,
        description: notification.message || 'Your AI-powered digest is ready to view',
        variant,
        action: {
          label: 'View Digest',
          onClick: () => {
            // Navigate to digest view
            if (notification.data.topicId) {
              window.location.href = `/research?topic=${notification.data.topicId}&view=digest`;
            }
          }
        }
      });
    } else {
      // Default notification toast
      toast({
        title: notification.title,
        description: notification.message,
        variant
      });
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[NotificationStream] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000); // Cap at 1 minute

    logger.debug(`[NotificationStream] Reconnecting in ${delay / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from notification stream
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      logger.debug('[NotificationStream] Disconnected from notification stream');
    }
  }

  /**
   * Add notification listener
   */
  addListener(listener: (notification: ServerNotification) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove notification listener
   */
  removeListener(listener: (notification: ServerNotification) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Check if connected
   */
  isStreamConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await api.put(`/notifications/${notificationId}/read`);
    } catch (error) {
      logger.error('[NotificationStream] Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await api.put('/notifications/read-all');
    } catch (error) {
      logger.error('[NotificationStream] Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await api.get('/notifications/unread/count');
      return response.data.count || 0;
    } catch (error) {
      logger.error('[NotificationStream] Failed to get unread count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const notificationStream = new NotificationStreamService();