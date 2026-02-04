/**
 * Digest Store - Zustand state management for digests
 * Persists digest state across component unmounts/navigation
 * Solves the issue of digest state loss when navigating away from Findings page
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SmartDigest } from '../types';

interface DigestQueueItem {
  id: string;
  topicId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timeframe: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface DigestState {
  // Hydration tracking
  hasHydrated: boolean;

  // Current digest data by topic ID
  digestsByTopic: Map<string, SmartDigest>;

  // Queue items by topic ID
  queueItemsByTopic: Map<string, DigestQueueItem>;

  // Loading states
  loadingDigests: Set<string>; // Set of topic IDs currently loading

  // Actions
  setDigest: (topicId: string, digest: SmartDigest | null) => void;
  getDigest: (topicId: string) => SmartDigest | undefined;
  clearDigest: (topicId: string) => void;

  setQueueItem: (topicId: string, queueItem: DigestQueueItem | null) => void;
  getQueueItem: (topicId: string) => DigestQueueItem | undefined;
  clearQueueItem: (topicId: string) => void;

  setLoading: (topicId: string, isLoading: boolean) => void;
  isLoading: (topicId: string) => boolean;

  // Clear all state for a topic
  clearTopicState: (topicId: string) => void;

  // Clear all state
  reset: () => void;
}

export const useDigestStore = create<DigestState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      digestsByTopic: new Map(),
      queueItemsByTopic: new Map(),
      loadingDigests: new Set(),

      setDigest: (topicId: string, digest: SmartDigest | null) => {
        set((state) => {
          const newDigests = new Map(state.digestsByTopic);
          if (digest) {
            newDigests.set(topicId, digest);
          } else {
            newDigests.delete(topicId);
          }
          return { digestsByTopic: newDigests };
        });
      },

      getDigest: (topicId: string) => {
        return get().digestsByTopic.get(topicId);
      },

      clearDigest: (topicId: string) => {
        set((state) => {
          const newDigests = new Map(state.digestsByTopic);
          newDigests.delete(topicId);
          return { digestsByTopic: newDigests };
        });
      },

      setQueueItem: (topicId: string, queueItem: DigestQueueItem | null) => {
        set((state) => {
          const newQueue = new Map(state.queueItemsByTopic);
          if (queueItem) {
            newQueue.set(topicId, queueItem);
          } else {
            newQueue.delete(topicId);
          }
          return { queueItemsByTopic: newQueue };
        });
      },

      getQueueItem: (topicId: string) => {
        return get().queueItemsByTopic.get(topicId);
      },

      clearQueueItem: (topicId: string) => {
        set((state) => {
          const newQueue = new Map(state.queueItemsByTopic);
          newQueue.delete(topicId);
          return { queueItemsByTopic: newQueue };
        });
      },

      setLoading: (topicId: string, isLoading: boolean) => {
        set((state) => {
          const newLoading = new Set(state.loadingDigests);
          if (isLoading) {
            newLoading.add(topicId);
          } else {
            newLoading.delete(topicId);
          }
          return { loadingDigests: newLoading };
        });
      },

      isLoading: (topicId: string) => {
        return get().loadingDigests.has(topicId);
      },

      clearTopicState: (topicId: string) => {
        set((state) => {
          const newDigests = new Map(state.digestsByTopic);
          const newQueue = new Map(state.queueItemsByTopic);
          const newLoading = new Set(state.loadingDigests);

          newDigests.delete(topicId);
          newQueue.delete(topicId);
          newLoading.delete(topicId);

          return {
            digestsByTopic: newDigests,
            queueItemsByTopic: newQueue,
            loadingDigests: newLoading
          };
        });
      },

      reset: () => {
        set({
          digestsByTopic: new Map(),
          queueItemsByTopic: new Map(),
          loadingDigests: new Set()
        });
      }
    }),
    {
      name: 'digest-store',
      // Track when hydration completes
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
        }
      },
      // Custom serialization for Map and Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          const parsed = JSON.parse(str);

          // Convert date strings back to Date objects in queue items
          const queueItemsArray = parsed.state.queueItemsByTopic || [];
          const queueItemsWithDates = queueItemsArray.map(([key, item]: [string, any]) => {
            return [key, {
              ...item,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
              completedAt: item.completedAt ? new Date(item.completedAt) : undefined
            }];
          });

          return {
            ...parsed,
            state: {
              ...parsed.state,
              digestsByTopic: new Map(parsed.state.digestsByTopic || []),
              queueItemsByTopic: new Map(queueItemsWithDates),
              loadingDigests: new Set(parsed.state.loadingDigests || [])
            }
          };
        },
        setItem: (name, value) => {
          // Convert queue items' dates to ISO strings for serialization
          const queueItemsArray = Array.from(value.state.queueItemsByTopic.entries()).map(([key, item]) => {
            return [key, {
              ...item,
              createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
              startedAt: item.startedAt instanceof Date ? item.startedAt.toISOString() : item.startedAt,
              completedAt: item.completedAt instanceof Date ? item.completedAt.toISOString() : item.completedAt
            }];
          });

          const serialized = {
            ...value,
            state: {
              ...value.state,
              digestsByTopic: Array.from(value.state.digestsByTopic.entries()),
              queueItemsByTopic: queueItemsArray,
              loadingDigests: Array.from(value.state.loadingDigests)
            }
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        }
      }
    }
  )
);

// Export a separate hook for hydration status
export const useDigestHydrated = () => {
  const hasHydrated = useDigestStore((state) => state.hasHydrated);
  return hasHydrated;
};