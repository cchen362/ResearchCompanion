import React, { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Button } from './ui/button';
import {
  FileText,
  ExternalLink,
  Calendar,
  Star,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react';
import { useResearchStore } from '../stores/researchStore';
import { logger } from '@/utils/logger';
import type { Finding, SourceCitation } from '../types';
import { format } from 'date-fns';

interface CitationLinkProps {
  citation: SourceCitation;
  onClose?: () => void;
  className?: string;
}

export function CitationLink({ citation, onClose, className = '' }: CitationLinkProps) {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const { loadFindingById } = useResearchStore();

  // Load the finding data
  useEffect(() => {
    const loadFinding = async () => {
      setIsLoading(true);
      try {
        const data = await loadFindingById(citation.findingId);
        setFinding(data);
      } catch (error) {
        logger.error('Failed to load finding:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFinding();
  }, [citation.findingId, loadFindingById]);

  if (isLoading) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs text-muted-foreground">Loading citation...</span>
      </div>
    );
  }

  if (!finding) {
    return (
      <Badge variant="outline" className={className}>
        [{citation.citationNumber}]
      </Badge>
    );
  }

  return (
    <>
      {/* Citation badge/link */}
      <Badge
        variant="outline"
        className={`cursor-pointer hover:bg-accent ${className}`}
        onClick={() => setIsExpanded(true)}
      >
        [{citation.citationNumber}]
      </Badge>

      {/* Expanded citation modal/popover */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Citation [{citation.citationNumber}]</h3>
                  <p className="text-sm text-muted-foreground">Research Finding</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              {finding.title && (
                <div>
                  <h4 className="text-lg font-semibold">{finding.title}</h4>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(finding.foundDate), 'MMM dd, yyyy')}
                </Badge>

                {/* relevanceScore display removed - deprecated metric */}

                <Badge variant="outline">
                  {finding.agentType.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Source */}
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{finding.source.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {finding.source.type} • {finding.source.authors?.join(', ')}
                    </p>
                    {finding.source.url && (
                      <a
                        href={finding.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        View original source
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Content with highlight */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">
                  {citation.highlightStart !== undefined && citation.highlightEnd !== undefined ? (
                    <>
                      {finding.content.substring(0, 200)}
                      <mark className="bg-yellow-200 dark:bg-yellow-800 px-1">
                        {finding.content.substring(citation.highlightStart, citation.highlightEnd)}
                      </mark>
                      {finding.content.substring(citation.highlightEnd, citation.highlightEnd + 200)}
                      {finding.content.length > citation.highlightEnd + 200 && '...'}
                    </>
                  ) : (
                    finding.content
                  )}
                </div>
              </div>

              {/* Key insights */}
              {finding.keyInsights && finding.keyInsights.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Key Insights</h5>
                  <ul className="space-y-1">
                    {finding.keyInsights.map((insight, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clinical relevance */}
              {finding.clinicalRelevance && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <h5 className="font-medium mb-1 text-blue-900 dark:text-blue-100">
                    Clinical Relevance
                  </h5>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {finding.clinicalRelevance}
                  </p>
                </div>
              )}

              {/* Limitations */}
              {finding.limitations && finding.limitations.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                  <h5 className="font-medium mb-1 text-orange-900 dark:text-orange-100">
                    Limitations
                  </h5>
                  <ul className="list-disc pl-5 space-y-1">
                    {finding.limitations.map((limitation, index) => (
                      <li key={index} className="text-sm text-orange-800 dark:text-orange-200">
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Citation text: "{citation.citationText}"
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Open finding in main viewer
                    window.location.hash = `#finding/${finding.id}`;
                    setIsExpanded(false);
                  }}
                >
                  View Full Finding
                  <ExternalLink className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// Inline citation component for use in message text
export function InlineCitation({
  number,
  findingId,
  onClick
}: {
  number: number;
  findingId: string;
  onClick?: (findingId: string) => void;
}) {
  return (
    <sup
      className="cursor-pointer text-primary hover:underline px-1"
      onClick={() => onClick?.(findingId)}
      title="Click to view citation"
    >
      [{number}]
    </sup>
  );
}

// Citation renderer for parsing and rendering citations in text
export function renderTextWithCitations(
  text: string,
  citations: SourceCitation[],
  onCitationClick?: (findingId: string) => void
): React.ReactNode {
  if (!citations || citations.length === 0) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Sort citations by their position in text
  const sortedCitations = [...citations].sort((a, b) =>
    (a.highlightStart || 0) - (b.highlightStart || 0)
  );

  sortedCitations.forEach((citation, index) => {
    // Add text before citation
    if (citation.highlightStart && citation.highlightStart > lastIndex) {
      parts.push(text.substring(lastIndex, citation.highlightStart));
    }

    // Add citation link
    parts.push(
      <InlineCitation
        key={`citation-${index}`}
        number={citation.citationNumber || index + 1}
        findingId={citation.findingId}
        onClick={onCitationClick}
      />
    );

    lastIndex = citation.highlightEnd || citation.highlightStart || lastIndex;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}