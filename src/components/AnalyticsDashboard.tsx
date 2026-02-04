import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  AlertTriangle,
  Lightbulb,
  Calendar,
  ChevronRight,
  BarChart3,
  Brain,
  Link2,
  Clock
} from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import type { ResearchFinding, SmartDigest } from '@/types';
import type {
  SymptomCorrelation,
  TreatmentEffectiveness,
  PatternAnalysis,
  ResearchInsight
} from '@/services/analytics.service';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AnalyticsDashboardProps {
  findings: ResearchFinding[];
  digest?: SmartDigest;
  className?: string;
}

export function AnalyticsDashboard({
  findings,
  digest,
  className
}: AnalyticsDashboardProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [analytics, setAnalytics] = useState<{
    correlations: SymptomCorrelation[];
    effectiveness: TreatmentEffectiveness[];
    patterns: PatternAnalysis;
    insights: ResearchInsight[];
  } | null>(null);

  useEffect(() => {
    // Generate analytics when data changes
    if (findings.length > 0) {
      const summary = analyticsService.generateAnalyticsSummary(findings, digest);
      setAnalytics(summary);
    }
  }, [findings, digest]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    if (!analytics) return null;

    const totalCorrelations = analytics.correlations.length;
    const strongCorrelations = analytics.correlations.filter(c => Math.abs(c.correlation) >= 0.6).length;
    const avgEffectiveness = analytics.effectiveness.length > 0
      ? analytics.effectiveness.reduce((sum, e) => sum + e.overallEffectiveness, 0) / analytics.effectiveness.length
      : 0;
    const breakthroughCount = analytics.insights.filter(i => i.type === 'breakthrough').length;

    return {
      totalCorrelations,
      strongCorrelations,
      avgEffectiveness,
      breakthroughCount,
      patternCount: analytics.patterns.patterns.length,
      insightCount: analytics.insights.length
    };
  }, [analytics]);

  if (!analytics || !metrics) {
    return (
      <div className={cn("p-6 text-center text-muted-foreground", className)}>
        <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No analytics data available yet.</p>
        <p className="text-sm mt-1">Add research findings to see patterns and insights.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Correlations Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCorrelations}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.strongCorrelations} strong
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Treatment Effect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.avgEffectiveness)}%</div>
            <Progress value={metrics.avgEffectiveness} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Patterns Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.patternCount}</div>
            <p className="text-xs text-muted-foreground">
              In your research
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Research Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.insightCount}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.breakthroughCount} breakthroughs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="correlations">Correlations</TabsTrigger>
          <TabsTrigger value="effectiveness">Treatments</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Pattern Analysis
              </CardTitle>
              <CardDescription>
                Identified patterns in your research findings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.patterns.patterns.map((pattern, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className={cn(
                    "p-2 rounded-full",
                    pattern.type === 'cyclical' ? "bg-blue-100 text-blue-600" :
                    pattern.type === 'progressive' ?
                      (pattern.trend === 'improving' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600") :
                    "bg-gray-100 text-gray-600"
                  )}>
                    {pattern.type === 'cyclical' ? <Clock className="h-4 w-4" /> :
                     pattern.trend === 'improving' ? <TrendingUp className="h-4 w-4" /> :
                     pattern.trend === 'worsening' ? <TrendingDown className="h-4 w-4" /> :
                     <Activity className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{pattern.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {pattern.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(pattern.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {analytics.patterns.patterns.length === 0 && (
                <p className="text-sm text-muted-foreground">No patterns detected yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Symptom Clusters */}
          {analytics.patterns.clusters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Symptom Clusters
                </CardTitle>
                <CardDescription>
                  Symptoms that frequently occur together
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.patterns.clusters.map((cluster, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex gap-2">
                        {cluster.symptoms.map((symptom, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {symptom}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {cluster.occurrenceCount} occurrences
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Correlations Tab */}
        <TabsContent value="correlations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Symptom Correlations</CardTitle>
              <CardDescription>
                Relationships between different symptoms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.correlations.length > 0 ? (
                <div className="space-y-3">
                  {analytics.correlations.slice(0, 10).map((correlation, index) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{correlation.symptom1}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">{correlation.symptom2}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge
                              variant={correlation.correlation > 0 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {correlation.correlation > 0 ? 'Positive' : 'Negative'} correlation
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {correlation.temporalRelation === 'concurrent' ? 'Occur together' :
                               correlation.temporalRelation === 'sequential' ? `~${Math.round(correlation.averageDaysBetween!)} days apart` :
                               'Independent timing'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {Math.abs(correlation.correlation).toFixed(2)}
                          </div>
                          <Progress
                            value={correlation.confidence * 100}
                            className="w-20 h-1 mt-1"
                          />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(correlation.confidence * 100)}% conf.
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No correlations found. Add more symptom events to detect patterns.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatment Effectiveness Tab */}
        <TabsContent value="effectiveness" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Treatment Effectiveness</CardTitle>
              <CardDescription>
                Analysis of treatment outcomes based on your research
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.effectiveness.length > 0 ? (
                <div className="space-y-4">
                  {analytics.effectiveness.map((treatment, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{treatment.treatmentName}</h4>
                          <p className="text-sm text-muted-foreground">
                            Started {format(treatment.startDate, 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {Math.round(treatment.overallEffectiveness)}%
                          </div>
                          <p className="text-xs text-muted-foreground">effectiveness</p>
                        </div>
                      </div>

                      <Progress
                        value={treatment.overallEffectiveness}
                        className="mb-3"
                      />

                      {/* Symptom Changes */}
                      {treatment.symptomChanges.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Symptom Changes:</p>
                          {treatment.symptomChanges.map((change, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{change.symptom}</span>
                              <div className="flex items-center gap-2">
                                {change.improvement > 0 ? (
                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-red-600" />
                                )}
                                <span className={cn(
                                  "font-medium",
                                  change.improvement > 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {Math.round(change.improvement)}% {change.improvement > 0 ? 'improved' : 'worsened'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Side Effects */}
                      {treatment.sideEffects.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium mb-1">Potential Side Effects:</p>
                          <div className="flex gap-2 flex-wrap">
                            {treatment.sideEffects.map((effect, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {effect}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Breakthroughs */}
                      {treatment.breakthroughs.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium mb-1">Associated Breakthroughs:</p>
                          {treatment.breakthroughs.map((breakthrough, i) => (
                            <div key={i} className="flex items-start gap-2 mt-1">
                              <Lightbulb className="h-3 w-3 text-yellow-600 mt-0.5" />
                              <span className="text-xs">{breakthrough.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No treatment data available. Add treatment events to track effectiveness.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Research Insights Tab */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Insights</CardTitle>
              <CardDescription>
                Key insights from your research findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.insights.length > 0 ? (
                <div className="space-y-3">
                  {analytics.insights.map((insight, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-full",
                          insight.type === 'breakthrough' ? "bg-yellow-100 text-yellow-600" :
                          insight.type === 'contradiction' ? "bg-red-100 text-red-600" :
                          insight.type === 'confirmation' ? "bg-green-100 text-green-600" :
                          "bg-blue-100 text-blue-600"
                        )}>
                          {insight.type === 'breakthrough' ? <Lightbulb className="h-4 w-4" /> :
                           insight.type === 'contradiction' ? <AlertTriangle className="h-4 w-4" /> :
                           insight.type === 'confirmation' ? <Target className="h-4 w-4" /> :
                           <BarChart3 className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm">{insight.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {insight.description}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(insight.confidence * 100)}% conf.
                            </Badge>
                          </div>
                          {insight.temporalContext && (
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {format(insight.temporalContext.when, 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                          {insight.relatedFindings.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Based on {insight.relatedFindings.length} finding{insight.relatedFindings.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No insights generated yet. Add more data to discover patterns.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}