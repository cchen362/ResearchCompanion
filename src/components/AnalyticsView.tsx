/**
 * AnalyticsView - Research insights and analytics component
 *
 * Phase 4 Refactoring: Updated to use services instead of direct DB access
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Brain } from 'lucide-react';
import { ResearchInsightsDashboard } from './ResearchInsightsDashboard';
import { topicsService } from '@/services/topics.service';
import { findingsService } from '@/services/findings.service';
import { digestService } from '@/services/digest.service';
import { logger } from '@/utils/logger';
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
      const allTopics = await topicsService.getTopics();
      setTopics(allTopics);
      if (allTopics.length > 0 && !selectedTopicId) {
        setSelectedTopicId(allTopics[0].id);
      }
      // Set loading to false if no topics
      if (allTopics.length === 0) {
        setLoading(false);
      }
    } catch (error) {
      logger.error('[AnalyticsView] Error loading topics:', error);
      toast({
        title: 'Error loading topics',
        description: 'Failed to load research topics.',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const loadTopicData = async (topicId: string) => {
    try {
      setLoading(true);

      // Load topic from existing topics array
      const topic = topics.find(t => t.id === topicId) || null;
      setSelectedTopic(topic);

      // Load findings via service
      const loadedFindings = await findingsService.getFindings(topicId);
      setFindings(loadedFindings);

      // Load digests via service
      const topicDigests = await digestService.getDigestsForTopic(topicId);
      setDigests(topicDigests);
    } catch (error) {
      logger.error('[AnalyticsView] Error loading topic data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load analytics data.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDigest = useCallback(async () => {
    if (!selectedTopic || findings.length === 0) {
      toast({
        title: 'No findings available',
        description: 'You need research findings to generate a digest.',
        variant: 'destructive'
      });
      return;
    }

    try {
      toast({
        title: 'Generating digest...',
        description: 'This may take a moment.',
      });

      const newDigest = await digestService.generateSmartDigest(selectedTopic, findings);

      // Reload digests after generation
      await loadTopicData(selectedTopicId);

      toast({
        title: 'Digest generated',
        description: 'Smart digest has been generated successfully.',
      });
    } catch (error) {
      logger.error('[AnalyticsView] Error generating digest:', error);
      toast({
        title: 'Failed to generate digest',
        description: 'An error occurred while generating the digest.',
        variant: 'destructive'
      });
    }
  }, [selectedTopic, findings, selectedTopicId, toast]);


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
          topics={topics}
          digests={digests}
          onGenerateDigest={handleGenerateDigest}
        />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Select a topic to view research insights</p>
        </Card>
      )}
    </div>
  );
}