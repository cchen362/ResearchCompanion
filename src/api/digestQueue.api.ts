/**
 * Digest Queue API Client
 * Frontend API client for interacting with server-side digest queue
 */

import { api } from '../services/api';

export interface QueueStatus {
  hasActiveQueue: boolean;
  queueId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt?: Date;
  startedAt?: Date;
  timeframe?: string;
  digestType?: string;
  message?: string;
}

export interface CreateQueueRequest {
  topicId: string;
  digestType?: 'smart' | 'simple';
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all';
  priority?: number;
  metadata?: Record<string, any>;
}

export interface QueueItem {
  id: string;
  userId: string;
  topicId: string;
  digestType: string;
  timeframe: string;
  status: string;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
  resultId?: string;
  metadata?: Record<string, any>;
}

export interface QueueStats {
  stats: Array<{
    status: string;
    count: number;
    oldest: Date;
    newest: Date;
  }>;
  summary: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

/**
 * Digest Queue API methods
 */
export const digestQueueAPI = {
  /**
   * Check queue status for a topic
   */
  async getQueueStatus(topicId: string, timeframe?: string): Promise<QueueStatus> {
    try {
      const params = timeframe ? `?timeframe=${timeframe}` : '';
      const response = await api.get(`/digest-queue/status/${topicId}${params}`);
      return response.data;
    } catch (error) {
      console.error('[DigestQueueAPI] Error checking queue status:', error);
      return { hasActiveQueue: false };
    }
  },

  /**
   * Create a new queue item
   */
  async createQueueItem(data: CreateQueueRequest): Promise<{
    success: boolean;
    queueId?: string;
    status?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const response = await api.post('/digest-queue', data);
      return response.data;
    } catch (error: any) {
      console.error('[DigestQueueAPI] Error creating queue item:', error);

      // Handle duplicate queue error
      if (error.response?.status === 409) {
        return {
          success: false,
          error: 'A digest is already being generated for this topic'
        };
      }

      return {
        success: false,
        error: error.response?.data?.error || 'Failed to queue digest generation'
      };
    }
  },

  /**
   * Update queue item status
   */
  async updateQueueStatus(
    queueId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    error?: string,
    resultId?: string
  ): Promise<boolean> {
    try {
      const response = await api.patch(`/digest-queue/${queueId}`, {
        status,
        error,
        resultId
      });
      return response.data.success;
    } catch (error) {
      console.error('[DigestQueueAPI] Error updating queue status:', error);
      return false;
    }
  },

  /**
   * Cancel a queue item
   */
  async cancelQueueItem(queueId: string): Promise<boolean> {
    try {
      const response = await api.delete(`/digest-queue/${queueId}`);
      return response.data.success;
    } catch (error) {
      console.error('[DigestQueueAPI] Error cancelling queue item:', error);
      return false;
    }
  },

  /**
   * Get user's queue items
   */
  async getUserQueueItems(limit: number = 10): Promise<{
    items: QueueItem[];
    count: number;
  }> {
    try {
      const response = await api.get(`/digest-queue?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[DigestQueueAPI] Error fetching queue items:', error);
      return { items: [], count: 0 };
    }
  },

  /**
   * Trigger cleanup of old/stale queue items
   */
  async cleanupQueue(): Promise<{
    success: boolean;
    staleCancelled?: number;
    oldDeleted?: number;
    message?: string;
  }> {
    try {
      const response = await api.post('/digest-queue/cleanup');
      return response.data;
    } catch (error) {
      console.error('[DigestQueueAPI] Error during cleanup:', error);
      return {
        success: false,
        message: 'Failed to cleanup queue'
      };
    }
  },

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats | null> {
    try {
      const response = await api.get('/digest-queue/stats');
      return response.data;
    } catch (error) {
      console.error('[DigestQueueAPI] Error fetching stats:', error);
      return null;
    }
  }
};

export default digestQueueAPI;