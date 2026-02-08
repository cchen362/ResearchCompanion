import { HelpCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MetricExplanation {
  label: string;
  explanation: string;
  details?: string;
}

const metricsExplanations: Record<string, MetricExplanation> = {
  relevanceScore: {
    label: 'Relevance Score',
    explanation: 'How relevant this finding is to your research topic (0-10 scale)',
    details: '8-10: Highly relevant, directly applicable | 5-7: Moderately relevant, useful context | 0-4: Low relevance, background information'
  },
  confidenceLevel: {
    label: 'Confidence Level',
    explanation: 'Quality and reliability of the research evidence',
    details: 'High: Peer-reviewed studies, RCTs, meta-analyses | Medium: Observational studies, case reports | Low: Preliminary data, unverified sources'
  },
  sourceQuality: {
    label: 'Source Quality',
    explanation: 'Reliability score of the information source (0-100)',
    details: '71-100: High quality (peer-reviewed journals) | 31-70: Medium quality (reputable media) | 0-30: Low quality (unverified sources)'
  },
  priority: {
    label: 'Priority',
    explanation: 'Importance level for treatment decisions',
    details: 'Critical: Safety-critical, immediate action needed | High: Important for treatment | Medium: Useful context | Low: Supplementary info'
  },
  category: {
    label: 'Category',
    explanation: 'Type of research finding for classification',
    details: 'Clinical Trial | Treatment | Mechanism | Outcome | Diagnostic | Prevention | Epidemiology'
  },
  isNew: {
    label: 'New Finding',
    explanation: 'Recently discovered within the last 7 days',
    details: 'Helps you stay updated with the latest research'
  },
  avgConfidence: {
    label: 'Average Confidence',
    explanation: 'Overall reliability of all findings in this topic',
    details: 'Calculated from individual confidence levels of all findings'
  },
  highRelevance: {
    label: 'High Relevance',
    explanation: 'Findings with relevance score ≥ 7',
    details: 'These are the most important findings for your research'
  },
  emergingResearch: {
    label: 'Emerging Research',
    explanation: 'New research areas gaining attention in the last 30 days',
    details: 'Based on publication frequency and citation patterns'
  },
  decliningFocus: {
    label: 'Declining Focus',
    explanation: 'Research areas with reduced activity recently',
    details: 'May indicate solved problems or shifting research priorities'
  }
};

// Label explanations
const labelExplanations: Record<string, string> = {
  critical: 'Immediately actionable, safety-critical information',
  high: 'Important for treatment decisions',
  medium: 'Useful context and background',
  low: 'Supplementary information',
  trial: 'Clinical trial information',
  new: 'Discovered within last 7 days',
  'peer-reviewed': 'Published in peer-reviewed journal',
  'fda-approved': 'FDA approved treatment',
  'phase-1': 'Phase 1 clinical trial',
  'phase-2': 'Phase 2 clinical trial',
  'phase-3': 'Phase 3 clinical trial',
  pediatric: 'Relevant to pediatric patients',
  adult: 'Relevant to adult patients'
};

interface MetricHelpProps {
  metric: string;
  className?: string;
  iconSize?: number;
}

export function MetricHelp({ metric, className = '', iconSize = 14 }: MetricHelpProps) {
  const explanation = metricsExplanations[metric];

  if (!explanation) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className={`inline-block ml-1 text-muted-foreground cursor-help ${className}`} size={iconSize} />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-1">
            <p className="font-semibold">{explanation.label}</p>
            <p>{explanation.explanation}</p>
            {explanation.details && (
              <p className="text-xs opacity-90 mt-1">{explanation.details}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LabelHelpProps {
  label: string;
  className?: string;
}

export function LabelHelp({ label, className = '' }: LabelHelpProps) {
  const explanation = labelExplanations[label.toLowerCase()];

  if (!explanation) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help ${className}`}>{label}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Info card for displaying explanations prominently
interface InfoCardProps {
  title: string;
  description: string;
  details?: string;
  className?: string;
}

export function InfoCard({ title, description, details, className = '' }: InfoCardProps) {
  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 ${className}`}>
      <div className="flex items-start gap-2">
        <Info className="text-blue-600 dark:text-blue-400 mt-0.5" size={16} />
        <div className="flex-1">
          <p className="font-medium text-sm text-blue-900 dark:text-blue-100">{title}</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">{description}</p>
          {details && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{details}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Score display with visual indicator
interface ScoreDisplayProps {
  label: string;
  score: number;
  max: number;
  metric: string;
  className?: string;
}

export function ScoreDisplay({ label, score, max, metric, className = '' }: ScoreDisplayProps) {
  const percentage = (score / max) * 100;
  const getColorClass = () => {
    if (percentage >= 70) return 'bg-green-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium flex items-center">
          {label}
          <MetricHelp metric={metric} />
        </span>
        <span className="text-sm font-semibold">{score.toFixed(1)}/{max}</span>
      </div>
      <div className="w-full bg-[var(--color-border)] rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getColorClass()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Confidence badge with explanation
interface ConfidenceBadgeProps {
  level: 'high' | 'medium' | 'low';
  showHelp?: boolean;
}

export function ConfidenceBadge({ level, showHelp = true }: ConfidenceBadgeProps) {
  const colors = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}>
      {level}
      {showHelp && <MetricHelp metric="confidenceLevel" iconSize={12} />}
    </span>
  );
}

// Priority badge with explanation
interface PriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low';
  showHelp?: boolean;
}

export function PriorityBadge({ priority, showHelp = true }: PriorityBadgeProps) {
  const colors = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-blue-500 text-white',
    low: 'bg-[var(--color-text-muted)] text-white'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[priority]}`}>
      {priority}
      {showHelp && <MetricHelp metric="priority" iconSize={12} className="text-white/80" />}
    </span>
  );
}