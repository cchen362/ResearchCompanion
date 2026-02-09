/**
 * DigestActions - Container component for digest action buttons
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 * Plan 019: Consolidated from 3 buttons to 1 (Regenerate Digest) with tooltip
 *
 * This is a PRESENTATIONAL component - receives callbacks via props.
 */

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

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
  /** Callback to generate/regenerate digest */
  onGenerate: () => void;
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

  // Show regenerate button with tooltip when digest exists
  if (hasDigest) {
    return (
      <div className="flex justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onGenerate}
                disabled={isGenerating}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
                {isGenerating ? 'Regenerating...' : 'Regenerate Digest'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-center">
              Re-analyzes your existing findings with AI.
              New research is fetched automatically by the scheduler.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return null;
}
