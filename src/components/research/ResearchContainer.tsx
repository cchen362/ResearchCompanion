/**
 * ResearchContainer - Orchestrator component for research data
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a CONTAINER component - it orchestrates data loading and
 * passes data down to child components.
 */

import { useEffect } from 'react';
import { useStoreHydration } from '@/hooks/useStoreHydration';
import { useTopics } from '@/hooks/useTopics';
import { useFindings } from '@/hooks/useFindings';
import { useDigest } from '@/hooks/useDigest';
import { useUIStore } from '@/stores/uiStore';

// Components
import { TopicSelector } from './topic/TopicSelector';
import { ResearchToolbar } from './toolbar/ResearchToolbar';
import { DigestPanel } from './digest/DigestPanel';
import { FindingsGrid } from './findings/FindingsGrid';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';

import type { ResearchFinding } from '@/types';

// ============================================
// Types
// ============================================

interface ResearchContainerProps {
  /** Optional topic ID from URL/props */
  topicId?: string;
  /** Callback when a finding is clicked */
  onFindingClick: (finding: ResearchFinding) => void;
  /** Callback to open source drawer */
  onViewSources: () => void;
  /** Callback when a finding is clicked in digest */
  onViewFinding?: (findingId: string) => void;
}

// ============================================
// Component
// ============================================

export function ResearchContainer({
  topicId: propTopicId,
  onFindingClick,
  onViewSources,
  onViewFinding
}: ResearchContainerProps) {
  // ============================================
  // Store Hydration
  // ============================================
  const isHydrated = useStoreHydration();

  // ============================================
  // Topics
  // ============================================
  const {
    topics,
    selectedTopicId,
    selectedTopic,
    isLoading: loadingTopics,
    selectTopic
  } = useTopics();

  // ============================================
  // Findings
  // ============================================
  const {
    findings,
    isLoading: loadingFindings,
    loadFindings
  } = useFindings(selectedTopicId);

  // ============================================
  // Digest
  // ============================================
  const {
    digest,
    loadDigest
  } = useDigest(selectedTopicId);

  // ============================================
  // UI State
  // ============================================
  const { viewMode } = useUIStore();

  // ============================================
  // Effects
  // ============================================

  // Set topic from prop if provided
  useEffect(() => {
    if (propTopicId && propTopicId !== selectedTopicId) {
      selectTopic(propTopicId);
    }
  }, [propTopicId, selectedTopicId, selectTopic]);

  // Load data when topic changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    if (!selectedTopicId) return;

    loadFindings();
    loadDigest();
  }, [isHydrated, selectedTopicId, loadFindings, loadDigest]);

  // ============================================
  // Render: Loading State
  // ============================================

  if (loadingTopics && topics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ============================================
  // Render: No Topics State
  // ============================================

  if (topics.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
        <CardTitle className="mb-2">No Research Topics</CardTitle>
        <p className="text-[var(--color-text-muted)]">
          Add a research topic to start tracking medical findings.
        </p>
      </Card>
    );
  }

  // ============================================
  // Render: Main Content
  // ============================================

  return (
    <div className="space-y-6">
      {/* Medical Information Disclaimer */}
      <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Medical Research Disclaimer</AlertTitle>
        <AlertDescription>
          This app aggregates publicly available medical research from verified sources.
          All information should be verified with healthcare providers. This is not medical advice.
          Always consult your healthcare team before making any medical decisions.
        </AlertDescription>
      </Alert>

      {/* Header with Topic Selector and Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Topic Selector */}
            <TopicSelector
              findingsCount={findings.length}
              digest={digest}
            />

            {/* Toolbar */}
            <ResearchToolbar
              topic={selectedTopic}
              findings={findings}
              digest={digest}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Hydration Loading */}
      {!isHydrated ? (
        <Card className="p-12 bg-gradient-to-br from-primary-50/50 to-primary-100/30">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/20 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Loading Saved Data</h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md">
                Retrieving your research findings and insights...
              </p>
            </div>
          </div>
        </Card>
      ) : viewMode === 'digest' ? (
        /* Digest View */
        <DigestPanel
          topicId={selectedTopicId}
          onViewSources={onViewSources}
          onViewFinding={onViewFinding}
        />
      ) : (
        /* List View */
        <FindingsGrid
          topicId={selectedTopicId}
          onFindingClick={onFindingClick}
        />
      )}
    </div>
  );
}
