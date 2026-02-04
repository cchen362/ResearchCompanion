/**
 * DigestActions - Container component for digest action buttons
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a CONTAINER component - it connects to Zustand stores.
 * Uses useDigest() hook for generation actions.
 */

import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface DigestActionsProps {
  /** Whether digest can be generated (has findings) */
  canGenerate: boolean;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Whether a digest already exists */
  hasDigest: boolean;
  /** Callback to generate digest */
  onGenerate: () => void;
  /** Callback to refresh research and digest */
  onRefresh: () => void;
  /** Count of findings for display */
  findingsCount?: number;
}

// ============================================
// Component
// ============================================

export function DigestActions({
  canGenerate,
  isGenerating,
  hasDigest,
  onGenerate,
  onRefresh,
  findingsCount = 0
}: DigestActionsProps) {
  // Show generate button when no digest exists
  if (!hasDigest && !isGenerating) {
    return (
      <div className="flex justify-center">
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          size="lg"
          className="gap-2"
        >
          <Sparkles className="h-5 w-5" />
          Generate Digest
          {findingsCount > 0 && (
            <span className="text-xs opacity-80">({findingsCount} findings)</span>
          )}
        </Button>
      </div>
    );
  }

  // Show refresh button when digest exists
  if (hasDigest) {
    return (
      <div className="flex justify-center gap-2">
        <Button
          onClick={onRefresh}
          disabled={isGenerating}
          variant="outline"
          size="sm"
          className="gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Updating...' : 'Update Research'}
        </Button>
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          variant="outline"
          size="sm"
          className="gap-1"
        >
          <Sparkles className="h-4 w-4" />
          Regenerate
        </Button>
      </div>
    );
  }

  return null;
}
