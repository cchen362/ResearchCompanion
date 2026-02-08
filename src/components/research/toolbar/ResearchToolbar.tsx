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
import { useDigest } from '@/hooks/useDigest';
import { ViewToggle } from './ViewToggle';
import { FindingsDateFilter } from './FindingsDateFilter';
import { ExportMenu } from '@/components/ExportMenu';
import type { FindingsDateFilter as FilterType } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings } from 'lucide-react';
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
  /** Topic ID for digest actions */
  topicId: string | null;
  /** Callback when settings clicked */
  onSettingsClick: () => void;
}

// ============================================
// Component
// ============================================

export function ResearchToolbar({
  topic,
  findings,
  digest,
  topicId,
  onSettingsClick
}: ResearchToolbarProps) {
  const { viewMode, setViewMode } = useUIStore();
  const { findingsDateFilter, setFindingsDateFilter } = useAppStore();
  const { isGenerating, refreshDigest } = useDigest(topicId);

  const handleViewChange = (mode: 'digest' | 'list') => {
    setViewMode(mode);
  };

  const handleFilterChange = (filter: FilterType) => {
    setFindingsDateFilter(filter);
  };

  const handleRefresh = () => {
    refreshDigest();
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

      {/* Refresh button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={isGenerating}
        title={isGenerating ? 'Updating research and digest...' : 'Update Research & Digest'}
        className="gap-1"
      >
        <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline text-xs">
          {isGenerating ? 'Updating...' : 'Update'}
        </span>
      </Button>

      {/* Settings button */}
      <Button
        size="sm"
        variant="outline"
        onClick={onSettingsClick}
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  );
}
