import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Database,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Calendar,
  BarChart3,
  Target,
  Search,
  Clock,
  Award,
  Users
} from 'lucide-react';
import { researchInsightsService } from '@/services/researchInsights.service';
import type { ResearchFinding, SmartDigest } from '@/types';
import type {
  ResearchMetrics,
  SourceCredibility,
  ResearchPattern,
  ResearchProgress
} from '@/services/researchInsights.service';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface ResearchInsightsDashboardProps {
  findings: ResearchFinding[];
  digests?: SmartDigest[];
  className?: string;
}

export function ResearchInsightsDashboard({
  findings,
  digests = [],
  className
}: ResearchInsightsDashboardProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [metrics, setMetrics] = useState<ResearchMetrics | null>(null);
  const [sourceCredibility, setSourceCredibility] = useState<SourceCredibility[]>([]);
  const [patterns, setPatterns] = useState<ResearchPattern[]>([]);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);

  useEffect(() => {
    // Calculate all research insights
    if (findings.length > 0) {
      try {
        const calculatedMetrics = researchInsightsService.calculateResearchMetrics(findings, digests);
        setMetrics(calculatedMetrics);

        const credibility = researchInsightsService.analyzeSourceCredibility(findings);
        setSourceCredibility(credibility);

        const researchPatterns = researchInsightsService.identifyResearchPatterns(findings, digests);
        setPatterns(researchPatterns);

        const researchProgress = researchInsightsService.trackResearchProgress(findings);
        setProgress(researchProgress);
      } catch (error) {
        console.error('Error calculating research insights:', error);
        // Set default empty states if there's an error
        setMetrics(null);
        setSourceCredibility([]);
        setPatterns([]);
        setProgress(null);
      }
    }
  }, [findings, digests]);

  if (!metrics || findings.length === 0) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <Card>
          <CardContent className="pt-6">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="mb-2">No Research Data Yet</CardTitle>
            <p className="text-muted-foreground">
              Start collecting research findings to see insights and patterns.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {metrics.topicsExplored.length} topics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Unique Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.uniqueSources}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Journals & databases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Critical Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.criticalFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              High priority: {metrics.highPriorityFindings}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Research Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress?.findingsPerWeek || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Findings per week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="discoveries">Discoveries</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research by Category</CardTitle>
              <CardDescription>Distribution of findings across different categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.findingsByCategory.slice(0, 5).map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{cat.category}</span>
                      <span className="text-muted-foreground">
                        {cat.count} findings ({cat.percentage}%)
                      </span>
                    </div>
                    <Progress value={cat.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Priority Breakdown</CardTitle>
              <CardDescription>Distribution of findings by priority level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {metrics.findingsByPriority.map((priority) => (
                  <div key={priority.priority} className="text-center">
                    <div className={cn(
                      "text-2xl font-bold",
                      priority.priority === 'critical' && "text-red-600",
                      priority.priority === 'high' && "text-orange-500",
                      priority.priority === 'medium' && "text-yellow-500",
                      priority.priority === 'low' && "text-gray-500"
                    )}>
                      {priority.count}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize mt-1">
                      {priority.priority}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Research Timeline */}
          {metrics.researchVelocity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Research Activity Over Time</CardTitle>
                <CardDescription>Monthly breakdown of research findings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.researchVelocity.slice(-6).map((month) => (
                    <div key={month.date} className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(new Date(month.date + '-01'), 'MMM yyyy')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{month.count} findings</Badge>
                        {month.categories.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {month.categories.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          {/* Top Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Most Referenced Sources</CardTitle>
              <CardDescription>Your primary research databases and journals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.sourceDistribution.slice(0, 8).map((source, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{source.source}</span>
                      <Badge variant="outline" className="text-xs">
                        {source.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{source.count} findings</span>
                      <span>•</span>
                      <span>Last: {formatDistanceToNow(source.mostRecent, { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Source Credibility Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Credibility Analysis</CardTitle>
              <CardDescription>Quality metrics for your research sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sourceCredibility.slice(0, 5).map((source, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{source.sourceName}</span>
                      <Badge variant={source.journalType === 'peer-reviewed' ? 'default' : 'secondary'}>
                        {source.journalType}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>Studies: {source.totalFindings}</span>
                      {source.averageStudySize && (
                        <span>Avg size: {source.averageStudySize}</span>
                      )}
                      {source.publicationYears.length > 0 && (
                        <span>Years: {Math.min(...source.publicationYears)}-{Math.max(...source.publicationYears)}</span>
                      )}
                    </div>
                    {source.studyTypes.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {source.studyTypes.map(type => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discoveries" className="space-y-4">
          {/* Knowledge Gaps */}
          {metrics.knowledgeGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Knowledge Gaps Identified</CardTitle>
                <CardDescription>Areas requiring further research</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.knowledgeGaps.map((gap, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-orange-500 mt-0.5" />
                      <p className="text-sm">{gap}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Breakthroughs from Digests */}
          {digests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Research Breakthroughs</CardTitle>
                <CardDescription>Significant discoveries from your research</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {digests.flatMap(d => d.breakthroughs || []).slice(0, 5).map((breakthrough, idx) => (
                    <div key={idx} className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Award className="h-4 w-4 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{breakthrough.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {breakthrough.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          {/* Research Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research Patterns Detected</CardTitle>
              <CardDescription>Trends and patterns in your research activity</CardDescription>
            </CardHeader>
            <CardContent>
              {patterns.length > 0 ? (
                <div className="space-y-3">
                  {patterns.map((pattern, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Badge variant="outline" className="mb-2">
                            {pattern.type.replace(/_/g, ' ')}
                          </Badge>
                          <p className="text-sm font-medium">{pattern.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{pattern.findingCount} findings</span>
                            {pattern.sources.length > 0 && (
                              <span>{pattern.sources.length} sources</span>
                            )}
                            <span>
                              {formatDistanceToNow(pattern.firstSeen, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No patterns detected yet. Continue researching to identify trends.</p>
              )}
            </CardContent>
          </Card>

          {/* Research Progress */}
          {progress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Research Progress Summary</CardTitle>
                <CardDescription>Your research journey over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Research Duration</p>
                      <p className="text-lg font-semibold">{progress.totalDays} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Average Velocity</p>
                      <p className="text-lg font-semibold">{progress.findingsPerWeek} per week</p>
                    </div>
                  </div>

                  {progress.mostProductivePeriod.findingsCount > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <p className="text-sm font-medium mb-1">Most Productive Period</p>
                      <p className="text-xs text-muted-foreground">
                        {format(progress.mostProductivePeriod.start, 'MMM d')} - {format(progress.mostProductivePeriod.end, 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs mt-1">
                        <strong>{progress.mostProductivePeriod.findingsCount}</strong> findings collected
                      </p>
                    </div>
                  )}

                  {progress.researchPhases.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Research Phases</p>
                      <div className="space-y-2">
                        {progress.researchPhases.map((phase, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {phase.phase}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {phase.findingsCount} findings
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(phase.startDate, 'MMM d, yyyy')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}