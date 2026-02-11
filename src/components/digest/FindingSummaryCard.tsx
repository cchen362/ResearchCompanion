import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SourceIcon } from './SourceIcon';
import { ChevronRight } from 'lucide-react';
import type { NotableFinding, TopFinding, ExplanationMode } from '@/types';

interface FindingSummaryCardProps {
  finding: NotableFinding | TopFinding;
  mode: ExplanationMode;
  onViewSource?: (findingId: string) => void;
}

export function FindingSummaryCard({ finding, mode, onViewSource }: FindingSummaryCardProps) {
  const content = mode === 'technical' ? finding.technical : finding.explained;
  const isNew = 'isNew' in finding && finding.isNew;

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onViewSource?.(finding.findingId)}
    >
      <div className="flex items-start gap-3">
        <SourceIcon type={finding.sourceType} size="md" className="flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm leading-tight">
              {content.title}
            </h4>
            {isNew && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-green-600">
                NEW
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            {content.summary}
          </p>
          <p className="text-xs text-muted-foreground">
            {finding.metadata}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 self-center" />
      </div>
    </Card>
  );
}
