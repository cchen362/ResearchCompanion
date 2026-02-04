/**
 * DigestProgress - Pure UI component for digest generation progress
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a PURE UI component - it receives props only, no store access.
 * Progress state comes from the parent container via props.
 */

import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import type { DigestQueueItem } from '@/types';

// ============================================
// Types
// ============================================

interface DigestProgressProps {
  /** Queue item with status, stage, progress, and error info */
  queueItem?: DigestQueueItem;
  /** Simple progress percentage (0-100) when not using queue */
  progress?: number;
  /** Simple message when not using queue */
  message?: string;
  /** Whether generation is in progress */
  isGenerating?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function getStageLabel(stage: string): string {
  switch (stage) {
    case 'queued':
      return 'Waiting in queue';
    case 'fetching':
      return 'Gathering research findings';
    case 'analyzing':
      return 'Analyzing patterns and themes';
    case 'generating':
      return 'Creating intelligent insights';
    case 'validating':
      return 'Finalizing your digest';
    default:
      return 'Processing';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

// ============================================
// Component
// ============================================

export function DigestProgress({
  queueItem,
  progress = 0,
  message = '',
  isGenerating = false
}: DigestProgressProps) {
  // If we have a queue item, use its detailed progress
  if (queueItem) {
    return (
      <Card className="mb-4 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            {getStatusIcon(queueItem.status)}
            <span className="text-sm font-medium">
              {queueItem.status === 'completed'
                ? 'Digest ready!'
                : queueItem.status === 'failed'
                ? 'Generation failed'
                : 'Generating new insights...'}
            </span>
            {queueItem.estimatedCompletionTime && queueItem.status === 'processing' && (
              <span className="text-xs text-muted-foreground ml-auto">
                Est. {Math.ceil((queueItem.estimatedCompletionTime - Date.now()) / 1000)}s
              </span>
            )}
          </div>

          {queueItem.progress && queueItem.status === 'processing' && (
            <>
              <Progress value={queueItem.progress.percentage} className="mb-2" />
              <p className="text-xs text-muted-foreground">
                {getStageLabel(queueItem.progress.stage)}
              </p>
            </>
          )}

          {queueItem.error && (
            <Alert className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {queueItem.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // Simple progress display for non-queue generation
  if (!isGenerating && progress === 0) {
    return null;
  }

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">
            Generating new insights...
          </span>
        </div>
        <Progress value={progress} className="mb-2" />
        <p className="text-xs text-muted-foreground">
          {message || 'Processing...'}
        </p>
      </CardContent>
    </Card>
  );
}
