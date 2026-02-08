import { useState, useEffect, useCallback } from 'react';
import { HeroSection } from './home/HeroSection';
import { TopicFilter } from './home/TopicFilter';
import { FindingsHighlights } from './home/FindingsHighlights';
import { ResearchPulseCard } from './home/ResearchPulseCard';
import { WorthRevisitingModal } from './home/WorthRevisitingModal';
import type { WorthRevisiting } from '@/types';
import { ContextualCTAs } from './home/ContextualCTAs';
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
  const modals = useUIStore(state => state.modals);
  const modalData = useUIStore(state => state.modalData);
  const openModal = useUIStore(state => state.openModal);
  const closeModal = useUIStore(state => state.closeModal);

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

  const handleWorthRevisitingClick = (item: WorthRevisiting) => {
    openModal('worthRevisiting', item);
  };

  const handleOpenDigest = (topicId: string) => {
    setCurrentView('findings');
  };

  const handleViewFindingFromWR = async (findingId: string) => {
    try {
      closeModal('worthRevisiting');
      const finding = await findingsService.getFinding(findingId);
      if (finding) {
        openModal('findingDetail', finding);
      }
    } catch (error) {
      logger.error('[HomePage] Failed to load finding from WR:', error);
    }
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
      {/* Topic Filter — full width, outside bento grid */}
      <TopicFilter
        topics={topics}
        selectedTopicId={selectedTopicId}
        onSelectTopic={handleTopicSelect}
      />

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Hero — always present, spans 2 cols on sm+, 2 of 3 on lg */}
        <div className="sm:col-span-2 lg:col-span-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
          <HeroSection
            unreadCount={stats.unreadCount}
            totalFindings={stats.totalFindings}
            topicCount={stats.topicCount}
            onViewFindings={handleViewFindings}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>

        {/* CTAs — no wrapper hover (individual CTA buttons have their own hover) */}
        <div className="sm:col-span-2 lg:col-span-1">
          <ContextualCTAs
            topicCount={stats.topicCount}
            totalFindings={stats.totalFindings}
            hasChatEnabled={topics.length > 0}
            hasDigests={stats.digestSignposts.length > 0}
            onNavigate={setCurrentView}
            onOpenChat={handleOpenChat}
          />
        </div>

        {/* Findings Highlights — only when there are unread findings */}
        {stats.recentUnread.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <FindingsHighlights
              findings={stats.recentUnread}
              onViewAllFindings={handleViewFindings}
            />
          </div>
        )}

        {/* Research Pulse — only when there are digests */}
        {stats.digestSignposts.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <ResearchPulseCard
              signposts={stats.digestSignposts}
              onOpenDigest={handleOpenDigest}
              onWorthRevisitingClick={handleWorthRevisitingClick}
            />
          </div>
        )}
      </div>

      {/* Worth Revisiting Modal */}
      <WorthRevisitingModal
        item={modalData as WorthRevisiting | null}
        isOpen={modals.worthRevisiting}
        onClose={() => closeModal('worthRevisiting')}
        onViewFinding={handleViewFindingFromWR}
      />
    </div>
  );
}
