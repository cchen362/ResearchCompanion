import { Brain, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WhatsNewSignpost {
  id: string;
  topicId: string;
  topicName: string;
  whatsNew: { technical?: string; explained?: string };
  notableFindingsCount: number;
  hasConflicts: boolean;
  createdAt: string;
  lastAgentRun?: string;
}

interface WhatsNewCardProps {
  signposts: WhatsNewSignpost[];
  onOpenDigest: (topicId: string) => void;
}

export function ResearchPulseCard({ signposts, onOpenDigest }: WhatsNewCardProps) {
  // Only show signposts that have a What's New summary
  const activeSignposts = signposts.filter(s => s.whatsNew?.explained || s.whatsNew?.technical);

  if (activeSignposts.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Research Companion</h3>
        </div>
      </div>

      {/* Per-topic cards */}
      <div className="p-5 space-y-4">
        {activeSignposts.map(signpost => (
          <div key={signpost.id} className="border border-[var(--color-border-muted)] rounded-lg p-4">
            {/* Topic header + Open digest link */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{signpost.topicName}</h4>
              <button
                onClick={() => onOpenDigest(signpost.topicId)}
                className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
              >
                Open digest <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* What's New summary */}
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {signpost.whatsNew.explained || signpost.whatsNew.technical || ''}
            </p>

            {/* Timestamp + agent scan freshness */}
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              Updated {new Date(signpost.createdAt).toLocaleDateString()}
              {signpost.lastAgentRun && new Date(signpost.lastAgentRun) > new Date(signpost.createdAt) && (
                <span className="ml-2">
                  · <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle mr-1" />
                  Scanned {formatDistanceToNow(new Date(signpost.lastAgentRun), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
