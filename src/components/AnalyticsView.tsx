import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Brain, FileText } from 'lucide-react';
import { ResearchInsightsDashboard } from './ResearchInsightsDashboard';
import { getDB } from '@/utils/db/database';
import { getAllTopics } from '@/utils/db/topics';
import type { ResearchFinding, SmartDigest, Topic } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function AnalyticsView() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [digests, setDigests] = useState<SmartDigest[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Load all digests (not just for this topic, as we might want cross-topic insights)
      const digestTx = db.transaction('digests', 'readonly');
      const digestStore = digestTx.objectStore('digests');
      const allDigests = await digestStore.getAll();
      // Filter for this topic's digests
      const topicDigests = allDigests.filter(d => d.topicId === topicId);
      setDigests(topicDigests);
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
                <CardTitle>Research Insights</CardTitle>
                <CardDescription>
                  Track research progress, source credibility, and knowledge patterns
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
              <p className="mt-4 text-muted-foreground">Loading insights...</p>
            </div>
          </div>
        </Card>
      ) : selectedTopic ? (
        <ResearchInsightsDashboard
          findings={findings}
          digests={digests}
        />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Select a topic to view research insights</p>
        </Card>
      )}
    </div>
  );
}