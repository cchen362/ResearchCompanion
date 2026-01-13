import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Clock,
  FileText,
  BookOpen,
  Brain,
  HelpCircle,
  Info
} from 'lucide-react';
import type { SmartDigest, DigestTimeframe, ExplanationMode } from '../types';
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface DigestCardProps {
  digest: SmartDigest;
  onThemeClick: (themeId: string) => void;
  onViewSources: () => void;
  onAskQuestion?: (question: string) => void;
  explanationMode: ExplanationMode;
  setExplanationMode: (mode: ExplanationMode) => void;
}

export function DigestCard({
  digest,
  onThemeClick,
  onViewSources,
  onAskQuestion,
  explanationMode,
  setExplanationMode
}: DigestCardProps) {
  // Initialize with saved preferences or default to showing takeaways
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('digestExpandedSections');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Set(parsed);
      } catch {
        // If parse fails, use default
        return new Set(['takeaways']);
      }
    }
    // Default: auto-expand takeaways
    return new Set(['takeaways']);
  });

  // Save preferences whenever they change
  useEffect(() => {
    localStorage.setItem('digestExpandedSections', JSON.stringify(Array.from(expandedSections)));
  }, [expandedSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getTimeframeLabel = (timeframe: DigestTimeframe) => {
    switch (timeframe) {
      case 'daily':
        return 'Today\'s Research';
      case 'weekly':
        return 'This Week\'s Research';
      case 'monthly':
        return 'This Month\'s Research';
      case 'all-time':
        return 'All Research';
      default:
        return 'Research Digest';
    }
  };

  const getImportanceBadgeColor = (importance: string) => {
    switch (importance) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'treatment':
        return '💊';
      case 'mechanism':
        return '🧬';
      case 'trial':
        return '🔬';
      case 'outcome':
        return '📊';
      case 'diagnostic':
        return '🔍';
      case 'prevention':
        return '🛡️';
      default:
        return '📝';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card with Executive Summary */}
      <Card className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">
                  {getTimeframeLabel(digest.timeframe)}
                </CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {digest.statistics.totalFindings} findings
                </Badge>
                {digest.statistics.newFindings > 0 && (
                  <Badge variant="default">
                    {digest.statistics.newFindings} new
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Generated {formatDistanceToNow(digest.generatedAt, { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExplanationMode(
                  explanationMode === 'detailed' ? 'simple' : 'detailed'
                )}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                {explanationMode === 'detailed' ? 'Simple' : 'Detailed'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Executive Summary */}
            <div className="p-4 bg-background/50 rounded-lg border">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Key Insight
              </h3>
              <p className="text-sm leading-relaxed">
                {explanationMode === 'simple' && digest.laymanSummary
                  ? digest.laymanSummary
                  : digest.executiveSummary}
              </p>
            </div>

            {/* Statistics Bar - Only show meaningful metrics */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-background/50 rounded cursor-help">
                      <div className="text-2xl font-bold text-primary">
                        {digest.statistics.totalFindings}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Findings</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total number of research findings collected for this topic</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-background/50 rounded cursor-help">
                      <div className="text-2xl font-bold">
                        {digest.statistics.sourceCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Unique Sources</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of different journals, databases, and research sources</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Takeaways */}
      {digest.keyTakeaways.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => toggleSection('takeaways')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Key Takeaways
              </CardTitle>
              {expandedSections.has('takeaways') ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
          {expandedSections.has('takeaways') && (
            <CardContent>
              <ul className="space-y-2">
                {digest.keyTakeaways.map((takeaway, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm">{takeaway}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Breakthroughs */}
      {digest.breakthroughs && digest.breakthroughs.length > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Breakthroughs & Advances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {digest.breakthroughs.map(breakthrough => (
                <div
                  key={breakthrough.id}
                  className="p-3 bg-background/80 rounded-lg border"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-sm">{breakthrough.title}</h4>
                    <Badge
                      variant={
                        breakthrough.impact === 'paradigm-shift'
                          ? 'destructive'
                          : breakthrough.impact === 'major'
                          ? 'default'
                          : 'secondary'
                      }
                      className="ml-2"
                    >
                      {breakthrough.impact.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {breakthrough.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Source: {breakthrough.source}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contradictions/Conflicts */}
      {digest.contradictions && digest.contradictions.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Conflicting Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {digest.contradictions.map(contradiction => (
                <div
                  key={contradiction.id}
                  className="p-3 bg-background/80 rounded-lg border"
                >
                  <h4 className="font-semibold text-sm mb-2">
                    {contradiction.topic}
                  </h4>
                  <div className="space-y-2">
                    <div className="pl-3 border-l-2 border-red-300">
                      <p className="text-sm">{contradiction.findingA.claim}</p>
                      <p className="text-xs text-muted-foreground">
                        — {contradiction.findingA.source}
                      </p>
                    </div>
                    <div className="pl-3 border-l-2 border-blue-300">
                      <p className="text-sm">{contradiction.findingB.claim}</p>
                      <p className="text-xs text-muted-foreground">
                        — {contradiction.findingB.source}
                      </p>
                    </div>
                  </div>
                  {contradiction.explanation && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Note: {contradiction.explanation}
                    </p>
                  )}
                  {contradiction.requiresAttention && (
                    <Badge variant="outline" className="mt-2">
                      Requires Discussion
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Research Trends Removed - These were misleading AI-generated placeholders */}
      {/* Will be replaced with real temporal analysis when we have actual historical data */}

      {/* View All Sources Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={onViewSources}
          className="w-full sm:w-auto"
        >
          <FileText className="h-4 w-4 mr-2" />
          View All {digest.statistics.sourceCount} Sources
        </Button>
      </div>
    </div>
  );
}