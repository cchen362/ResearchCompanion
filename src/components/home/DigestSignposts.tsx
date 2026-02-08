import { BookOpen, AlertTriangle, HelpCircle, ArrowRight, TrendingUp } from 'lucide-react';

interface DigestSignpost {
  id: string;
  topicId: string;
  topicName: string;
  breakthroughCount: number;
  contradictionCount: number;
  knowledgeGapCount: number;
  topBreakthroughs?: string[];
  createdAt: string;
}

interface DigestSignpostsProps {
  signposts: DigestSignpost[];
  onViewFindings: () => void;
}

export function DigestSignposts({ signposts, onViewFindings }: DigestSignpostsProps) {
  if (signposts.length === 0) return null;

  // Only show signposts that have meaningful content
  const meaningfulSignposts = signposts.filter(
    s => s.breakthroughCount > 0 || s.contradictionCount > 0 || s.knowledgeGapCount > 0
  );

  if (meaningfulSignposts.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
      <div className="px-5 py-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Latest Digest Insights</h3>
        </div>
        <button
          onClick={onViewFindings}
          className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
        >
          Open digests <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meaningfulSignposts.map(signpost => (
          <div key={signpost.id} className="border border-[var(--color-border-muted)] rounded-lg p-4">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{signpost.topicName}</h4>
            <div className="space-y-2">
              {signpost.breakthroughCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <BookOpen className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{signpost.breakthroughCount} breakthrough{signpost.breakthroughCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.contradictionCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{signpost.contradictionCount} contradiction{signpost.contradictionCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.knowledgeGapCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>{signpost.knowledgeGapCount} knowledge gap{signpost.knowledgeGapCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            {/* Top breakthrough titles — enrichment from backend */}
            {signpost.topBreakthroughs && signpost.topBreakthroughs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border-muted)]">
                <div className="space-y-1.5">
                  {signpost.topBreakthroughs.map((title, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                      <TrendingUp className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              Updated {new Date(signpost.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
