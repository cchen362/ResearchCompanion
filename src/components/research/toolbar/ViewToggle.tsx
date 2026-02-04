/**
 * ViewToggle - Pure UI component for switching between digest and list views
 *
 * Phase 3 Component Decomposition: New component
 *
 * This is a PURE UI component - it receives props only, no store access.
 * View state comes from the parent container via props.
 */

import { Button } from '@/components/ui/button';
import { Sparkles, List } from 'lucide-react';

// ============================================
// Types
// ============================================

type ViewMode = 'digest' | 'list';

interface ViewToggleProps {
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback when view mode changes */
  onViewChange: (mode: ViewMode) => void;
  /** Optional className for styling */
  className?: string;
}

// ============================================
// Component
// ============================================

export function ViewToggle({ viewMode, onViewChange, className }: ViewToggleProps) {
  return (
    <div className={`flex gap-1 p-1 bg-muted rounded-md ${className || ''}`}>
      <Button
        size="sm"
        variant={viewMode === 'digest' ? 'default' : 'ghost'}
        onClick={() => onViewChange('digest')}
        className="px-2 py-1"
      >
        <Sparkles className="h-4 w-4 mr-1" />
        Digest
      </Button>
      <Button
        size="sm"
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        onClick={() => onViewChange('list')}
        className="px-2 py-1"
      >
        <List className="h-4 w-4 mr-1" />
        List
      </Button>
    </div>
  );
}
