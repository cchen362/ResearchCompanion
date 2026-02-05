/**
 * FindingsDateFilter - Date range filter for findings list view
 *
 * Phase 3 Component Decomposition: New component for Phase 4 Digest UI Improvements
 *
 * This is a PURE UI component - it receives props only, no store access.
 * Filter state comes from the parent container via props.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import type { FindingsDateFilter as FilterType } from '@/stores/appStore';

// ============================================
// Types
// ============================================

interface FindingsDateFilterProps {
  /** Current selected filter */
  filter: FilterType;
  /** Callback when filter changes */
  onFilterChange: (filter: FilterType) => void;
}

// ============================================
// Constants
// ============================================

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

// ============================================
// Component
// ============================================

export function FindingsDateFilter({
  filter,
  onFilterChange,
}: FindingsDateFilterProps) {
  return (
    <Select value={filter} onValueChange={onFilterChange}>
      <SelectTrigger className="w-[140px] h-9">
        <Calendar className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        {FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
