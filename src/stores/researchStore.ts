/**
 * Research Store - Zustand state management for all research data
 *
 * Phase 2 Refactoring: Consolidates findings, topics, digests, and agents
 * into a single store to eliminate race conditions and state fragmentation.
 *
 * Key principles:
 * 1. Single source of truth for all research data
 * 2. Topic-keyed Maps for efficient lookup
 * 3. Selection state persists across navigation
 * 4. Loading happens through store actions (no duplicate fetches)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ResearchFinding, Topic, SmartDigest, Agent, DigestTimeframe } from '@/types';
import { findingsService } from '@/services/findings.service';
import { topicsService } from '@/services/topics.service';
import { digestService } from '@/services/digest.service';
import { agentsService } from '@/services/agents.service';

interface ResearchStore {
  // ============================================
  // Data (keyed by topicId for efficient access)
  // ============================================
  findings: Map<string, ResearchFinding[]>; // Keyed by topicId
  topics: Topic[];
  digests: Map<string, SmartDigest>; // Keyed by `${topicId}-${timeframe}`
  agents: Map<string, Agent[]>; // Keyed by topicId

  // ============================================
  // Selection State (persists across navigation)
  // ============================================
  selectedTopicId: string | null;
  selectedFindingId: string | null;
  selectedFindings: Set<string>; // Multi-selection for batch operations

  // ============================================
  // Hydration tracking
  // ============================================
  hasHydrated: boolean;

  // ============================================
  // Actions - Data Loading
  // ============================================
  loadTopics: () => Promise<void>;
  loadFindings: (topicId: string) => Promise<void>;
  loadDigest: (topicId: string, timeframe?: DigestTimeframe) => Promise<void>;
  loadAgents: (topicId: string) => Promise<void>;

  // ============================================
  // Actions - Selection
  // ============================================
  selectTopic: (topicId: string | null) => void;
  selectFinding: (findingId: string | null) => void;
  toggleFindingSelection: (findingId: string) => void;
  clearFindingSelection: () => void;
  getSelectedFindings: () => ResearchFinding[];

  // ============================================
  // Actions - Mutations
  // ============================================
  addFinding: (finding: ResearchFinding) => void;
  updateFinding: (id: string, updates: Partial<ResearchFinding>) => void;
  deleteFinding: (id: string) => void;

  // ============================================
  // Actions - Digest
  // ============================================
  generateDigest: (topicId: string, timeframe?: DigestTimeframe) => Promise<SmartDigest | null>;
  setDigest: (topicId: string, timeframe: DigestTimeframe, digest: SmartDigest | null) => void;
  clearDigest: (topicId: string) => void;

  // ============================================
  // Getters (computed selectors)
  // ============================================
  getFindingsForTopic: (topicId: string) => ResearchFinding[];
  getFindingById: (findingId: string) => ResearchFinding | null;
  loadFindingById: (findingId: string) => Promise<ResearchFinding | null>;
  getDigestForTopic: (topicId: string, timeframe?: DigestTimeframe) => SmartDigest | null;
  getSelectedTopic: () => Topic | null;
  getAgentsForTopic: (topicId: string) => Agent[];

  // ============================================
  // Bulk actions
  // ============================================
  reset: () => void;
  clearTopicData: (topicId: string) => void;
}

// Helper to create digest key
const makeDigestKey = (topicId: string, timeframe: DigestTimeframe = 'all-time') =>
  `${topicId}-${timeframe}`;

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      // ============================================
      // Initial State
      // ============================================
      findings: new Map(),
      topics: [],
      digests: new Map(),
      agents: new Map(),
      selectedTopicId: null,
      selectedFindingId: null,
      selectedFindings: new Set(),
      hasHydrated: false,

      // ============================================
      // Data Loading Actions
      // ============================================

      loadTopics: async () => {
        try {
          const topics = await topicsService.getTopics();
          set({ topics });

          // Auto-select first topic if none selected
          const { selectedTopicId } = get();
          if (!selectedTopicId && topics.length > 0) {
            set({ selectedTopicId: topics[0].id });
          }
        } catch (error) {
          console.error('[ResearchStore] Error loading topics:', error);
        }
      },

      loadFindings: async (topicId: string) => {
        try {
          const findings = await findingsService.getFindings(topicId);
          // Sort by timestamp (newest first)
          findings.sort((a, b) => b.timestamp - a.timestamp);

          set(state => ({
            findings: new Map(state.findings).set(topicId, findings)
          }));

          // Mark findings as read
          await findingsService.markFindingsAsRead(topicId);
        } catch (error) {
          console.error('[ResearchStore] Error loading findings:', error);
        }
      },

      loadDigest: async (topicId: string, timeframe: DigestTimeframe = 'all-time') => {
        try {
          // Try to get cached digest first
          const { digest: cachedDigest } = await digestService.getCachedDigest(topicId, timeframe);

          if (cachedDigest) {
            const key = makeDigestKey(topicId, timeframe);
            set(state => ({
              digests: new Map(state.digests).set(key, cachedDigest)
            }));
            return;
          }

          // Try to fetch from server
          const digest = await digestService.getDigest(topicId, timeframe);
          if (digest) {
            const key = makeDigestKey(topicId, timeframe);
            set(state => ({
              digests: new Map(state.digests).set(key, digest)
            }));
            // Cache it locally
            await digestService.saveDigest(digest);
          }
        } catch (error) {
          console.error('[ResearchStore] Error loading digest:', error);
        }
      },

      loadAgents: async (topicId: string) => {
        try {
          const agents = await agentsService.getAgents(topicId);
          set(state => ({
            agents: new Map(state.agents).set(topicId, agents)
          }));
        } catch (error) {
          console.error('[ResearchStore] Error loading agents:', error);
        }
      },

      // ============================================
      // Selection Actions
      // ============================================

      selectTopic: (topicId: string | null) => {
        set({
          selectedTopicId: topicId,
          selectedFindingId: null // Clear finding selection when topic changes
        });
      },

      selectFinding: (findingId: string | null) => {
        set({ selectedFindingId: findingId });
      },

      toggleFindingSelection: (findingId: string) => {
        set(state => {
          const newSelection = new Set(state.selectedFindings);
          if (newSelection.has(findingId)) {
            newSelection.delete(findingId);
          } else {
            newSelection.add(findingId);
          }
          return { selectedFindings: newSelection };
        });
      },

      clearFindingSelection: () => {
        set({ selectedFindings: new Set() });
      },

      getSelectedFindings: () => {
        const { selectedFindings, findings } = get();
        const result: ResearchFinding[] = [];
        for (const topicFindings of findings.values()) {
          for (const finding of topicFindings) {
            if (selectedFindings.has(finding.id)) {
              result.push(finding);
            }
          }
        }
        return result;
      },

      // ============================================
      // Mutation Actions
      // ============================================

      addFinding: (finding: ResearchFinding) => {
        set(state => {
          const topicFindings = state.findings.get(finding.topicId) || [];
          return {
            findings: new Map(state.findings).set(
              finding.topicId,
              [finding, ...topicFindings] // Add to beginning (newest first)
            )
          };
        });
      },

      updateFinding: (id: string, updates: Partial<ResearchFinding>) => {
        set(state => {
          const newFindings = new Map(state.findings);
          newFindings.forEach((findings, topicId) => {
            const index = findings.findIndex(f => f.id === id);
            if (index !== -1) {
              findings[index] = { ...findings[index], ...updates };
              newFindings.set(topicId, [...findings]);
            }
          });
          return { findings: newFindings };
        });
      },

      deleteFinding: (id: string) => {
        set(state => {
          const newFindings = new Map(state.findings);
          newFindings.forEach((findings, topicId) => {
            const filtered = findings.filter(f => f.id !== id);
            if (filtered.length !== findings.length) {
              newFindings.set(topicId, filtered);
            }
          });
          return { findings: newFindings };
        });
      },

      // ============================================
      // Digest Actions
      // ============================================

      generateDigest: async (topicId: string, timeframe: DigestTimeframe = 'all-time') => {
        try {
          const digest = await digestService.generateDigest(topicId, timeframe);
          if (digest) {
            const key = makeDigestKey(topicId, timeframe);
            set(state => ({
              digests: new Map(state.digests).set(key, digest)
            }));
          }
          return digest;
        } catch (error) {
          console.error('[ResearchStore] Error generating digest:', error);
          return null;
        }
      },

      setDigest: (topicId: string, timeframe: DigestTimeframe, digest: SmartDigest | null) => {
        const key = makeDigestKey(topicId, timeframe);
        set(state => {
          const newDigests = new Map(state.digests);
          if (digest) {
            newDigests.set(key, digest);
          } else {
            newDigests.delete(key);
          }
          return { digests: newDigests };
        });
      },

      clearDigest: (topicId: string) => {
        set(state => {
          const newDigests = new Map(state.digests);
          // Clear all digests for this topic (all timeframes)
          Array.from(newDigests.keys())
            .filter(key => key.startsWith(topicId))
            .forEach(key => newDigests.delete(key));
          return { digests: newDigests };
        });
      },

      // ============================================
      // Getters (Selectors)
      // ============================================

      getFindingsForTopic: (topicId: string) => {
        return get().findings.get(topicId) || [];
      },

      getFindingById: (findingId: string) => {
        const { findings } = get();
        for (const topicFindings of findings.values()) {
          const found = topicFindings.find(f => f.id === findingId);
          if (found) return found;
        }
        return null;
      },

      loadFindingById: async (findingId: string) => {
        // First check if we have it cached
        const cached = get().getFindingById(findingId);
        if (cached) return cached;

        // Otherwise load from service
        try {
          const finding = await findingsService.getFindingById(findingId);
          if (finding) {
            // Add to cache
            get().addFinding(finding);
          }
          return finding;
        } catch (error) {
          console.error('[ResearchStore] Error loading finding by ID:', error);
          return null;
        }
      },

      getDigestForTopic: (topicId: string, timeframe: DigestTimeframe = 'all-time') => {
        const key = makeDigestKey(topicId, timeframe);
        return get().digests.get(key) || null;
      },

      getSelectedTopic: () => {
        const { topics, selectedTopicId } = get();
        return topics.find(t => t.id === selectedTopicId) || null;
      },

      getAgentsForTopic: (topicId: string) => {
        return get().agents.get(topicId) || [];
      },

      // ============================================
      // Bulk Actions
      // ============================================

      reset: () => {
        set({
          findings: new Map(),
          topics: [],
          digests: new Map(),
          agents: new Map(),
          selectedTopicId: null,
          selectedFindingId: null
        });
      },

      clearTopicData: (topicId: string) => {
        set(state => {
          const newFindings = new Map(state.findings);
          const newDigests = new Map(state.digests);
          const newAgents = new Map(state.agents);

          newFindings.delete(topicId);
          newAgents.delete(topicId);

          // Clear all digests for this topic
          Array.from(newDigests.keys())
            .filter(key => key.startsWith(topicId))
            .forEach(key => newDigests.delete(key));

          return {
            findings: newFindings,
            digests: newDigests,
            agents: newAgents,
            // Clear selection if this topic was selected
            selectedTopicId: state.selectedTopicId === topicId ? null : state.selectedTopicId,
            selectedFindingId: state.selectedTopicId === topicId ? null : state.selectedFindingId
          };
        });
      }
    }),
    {
      name: 'research-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist selection state, not data (data is fetched fresh)
      partialize: (state) => ({
        selectedTopicId: state.selectedTopicId,
        selectedFindingId: state.selectedFindingId
      }),
      // Track hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
        }
      }
    }
  )
);

// Export hydration hook
export const useResearchHydrated = () => {
  return useResearchStore((state) => state.hasHydrated);
};
