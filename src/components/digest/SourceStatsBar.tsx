import React from 'react';
import { Card } from '@/components/ui/card';
import { SourceIcon, SOURCE_CONFIG } from './SourceIcon';
import type { SourceBreakdown } from '@/types';

interface SourceStatsBarProps {
  breakdown: SourceBreakdown;
  totalFindings: number;
  className?: string;
}

export function SourceStatsBar({ breakdown, totalFindings, className = '' }: SourceStatsBarProps) {
  const stats = [
    { type: 'pubmed' as const, count: breakdown.pubmed },
    { type: 'clinical_trial' as const, count: breakdown.clinicalTrials },
    { type: 'fda' as const, count: breakdown.fda },
    { type: 'web' as const, count: breakdown.web },
  ].filter(stat => stat.count > 0); // Only show sources that have findings

  return (
    <Card className={`p-4 ${className}`}>
      <p className="text-sm text-center text-muted-foreground mb-3">
        {totalFindings} findings analyzed
      </p>
      <div className="flex justify-center gap-4 flex-wrap">
        {stats.map(({ type, count }) => (
          <div
            key={type}
            className="flex flex-col items-center p-3 rounded-lg bg-[var(--color-surface-sunken)] min-w-[80px]"
          >
            <SourceIcon type={type} size="md" />
            <span className="text-lg font-bold mt-1">{count}</span>
            <span className="text-xs text-muted-foreground">{SOURCE_CONFIG[type].label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
