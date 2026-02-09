/**
 * TopicSelector - Container component for topic selection
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 *
 * This is a CONTAINER component - it connects to Zustand stores.
 * Uses useTopics() hook for topic data and selection.
 */

import { useTopics } from '@/hooks/useTopics';
import { Brain, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SmartDigest } from '@/types';

// ============================================
// Types
// ============================================

interface TopicSelectorProps {
  /** Callback when topic changes */
  onTopicChange?: (topicId: string) => void;
  /** Optional findings count to display */
  findingsCount?: number;
  /** Optional digest for timestamp display */
  digest?: SmartDigest | null;
}

// ============================================
// Component
// ============================================

export function TopicSelector({
  onTopicChange,
  findingsCount = 0,
  digest
}: TopicSelectorProps) {
  const {
    topics,
    selectedTopicId,
    selectedTopic,
    isLoading,
    selectTopic
  } = useTopics();

  const handleTopicChange = (topicId: string) => {
    selectTopic(topicId);
    onTopicChange?.(topicId);
  };

  return (
    <div className="space-y-4">
      {/* Topic Dropdown with Brain Icon */}
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <select
          value={selectedTopicId || ''}
          onChange={(e) => handleTopicChange(e.target.value)}
          className="text-lg font-semibold bg-transparent border-b border-[var(--color-border)] focus:border-primary outline-none"
          disabled={isLoading}
        >
          {topics.length === 0 && (
            <option value="">No topics available</option>
          )}
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-4 w-4" />
          {findingsCount} findings
        </span>
        {digest && (
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Updated {formatDistanceToNow(digest.generatedAt)} ago
          </span>
        )}
      </div>
    </div>
  );
}
