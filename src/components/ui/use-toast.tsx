import { useUIStore } from '@/stores/uiStore';

export function useToast() {
  const { showToast, dismissToast } = useUIStore();

  const toast = (options: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
    action?: {
      label: string;
      handler: () => void;
    };
  }) => {
    showToast({
      type: options.variant === 'destructive' ? 'error' : 'info',
      message: options.description || options.title || '',
      action: options.action,
      duration: 5000
    });
  };

  return {
    toast,
    dismiss: dismissToast
  };
}