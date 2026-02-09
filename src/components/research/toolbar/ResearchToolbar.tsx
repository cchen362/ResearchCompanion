/**
 * ResearchToolbar - Container component for research controls
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a CONTAINER component - it connects to Zustand stores.
 * Composes ViewToggle, TimeframeSelector, and action buttons.
 */

import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/appStore';
import { ViewToggle } from './ViewToggle';
import { FindingsDateFilter } from './FindingsDateFilter';
import { ExportMenu } from '@/components/ExportMenu';
import type { FindingsDateFilter as FilterType } from '@/stores/appStore';
import type { Topic, ResearchFinding, SmartDigest } from '@/types';

// ============================================
// Types
// ============================================

interface ResearchToolbarProps {
  /** Current topic for export */
  topic?: Topic | null;
  /** Findings for export */
  findings: ResearchFinding[];
  /** Digest for export */
  digest?: SmartDigest | null;
}

// ============================================
// Component
// ============================================

export function ResearchToolbar({
  topic,
  findings,
  digest
}: ResearchToolbarProps) {
  const { viewMode, setViewMode } = useUIStore();
  const { findingsDateFilter, setFindingsDateFilter } = useAppStore();

  const handleViewChange = (mode: 'digest' | 'list') => {
    setViewMode(mode);
  };

  const handleFilterChange = (filter: FilterType) => {
    setFindingsDateFilter(filter);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Export button (only show when there's data) */}
      {topic && findings.length > 0 && (
        <ExportMenu
          topic={topic}
          findings={findings}
          digest={digest || undefined}
        />
      )}

      {/* Date filter - only show in list view */}
      {viewMode === 'list' && (
        <FindingsDateFilter
          filter={findingsDateFilter}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* View mode toggle */}
      <ViewToggle
        viewMode={viewMode}
        onViewChange={handleViewChange}
      />

    </div>
  );
}
