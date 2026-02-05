/**
 * FindingsGrid - Container component for findings display
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a CONTAINER component - it connects to Zustand stores.
 * Uses useFindings() hook for findings data.
 */

import { useMemo } from 'react';
import { useFindings } from '@/hooks/useFindings';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/appStore';
import { FindingCard } from './FindingCard';
import { FindingsEmpty } from './FindingsEmpty';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { ResearchFinding } from '@/types';

// ============================================
// Types
// ============================================

interface FindingsGridProps {
  /** Topic ID to load findings for */
  topicId: string | null;
  /** Callback when a finding is clicked */
  onFindingClick: (finding: ResearchFinding) => void;
}

// ============================================
// Component
// ============================================

export function FindingsGrid({ topicId, onFindingClick }: FindingsGridProps) {
  const { findings, isLoading } = useFindings(topicId);
  const { viewMode } = useUIStore();
  const { findingsDateFilter } = useAppStore();

  // Apply date filtering
  const filteredFindings = useMemo(() => {
    if (findingsDateFilter === 'all') return findings;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const cutoffMap: Record<'7d' | '30d' | '90d', number> = {
      '7d': now - (7 * day),
      '30d': now - (30 * day),
      '90d': now - (90 * day),
    };

    const cutoff = cutoffMap[findingsDateFilter];
    return findings.filter(f => f.timestamp > cutoff);
  }, [findings, findingsDateFilter]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-12 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="absolute inset-0 blur-lg bg-primary/20 animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Loading Research Findings</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              We're gathering the latest research data for your topic...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state - check filteredFindings
  if (filteredFindings.length === 0) {
    return <FindingsEmpty hasTopicSelected={!!topicId} />;
  }

  // Only show list view in this component (digest view is handled by DigestPanel)
  // List view - use filteredFindings
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {filteredFindings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            onClick={onFindingClick}
          />
        ))}
      </div>
    );
  }

  // Default: return null, let parent handle digest view
  return null;
}
