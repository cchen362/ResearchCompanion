import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { DIGEST_SECTION_IDS } from '@/components/DigestCard';
import type { SmartDigest } from '@/types';
import {
  Brain,
  FileText,
  Lightbulb,
  TrendingUp,
  Stethoscope,
  AlertTriangle,
  BookOpen
} from 'lucide-react';

interface DigestTOCProps {
  digest: SmartDigest;
}

interface TOCEntry {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DigestTOC({ digest }: DigestTOCProps) {
  // Build TOC entries dynamically — only sections with content
  const entries: TOCEntry[] = useMemo(() => {
    const result: TOCEntry[] = [];

    // Header/Featured is always present
    result.push({ id: DIGEST_SECTION_IDS.header, label: 'Overview', icon: Brain });

    if (digest.topFindings && digest.topFindings.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.topFindings, label: 'Top Findings', icon: FileText });
    }

    if (digest.keyTakeaways.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.takeaways, label: 'Key Takeaways', icon: Lightbulb });
    }

    if (digest.breakthroughs && digest.breakthroughs.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.breakthroughs, label: 'Breakthroughs', icon: TrendingUp });
    }

    if (digest.questionsForDoctor && digest.questionsForDoctor.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.questions, label: 'Questions for Doctor', icon: Stethoscope });
    }

    if (digest.warningSigns && digest.warningSigns.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.warningSigns, label: 'Warning Signs', icon: AlertTriangle });
    }

    if (digest.contradictions && digest.contradictions.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.contradictions, label: 'Conflicting Info', icon: AlertTriangle });
    }

    result.push({ id: DIGEST_SECTION_IDS.sources, label: 'View Sources', icon: BookOpen });

    return result;
  }, [digest]);

  const sectionIds = useMemo(() => entries.map(e => e.id), [entries]);
  const activeId = useScrollSpy({ sectionIds });

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="sticky top-24 space-y-1" aria-label="Digest table of contents">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 px-3">
        Contents
      </h4>
      {entries.map(entry => {
        const Icon = entry.icon;
        const isActive = activeId === entry.id;

        return (
          <button
            key={entry.id}
            onClick={() => handleClick(entry.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left',
              isActive
                ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-950/30 dark:text-primary-300'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <Icon className={cn(
              'h-4 w-4 shrink-0',
              isActive ? 'text-primary-600 dark:text-primary-400' : 'text-[var(--color-text-muted)]'
            )} />
            <span className="truncate">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
