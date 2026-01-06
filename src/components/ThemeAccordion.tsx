import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  TrendingUp,
  Shield,
  AlertTriangle,
  Info,
  ExternalLink,
  Pill,
  Building2,
  Users
} from 'lucide-react';
import type { DigestTheme, ResearchFinding } from '../types';
import { cn } from '../lib/utils';

interface ThemeAccordionProps {
  themes: DigestTheme[];
  findings: ResearchFinding[];
  onThemeExpand: (themeId: string) => void;
  onFindingClick: (findingId: string) => void;
  onViewSources: (themeId: string) => void;
  explanationMode: 'detailed' | 'simple';
}

export function ThemeAccordion({
  themes,
  findings,
  onThemeExpand,
  onFindingClick,
  onViewSources,
  explanationMode
}: ThemeAccordionProps) {
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  const toggleTheme = (themeId: string) => {
    setExpandedThemes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(themeId)) {
        newSet.delete(themeId);
      } else {
        newSet.add(themeId);
        onThemeExpand(themeId);
      }
      return newSet;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'treatment':
        return <Pill className="h-4 w-4" />;
      case 'mechanism':
        return <Info className="h-4 w-4" />;
      case 'trial':
        return <Building2 className="h-4 w-4" />;
      case 'outcome':
        return <TrendingUp className="h-4 w-4" />;
      case 'diagnostic':
        return <Shield className="h-4 w-4" />;
      case 'prevention':
        return <Shield className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getImportanceStyles = (importance: string) => {
    switch (importance) {
      case 'critical':
        return {
          border: 'border-red-500/50 border-l-4',
          bg: 'bg-red-50/50 dark:bg-red-950/20',
          badge: 'destructive' as const
        };
      case 'high':
        return {
          border: 'border-orange-500/50 border-l-4',
          bg: 'bg-orange-50/50 dark:bg-orange-950/20',
          badge: 'default' as const
        };
      case 'medium':
        return {
          border: 'border-blue-500/50 border-l-4',
          bg: 'bg-blue-50/50 dark:bg-blue-950/20',
          badge: 'secondary' as const
        };
      case 'low':
        return {
          border: 'border-gray-300 border-l-2',
          bg: '',
          badge: 'outline' as const
        };
      default:
        return {
          border: '',
          bg: '',
          badge: 'secondary' as const
        };
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[confidence as keyof typeof colors] || colors.medium;
  };

  const getFindingsByTheme = (themeId: string): ResearchFinding[] => {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return [];
    return findings.filter(f => theme.findingIds.includes(f.id));
  };

  const sortedThemes = [...themes].sort((a, b) => {
    const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (
      importanceOrder[a.importance as keyof typeof importanceOrder] -
      importanceOrder[b.importance as keyof typeof importanceOrder]
    );
  });

  return (
    <div className="space-y-3">
      {sortedThemes.map(theme => {
        const isExpanded = expandedThemes.has(theme.id);
        const styles = getImportanceStyles(theme.importance);
        const themeFindings = getFindingsByTheme(theme.id);

        return (
          <Card
            key={theme.id}
            className={cn(
              'transition-all duration-200',
              styles.border,
              styles.bg,
              hoveredTheme === theme.id && 'shadow-md'
            )}
            onMouseEnter={() => setHoveredTheme(theme.id)}
            onMouseLeave={() => setHoveredTheme(null)}
          >
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleTheme(theme.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getCategoryIcon(theme.category)}
                      <h3 className="font-semibold text-base">{theme.title}</h3>
                      <Badge variant={styles.badge} className="ml-2">
                        {theme.importance}
                      </Badge>
                      <Badge variant="outline" className="ml-1">
                        {theme.findingCount} findings
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {theme.summary}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Relevance:</span>
                        <span className="text-xs font-medium">
                          {Math.round(theme.avgRelevance * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Confidence:</span>
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            getConfidenceBadge(theme.avgConfidence)
                          )}
                        >
                          {theme.avgConfidence}
                        </span>
                      </div>
                    </div>
                    {theme.entities && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {theme.entities.medications?.slice(0, 3).map((med, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <Pill className="h-3 w-3 mr-1" />
                            {med}
                          </Badge>
                        ))}
                        {theme.entities.institutions?.slice(0, 2).map((inst, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {inst}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Related Findings
                  </h4>
                  <div className="space-y-2">
                    {themeFindings.slice(0, 3).map(finding => (
                      <div
                        key={finding.id}
                        className="p-3 bg-background/60 rounded-lg border cursor-pointer hover:bg-background/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFindingClick(finding.id);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {finding.type}
                              </Badge>
                              {finding.isNew && (
                                <Badge variant="default" className="text-xs">
                                  New
                                </Badge>
                              )}
                              {finding.isContradictory && (
                                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                            <h5 className="font-medium text-sm mb-1 line-clamp-1">
                              {finding.title}
                            </h5>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {explanationMode === 'simple' && finding.summary
                                ? finding.summary.split('.')[0] + '.'
                                : finding.summary}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-muted-foreground">
                                {finding.source.name}
                              </span>
                              {finding.source.publishDate && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(finding.source.publishDate).toLocaleDateString()}
                                </span>
                              )}
                              {finding.source.url && (
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {themeFindings.length > 3 && (
                    <div className="mt-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSources(theme.id);
                        }}
                      >
                        View all {themeFindings.length} findings in this theme
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {themes.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No research themes available yet.</p>
            <p className="text-xs mt-1">
              Themes will appear once findings are analyzed.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}