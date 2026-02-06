import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Star, Lightbulb, ExternalLink } from 'lucide-react';
import { SourceIcon } from './SourceIcon';
import type { FeaturedDiscovery as FeaturedDiscoveryType, ExplanationMode } from '@/types';

interface FeaturedDiscoveryProps {
  discovery: FeaturedDiscoveryType;
  mode: ExplanationMode;
  onViewSource?: (findingId: string) => void;
}

export function FeaturedDiscovery({ discovery, mode, onViewSource }: FeaturedDiscoveryProps) {
  const content = mode === 'technical' ? discovery.technical : discovery.explained;
  const { sourceMetadata } = discovery;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span className="font-semibold uppercase tracking-wide">Featured Discovery</span>
        </div>
        <div className="flex items-center gap-2">
          <SourceIcon type={discovery.sourceType} showLabel />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pull Quote */}
        <blockquote className="relative pl-4 border-l-4 border-primary/40 py-2">
          <p className="text-lg font-medium leading-relaxed italic">
            "{content.quote}"
          </p>
        </blockquote>

        {/* Why This Matters */}
        <div>
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
            Why This Matters for You
          </h4>
          <p className="text-sm leading-relaxed">
            {content.whyItMatters}
          </p>
        </div>

        {/* Action Item */}
        {content.actionItem && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                  Action Item
                </span>
                <p className="text-sm text-amber-900 dark:text-amber-100 mt-1">
                  {content.actionItem}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Source Attribution */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <span>Source: {sourceMetadata.name}</span>
          {sourceMetadata.date && <span> &bull; {sourceMetadata.date}</span>}
          {sourceMetadata.studyType && <span> &bull; {sourceMetadata.studyType}</span>}
          {onViewSource && (
            <button
              onClick={() => onViewSource(discovery.findingId)}
              className="ml-2 text-primary hover:underline"
            >
              View original &rarr;
            </button>
          )}
          {sourceMetadata.url && (
            <a
              href={sourceMetadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
