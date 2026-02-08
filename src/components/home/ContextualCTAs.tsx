import { Plus, Bot, MessageSquare, FileText } from 'lucide-react';

interface ContextualCTA {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  action: () => void;
}

interface ContextualCTAsProps {
  topicCount: number;
  totalFindings: number;
  hasChatEnabled: boolean;
  hasDigests: boolean;
  onNavigate: (view: string) => void;
  onOpenChat: () => void;
}

export function ContextualCTAs({
  topicCount,
  totalFindings,
  hasChatEnabled,
  hasDigests,
  onNavigate,
  onOpenChat
}: ContextualCTAsProps) {
  // Rule-based CTAs — max 3, ordered by relevance
  const ctas: ContextualCTA[] = [];

  if (topicCount === 0) {
    ctas.push({
      id: 'add-topic',
      icon: <Plus className="h-5 w-5 text-primary-600" />,
      label: 'Add a research topic',
      description: 'Start tracking a medical condition',
      action: () => onNavigate('topics')
    });
  }

  if (totalFindings > 0 && hasChatEnabled) {
    ctas.push({
      id: 'open-chat',
      icon: <MessageSquare className="h-5 w-5 text-purple-600" />,
      label: 'Ask about your research',
      description: 'Chat with AI about your findings',
      action: onOpenChat
    });
  }

  if (topicCount > 0 && totalFindings === 0) {
    ctas.push({
      id: 'check-agents',
      icon: <Bot className="h-5 w-5 text-blue-600" />,
      label: 'Check your agents',
      description: 'See research agent status and results',
      action: () => onNavigate('agents')
    });
  }

  if (totalFindings > 5) {
    ctas.push({
      id: 'view-findings',
      icon: <FileText className="h-5 w-5 text-green-600" />,
      label: 'Browse all findings',
      description: 'Search, filter, and explore your research',
      action: () => onNavigate('findings')
    });
  }

  // Max 3 CTAs
  const displayCtas = ctas.slice(0, 3);

  if (displayCtas.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-1 h-full content-start">
      {displayCtas.map(cta => (
        <button
          key={cta.id}
          onClick={cta.action}
          className="flex items-center gap-3 p-4 bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] hover:border-primary-200 hover:shadow-md transition-all text-left"
        >
          <div className="shrink-0">{cta.icon}</div>
          <div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{cta.label}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{cta.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
