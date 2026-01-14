import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Database,
  TrendingUp,
  BookOpen,
  Calendar,
  Search,
  Clock,
  Activity,
  Lightbulb,
  AlertTriangle,
  Award
} from 'lucide-react';
import { researchInsightsService } from '@/services/researchInsights.service';
import type { ResearchFinding, SmartDigest, Topic } from '@/types';
import type {
  ResearchMetrics,
  DigestInsights,
  ResearchActivity
} from '@/services/researchInsights.service';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface ResearchInsightsDashboardProps {
  findings: ResearchFinding[];
  topics: Topic[];
  digests?: SmartDigest[];
  onGenerateDigest?: () => void;
  className?: string;
}

// Helper function to safely format dates
function safeFormatDistanceToNow(date: Date | string | number | undefined | null): string {
  if (!date) return 'recently';

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'recently';
    }
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.warn('Invalid date for formatting:', date);
    return 'recently';
  }
}

// Helper function to safely format dates
function safeFormatDate(date: Date | string | number | undefined | null, formatString: string): string {
  if (!date) return '';

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    return format(dateObj, formatString);
  } catch (error) {
    console.warn('Invalid date for formatting:', date);
    return '';
  }
}

export function ResearchInsightsDashboard({
  findings,
  topics,
  digests = [],
  onGenerateDigest,
  className
}: ResearchInsightsDashboardProps) {
  const [metrics, setMetrics] = useState<ResearchMetrics | null>(null);
  const [digestInsights, setDigestInsights] = useState<DigestInsights | null>(null);
  const [activity, setActivity] = useState<ResearchActivity | null>(null);

  useEffect(() => {
    // Calculate all research insights
    if (findings.length > 0) {
      try {
        const calculatedMetrics = researchInsightsService.calculateResearchMetrics(findings, topics);
        setMetrics(calculatedMetrics);

        const insights = researchInsightsService.extractDigestInsights(digests);
        setDigestInsights(insights);

        const researchActivity = researchInsightsService.getResearchActivity(findings);
        setActivity(researchActivity);
      } catch (error) {
        console.error('Error calculating research insights:', error);
        setMetrics(null);
        setDigestInsights(null);
        setActivity(null);
      }
    }
  }, [findings, topics, digests]);

  // Empty state
  if (!metrics || findings.length === 0) {
    return (
      <div className={cn("p-8", className)}>
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="mb-2 text-xl">No Research Data Yet</CardTitle>
            <p className="text-muted-foreground mb-6">
              Start collecting research findings to see insights about your research journey.
            </p>
            <p className="text-sm text-muted-foreground">
              Research Insights will show:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Where your information comes from</li>
              <li>• Your research progress over time</li>
              <li>• Key discoveries and patterns</li>
              <li>• Actual insights from AI analysis</li>
            </ul>
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
            <p className="text-xs text-muted-foreground">
              Across {metrics.totalTopics || 0} topic{metrics.totalTopics !== 1 ? 's' : ''}
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
            <p className="text-xs text-muted-foreground">
              Journals & databases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Research Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.findingsPerWeek.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Findings per week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Research Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.researchDuration.days}</div>
            <p className="text-xs text-muted-foreground">
              Days of research
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Summary</CardTitle>
              <CardDescription>
                Your research progress at a glance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Finding Types */}
              <div>
                <h3 className="text-sm font-medium mb-3">Finding Types</h3>
                <div className="space-y-2">
                  {metrics.findingsByType.map(type => (
                    <div key={type.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{type.type}</span>
                        <Badge variant="secondary" className="text-xs">
                          {type.count}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${type.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {type.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 className="text-sm font-medium mb-3">Activity Timeline</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{metrics.activityTimeline.thisWeek}</div>
                    <div className="text-xs text-muted-foreground">This Week</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{metrics.activityTimeline.lastWeek}</div>
                    <div className="text-xs text-muted-foreground">Last Week</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{metrics.activityTimeline.thisMonth}</div>
                    <div className="text-xs text-muted-foreground">This Month</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-semibold">{metrics.activityTimeline.older}</div>
                    <div className="text-xs text-muted-foreground">Older</div>
                  </div>
                </div>
              </div>

              {/* Most Productive Period */}
              {metrics.mostProductivePeriod && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Most Productive Period</h3>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {safeFormatDate(metrics.mostProductivePeriod.start, 'MMM d')} - {safeFormatDate(metrics.mostProductivePeriod.end, 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {metrics.mostProductivePeriod.count} findings collected
                        </div>
                      </div>
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Information Sources</CardTitle>
              <CardDescription>
                Where your research findings come from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.sourceDistribution.slice(0, 10).map((source, index) => (
                  <div key={source.source} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {source.findingTypes.length > 0 ? source.findingTypes[0] : 'research'}
                        </Badge>
                        <span className="text-sm font-medium">{source.source}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Last accessed {safeFormatDistanceToNow(source.lastAccessed)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{source.count}</div>
                      <div className="text-xs text-muted-foreground">
                        finding{source.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Smart Digest Insights</CardTitle>
              <CardDescription>
                AI-analyzed patterns and discoveries from your research
              </CardDescription>
            </CardHeader>
            <CardContent>
              {digestInsights?.latestDigest ? (
                <div className="space-y-6">
                  {/* Latest Digest Info */}
                  <div className="text-sm text-muted-foreground">
                    From digest generated {safeFormatDistanceToNow(digestInsights.latestDigest.createdAt)}
                  </div>

                  {/* Breakthroughs */}
                  {digestInsights.breakthroughs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Research Breakthroughs
                      </h3>
                      <div className="space-y-3">
                        {digestInsights.breakthroughs.map(breakthrough => (
                          <div key={breakthrough.id} className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-sm font-medium mb-1">{breakthrough.finding}</div>
                            <div className="text-xs text-muted-foreground">{breakthrough.significance}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge Gaps */}
                  {digestInsights.knowledgeGaps.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Search className="h-4 w-4 text-blue-500" />
                        Knowledge Gaps Identified
                      </h3>
                      <ul className="space-y-2">
                        {digestInsights.knowledgeGaps.map((gap, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contradictions */}
                  {digestInsights.contradictions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Contradictions Found
                      </h3>
                      <div className="space-y-3">
                        {digestInsights.contradictions.map(contradiction => (
                          <div key={contradiction.id} className="p-3 border-l-2 border-orange-500 bg-muted/20">
                            <div className="text-sm font-medium mb-2">{contradiction.topic}</div>
                            <div className="space-y-2">
                              <div className="text-xs">
                                <span className="font-medium">Claim A:</span> {contradiction.claimA}
                              </div>
                              <div className="text-xs">
                                <span className="font-medium">Claim B:</span> {contradiction.claimB}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground mb-4">
                    Generate a Smart Digest to discover patterns, gaps, and breakthroughs in your research
                  </div>
                  {onGenerateDigest && (
                    <Button onClick={onGenerateDigest} variant="outline">
                      Generate Digest
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Activity</CardTitle>
              <CardDescription>
                Recent research activity and agent performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recent Activity */}
              {activity && (
                <>
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Recent Findings (Last 7 Days)
                    </h3>
                    <div className="space-y-2">
                      {activity.recentFindings.map((day, index) => (
                        <div key={day.date} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <div className="text-sm">
                              {index === 0 ? 'Today' :
                               index === 1 ? 'Yesterday' :
                               safeFormatDate(new Date(day.date), 'EEEE, MMM d')}
                            </div>
                            {day.types.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {day.types.map(type => (
                                  <Badge key={type} variant="outline" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">{day.count}</div>
                            <div className="text-xs text-muted-foreground">
                              finding{day.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agent Activity */}
                  {activity.agentActivity.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Agent Activity
                      </h3>
                      <div className="space-y-2">
                        {activity.agentActivity.slice(0, 5).map((agent, index) => (
                          <div key={`${agent.agentName}-${index}`} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div>
                              <div className="text-sm font-medium">{agent.agentName}</div>
                              <div className="text-xs text-muted-foreground">
                                Last run {safeFormatDistanceToNow(agent.lastRun)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold">{agent.findingsGenerated}</div>
                              <div className="text-xs text-muted-foreground">
                                finding{agent.findingsGenerated !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}