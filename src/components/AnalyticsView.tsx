import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Network, Brain, FileText } from 'lucide-react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { KnowledgeGraphVisualization } from './KnowledgeGraphVisualization';
import { getDB } from '@/utils/db/database';
import { getAllTopics } from '@/utils/db/topics';
import type { ResearchFinding, SmartDigest, TimelineEvent, Topic } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function AnalyticsView() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [digest, setDigest] = useState<SmartDigest | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const { toast } = useToast();

  // Load topics on mount
  useEffect(() => {
    loadTopics();
  }, []);

  // Load data when topic changes
  useEffect(() => {
    if (selectedTopicId) {
      loadTopicData(selectedTopicId);
    }
  }, [selectedTopicId]);

  const loadTopics = async () => {
    try {
      const allTopics = await getAllTopics();
      setTopics(allTopics);
      if (allTopics.length > 0 && !selectedTopicId) {
        setSelectedTopicId(allTopics[0].id);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
      toast({
        title: 'Error loading topics',
        description: 'Failed to load research topics.',
        variant: 'destructive'
      });
    }
  };

  const loadTopicData = async (topicId: string) => {
    try {
      setLoading(true);
      const db = await getDB();

      // Load topic
      const topic = topics.find(t => t.id === topicId) || null;
      setSelectedTopic(topic);

      // Load findings
      const findingsTx = db.transaction('findings', 'readonly');
      const findingsStore = findingsTx.objectStore('findings');
      // Use the correct index name 'by-topic'
      const findingsIndex = findingsStore.index('by-topic');
      const loadedFindings = await findingsIndex.getAll(topicId);
      setFindings(loadedFindings);

      // Load digest
      const digestTx = db.transaction('digests', 'readonly');
      const digestStore = digestTx.objectStore('digests');
      const digests = await digestStore.getAll();
      const topicDigest = digests.find(d => d.topicId === topicId);
      setDigest(topicDigest || null);

      // Load timeline
      try {
        const timelineTx = db.transaction('timeline', 'readonly');
        const timelineStore = timelineTx.objectStore('timeline');
        // Check if the index exists and use the correct one
        if (timelineStore.indexNames.contains('by-topic')) {
          const timelineIndex = timelineStore.index('by-topic');
          const timelineEvents = await timelineIndex.getAll(topicId);
          setTimeline(timelineEvents);
        } else {
          // Fallback: get all timeline events and filter manually
          const allEvents = await timelineStore.getAll();
          const topicEvents = allEvents.filter(e => e.linkedTopicId === topicId || e.topicId === topicId);
          setTimeline(topicEvents);
        }
      } catch (error) {
        console.warn('Error loading timeline:', error);
        setTimeline([]); // Set empty timeline on error
      }
    } catch (error) {
      console.error('Error loading topic data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load analytics data.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (nodeId: string, node: any) => {
    console.log('Node clicked:', nodeId, node);
    // Could open a detail drawer here
  };

  const handleNodeDoubleClick = (nodeId: string, node: any) => {
    console.log('Node double-clicked:', nodeId, node);
    // Could start a chat conversation about this node
    toast({
      title: 'Node Selected',
      description: `Selected: ${node.label}. Chat integration coming soon!`
    });
  };

  if (topics.length === 0 && !loading) {
    return (
      <Card className="p-8 text-center">
        <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <CardTitle className="mb-2">No Research Topics</CardTitle>
        <p className="text-muted-foreground">
          Add a research topic to start analyzing patterns and insights.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Analytics & Insights</CardTitle>
                <CardDescription>
                  Analyze patterns, correlations, and knowledge graphs from your research
                </CardDescription>
              </div>
            </div>

            {/* Topic Selector */}
            {topics.length > 0 && (
              <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map(topic => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      {loading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        </Card>
      ) : selectedTopic ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="graph">
              <Network className="h-4 w-4 mr-2" />
              Knowledge Graph
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-6">
            {timeline.length > 0 ? (
              <AnalyticsDashboard
                findings={findings}
                timeline={timeline}
                digest={digest}
              />
            ) : (
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <CardTitle className="mb-2">No Timeline Data</CardTitle>
                <p className="text-muted-foreground">
                  Add timeline events to see analytics and patterns. Timeline events track symptoms, treatments, and outcomes over time.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="graph" className="mt-6">
            <Card className="p-4">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Knowledge Graph</h2>
                <p className="text-sm text-muted-foreground">
                  Visual representation of relationships between findings, themes, and outcomes
                </p>
              </div>

              {findings.length > 0 ? (
                <>
                  <KnowledgeGraphVisualization
                    findings={findings}
                    digest={digest}
                    timeline={timeline}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                  />
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Click a node to see details</span>
                    <span>•</span>
                    <span>Double-click to explore in chat</span>
                    <span>•</span>
                    <span>Use mouse wheel to zoom</span>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-muted/50 rounded-lg">
                  <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No findings available to build knowledge graph. Add research findings to visualize relationships.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Select a topic to view analytics</p>
        </Card>
      )}
    </div>
  );
}