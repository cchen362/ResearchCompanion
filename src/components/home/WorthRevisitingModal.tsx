import { useState } from 'react';
import { X, Link2, Clock, TrendingUp, HelpCircle, GraduationCap, Lightbulb, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { WorthRevisiting, DualModeText, ExplanationMode } from '@/types';

interface WorthRevisitingModalProps {
  item: WorthRevisiting | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFinding?: (findingId: string) => void;
}

/** Handles both old (string) and new ({technical, explained}) formats */
function resolveText(value: DualModeText | string | undefined, mode: ExplanationMode): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return mode === 'technical' ? value.technical : value.explained;
}

export function WorthRevisitingModal({ item, isOpen, onClose, onViewFinding }: WorthRevisitingModalProps) {
  const [mode, setMode] = useState<ExplanationMode>('explained');

  if (!isOpen || !item) return null;

  const toggleClasses = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
      active
        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-muted)]">
          {/* Left: title + tooltip */}
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Worth Revisiting</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="text-muted-foreground cursor-help" size={16} />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>When new research appears, your AI companion reviews your entire research history to find earlier findings that now have new significance. Think of it as spotting that a 2023 gene therapy study predicted what a 2026 clinical trial just confirmed.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Right: toggle (desktop) + close */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-[var(--color-surface-sunken)] rounded-lg p-1">
              <button onClick={() => setMode('technical')} className={toggleClasses(mode === 'technical')}>
                <GraduationCap className="h-3.5 w-3.5" />
                Technical
              </button>
              <button onClick={() => setMode('explained')} className={toggleClasses(mode === 'explained')}>
                <Lightbulb className="h-3.5 w-3.5" />
                Explained
              </button>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile toggle — separate row below header */}
        <div className="flex sm:hidden justify-center p-3 border-b border-[var(--color-border-muted)]">
          <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] rounded-lg p-1">
            <button onClick={() => setMode('technical')} className={toggleClasses(mode === 'technical')}>
              <GraduationCap className="h-3.5 w-3.5" />
              Technical
            </button>
            <button onClick={() => setMode('explained')} className={toggleClasses(mode === 'explained')}>
              <Lightbulb className="h-3.5 w-3.5" />
              Explained
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Connection basis badge */}
          <div className="flex justify-center mb-5">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {item.connectionBasis}
            </span>
          </div>

          {/* Two finding cards: side-by-side on md+, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* Older Finding */}
            <div className="border border-[var(--color-border-muted)] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Earlier Finding</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.oldFindingTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
                {resolveText(item.oldFindingSummary, mode)}
              </p>
              {onViewFinding && (
                <button
                  onClick={() => onViewFinding(item.oldFindingId)}
                  className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors inline-flex items-center gap-1"
                >
                  View source <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Recent Breakthrough */}
            <div className="border border-amber-300 dark:border-amber-700 rounded-lg p-5 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Recent Breakthrough</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.newBreakthroughTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
                {resolveText(item.newBreakthroughSummary, mode)}
              </p>
              {onViewFinding && (
                <button
                  onClick={() => onViewFinding(item.newBreakthroughId)}
                  className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 font-medium transition-colors inline-flex items-center gap-1"
                >
                  View source <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Connection explanation */}
          <div className="flex items-start gap-3 p-5 rounded-lg bg-[var(--color-surface-sunken)]">
            <Link2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Why this matters: </span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {resolveText(item.connectionExplanation, mode)}
              </span>
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
