/**
 * TimeframeSelector - Pure UI component for selecting digest timeframe
 *
 * Phase 3 Component Decomposition: New component
 *
 * This is a PURE UI component - it receives props only, no store access.
 * Timeframe state comes from the parent container via props.
 */

import type { DigestTimeframe } from '@/types';

// ============================================
// Types
// ============================================

interface TimeframeSelectorProps {
  /** Current selected timeframe */
  timeframe: DigestTimeframe;
  /** Callback when timeframe changes */
  onTimeframeChange: (timeframe: DigestTimeframe) => void;
  /** Optional className for styling */
  className?: string;
}

// ============================================
// Constants
// ============================================

const TIMEFRAME_OPTIONS: { value: DigestTimeframe; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all-time', label: 'All Time' }
];

// ============================================
// Component
// ============================================

export function TimeframeSelector({
  timeframe,
  onTimeframeChange,
  className
}: TimeframeSelectorProps) {
  return (
    <select
      value={timeframe}
      onChange={(e) => onTimeframeChange(e.target.value as DigestTimeframe)}
      className={`px-3 py-1 border rounded-md text-sm bg-background ${className || ''}`}
    >
      {TIMEFRAME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
