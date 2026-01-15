import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getDB } from '@/utils/db/database';
import { getTopic } from '@/utils/db/topics';
import { digestQueueService } from '@/services/digestQueue.service';
import { digestCacheService } from '@/services/digestCache.service';
import type {
  ResearchFinding,
  Topic,
  SmartDigest,
  DigestTimeframe,
  ExplanationMode,
  DigestQueueItem
} from '@/types';
import { DigestCard } from './DigestCard';
import { SourceDrawer } from './SourceDrawer';
import { FindingDetailDrawer } from './FindingDetailDrawer';
import DigestSettings from './DigestSettings';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ExportMenu } from './ExportMenu';
import {
  RefreshCw,
  Calendar,
  FileText,
  Brain,
  LayoutGrid,
  List,
  Loader2,
  AlertCircle,
  Settings,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Sparkles,
  AlertTriangle,
  Info,
  BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FindingsViewerProgressiveProps {
  topicId?: string;
}

// Component for showing digest generation progress
function DigestProgress({ queueItem }: { queueItem: DigestQueueItem }) {
  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'queued': return 'Waiting in queue';
      case 'fetching': return 'Gathering research findings';
      case 'analyzing': return 'Analyzing patterns and themes';
      case 'generating': return 'Creating intelligent insights';
      case 'validating': return 'Finalizing your digest';
      default: return 'Processing';
    }
  };

  const getIcon = () => {
    switch (queueItem.status) {
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          {getIcon()}
          <span className="text-sm font-medium">
            {queueItem.status === 'completed'
              ? 'Digest ready!'
              : queueItem.status === 'failed'
              ? 'Generation failed'
              : 'Generating new insights...'}
          </span>
          {queueItem.estimatedCompletionTime && queueItem.status === 'processing' && (
            <span className="text-xs text-muted-foreground ml-auto">
              Est. {Math.ceil((queueItem.estimatedCompletionTime - Date.now()) / 1000)}s
            </span>
          )}
        </div>

        {queueItem.progress && queueItem.status === 'processing' && (
          <>
            <Progress value={queueItem.progress.percentage} className="mb-2" />
            <p className="text-xs text-muted-foreground">
              {getStageLabel(queueItem.progress.stage)}
            </p>
          </>
        )}

        {queueItem.error && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {queueItem.error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function FindingsViewerProgressive({ topicId }: FindingsViewerProgressiveProps) {
  // Core state
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [visibleFindings, setVisibleFindings] = useState<ResearchFinding[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topicId || '');
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [digest, setDigest] = useState<SmartDigest | null>(null);
  const [cachedDigest, setCachedDigest] = useState<SmartDigest | null>(null);

  // Loading states (granular)
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [loadingDigest, setLoadingDigest] = useState(false);

  // Queue state
  const [queueItem, setQueueItem] = useState<DigestQueueItem | null>(null);
  const [digestGeneration, setDigestGeneration] = useState<{
    isGenerating: boolean;
    progress: number;
    message: string;
  }>({ isGenerating: false, progress: 0, message: '' });

  // UI state
  const [viewMode, setViewMode] = useState<'digest' | 'list'>('digest');
  const [digestTimeframe, setDigestTimeframe] = useState<DigestTimeframe>('weekly');
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>('simple');
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  const [selectedThemeName, setSelectedThemeName] = useState<string | undefined>();
  const [selectedFinding, setSelectedFinding] = useState<ResearchFinding | null>(null);
  const [showFindingDetail, setShowFindingDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Track manual refresh to prevent auto-refresh race condition
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  // Track if refresh button is disabled due to debounce
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination for findings
  const [findingsPage, setFindingsPage] = useState(1);
  const findingsPerPage = 20;

  // Refs for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load topics on mount
  useEffect(() => {
    loadTopics();
  }, []);

  // Progressive loading when topic changes
  useEffect(() => {
    if (selectedTopicId) {
      loadTopicDataProgressive(selectedTopicId);
    }
  }, [selectedTopicId, digestTimeframe]);

  // Listen for digest completion events
  useEffect(() => {
    const handleDigestCompleted = async (event: CustomEvent) => {
      const { queueItem: completedItem, digest: newDigest } = event.detail;
      if (completedItem.topicId === selectedTopicId) {
        setDigest(newDigest);
        setQueueItem(null);
        setDigestGeneration({ isGenerating: false, progress: 100, message: 'Complete!' });

        // Clear manual refresh flag after completion
        setIsManualRefresh(false);
        // Clear refreshing flag
        setIsRefreshing(false);

        // Save to cache
        await digestCacheService.saveDigest(newDigest);
      }
    };

    const handleDigestProgress = (event: CustomEvent) => {
      const { queueItem: updatedItem } = event.detail;
      if (updatedItem.topicId === selectedTopicId) {
        setQueueItem(updatedItem);
        if (updatedItem.progress) {
          setDigestGeneration({
            isGenerating: true,
            progress: updatedItem.progress.percentage,
            message: updatedItem.progress.message
          });
        }
      }
    };

    const handleDigestFailed = (event: CustomEvent) => {
      const { queueItem: failedItem } = event.detail;
      if (failedItem.topicId === selectedTopicId) {
        setQueueItem(failedItem);
        setDigestGeneration({ isGenerating: false, progress: 0, message: 'Failed' });
        // Clear manual refresh flag on failure
        setIsManualRefresh(false);
        // Clear refreshing flag
        setIsRefreshing(false);
      }
    };

    window.addEventListener('digest-completed', handleDigestCompleted as any);
    window.addEventListener('digest-progress', handleDigestProgress as any);
    window.addEventListener('digest-failed', handleDigestFailed as any);

    return () => {
      window.removeEventListener('digest-completed', handleDigestCompleted as any);
      window.removeEventListener('digest-progress', handleDigestProgress as any);
      window.removeEventListener('digest-failed', handleDigestFailed as any);
    };
  }, [selectedTopicId]);

  // Setup infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleFindings.length < findings.length) {
        loadMoreFindings();
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [visibleFindings, findings]);

  const loadTopics = async () => {
    try {
      setLoadingTopics(true);
      const db = await getDB();
      const allTopics = await db.getAll('topics');
      setTopics(allTopics);
      if (!selectedTopicId && allTopics.length > 0) {
        setSelectedTopicId(allTopics[0].id);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const loadTopicDataProgressive = async (topicId: string) => {
    try {
      // Step 1: Load topic info immediately
      const topic = await getTopic(topicId);
      if (!topic) {
        console.error('Topic not found:', topicId);
        return;
      }
      setCurrentTopic(topic);

      // Step 2: Load findings (fast)
      setLoadingFindings(true);
      const db = await getDB();
      const topicFindings = await db.getAllFromIndex('findings', 'by-topic', topicId);
      topicFindings.sort((a, b) => b.timestamp - a.timestamp);
      setFindings(topicFindings);

      // Load first page of findings
      setVisibleFindings(topicFindings.slice(0, findingsPerPage));
      setFindingsPage(1);
      setLoadingFindings(false);

      // Step 3: Check for cached digest using cache service
      setLoadingDigest(true);
      const { digest: cachedDigest, isStale } = await digestCacheService.getCachedDigest(
        topicId,
        digestTimeframe
      );

      if (cachedDigest) {
        setCachedDigest(cachedDigest);
        setDigest(cachedDigest);
        setLoadingDigest(false);

        // Check if we should refresh the digest (but skip if manual refresh is in progress)
        if (!isManualRefresh) {
          const shouldRefresh = await digestCacheService.shouldRefreshDigest(
            topicId,
            digestTimeframe,
            cachedDigest
          );

          if (shouldRefresh || isStale) {
            // Add small delay to prevent race condition with queue status
            await new Promise(resolve => setTimeout(resolve, 100));

            // Queue background refresh if stale or needs update
            const existingQueue = await digestQueueService.getQueueStatus(topicId);
            // Also check if we have a queueItem in state
            if (!existingQueue && !queueItem) {
              const newQueueItem = await digestQueueService.queueDigestGeneration(
                topicId,
                digestTimeframe,
                topicFindings.map(f => f.id),
                isStale ? 'high' : 'normal',
                'system'
              );
              setQueueItem(newQueueItem);
              setDigestGeneration({
                isGenerating: true,
                progress: 0,
                message: isStale ? 'Updating stale digest...' : 'Refreshing digest...'
              });
            }
          }
        }
      } else {
        setCachedDigest(null);
        setLoadingDigest(false);

        // Step 4: Queue digest generation in background (non-blocking)
        if (topicFindings.length > 0 && !isManualRefresh) {
          // Add small delay to prevent race condition
          await new Promise(resolve => setTimeout(resolve, 100));

          const existingQueue = await digestQueueService.getQueueStatus(topicId);
          // Also check if we have a queueItem in state
          if (!existingQueue && !queueItem) {
            const newQueueItem = await digestQueueService.queueDigestGeneration(
              topicId,
              digestTimeframe,
              topicFindings.map(f => f.id),
              'normal',
              'user'
            );
            setQueueItem(newQueueItem);
            setDigestGeneration({
              isGenerating: true,
              progress: 0,
              message: 'Queued for generation...'
            });
          } else if (existingQueue) {
            setQueueItem(existingQueue);
          }
        }
      }
    } catch (error) {
      console.error('Error loading topic data:', error);
      setLoadingFindings(false);
      setLoadingDigest(false);
    }
  };

  const loadMoreFindings = () => {
    const nextPage = findingsPage + 1;
    const startIndex = (nextPage - 1) * findingsPerPage;
    const endIndex = startIndex + findingsPerPage;
    const newVisibleFindings = findings.slice(0, endIndex);
    setVisibleFindings(newVisibleFindings);
    setFindingsPage(nextPage);
  };

  const handleRefreshDigest = async () => {
    if (!selectedTopicId || findings.length === 0) return;

    // Prevent rapid clicks with debouncing
    if (isRefreshing || digestGeneration.isGenerating) {
      console.log('Refresh already in progress, ignoring duplicate request');
      return;
    }

    // Set debounce flag
    setIsRefreshing(true);

    // Set manual refresh flag to prevent auto-refresh race condition
    setIsManualRefresh(true);

    try {
      // Cancel existing queue item if any
      if (queueItem) {
        await digestQueueService.cancelQueueItem(queueItem.id);
      }

      // Queue new generation with high priority
      const newQueueItem = await digestQueueService.queueDigestGeneration(
        selectedTopicId,
        digestTimeframe,
        findings.map(f => f.id),
        'high',
        'user'
      );

      setQueueItem(newQueueItem);
      setDigestGeneration({
        isGenerating: true,
        progress: 0,
        message: 'Priority generation started...'
      });

      // Clear debounce flag after 1 second to prevent rapid re-clicks
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Error refreshing digest:', error);
      setIsRefreshing(false);
      setIsManualRefresh(false);
    }
  };

  const handleTimeframeChange = async (newTimeframe: DigestTimeframe) => {
    setDigestTimeframe(newTimeframe);
    // This will trigger the useEffect to reload with new timeframe
  };

  const getFilteredFindings = (): ResearchFinding[] => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    switch (digestTimeframe) {
      case 'daily':
        return findings.filter(f => f.timestamp > now - day);
      case 'weekly':
        return findings.filter(f => f.timestamp > now - (7 * day));
      case 'monthly':
        return findings.filter(f => f.timestamp > now - (30 * day));
      default:
        return findings;
    }
  };

  const handleFindingClick = (finding: ResearchFinding) => {
    setSelectedFinding(finding);
    setShowFindingDetail(true);
  };

  const handleThemeClick = (themeId: string, themeName: string) => {
    setSelectedThemeId(themeId);
    setSelectedThemeName(themeName);
    setShowSourceDrawer(true);
  };

  // Render loading state
  if (loadingTopics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render no topics state
  if (topics.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <CardTitle className="mb-2">No Research Topics</CardTitle>
        <p className="text-muted-foreground">
          Add a research topic to start tracking medical findings.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Medical Information Disclaimer */}
      <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Medical Research Disclaimer</AlertTitle>
        <AlertDescription>
          This app aggregates publicly available medical research from verified sources.
          All information should be verified with healthcare providers. This is not medical advice.
          Always consult your healthcare team before making any medical decisions.
        </AlertDescription>
      </Alert>

      {/* Header with Topic Selector and Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="text-lg font-semibold bg-transparent border-b border-gray-200 focus:border-primary outline-none"
              >
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Export button */}
              {currentTopic && findings.length > 0 && (
                <ExportMenu
                  topic={currentTopic}
                  findings={findings}
                  digest={digest}
                  timeline={[]}
                />
              )}

              {/* Timeframe selector */}
              <select
                value={digestTimeframe}
                onChange={(e) => handleTimeframeChange(e.target.value as DigestTimeframe)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="daily">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
                <option value="all-time">All Time</option>
              </select>

              {/* View mode toggle */}
              <div className="flex gap-1 p-1 bg-muted rounded-md">
                <Button
                  size="sm"
                  variant={viewMode === 'digest' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('digest')}
                  className="px-2 py-1"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Digest
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('list')}
                  className="px-2 py-1"
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
              </div>

              {/* Refresh button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshDigest}
                disabled={digestGeneration.isGenerating || isRefreshing}
                title={isRefreshing ? 'Please wait...' : 'Refresh digest'}
              >
                <RefreshCw className={`h-4 w-4 ${digestGeneration.isGenerating || isRefreshing ? 'animate-spin' : ''}`} />
              </Button>

              {/* Settings button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {findings.length} findings
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {getFilteredFindings().length} in period
            </span>
            {digest && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Updated {formatDistanceToNow(digest.generatedAt)} ago
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Progress indicator for digest generation */}
      {queueItem && queueItem.status !== 'completed' && (
        <DigestProgress queueItem={queueItem} />
      )}

      {/* Main content area */}
      {loadingFindings ? (
        <Card className="p-12 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/20 animate-pulse"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Loading Research Findings</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                We're gathering the latest research data for your topic. This typically takes just a moment...
              </p>
            </div>
          </div>
        </Card>
      ) : findings.length === 0 ? (
        <Card className="p-12 bg-gradient-to-br from-gray-50/50 to-slate-50/50 dark:from-gray-950/20 dark:to-slate-950/20">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <FileText className="h-16 w-16 text-muted-foreground/50" />
              <AlertCircle className="h-6 w-6 text-amber-500 absolute -top-1 -right-1" />
            </div>
            <div className="text-center space-y-3 max-w-lg">
              <h3 className="text-xl font-semibold">No Research Findings Available</h3>
              <p className="text-muted-foreground">
                To see real medical research for this topic, you need to connect to verified research sources.
              </p>

              <div className="text-left bg-background/50 rounded-lg p-4 mt-6">
                <p className="text-sm font-medium mb-2">Active Data Sources:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• PubMed - 35+ million biomedical citations</li>
                  <li>• ClinicalTrials.gov - 450,000+ registered trials</li>
                  <li>• FDA announcements and approvals</li>
                  <li>• Peer-reviewed medical journals via web search</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  All data shown is from real, verified medical sources. No fabricated content.
                </p>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div>
          {viewMode === 'digest' ? (
            <div className="space-y-4">
              {digest ? (
                <>
                {/* Show if digest is stale */}
                {cachedDigest && digest.id === cachedDigest.id && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle>Cached Digest</AlertTitle>
                    <AlertDescription>
                      This digest was generated {formatDistanceToNow(digest.generatedAt)} ago.
                      {queueItem ? ' A fresh digest is being generated...' : ' Click refresh to generate a new one.'}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Show if using client-side digest */}
                {digest && digest.id.startsWith('digest_client_') && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle>Offline Mode</AlertTitle>
                    <AlertDescription>
                      Backend is unavailable. Showing basic digest generated locally.
                      AI-powered insights will be available when the backend is restored.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Digest content */}
                <DigestCard
                  digest={digest}
                  explanationMode={explanationMode}
                  setExplanationMode={setExplanationMode}
                  onThemeClick={(themeId) => handleThemeClick(themeId, '')}
                  onViewSources={() => setShowSourceDrawer(true)}
                />

                {/* Themes Removed - These were confusing AI-generated groupings */}
                {/* Will be replaced with better organization when we have real research data */}
              </>
            ) : queueItem && (queueItem.status === 'pending' || queueItem.status === 'processing') ? (
              <Card className="p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
                <CardTitle className="mb-2">Generating AI-Powered Insights</CardTitle>
                <p className="text-muted-foreground mb-4">
                  Analyzing {getFilteredFindings().length} findings to create your personalized digest...
                </p>
                <Progress value={queueItem.progress || 0} className="max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">{queueItem.progressMessage || 'Processing...'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This typically takes 30-90 seconds for thorough AI analysis
                </p>
              </Card>
            ) : !digest ? (
              <Card className="p-8 text-center">
                {digestGeneration.isGenerating ? (
                  <div className="space-y-4">
                    <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
                    <CardTitle className="mb-2">Processing...</CardTitle>
                    <Progress value={digestGeneration.progress} className="max-w-xs mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Brain className="h-16 w-16 mx-auto text-primary/30" />
                      <Info className="h-6 w-6 text-primary absolute -top-1 -right-1 animate-bounce" />
                    </div>
                    <div className="text-center space-y-2">
                      <CardTitle className="text-xl">Ready to Generate Insights</CardTitle>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Transform your {getFilteredFindings().length} research findings into an AI-powered digest with key themes, breakthroughs, and actionable insights.
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <Button onClick={handleRefreshDigest} size="lg" className="gap-2">
                        <Sparkles className="h-5 w-5" />
                        Generate AI Digest
                      </Button>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Takes 30-90 seconds • Uses advanced AI analysis
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            ) : null}
            </div>
          ) : (
            <div className="space-y-4">
            {visibleFindings.map((finding) => (
              <Card
                key={finding.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleFindingClick(finding)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base line-clamp-2">{finding.title}</CardTitle>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{finding.type}</span>
                    <span>•</span>
                    <span>{finding.source.displayName || 'Research Database'}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(finding.timestamp)} ago</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {finding.summary}
                  </p>
                </CardContent>
              </Card>
            ))}

            {/* Load more indicator */}
            {visibleFindings.length < findings.length && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Source Drawer */}
      <SourceDrawer
        isOpen={showSourceDrawer}
        onClose={() => setShowSourceDrawer(false)}
        findings={selectedThemeId
          ? findings.filter(f =>
              digest?.themes.find(t => t.id === selectedThemeId)?.findingIds.includes(f.id)
            )
          : findings  // Show ALL findings when no theme is selected (View All Sources)
        }
        selectedThemeId={selectedThemeId}
        themeName={selectedThemeName}
      />

      {/* Finding Detail Drawer */}
      {selectedFinding && (
        <FindingDetailDrawer
          finding={selectedFinding}
          isOpen={showFindingDetail}
          onClose={() => setShowFindingDetail(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DigestSettings
              topicId={selectedTopicId}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}