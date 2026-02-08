import { X, Link2, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorthRevisiting } from '@/types';

interface WorthRevisitingModalProps {
  item: WorthRevisiting | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WorthRevisitingModal({ item, isOpen, onClose }: WorthRevisitingModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-muted)]">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Worth Revisiting</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Connection basis badge */}
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {item.connectionBasis}
            </span>
          </div>

          {/* Two finding cards: side-by-side on md+, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Older Finding */}
            <div className="border border-[var(--color-border-muted)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Earlier Finding</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.oldFindingTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.oldFindingSummary}</p>
            </div>

            {/* Recent Breakthrough */}
            <div className="border border-amber-300 dark:border-amber-700 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Recent Breakthrough</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.newBreakthroughTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.newBreakthroughSummary}</p>
            </div>
          </div>

          {/* Connection explanation */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--color-surface-sunken)]">
            <Link2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Why this matters: </span>
              <span className="text-sm text-[var(--color-text-secondary)]">{item.connectionExplanation}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border-muted)] p-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
