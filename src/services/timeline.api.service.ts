import api from './api';
import type { TimelineEvent } from '@/types';

/**
 * Timeline API Service
 * Handles all timeline-related API calls to the backend
 */
class TimelineAPIService {
  /**
   * Get all timeline events for the current user
   */
  async getAllEvents(): Promise<TimelineEvent[]> {
    try {
      const response = await api.get('/timeline');
      return this.transformEvents(response.data.events || []);
    } catch (error) {
      console.error('Error fetching all timeline events:', error);
      throw error;
    }
  }

  /**
   * Get timeline events for a specific topic
   */
  async getEventsByTopic(topicId: string): Promise<TimelineEvent[]> {
    try {
      const response = await api.get(`/timeline/topic/${topicId}`);
      return this.transformEvents(response.data.events || []);
    } catch (error) {
      console.error(`Error fetching timeline for topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Get timeline events by type
   */
  async getEventsByType(type: string): Promise<TimelineEvent[]> {
    try {
      const response = await api.get(`/timeline/type/${type}`);
      return this.transformEvents(response.data.events || []);
    } catch (error) {
      console.error(`Error fetching timeline by type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Get a single timeline event by ID
   */
  async getEvent(eventId: string): Promise<TimelineEvent | null> {
    try {
      const response = await api.get(`/timeline/${eventId}`);
      return this.transformEvent(response.data.event);
    } catch (error) {
      console.error(`Error fetching timeline event ${eventId}:`, error);
      if ((error as any).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new timeline event
   */
  async createEvent(
    topicId: string,
    type: string,
    title: string,
    data?: any,
    metadata?: any
  ): Promise<TimelineEvent> {
    try {
      const response = await api.post('/timeline', {
        topicId,
        type,
        title,
        data,
        metadata
      });
      return this.transformEvent(response.data.event);
    } catch (error) {
      console.error('Error creating timeline event:', error);
      throw error;
    }
  }

  /**
   * Update a timeline event
   */
  async updateEvent(
    eventId: string,
    updates: {
      title?: string;
      description?: string;
      event_date?: string;
      data?: any;
      metadata?: any;
    }
  ): Promise<TimelineEvent> {
    try {
      const response = await api.put(`/timeline/${eventId}`, updates);
      return this.transformEvent(response.data.event);
    } catch (error) {
      console.error(`Error updating timeline event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a timeline event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const response = await api.delete(`/timeline/${eventId}`);
      return response.data.success === true;
    } catch (error) {
      console.error(`Error deleting timeline event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all timeline events for a topic
   */
  async deleteByTopic(topicId: string): Promise<number> {
    try {
      const response = await api.delete(`/timeline/topic/${topicId}`);
      return response.data.count || 0;
    } catch (error) {
      console.error(`Error deleting timeline for topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Transform backend timeline event to frontend format
   */
  private transformEvent(backendEvent: any): TimelineEvent {
    if (!backendEvent) return null as any;

    // The backend uses snake_case, frontend uses camelCase
    return {
      id: backendEvent.id,
      topicId: backendEvent.topic_id,
      type: backendEvent.type as TimelineEvent['type'],
      title: backendEvent.title,
      description: backendEvent.description,
      timestamp: new Date(backendEvent.event_date).getTime(),
      data: backendEvent.data || {},
      metadata: backendEvent.metadata || {},
      createdAt: new Date(backendEvent.created_at).getTime(),
      updatedAt: new Date(backendEvent.updated_at).getTime()
    };
  }

  /**
   * Transform an array of backend events
   */
  private transformEvents(backendEvents: any[]): TimelineEvent[] {
    return backendEvents.map(event => this.transformEvent(event));
  }
}

// Export singleton instance
export const timelineAPIService = new TimelineAPIService();