import { Brain, ArrowRight, Link2 } from 'lucide-react';
import type { WorthRevisiting } from '@/types';

interface ResearchPulseSignpost {
  id: string;
  topicId: string;
  topicName: string;
  breakthroughCount: number;
  contradictionCount: number;
  knowledgeGapCount: number;
  topBreakthroughs?: string[];
  researchPulse: string;
  worthRevisiting: WorthRevisiting[];
  createdAt: string;
}

interface ResearchPulseCardProps {
  signposts: ResearchPulseSignpost[];
  onOpenDigest: (topicId: string) => void;
  onWorthRevisitingClick: (item: WorthRevisiting) => void;
}

export function ResearchPulseCard({ signposts, onOpenDigest, onWorthRevisitingClick }: ResearchPulseCardProps) {
  // Only show signposts that have a Research Pulse
  const pulseSignposts = signposts.filter(s => s.researchPulse && s.researchPulse.trim().length > 0);

  if (pulseSignposts.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Research Companion</h3>
        </div>
      </div>

      {/* Per-topic pulse cards */}
      <div className="p-5 space-y-4">
        {pulseSignposts.map(signpost => (
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

            {/* Pulse sentence */}
            <p className="text-sm text-[var(--color-text-secondary)] italic leading-relaxed">
              &ldquo;{signpost.researchPulse}&rdquo;
            </p>

            {/* Worth Revisiting nudges */}
            {signpost.worthRevisiting && signpost.worthRevisiting.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border-muted)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Link2 className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">Worth Revisiting</span>
                </div>
                <div className="space-y-2">
                  {signpost.worthRevisiting.map((wr, idx) => (
                    <button
                      key={idx}
                      onClick={() => onWorthRevisitingClick(wr)}
                      className="w-full text-left p-2.5 rounded-md bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border-muted)] transition-colors group"
                    >
                      <div className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
                        <span>
                          <span className="font-medium text-[var(--color-text-primary)]">{wr.oldFindingTitle}</span>
                          <span className="mx-1.5 text-amber-500">&#8596;</span>
                          <span className="font-medium text-[var(--color-text-primary)]">{wr.newBreakthroughTitle}</span>
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 group-hover:text-[var(--color-text-secondary)] transition-colors">
                        {wr.connectionBasis}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              Updated {new Date(signpost.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
