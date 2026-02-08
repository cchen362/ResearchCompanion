/**
 * FindingsEmpty - Pure UI component for empty findings state
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a PURE UI component - it receives props only, no store access.
 * State information comes from the parent container via props.
 */

import { Card } from '@/components/ui/card';
import { FileText, AlertCircle } from 'lucide-react';

// ============================================
// Types
// ============================================

interface FindingsEmptyProps {
  /** Whether a topic is currently selected */
  hasTopicSelected: boolean;
  /** Optional callback to run research agents */
  onRunAgents?: () => void;
  /** Optional className for styling */
  className?: string;
}

// ============================================
// Component
// ============================================

export function FindingsEmpty({
  hasTopicSelected,
  onRunAgents,
  className
}: FindingsEmptyProps) {
  if (!hasTopicSelected) {
    return (
      <Card className={`p-12 bg-gradient-to-br from-[var(--color-surface-sunken)] to-[var(--color-surface)] ${className || ''}`}>
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <FileText className="h-16 w-16 text-[var(--color-text-muted)]/50" />
          </div>
          <div className="text-center space-y-3 max-w-lg">
            <h3 className="text-xl font-semibold">Select a Topic</h3>
            <p className="text-[var(--color-text-muted)]">
              Choose a medical topic to view research findings.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-12 bg-gradient-to-br from-[var(--color-surface-sunken)] to-[var(--color-surface)] ${className || ''}`}>
      <div className="flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <FileText className="h-16 w-16 text-[var(--color-text-muted)]/50" />
          <AlertCircle className="h-6 w-6 text-amber-500 absolute -top-1 -right-1" />
        </div>
        <div className="text-center space-y-3 max-w-lg">
          <h3 className="text-xl font-semibold">No Research Findings Available</h3>
          <p className="text-[var(--color-text-muted)]">
            To see real medical research for this topic, you need to run research agents.
          </p>
        </div>
      </div>
    </Card>
  );
}
