import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Finding, ResearchAgent, DigestData } from '../types';
import { getDB } from '../utils/db/database';

interface FindingsStore {
  // State
  findings: Finding[];
  findingsMap: Map<string, Finding>;
  topicFindings: Map<string, Finding[]>;
  selectedFindings: Set<string>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalFindings: number;
  hasMore: boolean;

  // Filters
  filters: {
    topicId?: string;
    agentType?: ResearchAgent['type'];
    dateRange?: { start: Date; end: Date };
    relevanceThreshold?: number;
    sources?: string[];
    searchQuery?: string;
  };

  // Actions - Data Loading
  loadFindings: (topicId?: string, force?: boolean) => Promise<void>;
  loadFindingById: (findingId: string) => Promise<Finding | null>;
  loadFindingsByIds: (findingIds: string[]) => Promise<Finding[]>;
  loadMoreFindings: () => Promise<void>;
  refreshFindings: () => Promise<void>;

  // Actions - Selection
  selectFinding: (findingId: string) => void;
  unselectFinding: (findingId: string) => void;
  clearSelection: () => void;
  selectMultiple: (findingIds: string[]) => void;
  getSelectedFindings: () => Finding[];

  // Actions - Filtering
  setFilters: (filters: Partial<FindingsStore['filters']>) => void;
  clearFilters: () => void;
  applyFilters: () => Promise<void>;

  // Actions - Search
  searchFindings: (query: string) => Promise<Finding[]>;
  clearSearch: () => void;

  // Actions - Cache Management
  addFindingToCache: (finding: Finding) => void;
  updateFindingInCache: (findingId: string, updates: Partial<Finding>) => void;
  removeFindingFromCache: (findingId: string) => void;
  clearCache: () => void;

  // Actions - Digest Integration
  getFindingsForDigest: (topicId: string, limit?: number) => Promise<Finding[]>;
  markFindingsAsUsedInDigest: (findingIds: string[], digestId: string) => Promise<void>;
}

export const useFindingsStore = create<FindingsStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      findings: [],
      findingsMap: new Map(),
      topicFindings: new Map(),
      selectedFindings: new Set(),
      isLoading: false,
      error: null,
      lastUpdated: null,
      currentPage: 0,
      pageSize: 20,
      totalFindings: 0,
      hasMore: true,
      filters: {},

      // Data Loading
      loadFindings: async (topicId?: string, force = false) => {
        const { findings, lastUpdated } = get();

        // Check if we need to reload
        if (!force && findings.length > 0 && lastUpdated) {
          const lastUpdateTime = new Date(lastUpdated).getTime();
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;

          if (now - lastUpdateTime < fiveMinutes) {
            return; // Use cached data
          }
        }

        set({ isLoading: true, error: null });

        try {
          const db = await getDB();
          const tx = db.transaction('findings', 'readonly');
          const store = tx.objectStore('findings');

          let allFindings: Finding[];

          if (topicId) {
            const index = store.index('by-topic');
            allFindings = await index.getAll(topicId);
          } else {
            allFindings = await store.getAll();
          }

          // Sort by date (newest first) and relevance
          allFindings.sort((a, b) => {
            const dateCompare = new Date(b.foundDate).getTime() - new Date(a.foundDate).getTime();
            if (dateCompare !== 0) return dateCompare;
            return (b.relevanceScore || 0) - (a.relevanceScore || 0);
          });

          // Create maps for efficient access
          const findingsMap = new Map<string, Finding>();
          const topicFindings = new Map<string, Finding[]>();

          allFindings.forEach(finding => {
            findingsMap.set(finding.id, finding);

            const topicList = topicFindings.get(finding.topicId) || [];
            topicList.push(finding);
            topicFindings.set(finding.topicId, topicList);
          });

          // Apply initial pagination
          const { pageSize } = get();
          const paginatedFindings = allFindings.slice(0, pageSize);

          set({
            findings: paginatedFindings,
            findingsMap,
            topicFindings,
            totalFindings: allFindings.length,
            hasMore: allFindings.length > pageSize,
            currentPage: 0,
            isLoading: false,
            lastUpdated: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to load findings:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load findings',
            isLoading: false
          });
        }
      },

      loadFindingById: async (findingId: string) => {
        const { findingsMap } = get();

        // Check cache first
        if (findingsMap.has(findingId)) {
          return findingsMap.get(findingId)!;
        }

        try {
          const db = await getDB();
          const finding = await db.get('findings', findingId);

          if (finding) {
            get().addFindingToCache(finding);
            return finding;
          }
          return null;
        } catch (error) {
          console.error('Failed to load finding:', error);
          return null;
        }
      },

      loadFindingsByIds: async (findingIds: string[]) => {
        const { findingsMap } = get();
        const results: Finding[] = [];
        const missingIds: string[] = [];

        // Check cache first
        findingIds.forEach(id => {
          const cached = findingsMap.get(id);
          if (cached) {
            results.push(cached);
          } else {
            missingIds.push(id);
          }
        });

        // Load missing findings from database
        if (missingIds.length > 0) {
          try {
            const db = await getDB();
            const tx = db.transaction('findings', 'readonly');

            const loadPromises = missingIds.map(id => tx.objectStore('findings').get(id));
            const loadedFindings = await Promise.all(loadPromises);

            loadedFindings.forEach(finding => {
              if (finding) {
                results.push(finding);
                get().addFindingToCache(finding);
              }
            });
          } catch (error) {
            console.error('Failed to load findings by IDs:', error);
          }
        }

        return results;
      },

      loadMoreFindings: async () => {
        const { hasMore, currentPage, pageSize, topicFindings, filters } = get();

        if (!hasMore) return;

        set({ isLoading: true });

        try {
          const db = await getDB();
          const tx = db.transaction('findings', 'readonly');
          const store = tx.objectStore('findings');

          let allFindings: Finding[];

          if (filters.topicId) {
            allFindings = topicFindings.get(filters.topicId) || [];
          } else {
            allFindings = await store.getAll();
          }

          // Apply filters
          if (filters.agentType) {
            allFindings = allFindings.filter(f => f.agentType === filters.agentType);
          }
          if (filters.relevanceThreshold) {
            allFindings = allFindings.filter(f =>
              (f.relevanceScore || 0) >= filters.relevanceThreshold!
            );
          }
          if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            allFindings = allFindings.filter(f =>
              f.content.toLowerCase().includes(query) ||
              f.title?.toLowerCase().includes(query)
            );
          }

          const nextPage = currentPage + 1;
          const start = nextPage * pageSize;
          const end = start + pageSize;
          const nextFindings = allFindings.slice(start, end);

          const { findings } = get();
          set({
            findings: [...findings, ...nextFindings],
            currentPage: nextPage,
            hasMore: end < allFindings.length,
            isLoading: false
          });
        } catch (error) {
          console.error('Failed to load more findings:', error);
          set({ isLoading: false });
        }
      },

      refreshFindings: async () => {
        const { filters } = get();
        await get().loadFindings(filters.topicId, true);
      },

      // Selection
      selectFinding: (findingId: string) => {
        const { selectedFindings } = get();
        const newSelection = new Set(selectedFindings);
        newSelection.add(findingId);
        set({ selectedFindings: newSelection });
      },

      unselectFinding: (findingId: string) => {
        const { selectedFindings } = get();
        const newSelection = new Set(selectedFindings);
        newSelection.delete(findingId);
        set({ selectedFindings: newSelection });
      },

      clearSelection: () => {
        set({ selectedFindings: new Set() });
      },

      selectMultiple: (findingIds: string[]) => {
        const { selectedFindings } = get();
        const newSelection = new Set(selectedFindings);
        findingIds.forEach(id => newSelection.add(id));
        set({ selectedFindings: newSelection });
      },

      getSelectedFindings: () => {
        const { selectedFindings, findingsMap } = get();
        const findings: Finding[] = [];

        selectedFindings.forEach(id => {
          const finding = findingsMap.get(id);
          if (finding) {
            findings.push(finding);
          }
        });

        return findings;
      },

      // Filtering
      setFilters: (newFilters: Partial<FindingsStore['filters']>) => {
        const { filters } = get();
        set({ filters: { ...filters, ...newFilters } });
      },

      clearFilters: () => {
        set({ filters: {} });
      },

      applyFilters: async () => {
        const { filters } = get();
        await get().loadFindings(filters.topicId, true);
      },

      // Search
      searchFindings: async (query: string) => {
        if (!query) {
          return get().findings;
        }

        set({ isLoading: true });

        try {
          const db = await getDB();
          const allFindings = await db.getAll('findings');

          const searchResults = allFindings.filter(finding => {
            const searchableContent = [
              finding.title || '',
              finding.content,
              finding.keyInsights?.join(' ') || '',
              finding.source.title || ''
            ].join(' ').toLowerCase();

            return searchableContent.includes(query.toLowerCase());
          });

          // Sort by relevance (simple scoring based on match count)
          searchResults.sort((a, b) => {
            const aContent = [a.title || '', a.content].join(' ').toLowerCase();
            const bContent = [b.title || '', b.content].join(' ').toLowerCase();

            const aMatches = (aContent.match(new RegExp(query.toLowerCase(), 'g')) || []).length;
            const bMatches = (bContent.match(new RegExp(query.toLowerCase(), 'g')) || []).length;

            return bMatches - aMatches;
          });

          set({
            findings: searchResults.slice(0, get().pageSize),
            filters: { ...get().filters, searchQuery: query },
            totalFindings: searchResults.length,
            hasMore: searchResults.length > get().pageSize,
            isLoading: false
          });

          return searchResults;
        } catch (error) {
          console.error('Failed to search findings:', error);
          set({ isLoading: false });
          return [];
        }
      },

      clearSearch: () => {
        const { filters } = get();
        const { searchQuery, ...restFilters } = filters;
        set({ filters: restFilters });
        get().applyFilters();
      },

      // Cache Management
      addFindingToCache: (finding: Finding) => {
        const { findingsMap, topicFindings } = get();

        // Add to findings map
        const newFindingsMap = new Map(findingsMap);
        newFindingsMap.set(finding.id, finding);

        // Add to topic findings
        const newTopicFindings = new Map(topicFindings);
        const topicList = newTopicFindings.get(finding.topicId) || [];
        if (!topicList.find(f => f.id === finding.id)) {
          topicList.push(finding);
          newTopicFindings.set(finding.topicId, topicList);
        }

        set({ findingsMap: newFindingsMap, topicFindings: newTopicFindings });
      },

      updateFindingInCache: (findingId: string, updates: Partial<Finding>) => {
        const { findingsMap, findings } = get();

        const existing = findingsMap.get(findingId);
        if (!existing) return;

        const updated = { ...existing, ...updates };

        // Update map
        const newFindingsMap = new Map(findingsMap);
        newFindingsMap.set(findingId, updated);

        // Update array
        const newFindings = findings.map(f => f.id === findingId ? updated : f);

        set({ findingsMap: newFindingsMap, findings: newFindings });
      },

      removeFindingFromCache: (findingId: string) => {
        const { findingsMap, findings, topicFindings } = get();

        const finding = findingsMap.get(findingId);
        if (!finding) return;

        // Remove from map
        const newFindingsMap = new Map(findingsMap);
        newFindingsMap.delete(findingId);

        // Remove from array
        const newFindings = findings.filter(f => f.id !== findingId);

        // Remove from topic findings
        const newTopicFindings = new Map(topicFindings);
        const topicList = newTopicFindings.get(finding.topicId);
        if (topicList) {
          const filteredList = topicList.filter(f => f.id !== findingId);
          newTopicFindings.set(finding.topicId, filteredList);
        }

        set({
          findingsMap: newFindingsMap,
          findings: newFindings,
          topicFindings: newTopicFindings
        });
      },

      clearCache: () => {
        set({
          findings: [],
          findingsMap: new Map(),
          topicFindings: new Map(),
          selectedFindings: new Set(),
          lastUpdated: null
        });
      },

      // Digest Integration
      getFindingsForDigest: async (topicId: string, limit = 10) => {
        try {
          const db = await getDB();
          const index = db.transaction('findings', 'readonly')
            .objectStore('findings')
            .index('by-topic');

          const findings = await index.getAll(topicId);

          // Sort by relevance and date
          findings.sort((a, b) => {
            const relevanceA = a.relevanceScore || 0;
            const relevanceB = b.relevanceScore || 0;
            if (relevanceA !== relevanceB) {
              return relevanceB - relevanceA;
            }
            return new Date(b.foundDate).getTime() - new Date(a.foundDate).getTime();
          });

          return findings.slice(0, limit);
        } catch (error) {
          console.error('Failed to get findings for digest:', error);
          return [];
        }
      },

      markFindingsAsUsedInDigest: async (findingIds: string[], digestId: string) => {
        try {
          const db = await getDB();
          const tx = db.transaction('findings', 'readwrite');

          for (const findingId of findingIds) {
            const finding = await tx.objectStore('findings').get(findingId);
            if (finding) {
              // Add digest reference to finding metadata
              const metadata = finding.metadata || {};
              const digestReferences = metadata.digestReferences || [];
              if (!digestReferences.includes(digestId)) {
                digestReferences.push(digestId);
                finding.metadata = { ...metadata, digestReferences };
                await tx.objectStore('findings').put(finding);
              }
            }
          }

          await tx.done;
        } catch (error) {
          console.error('Failed to mark findings as used in digest:', error);
        }
      }
    }),
    {
      name: 'findings-store'
    }
  )
);