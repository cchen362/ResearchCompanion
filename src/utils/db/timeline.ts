/**
 * Timeline Database Utils - DEPRECATED STUB
 *
 * This file was deprecated in Phase 1 Service Layer Consolidation.
 * Timeline events are no longer used in the core application.
 * This stub exists only to prevent build errors.
 *
 * TODO: Remove in Phase 3 (Component Decomposition) along with
 * - Timeline.tsx component
 * - VoiceRecorder.tsx timeline features
 * - RecordingDetailModal.tsx
 */

import type { TimelineEvent } from '@/types';

/**
 * @deprecated Timeline feature is deprecated. Returns empty array.
 */
export async function getTimelineForTopic(_topicId: string): Promise<TimelineEvent[]> {
  console.warn('[timeline.ts] Timeline feature is deprecated. Returning empty array.');
  return [];
}

/**
 * @deprecated Timeline feature is deprecated. No-op function.
 */
export async function createTimelineEvent(_event: Partial<TimelineEvent>): Promise<TimelineEvent | null> {
  console.warn('[timeline.ts] Timeline feature is deprecated. Event not created.');
  return null;
}

/**
 * @deprecated Timeline feature is deprecated. No-op function.
 */
export async function deleteTimelineEvent(_id: string): Promise<void> {
  console.warn('[timeline.ts] Timeline feature is deprecated.');
}

/**
 * @deprecated Timeline feature is deprecated. No-op function.
 */
export async function updateTimelineEvent(_id: string, _updates: Partial<TimelineEvent>): Promise<void> {
  console.warn('[timeline.ts] Timeline feature is deprecated.');
}
