import { getDB } from './database';
import type { TimelineEvent } from '@/types';
import { generateId } from './topics';
import { timelineAPIService } from '@/services/timeline.api.service';

// Check if we should use server storage
const USE_SERVER_STORAGE = import.meta.env.VITE_USE_SERVER_STORAGE === 'true';

/**
 * Create a new timeline event
 * Uses dual storage strategy: server + local IndexedDB
 */
export async function createTimelineEvent(
  topicId: string,
  type: TimelineEvent['type'],
  title: string,
  data: any,
  metadata?: any
): Promise<TimelineEvent> {
  // If server storage is enabled, save to server first
  if (USE_SERVER_STORAGE) {
    try {
      // Save to server
      const serverEvent = await timelineAPIService.createEvent(
        topicId,
        type,
        title,
        data,
        metadata
      );

      // Also save to IndexedDB for offline access
      const db = await getDB();
      await db.put('timeline', serverEvent);

      return serverEvent;
    } catch (error) {
      console.error('Failed to save timeline event to server:', error);
      // Fall through to local-only storage
    }
  }

  // Local-only storage (fallback or when server storage disabled)
  const db = await getDB();

  const event: TimelineEvent = {
    id: generateId(),
    topicId,
    type,
    timestamp: Date.now(),
    title,
    description: '',
    data,
    metadata,
    tags: []
  };

  await db.add('timeline', event);
  return event;
}

/**
 * Get all timeline events for a topic
 * Fetches from server if available, falls back to local IndexedDB
 */
export async function getTimelineForTopic(topicId: string): Promise<TimelineEvent[]> {
  // Try to fetch from server first if enabled
  if (USE_SERVER_STORAGE) {
    try {
      const serverEvents = await timelineAPIService.getEventsByTopic(topicId);

      // Update local cache with server data
      const db = await getDB();
      for (const event of serverEvents) {
        await db.put('timeline', event);
      }

      // Sort by timestamp, newest first
      return serverEvents.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to fetch timeline from server:', error);
      // Fall through to local storage
    }
  }

  // Fetch from local IndexedDB (fallback or when server storage disabled)
  const db = await getDB();
  const events = await db.getAllFromIndex('timeline', 'by-topic', topicId);

  // Sort by timestamp, newest first
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get timeline events by type
 */
export async function getTimelineByType(
  topicId: string,
  type: TimelineEvent['type']
): Promise<TimelineEvent[]> {
  const events = await getTimelineForTopic(topicId);
  return events.filter(event => event.type === type);
}

/**
 * Delete a timeline event
 */
export async function deleteTimelineEvent(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('timeline', id);
}

/**
 * Update a timeline event
 */
export async function updateTimelineEvent(event: TimelineEvent): Promise<void> {
  const db = await getDB();
  await db.put('timeline', event);
}

/**
 * Search timeline events by text
 */
export async function searchTimeline(
  topicId: string,
  searchText: string
): Promise<TimelineEvent[]> {
  const events = await getTimelineForTopic(topicId);
  const lowerSearch = searchText.toLowerCase();

  return events.filter(event =>
    event.title.toLowerCase().includes(lowerSearch) ||
    event.description?.toLowerCase().includes(lowerSearch) ||
    JSON.stringify(event.data).toLowerCase().includes(lowerSearch)
  );
}

/**
 * Get timeline events within a date range
 */
export async function getTimelineRange(
  topicId: string,
  startDate: number,
  endDate: number
): Promise<TimelineEvent[]> {
  const events = await getTimelineForTopic(topicId);

  return events.filter(event =>
    event.timestamp >= startDate && event.timestamp <= endDate
  );
}

/**
 * Add tag to timeline event
 */
export async function addTagToEvent(
  eventId: string,
  tag: string
): Promise<void> {
  const db = await getDB();
  const event = await db.get('timeline', eventId);

  if (event) {
    if (!event.tags.includes(tag)) {
      event.tags.push(tag);
      await db.put('timeline', event);
    }
  }
}

/**
 * Get all unique tags from timeline events
 */
export async function getAllTimelineTags(topicId: string): Promise<string[]> {
  const events = await getTimelineForTopic(topicId);
  const tags = new Set<string>();

  events.forEach(event => {
    event.tags.forEach(tag => tags.add(tag));
  });

  return Array.from(tags);
}

/**
 * Get timeline events by tag
 */
export async function getTimelineByTag(
  topicId: string,
  tag: string
): Promise<TimelineEvent[]> {
  const events = await getTimelineForTopic(topicId);
  return events.filter(event => event.tags.includes(tag));
}