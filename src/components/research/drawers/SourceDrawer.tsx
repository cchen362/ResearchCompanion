import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  ExternalLink,
  Calendar,
  Users,
  FileText,
  Filter,
  X,
  ChevronRight,
  Building2,
  Pill,
  AlertTriangle,
  BookOpen,
  Copy,
  Download,
  Star
} from 'lucide-react';
import type { ResearchFinding, ResearchSource } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface SourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  findings: ResearchFinding[];
  // Renamed: selectedThemeId → selectedDigestThemeId (DigestTheme, not UI theme)
  selectedDigestThemeId?: string;
  // Renamed: themeName → digestThemeName (DigestTheme title, not UI theme)
  digestThemeName?: string;
  /** ID of the featured finding in the digest */
  featuredFindingId?: string;
  /** IDs of findings referenced in the digest's topFindings */
  digestFindingIds?: string[];
}

export function SourceDrawer({
  isOpen,
  onClose,
  findings,
  selectedDigestThemeId,
  digestThemeName,
  featuredFindingId,
  digestFindingIds
}: SourceDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group findings by source
  const groupedBySource = findings.reduce((acc, finding) => {
    const sourceName = finding.source.name;
    if (!acc[sourceName]) {
      acc[sourceName] = [];
    }
    acc[sourceName].push(finding);
    return acc;
  }, {} as Record<string, ResearchFinding[]>);

  // Filter findings based on search and type
  const filteredFindings = findings.filter(finding => {
    const matchesSearch =
      !searchQuery ||
      finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.source.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'all' || finding.type === selectedType;

    return matchesSearch && matchesType;
  });

  // Sort findings
  const sortedFindings = [...filteredFindings].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return b.timestamp - a.timestamp;
      case 'type':
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  const toggleFinding = (findingId: string) => {
    setExpandedFindings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(findingId)) {
        newSet.delete(findingId);
      } else {
        newSet.add(findingId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (finding: ResearchFinding) => {
    const text = `${finding.title}\n\n${finding.summary}\n\nSource: ${finding.source.name} ${
      finding.source.url ? `(${finding.source.url})` : ''
    }`;
    await navigator.clipboard.writeText(text);
    setCopiedId(finding.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportFindings = () => {
    const content = sortedFindings
      .map(
        f =>
          `## ${f.title}\n\n${f.summary}\n\nSource: ${f.source.name}\n${
            f.source.url ? `URL: ${f.source.url}\n` : ''
          }\n---\n`
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-findings-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'treatment':
        return <Pill className="h-4 w-4" />;
      case 'trial':
        return <Building2 className="h-4 w-4" />;
      case 'study':
        return <BookOpen className="h-4 w-4" />;
      case 'guideline':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-600 bg-green-50 dark:bg-green-950';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      case 'low':
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950';
      default:
        return '';
    }
  };

  // Source type to border color mapping
  const getSourceBorderColor = (finding: ResearchFinding): string => {
    const type = finding.source?.type?.toLowerCase() || '';
    if (type.includes('pubmed') || type === 'journal' || type === 'research_paper') return 'border-l-4 border-l-blue-500';
    if (type.includes('clinical')) return 'border-l-4 border-l-green-500';
    if (type.includes('fda')) return 'border-l-4 border-l-purple-500';
    return 'border-l-4 border-l-gray-300';
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Research Sources
            {digestThemeName && (
              <span className="text-muted-foreground font-normal ml-2">
                for "{digestThemeName}"
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {sortedFindings.length} findings from {Object.keys(groupedBySource).length} sources
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="all">All Types</option>
                <option value="treatment">Treatments</option>
                <option value="trial">Clinical Trials</option>
                <option value="study">Studies</option>
                <option value="guideline">Guidelines</option>
                <option value="news">News</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="date">Sort by Date</option>
                <option value="type">Sort by Type</option>
              </select>

              <Button variant="outline" size="sm" onClick={exportFindings}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* View Tabs */}
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="grouped">Grouped by Source</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4 space-y-3">
              {sortedFindings.map(finding => {
                const isExpanded = expandedFindings.has(finding.id);

                return (
                  <Card key={finding.id} className={cn("overflow-hidden", getSourceBorderColor(finding))}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getTypeIcon(finding.type)}
                              <Badge variant="outline" className="text-xs">
                                {finding.type}
                              </Badge>
                              {finding.isNew && (
                                <Badge variant="default" className="text-xs">
                                  New
                                </Badge>
                              )}
                              {finding.isContradictory && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflicting
                                </Badge>
                              )}
                              {featuredFindingId === finding.id && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Featured
                                </Badge>
                              )}
                              {digestFindingIds?.includes(finding.id) && featuredFindingId !== finding.id && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  In Digest
                                </Badge>
                              )}
                            </div>
                            <h3
                              className="font-semibold text-sm cursor-pointer hover:text-primary"
                              onClick={() => toggleFinding(finding.id)}
                            >
                              {finding.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(finding)}
                            >
                              {copiedId === finding.id ? (
                                <span className="text-xs text-green-600">Copied!</span>
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFinding(finding.id)}
                            >
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  isExpanded && 'rotate-90'
                                )}
                              />
                            </Button>
                          </div>
                        </div>

                        {/* Summary */}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {finding.summary}
                        </p>

                        {/* Metadata */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {finding.source.displayName || 'Research Database'}
                          </div>
                          {finding.publishedAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(finding.publishedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="pt-3 border-t space-y-3">
                            {(() => {
                              // Try structured details from metadata first
                              const rawStructured = (finding as any).structuredDetails;
                              if (rawStructured) {
                                try {
                                  const parsed = typeof rawStructured === 'string'
                                    ? JSON.parse(rawStructured) : rawStructured;
                                  if (parsed && (parsed.keyFinding || parsed.method || parsed.implications)) {
                                    return (
                                      <div className="space-y-2">
                                        {parsed.keyFinding && (
                                          <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Finding</h4>
                                            <p className="text-sm">{parsed.keyFinding}</p>
                                          </div>
                                        )}
                                        {parsed.method && (
                                          <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Method</h4>
                                            <p className="text-sm">{parsed.method}</p>
                                          </div>
                                        )}
                                        {parsed.implications && (
                                          <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why It Matters</h4>
                                            <p className="text-sm">{parsed.implications}</p>
                                          </div>
                                        )}
                                        {parsed.source && (
                                          <p className="text-xs text-muted-foreground italic">{parsed.source}</p>
                                        )}
                                      </div>
                                    );
                                  }
                                } catch { /* Not JSON — fall through */ }
                              }
                              // Fallback: raw text for old findings
                              if (finding.details) {
                                return (
                                  <div>
                                    <h4 className="text-sm font-medium mb-1">Full Details</h4>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                      {finding.details.replace(/[#*`_]/g, '').trim()}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {finding.extractedEntities && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">Key Information</h4>
                                <div className="flex flex-wrap gap-2">
                                  {finding.extractedEntities.medications?.map((med, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      <Pill className="h-3 w-3 mr-1" />
                                      {med}
                                    </Badge>
                                  ))}
                                  {finding.extractedEntities.institutions?.map((inst, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {inst}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {finding.source.url && (
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {finding.source.authors?.join(', ')}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(finding.source.url, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View Source
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {sortedFindings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No findings match your filters.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="grouped" className="mt-4 space-y-4">
              {Object.entries(groupedBySource).map(([sourceName, sourceFindings]) => (
                <Card key={sourceName}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {sourceName}
                        </h3>
                        <Badge variant="outline">{sourceFindings.length} findings</Badge>
                      </div>
                      <div className="space-y-2">
                        {sourceFindings.map(finding => (
                          <div
                            key={finding.id}
                            className="p-2 bg-muted/50 rounded-md cursor-pointer hover:bg-muted/70"
                            onClick={() => toggleFinding(finding.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium line-clamp-1">
                                  {finding.title}
                                </p>
                                {finding.summary && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {finding.summary}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {finding.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(finding.timestamp, {
                                      addSuffix: true
                                    })}
                                  </span>
                                </div>
                              </div>
                              {finding.source.url && (
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}