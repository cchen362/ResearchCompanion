import type { Topic } from '@/types';

interface TopicFilterProps {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string | null) => void;
}

export function TopicFilter({ topics, selectedTopicId, onSelectTopic }: TopicFilterProps) {
  if (topics.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelectTopic(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          selectedTopicId === null
            ? 'bg-primary-600 text-white shadow-sm'
            : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] hover:bg-primary-50'
        }`}
      >
        All Topics
      </button>
      {topics.map(topic => (
        <button
          key={topic.id}
          onClick={() => onSelectTopic(topic.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedTopicId === topic.id
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] hover:bg-primary-50'
          }`}
        >
          {topic.name}
        </button>
      ))}
    </div>
  );
}
