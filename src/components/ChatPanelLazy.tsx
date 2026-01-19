import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Use minimal version to avoid ALL circular dependencies
const ChatPanelImpl = lazy(() =>
  import('./ChatPanelMinimal').then(module => ({
    default: module.ChatPanel
  }))
);

interface ChatPanelProps {
  topicId: string;
  topicName: string;
  className?: string;
  onClose?: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading chat...</span>
          </div>
        </div>
      }
    >
      <ChatPanelImpl {...props} />
    </Suspense>
  );
}

// Export the same type for compatibility
export type { ChatPanelProps };