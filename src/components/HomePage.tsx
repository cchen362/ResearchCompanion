import { useState, useEffect, useCallback } from 'react';
import { HeroSection } from './home/HeroSection';
import { TopicFilter } from './home/TopicFilter';
import { FindingsHighlights } from './home/FindingsHighlights';
import { DigestSignposts } from './home/DigestSignposts';
import { ContextualCTAs } from './home/ContextualCTAs';
import { ActivityChart } from './home/ActivityChart';
import { api } from '@/services/api';
import { findingsService } from '@/services/findings.service';
import { useUIStore } from '@/stores/uiStore';
import { logger } from '@/utils/logger';
import type { Topic } from '@/types';

interface DashboardStats {
  unreadCount: number;
  totalFindings: number;
  topicCount: number;
  recentUnread: any[];
  digestSignposts: any[];
  sourceBreakdown: { type: string; count: number }[];
  activityTimeline: { date: string; count: number }[];
}

interface HomePageProps {
  topics: Topic[];
  setCurrentView: (view: string) => void;
}

export function HomePage({ topics, setCurrentView }: HomePageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const setChatPanelOpen = useUIStore(state => state.setChatPanelOpen);

  const loadStats = useCallback(async (topicId?: string | null) => {
    try {
      setLoading(true);
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.get(`/dashboard/stats${params}`);

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      logger.error('[HomePage] Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stats on mount and when topic filter changes
  useEffect(() => {
    loadStats(selectedTopicId);
  }, [selectedTopicId, loadStats]);

  // Listen for events that should refresh stats
  useEffect(() => {
    const handleRefresh = () => loadStats(selectedTopicId);

    window.addEventListener('agent-complete', handleRefresh);
    window.addEventListener('digest-completed', handleRefresh);
    window.addEventListener('topic-created', handleRefresh);

    return () => {
      window.removeEventListener('agent-complete', handleRefresh);
      window.removeEventListener('digest-completed', handleRefresh);
      window.removeEventListener('topic-created', handleRefresh);
    };
  }, [selectedTopicId, loadStats]);

  const handleTopicSelect = (topicId: string | null) => {
    setSelectedTopicId(topicId);
  };

  const handleViewFindings = () => {
    setCurrentView('findings');
  };

  const handleMarkAllRead = async () => {
    try {
      await findingsService.markFindingsAsRead(selectedTopicId || undefined);
      // Refresh stats after marking as read
      await loadStats(selectedTopicId);
    } catch (error) {
      logger.error('[HomePage] Failed to mark all as read:', error);
    }
  };

  const handleOpenChat = () => {
    setChatPanelOpen(true);
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Topic Filter (chip/pill sub-nav) */}
      <TopicFilter
        topics={topics}
        selectedTopicId={selectedTopicId}
        onSelectTopic={handleTopicSelect}
      />

      {/* Hero Section — template-based narrative */}
      <HeroSection
        unreadCount={stats.unreadCount}
        totalFindings={stats.totalFindings}
        topicCount={stats.topicCount}
        onViewFindings={handleViewFindings}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Contextual CTAs — rule-based feature nudges */}
      <ContextualCTAs
        topicCount={stats.topicCount}
        totalFindings={stats.totalFindings}
        hasChatEnabled={topics.length > 0}
        hasDigests={stats.digestSignposts.length > 0}
        onNavigate={setCurrentView}
        onOpenChat={handleOpenChat}
      />

      {/* Findings Highlights — teasers for unread findings */}
      <FindingsHighlights
        findings={stats.recentUnread}
        onViewAllFindings={handleViewFindings}
      />

      {/* Digest Signposts — metadata references, not full content */}
      <DigestSignposts
        signposts={stats.digestSignposts}
        onViewFindings={handleViewFindings}
      />

      {/* Activity timeline chart */}
      <ActivityChart
        activityTimeline={stats.activityTimeline}
      />
    </div>
  );
}
