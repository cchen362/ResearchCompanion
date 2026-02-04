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
import DigestSettings from '@/components/DigestSettings';

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
    sourceDrawerContext,
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

  const handleSettingsClick = () => {
    openModal('digestSettings');
  };

  const handleViewSources = () => {
    openSourceDrawer(); // No theme = show all sources
  };

  const handleThemeClick = (themeId: string, themeName: string) => {
    openSourceDrawer(themeId, themeName);
  };

  // ============================================
  // Derived Data
  // ============================================

  // Filter findings for source drawer based on selected theme
  const sourceDrawerFindings = sourceDrawerContext.digestThemeId
    ? findings.filter(f =>
        digest?.themes?.find(t => t.id === sourceDrawerContext.digestThemeId)?.findingIds.includes(f.id)
      )
    : findings;

  // ============================================
  // Render
  // ============================================

  return (
    <>
      {/* Main Content */}
      <ResearchContainer
        topicId={propTopicId}
        onFindingClick={handleFindingClick}
        onSettingsClick={handleSettingsClick}
        onViewSources={handleViewSources}
        onThemeClick={handleThemeClick}
      />

      {/* Source Drawer */}
      <SourceDrawer
        isOpen={modals.sourceDrawer}
        onClose={closeSourceDrawer}
        findings={sourceDrawerFindings}
        selectedDigestThemeId={sourceDrawerContext.digestThemeId || undefined}
        digestThemeName={sourceDrawerContext.digestThemeName || undefined}
      />

      {/* Finding Detail Drawer */}
      {selectedFinding && (
        <FindingDetailDrawer
          finding={selectedFinding as any}
          isOpen={modals.findingDetail}
          onClose={() => closeModal('findingDetail')}
        />
      )}

      {/* Settings Modal */}
      {modals.digestSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DigestSettings
              topicId={selectedTopicId || ''}
              onClose={() => closeModal('digestSettings')}
            />
          </div>
        </div>
      )}
    </>
  );
}

// Default export for compatibility with lazy loading
export default ResearchPage;
