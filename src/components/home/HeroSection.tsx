interface HeroSectionProps {
  unreadCount: number;
  totalFindings: number;
  topicCount: number;
  onViewFindings: () => void;
  onMarkAllRead: () => void;
}

export function HeroSection({
  unreadCount,
  totalFindings,
  topicCount,
  onViewFindings,
  onMarkAllRead
}: HeroSectionProps) {
  // Template-based hero — conditional on actual data, NO LLM
  const getHeroContent = () => {
    if (topicCount === 0) {
      return {
        headline: 'Welcome to Medical Research Companion',
        message: 'Get started by adding your first research topic. Your agents will begin finding relevant studies, trials, and news automatically.',
        showAction: false
      };
    }

    if (totalFindings === 0) {
      return {
        headline: 'Research is underway',
        message: `Your agents are searching across ${topicCount} topic${topicCount > 1 ? 's' : ''}. Findings will appear here as they come in.`,
        showAction: false
      };
    }

    if (unreadCount === 0) {
      return {
        headline: "You're all caught up",
        message: `${totalFindings} finding${totalFindings > 1 ? 's' : ''} across ${topicCount} topic${topicCount > 1 ? 's' : ''} — all reviewed. Your agents will notify you when new research surfaces.`,
        showAction: false
      };
    }

    if (unreadCount <= 3) {
      return {
        headline: `${unreadCount} new finding${unreadCount > 1 ? 's' : ''} to review`,
        message: 'Your agents found some new research worth looking at.',
        showAction: true
      };
    }

    // 4+ unread findings
    return {
      headline: `${unreadCount} new findings since you last checked`,
      message: `Your agents have been gathering research across ${topicCount} topic${topicCount > 1 ? 's' : ''}. Here are the highlights.`,
      showAction: true
    };
  };

  const { headline, message, showAction } = getHeroContent();

  return (
    <div className="bg-gradient-to-r from-primary-50 to-primary-100/30 border border-primary-200/50 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-gray-900">{headline}</h2>
      <p className="mt-2 text-gray-600">{message}</p>
      {showAction && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onViewFindings}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            View New Findings
          </button>
          <button
            onClick={onMarkAllRead}
            className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}
