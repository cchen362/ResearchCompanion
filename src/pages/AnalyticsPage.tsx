import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { ExportMenu } from '@/components/ExportMenu';
import { findingsService } from '@/services/findings.service';
import { digestService } from '@/services/digest.service';
import { topicsService } from '@/services/topics.service';
import type { ResearchFinding, SmartDigest, TimelineEvent, ResearchTopic } from '@/types';

// NOTE: Timeline service was deprecated in Phase 1 refactoring
// Timeline events will be empty until Phase 3 cleanup
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
      const [topicData, findingsData, digestData] = await Promise.all([
        topicsService.getTopic(topicId),
        findingsService.getFindings(topicId),
        digestService.getDigest(topicId)
      ]);

      setTopic(topicData);
      setFindings(findingsData);
      setDigest(digestData);
      // Timeline service deprecated in Phase 1 - leave timeline empty
      setTimeline([]);
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
        <AnalyticsDashboard
          findings={findings}
          timeline={timeline}
          digest={digest}
        />
      </div>
    </div>
  );
}