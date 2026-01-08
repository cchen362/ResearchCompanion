import { getDB } from '@/utils/db/database';
import {
  getAllTimelineEvents,
  getTimelineEventsByTopic,
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent
} from '@/utils/db/timeline';
import type { TimelineEvent } from '@/types';

class TimelineService {
  async getEvents(topicId?: string): Promise<TimelineEvent[]> {
    if (topicId) {
      return await getTimelineEventsByTopic(topicId);
    }
    return await getAllTimelineEvents();
  }

  async getEvent(id: string): Promise<TimelineEvent | undefined> {
    const db = await getDB();
    const tx = db.transaction('timeline', 'readonly');
    const store = tx.objectStore('timeline');
    return await store.get(id);
  }

  async saveEvent(event: TimelineEvent): Promise<TimelineEvent> {
    if (event.id) {
      return await updateTimelineEvent(event.id, event);
    }
    return await createTimelineEvent(event);
  }

  async deleteEvent(id: string): Promise<void> {
    await deleteTimelineEvent(id);
  }

  async getEventsByDateRange(startDate: number, endDate: number): Promise<TimelineEvent[]> {
    const db = await getDB();
    const tx = db.transaction('timeline', 'readonly');
    const store = tx.objectStore('timeline');
    const allEvents = await store.getAll();

    return allEvents.filter(
      event => event.date >= startDate && event.date <= endDate
    );
  }

  async getEventsByType(type: string, topicId?: string): Promise<TimelineEvent[]> {
    const events = topicId
      ? await this.getEvents(topicId)
      : await this.getEvents();

    return events.filter(event => event.type === type);
  }
}

export const timelineService = new TimelineService();