import { useState, useEffect, useCallback } from 'react';
import { digestQueueService } from '@/services/digestQueue.service';
import { topicsService } from '@/services/topics.service';
import { findingsService } from '@/services/findings.service';
import { digestService } from '@/services/digest.service';
import type { ResearchFinding, Topic, SmartDigest, DigestTimeframe, ExplanationMode } from '@/types';
import { DigestCard } from './DigestCard';
import { ThemeAccordion } from './ThemeAccordion';
import { SourceDrawer } from './SourceDrawer';
import { FindingDetailDrawer } from './FindingDetailDrawer';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import {
  RefreshCw,
  Calendar,
  FileText,
  Brain,
  LayoutGrid,
  List,
  Loader2,
  AlertCircle,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FindingsViewerEnhancedProps {
  topicId?: string;
}

export default function FindingsViewerEnhanced({ topicId }: FindingsViewerEnhancedProps) {
  // State management
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topicId || '');
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [digest, setDigest] = useState<SmartDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingDigest, setGeneratingDigest] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState<'digest' | 'list'>('digest');
  const [digestTimeframe, setDigestTimeframe] = useState<DigestTimeframe>('weekly');
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>('simple');
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  const [selectedThemeName, setSelectedThemeName] = useState<string | undefined>();
  const [selectedFinding, setSelectedFinding] = useState<ResearchFinding | null>(null);
  const [showFindingDetail, setShowFindingDetail] = useState(false);

  // Load topics on mount
  useEffect(() => {
    loadTopics();
  }, []);

  // Load findings and digest when topic changes
  useEffect(() => {
    if (selectedTopicId) {
      loadTopicData(selectedTopicId);
    }
  }, [selectedTopicId]);

  // Listen for digest completion events
  useEffect(() => {
    const handleDigestCompleted = (event: CustomEvent) => {
      console.log('[DIGEST EVENT] Digest completed event received:', event.detail);

      // If the completed digest is for our current topic, update the UI
      if (event.detail?.topicId === selectedTopicId) {
        const completedDigest = event.detail.digest;
        if (completedDigest) {
          setDigest(completedDigest);
          setGeneratingDigest(false);
          console.log('[DIGEST EVENT] Updated UI with completed digest');
        }
      }
    };

    // Listen for the digest-completed event
    window.addEventListener('digest-completed' as any, handleDigestCompleted);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('digest-completed' as any, handleDigestCompleted);
    };
  }, [selectedTopicId]);

  const loadTopics = async () => {
    try {
      const allTopics = await topicsService.getTopics();
      setTopics(allTopics);
      if (!selectedTopicId && allTopics.length > 0) {
        setSelectedTopicId(allTopics[0].id);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadTopicData = async (topicId: string) => {
    try {
      setLoading(true);

      // Load topic, findings, and digest in parallel for faster loading
      const [topic, topicFindings, existingDigest] = await Promise.all([
        topicsService.getTopic(topicId),
        findingsService.getFindings(topicId),
        digestService.getDigest(topicId, digestTimeframe).catch(() => undefined) // Don't fail if digest not found
      ]);

      if (topic) {
        setCurrentTopic(topic);

        // Sort and set findings
        topicFindings.sort((a, b) => b.timestamp - a.timestamp);
        setFindings(topicFindings);

        // If we got a digest from parallel fetch, use it immediately
        if (existingDigest) {
          console.log('[DIGEST PARALLEL] Found digest in parallel fetch:', {
            id: existingDigest.id,
            timeframe: existingDigest.timeframe
          });

          const maxAge = getMaxDigestAge(digestTimeframe);
          const isRecent = (Date.now() - existingDigest.generatedAt) < maxAge;

          if (isRecent) {
            console.log('[DIGEST PARALLEL] Using existing digest from parallel load');
            setDigest(existingDigest);
          } else {
            // Digest is too old, generate new one
            console.log('[DIGEST PARALLEL] Digest from parallel load is too old, generating new');
            if (topicFindings.length > 0) {
              await generateNewDigest(topicFindings, topic);
            }
          }
        } else {
          // No digest found, generate if we have data
          console.log('[DIGEST PARALLEL] No digest found in parallel load');
          if (topicFindings.length > 0) {
            await generateNewDigest(topicFindings, topic);
          }
        }
      }
    } catch (error) {
      console.error('Error loading topic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrGenerateDigest = async (
    topicId: string,
    topicFindings: ResearchFinding[],
    topic: Topic | null
  ) => {
    if (!topic || topicFindings.length === 0) {
      console.log('[DIGEST CHECK] No topic or findings, skipping digest');
      setDigest(null);
      return;
    }

    try {
      console.log('[DIGEST CHECK] Loading existing digest for topic:', topicId, 'timeframe:', digestTimeframe);

      // First, try to fetch the latest digest from the server with the current timeframe
      // This will use GET /api/digests/latest/:topicId?timeframe=X which is efficient
      const existingDigest = await digestService.getDigest(topicId, digestTimeframe);

      if (existingDigest) {
        console.log('[DIGEST CHECK] Found existing digest:', {
          id: existingDigest.id,
          timeframe: existingDigest.timeframe,
          generatedAt: new Date(existingDigest.generatedAt).toISOString(),
          age: Math.round((Date.now() - existingDigest.generatedAt) / (1000 * 60 * 60)) + ' hours ago'
        });

        // Check if this digest matches our desired timeframe
        // For now, accept any digest since backend doesn't store timeframe yet
        // TODO: Once backend stores timeframe, filter by it
        const maxAge = getMaxDigestAge(digestTimeframe);
        const isRecent = (Date.now() - existingDigest.generatedAt) < maxAge;

        console.log('[DIGEST CHECK] Is recent?', isRecent, {
          maxAge: Math.round(maxAge / (1000 * 60 * 60)) + ' hours',
          digestAge: Math.round((Date.now() - existingDigest.generatedAt) / (1000 * 60 * 60)) + ' hours'
        });

        if (isRecent) {
          console.log('[DIGEST CHECK] Using existing digest from server, not generating new');
          setDigest(existingDigest);
          return; // Exit early - we have what we need
        } else {
          console.log('[DIGEST CHECK] Digest too old, will generate new');
        }
      } else {
        console.log('[DIGEST CHECK] No existing digest found on server');
      }

      // Only generate new digest if we don't have a recent one
      console.log('[DIGEST CHECK] Generating new digest...');
      await generateNewDigest(topicFindings, topic);

    } catch (error) {
      console.error('[DIGEST CHECK] Error loading digest:', error);
      // If loading fails, try to generate a new one as fallback
      try {
        await generateNewDigest(topicFindings, topic);
      } catch (genError) {
        console.error('[DIGEST CHECK] Error generating digest:', genError);
        setDigest(null);
      }
    }
  };

  const getMaxDigestAge = (timeframe: DigestTimeframe): number => {
    switch (timeframe) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'all-time':
        return Infinity;
      default:
        return 24 * 60 * 60 * 1000;
    }
  };

  const generateNewDigest = async (
    topicFindings: ResearchFinding[] = findings,
    topic: Topic | null = currentTopic
  ) => {
    if (!topic || topicFindings.length === 0) {
      console.log('[DIGEST GEN] No topic or findings, skipping generation');
      return;
    }

    try {
      console.log('[DIGEST GEN] Starting new digest generation for topic:', topic.name);
      setGeneratingDigest(true);

      // Filter findings based on timeframe
      const filteredFindings = filterFindingsByTimeframe(topicFindings, digestTimeframe);
      console.log('[DIGEST GEN] Filtered findings:', {
        total: topicFindings.length,
        filtered: filteredFindings.length,
        timeframe: digestTimeframe
      });

      if (filteredFindings.length === 0) {
        console.log('[DIGEST GEN] No findings after filtering, cancelling');
        setDigest(null);
        return;
      }

      // Use digestQueueService to generate digest with proper auth
      const findingIds = filteredFindings.map(f => f.id);
      console.log('[DIGEST GEN] Queueing digest with finding IDs:', findingIds.length);

      const queueId = await digestQueueService.queueDigestGeneration(
        topicId || '',
        digestTimeframe,
        findingIds,
        'high',
        'user'
      );

      console.log('[DIGEST GEN] Digest queued with ID:', queueId);

      // Wait for digest to be generated with timeout protection
      const startTime = Date.now();
      const timeout = 30000; // 30 second timeout
      let intervalId: NodeJS.Timeout;

      const checkStatus = async () => {
        try {
          const status = await digestQueueService.getQueueStatus(queueId);

          if (status?.status === 'completed' && status.digest) {
            setDigest(status.digest);
            clearInterval(intervalId);
            return;
          } else if (status?.status === 'failed') {
            clearInterval(intervalId);
            throw new Error('Failed to generate digest');
          }

          // Check if timeout exceeded
          if (Date.now() - startTime > timeout) {
            clearInterval(intervalId);
            console.log('[DIGEST GEN] Timeout exceeded, checking server for existing digest');

            // Try one more time to fetch from server
            const existingDigest = await digestService.getDigest(topicId || '', digestTimeframe);
            if (existingDigest) {
              setDigest(existingDigest);
            } else {
              throw new Error('Digest generation timed out');
            }
          }
        } catch (error) {
          clearInterval(intervalId);
          throw error;
        }
      };

      // Check status every second
      intervalId = setInterval(checkStatus, 1000);
      await checkStatus(); // First check immediately
    } catch (error) {
      console.error('Error generating digest:', error);
      // Fallback: Create a basic digest locally
      createLocalDigest(topicFindings, topic);
    } finally {
      setGeneratingDigest(false);
    }
  };

  const filterFindingsByTimeframe = (
    findings: ResearchFinding[],
    timeframe: DigestTimeframe
  ): ResearchFinding[] => {
    if (timeframe === 'all-time') return findings;

    const now = Date.now();
    const cutoff = now - getMaxDigestAge(timeframe);

    return findings.filter(f => f.timestamp >= cutoff);
  };

  const createLocalDigest = (topicFindings: ResearchFinding[], topic: Topic) => {
    // Create a basic digest locally when API is unavailable
    const themes = groupFindingsIntoThemes(topicFindings);

    const digest: SmartDigest = {
      id: `local-digest-${Date.now()}`,
      topicId: topic.id,
      generatedAt: Date.now(),
      timeframe: digestTimeframe,
      executiveSummary: `Found ${topicFindings.length} research findings across ${themes.length} key themes for ${topic.diseaseProfile.name}.`,
      laymanSummary: `We found ${topicFindings.length} pieces of research about ${topic.diseaseProfile.name}. The findings cover ${themes.length} main areas of research.`,
      themes,
      keyTakeaways: extractKeyTakeaways(topicFindings),
      trends: {
        emerging: [],
        declining: [],
        stable: []
      },
      statistics: {
        totalFindings: topicFindings.length,
        newFindings: topicFindings.filter(f => f.isNew).length,
        highPriorityCount: topicFindings.filter(f => f.priority === 'high' || f.priority === 'critical').length,
        sourceCount: calculateUniqueStudies(topicFindings),
        journalCount: topicFindings.filter(f => f.source.type === 'journal' || f.source.type === 'pubmed').length
      },
      topSources: extractTopSources(topicFindings),
      allFindingIds: topicFindings.map(f => f.id)
    };

    setDigest(digest);
  };

  const groupFindingsIntoThemes = (findings: ResearchFinding[]) => {
    // Simple grouping by type for local fallback
    const typeGroups = findings.reduce((acc, finding) => {
      const type = finding.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(finding);
      return acc;
    }, {} as Record<string, ResearchFinding[]>);

    return Object.entries(typeGroups).map(([type, groupFindings]) => ({
      id: `theme-${type}`,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Research`,
      summary: `${groupFindings.length} findings related to ${type}`,
      category: type as any,
      importance: (groupFindings.length > 5 ? 'high' : 'medium') as 'high' | 'medium',
      findingIds: groupFindings.map(f => f.id),
      findingCount: groupFindings.length
    }));
  };


  const extractKeyTakeaways = (findings: ResearchFinding[]) => {
    // Generate more meaningful takeaways from the findings
    const takeaways: string[] = [];

    // Sort by date and priority, get top findings
    const topFindings = findings
      .sort((a, b) => {
        // First sort by priority if available
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority || 'medium'];
        const bPriority = priorityOrder[b.priority || 'medium'];
        if (aPriority !== bPriority) return bPriority - aPriority;
        // Then by timestamp (newer first)
        return b.timestamp - a.timestamp;
      })
      .slice(0, 7);

    topFindings.forEach(f => {
      // Try to extract meaningful information from the finding
      if (f.summary) {
        // Use summary if available
        takeaways.push(f.summary.substring(0, 150));
      } else if (f.snippet) {
        // Use snippet as fallback
        takeaways.push(f.snippet.substring(0, 150));
      } else {
        // Last resort: use title with source info
        takeaways.push(`${f.title} (${f.source.displayName || f.source.name})`);
      }
    });

    return takeaways.slice(0, 5);
  };

  const calculateUniqueStudies = (findings: ResearchFinding[]) => {
    const uniqueStudies = new Set<string>();
    findings.forEach(f => {
      // Try to extract unique identifiers from metadata
      if (f.metadata?.doi) {
        uniqueStudies.add(`doi:${f.metadata.doi}`);
      } else if (f.metadata?.pubmedId) {
        uniqueStudies.add(`pmid:${f.metadata.pubmedId}`);
      } else if (f.metadata?.studyId) {
        uniqueStudies.add(`study:${f.metadata.studyId}`);
      } else if (f.metadata?.trialId) {
        uniqueStudies.add(`trial:${f.metadata.trialId}`);
      } else {
        // Fallback: use URL or title+source as unique identifier
        uniqueStudies.add(f.url || `${f.source.displayName || f.source.name}:${f.title.substring(0, 30)}`);
      }
    });
    return uniqueStudies.size;
  };


  const extractTopSources = (findings: ResearchFinding[]) => {
    const sourceMap = new Map<string, any>();

    findings.forEach(f => {
      const source = f.source.displayName || f.source.name;
      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          name: source,
          type: f.source.type,
          findingCount: 0,
          avgCredibility: 0,
          topContributions: []
        });
      }
      const entry = sourceMap.get(source);
      entry.findingCount++;
    });

    return Array.from(sourceMap.values())
      .sort((a, b) => b.findingCount - a.findingCount)
      .slice(0, 5);
  };

  const handleThemeExpand = (themeId: string) => {
    // Track theme expansion in digest
    if (digest) {
      const updatedDigest = {
        ...digest,
        userEngagement: {
          ...digest.userEngagement,
          viewed: true,
          viewedAt: digest.userEngagement?.viewedAt || Date.now(),
          expandedThemes: [
            ...(digest.userEngagement?.expandedThemes || []),
            themeId
          ]
        }
      };
      setDigest(updatedDigest);
      // Optionally save to database
      saveDigestEngagement(updatedDigest);
    }
  };

  const saveDigestEngagement = async (digest: SmartDigest) => {
    try {
      await digestService.saveDigest(digest);
    } catch (error) {
      console.error('Error saving digest engagement:', error);
    }
  };

  const handleViewSources = (themeId?: string) => {
    if (themeId) {
      const theme = digest?.themes.find(t => t.id === themeId);
      setSelectedThemeId(themeId);
      setSelectedThemeName(theme?.title);
    }
    setShowSourceDrawer(true);
  };

  const handleFindingClick = async (findingId: string) => {
    // Find and show the finding details
    const finding = findings.find(f => f.id === findingId);
    if (finding) {
      setSelectedFinding(finding);
      setShowFindingDetail(true);

      // Skip individual engagement updates to avoid unnecessary API calls
      // Engagement tracking can be done in batch or analytics service
      console.log('Finding expanded:', findingId);
    }
  };

  const handleAddToChat = (finding: ResearchFinding) => {
    // This will be implemented in Phase 2
    console.log('Adding to chat context:', finding);
    // For now, just close the drawer
    setShowFindingDetail(false);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render no topics state
  if (topics.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <CardTitle className="mb-2">No Topics Created</CardTitle>
        <p className="text-muted-foreground">
          Add a topic to start tracking research findings.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div className="flex-1">
              <label htmlFor="topic-select" className="block text-sm font-medium mb-2">
                Research Topic
              </label>
              <select
                id="topic-select"
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name} - {topic.diseaseProfile.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateNewDigest()}
                disabled={generatingDigest || findings.length === 0}
              >
                {generatingDigest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Digest
                  </>
                )}
              </Button>

              <select
                value={digestTimeframe}
                onChange={(e) => {
                  const newTimeframe = e.target.value as DigestTimeframe;
                  setDigestTimeframe(newTimeframe);
                  // Use callback to ensure we get the latest state
                  setTimeout(() => {
                    loadOrGenerateDigest(selectedTopicId, findings, currentTopic);
                  }, 0);
                }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="all-time">All Time</option>
              </select>

              <div className="flex rounded-md shadow-sm">
                <Button
                  variant={viewMode === 'digest' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('digest')}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Digest
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      {findings.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle className="mb-2">No Research Findings Yet</CardTitle>
          <p className="text-muted-foreground">
            Run agents to discover research for this topic.
          </p>
        </Card>
      ) : viewMode === 'digest' ? (
        digest ? (
          <div className="space-y-6">
            <DigestCard
              digest={digest}
              onThemeClick={handleThemeExpand}
              onViewSources={() => handleViewSources()}
              explanationMode={explanationMode}
              setExplanationMode={setExplanationMode}
            />

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Research Themes
              </h2>
              <ThemeAccordion
                themes={digest.themes}
                findings={findings}
                onThemeExpand={handleThemeExpand}
                onFindingClick={handleFindingClick}
                onViewSources={handleViewSources}
                explanationMode={explanationMode}
              />
            </div>
          </div>
        ) : generatingDigest ? (
          <Card className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <CardTitle className="mb-2">Generating Digest...</CardTitle>
            <p className="text-muted-foreground">
              Analyzing {findings.length} findings to create your research digest.
            </p>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="mb-2">No Digest Available</CardTitle>
            <p className="text-muted-foreground mb-4">
              Generate a digest to see AI-powered insights from your research findings.
            </p>
            <Button
              onClick={generateNewDigest}
              disabled={findings.length === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Digest
            </Button>
          </Card>
        )
      ) : (
        // List view - render original findings list
        <div className="space-y-4">
          {findings.map(finding => (
            <Card key={finding.id} className={finding.isNew ? 'ring-2 ring-primary' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{finding.type}</Badge>
                      {finding.isNew && <Badge>New</Badge>}
                      <h3 className="text-lg font-medium">{finding.title}</h3>
                    </div>
                    <p className="text-muted-foreground mb-4">{finding.summary}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium">{finding.source.displayName || finding.source.name}</span>
                      <span>{finding.type}</span>
                      {finding.metadata?.studyType && (
                        <Badge variant="secondary">{finding.metadata.studyType}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Source Drawer */}
      <SourceDrawer
        isOpen={showSourceDrawer}
        onClose={() => {
          setShowSourceDrawer(false);
          setSelectedThemeId(undefined);
          setSelectedThemeName(undefined);
        }}
        findings={selectedThemeId && digest
          ? findings.filter(f =>
              digest.themes.find(t => t.id === selectedThemeId)?.findingIds.includes(f.id)
            )
          : findings
        }
        selectedThemeId={selectedThemeId}
        themeName={selectedThemeName}
      />

      {/* Finding Detail Drawer */}
      <FindingDetailDrawer
        finding={selectedFinding}
        isOpen={showFindingDetail}
        onClose={() => {
          setShowFindingDetail(false);
          setSelectedFinding(null);
        }}
        onAddToChat={handleAddToChat}
      />
    </div>
  );
}