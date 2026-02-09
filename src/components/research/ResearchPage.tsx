/**
 * ResearchPage - Page component for research findings
 *
 * Phase 3 Component Decomposition: Replaces FindingsViewerProgressive.tsx
 *
 * This is a PAGE component - it handles:
 * - Route parameters
 * - Drawer/modal management
 * - Composing the ResearchContainer
 */

import { useUIStore } from '@/stores/uiStore';
import { useFindings } from '@/hooks/useFindings';
import { useDigest } from '@/hooks/useDigest';
import { useTopics } from '@/hooks/useTopics';

// Components
import { ResearchContainer } from './ResearchContainer';
import { SourceDrawer } from './drawers/SourceDrawer';
import { FindingDetailDrawer } from './drawers/FindingDetailDrawer';
import type { ResearchFinding } from '@/types';

// ============================================
// Types
// ============================================

interface ResearchPageProps {
  /** Optional topic ID from URL/route */
  topicId?: string;
}

// ============================================
// Component
// ============================================

export function ResearchPage({ topicId: propTopicId }: ResearchPageProps) {
  // ============================================
  // Store State
  // ============================================
  const {
    modals,
    openModal,
    closeModal,
    openSourceDrawer,
    closeSourceDrawer
  } = useUIStore();

  // ============================================
  // Data Hooks
  // ============================================
  const { selectedTopicId, selectedTopic } = useTopics();
  const { findings, selectedFinding, selectFinding } = useFindings(selectedTopicId);
  const { digest } = useDigest(selectedTopicId);

  // ============================================
  // Event Handlers
  // ============================================

  const handleFindingClick = (finding: ResearchFinding) => {
    selectFinding(finding.id);
    openModal('findingDetail', finding);
  };

  const handleViewSources = () => {
    openSourceDrawer(); // No theme = show all sources
  };

  const handleViewFinding = (findingId: string) => {
    const finding = findings.find(f => f.id === findingId);
    if (finding) {
      selectFinding(finding.id);
      openModal('findingDetail', finding);
    }
  };

  // ============================================
  // Derived Data
  // ============================================

  const sourceDrawerFindings = findings;

  // ============================================
  // Render
  // ============================================

  return (
    <>
      {/* Main Content */}
      <ResearchContainer
        topicId={propTopicId}
        onFindingClick={handleFindingClick}
        onViewSources={handleViewSources}
        onViewFinding={handleViewFinding}
      />

      {/* Source Drawer */}
      <SourceDrawer
        isOpen={modals.sourceDrawer}
        onClose={closeSourceDrawer}
        findings={sourceDrawerFindings}
        featuredFindingId={digest?.featuredDiscovery?.findingId}
        digestFindingIds={digest?.topFindings?.map(f => f.findingId) || []}
      />

      {/* Finding Detail Drawer */}
      {selectedFinding && (
        <FindingDetailDrawer
          finding={selectedFinding as any}
          isOpen={modals.findingDetail}
          onClose={() => closeModal('findingDetail')}
        />
      )}

    </>
  );
}

// Default export for compatibility with lazy loading
export default ResearchPage;
