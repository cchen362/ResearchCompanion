/**
 * useFindings - Hook for findings data and operations
 *
 * Phase 2 Refactoring: Wraps researchStore and uiStore for findings management.
 *
 * Key principles:
 * 1. Single source of truth from researchStore
 * 2. Loading state from uiStore (centralized)
 * 3. Filtering and sorting applied as derived state
 * 4. No useState - all state comes from stores
 *
 * Usage:
 * ```typescript
 * function FindingsList({ topicId }) {
 *   const { findings, isLoading, refreshFindings } = useFindings(topicId);
 *
 *   return (
 *     <div>
 *       {isLoading ? <Spinner /> : findings.map(f => <FindingCard key={f.id} finding={f} />)}
 *       <button onClick={refreshFindings}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useMemo, useCallback } from 'react';
import { useResearchStore } from '@/stores/researchStore';
import { useUIStore } from '@/stores/uiStore';
import type { ResearchFinding } from '@/types';

export interface UseFindingsOptions {
  filterBy?: 'all' | 'pubmed' | 'clinical' | 'web';
  sortBy?: 'date' | 'relevance' | 'source';
}

interface UseFindingsReturn {
  // Data
  findings: ResearchFinding[];
  totalCount: number;

  // Loading state
  isLoading: boolean;

  // Selection
  selectedFindingId: string | null;
  selectedFinding: ResearchFinding | null;
  selectFinding: (findingId: string | null) => void;

  // Actions
  loadFindings: () => Promise<void>;
  refreshFindings: () => Promise<void>;
  addFinding: (finding: ResearchFinding) => void;
  updateFinding: (id: string, updates: Partial<ResearchFinding>) => void;
  deleteFinding: (id: string) => void;
}

/**
 * Hook for managing findings for a specific topic.
 *
 * @param topicId - The topic ID to get findings for (null for no topic)
 * @param options - Optional filtering and sorting options
 */
export function useFindings(
  topicId: string | null,
  options: UseFindingsOptions = {}
): UseFindingsReturn {
  // Get store state and actions
  const {
    getFindingsForTopic,
    loadFindings: loadFindingsFromStore,
    selectedFindingId,
    selectFinding,
    addFinding,
    updateFinding,
    deleteFinding
  } = useResearchStore();

  const { loading, setLoading, filterBy: storeFilterBy, sortBy: storeSortBy } = useUIStore();

  // Use options if provided, otherwise fall back to store values
  const filterBy = options.filterBy ?? storeFilterBy;
  const sortBy = options.sortBy ?? storeSortBy;

  // Get raw findings from store
  const rawFindings = topicId ? getFindingsForTopic(topicId) : [];

  // Apply filtering
  const filteredFindings = useMemo(() => {
    if (filterBy === 'all') return rawFindings;

    return rawFindings.filter(finding => {
      const sourceType = finding.source?.type?.toLowerCase() || '';
      switch (filterBy) {
        case 'pubmed':
          return sourceType.includes('pubmed') || sourceType.includes('journal');
        case 'clinical':
          return sourceType.includes('clinical') || sourceType.includes('trial');
        case 'web':
          return sourceType.includes('web') || sourceType.includes('news');
        default:
          return true;
      }
    });
  }, [rawFindings, filterBy]);

  // Apply sorting
  const sortedFindings = useMemo(() => {
    const sorted = [...filteredFindings];

    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case 'relevance':
        sorted.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        break;
      case 'source':
        sorted.sort((a, b) => {
          const sourceA = a.source?.displayName || a.source?.name || '';
          const sourceB = b.source?.displayName || b.source?.name || '';
          return sourceA.localeCompare(sourceB);
        });
        break;
    }

    return sorted;
  }, [filteredFindings, sortBy]);

  // Get selected finding object
  const selectedFinding = useMemo(() => {
    if (!selectedFindingId) return null;
    return sortedFindings.find(f => f.id === selectedFindingId) || null;
  }, [selectedFindingId, sortedFindings]);

  // Load findings action with loading state management
  const loadFindings = useCallback(async () => {
    if (!topicId) return;

    setLoading('findings', true);
    try {
      await loadFindingsFromStore(topicId);
    } finally {
      setLoading('findings', false);
    }
  }, [topicId, loadFindingsFromStore, setLoading]);

  // Refresh is the same as load (force refresh from server)
  const refreshFindings = useCallback(async () => {
    await loadFindings();
  }, [loadFindings]);

  return {
    // Data
    findings: sortedFindings,
    totalCount: rawFindings.length,

    // Loading state
    isLoading: loading.findings,

    // Selection
    selectedFindingId,
    selectedFinding,
    selectFinding,

    // Actions
    loadFindings,
    refreshFindings,
    addFinding,
    updateFinding,
    deleteFinding
  };
}
