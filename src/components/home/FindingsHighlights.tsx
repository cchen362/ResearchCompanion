import { FileText, ArrowRight } from 'lucide-react';
import { getSourceCategory } from '@/utils/sourceCategory';
import { SOURCE_CONFIG } from '@/components/digest/SourceIcon';

interface FindingTeaser {
  id: string;
  title: string;
  summary: string;
  source: any;
  category: string;
  created_at: string;
  topic_id: string;
}

interface FindingsHighlightsProps {
  findings: FindingTeaser[];
  onViewAllFindings: () => void;
}

export function FindingsHighlights({ findings, onViewAllFindings }: FindingsHighlightsProps) {
  if (findings.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)]">
      <div className="px-5 py-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Unread Findings</h3>
          <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
            {findings.length}
          </span>
        </div>
        <button
          onClick={onViewAllFindings}
          className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="divide-y divide-[var(--color-border-muted)]">
        {findings.map(finding => {
          const source = typeof finding.source === 'string'
            ? JSON.parse(finding.source)
            : finding.source;
          const sourceCategory = getSourceCategory(source?.type);
          const sourceLabel = SOURCE_CONFIG[sourceCategory]?.label || 'Research';

          return (
            <div
              key={finding.id}
              className="px-5 py-3 hover:bg-[var(--color-surface-sunken)] cursor-pointer transition-colors"
              onClick={onViewAllFindings}
            >
              <h4 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-1">{finding.title}</h4>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-1">{finding.summary}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>{sourceLabel}</span>
                <span>{new Date(finding.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
