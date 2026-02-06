/**
 * FindingCard - Pure UI component for displaying a single research finding
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a PURE UI component - it receives props only, no store access.
 * Finding data comes from the parent container via props.
 */

import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import type { ResearchFinding } from '@/types';
import { getSourceCategory } from '@/utils/sourceCategory';
import { SOURCE_CONFIG } from '@/components/digest/SourceIcon';

// ============================================
// Types
// ============================================

interface FindingCardProps {
  /** The research finding to display */
  finding: ResearchFinding;
  /** Callback when card is clicked */
  onClick: (finding: ResearchFinding) => void;
  /** Optional className for styling */
  className?: string;
}

// ============================================
// Component
// ============================================

export function FindingCard({ finding, onClick, className }: FindingCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${className || ''}`}
      onClick={() => onClick(finding)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-base line-clamp-2">{finding.title}</CardTitle>
        </div>
        <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
          <span>{SOURCE_CONFIG[getSourceCategory(finding.source?.type)].label}</span>
          <span>-</span>
          <span>{finding.source.displayName || 'Research Database'}</span>
          <span>-</span>
          <span>{formatDistanceToNow(finding.timestamp)} ago</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {finding.summary}
        </p>
      </CardContent>
    </Card>
  );
}
