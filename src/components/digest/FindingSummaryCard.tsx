import React from 'react';
import { Card } from '@/components/ui/card';
import { SourceIcon } from './SourceIcon';
import type { TopFinding, ExplanationMode } from '@/types';

interface FindingSummaryCardProps {
  finding: TopFinding;
  mode: ExplanationMode;
  onViewSource?: (findingId: string) => void;
}

export function FindingSummaryCard({ finding, mode, onViewSource }: FindingSummaryCardProps) {
  const content = mode === 'technical' ? finding.technical : finding.explained;

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onViewSource?.(finding.findingId)}
    >
      <div className="flex items-start gap-3">
        <SourceIcon type={finding.sourceType} size="md" className="flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-tight mb-1">
            {content.title}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            {content.summary}
          </p>
          <p className="text-xs text-muted-foreground">
            {finding.metadata}
          </p>
        </div>
      </div>
    </Card>
  );
}
