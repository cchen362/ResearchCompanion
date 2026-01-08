import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3, Network, Download } from 'lucide-react';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { KnowledgeGraphVisualization } from '@/components/KnowledgeGraphVisualization';
import { ExportMenu } from '@/components/ExportMenu';
import { findingsService } from '@/services/findings.service';
import { digestService } from '@/services/digest.service';
import { timelineService } from '@/services/timeline.service';
import { topicsService } from '@/services/topics.service';
import { chatService } from '@/services/chat.service';
import type { ResearchFinding, SmartDigest, TimelineEvent, ResearchTopic } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function AnalyticsPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [topic, setTopic] = useState<ResearchTopic | null>(null);
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [digest, setDigest] = useState<SmartDigest | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');

  useEffect(() => {
    if (topicId) {
      loadData();
    }
  }, [topicId]);

  const loadData = async () => {
    if (!topicId) return;

    try {
      setLoading(true);

      // Load all data in parallel
      const [topicData, findingsData, digestData, timelineData] = await Promise.all([
        topicsService.getTopic(topicId),
        findingsService.getFindings(topicId),
        digestService.getDigest(topicId),
        timelineService.getTimeline(topicId)
      ]);

      setTopic(topicData);
      setFindings(findingsData);
      setDigest(digestData);
      setTimeline(timelineData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load analytics data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (nodeId: string, node: any) => {
    // If it's a finding node, could open the finding detail drawer
    console.log('Node clicked:', nodeId, node);
  };

  const handleNodeDoubleClick = async (nodeId: string, node: any) => {
    // Start a chat conversation about this node
    if (node.description) {
      try {
        // Add context to chat about this node
        await chatService.addContext({
          type: 'graph_node',
          content: `User is exploring: ${node.label}\n${node.description}`,
          metadata: { nodeId, nodeType: node.type }
        });

        // Navigate to chat with a suggested question
        navigate(`/topic/${topicId}/chat`, {
          state: {
            suggestedQuestion: `Tell me more about ${node.label}`
          }
        });
      } catch (error) {
        console.error('Error starting chat:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Topic not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/20 to-white">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/topic/${topicId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Topic
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Analytics & Insights</h1>
                <p className="text-sm text-muted-foreground">{topic.name}</p>
              </div>
            </div>
            <ExportMenu
              topic={topic}
              findings={findings}
              digest={digest}
              timeline={timeline}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
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
            <AnalyticsDashboard
              findings={findings}
              timeline={timeline}
              digest={digest}
            />
          </TabsContent>

          <TabsContent value="graph" className="mt-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Knowledge Graph</h2>
                <p className="text-sm text-muted-foreground">
                  Visual representation of relationships between findings, themes, and outcomes
                </p>
              </div>
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
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}