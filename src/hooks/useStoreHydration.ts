/**
 * useStoreHydration - Hook to wait for Zustand stores to hydrate
 *
 * Phase 2 Refactoring: Essential for preventing data loading before
 * persisted state is restored from localStorage.
 *
 * Key principles:
 * 1. Wait for ALL relevant stores to hydrate before loading data
 * 2. Prevents race conditions between hydration and data fetching
 * 3. Ensures persisted selections are available before loading topic data
 *
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   const isHydrated = useStoreHydration();
 *
 *   useEffect(() => {
 *     if (!isHydrated) return; // Wait for hydration
 *     loadData();
 *   }, [isHydrated]);
 * }
 * ```
 */

import { useEffect, useState } from 'react';
import { useResearchStore } from '@/stores/researchStore';

/**
 * Hook that returns true when all Zustand stores have hydrated from localStorage.
 * Use this to gate any data loading that depends on persisted state.
 */
export function useStoreHydration(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);
  const researchHydrated = useResearchStore((state) => state.hasHydrated);

  useEffect(() => {
    // Check if research store has hydrated
    // Note: uiStore and appStore hydration is simpler - they don't have
    // hasHydrated tracking, but their persist middleware handles it
    if (researchHydrated) {
      setIsHydrated(true);
      return;
    }

    // Set up listener for hydration completion
    const unsubscribe = useResearchStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    // Check if already hydrated (race condition prevention)
    if (useResearchStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => {
      unsubscribe();
    };
  }, [researchHydrated]);

  return isHydrated;
}

/**
 * Hook that returns hydration status with loading state.
 * Useful when you need to show a loading indicator during hydration.
 */
export function useStoreHydrationWithLoading() {
  const isHydrated = useStoreHydration();

  return {
    isHydrated,
    isLoading: !isHydrated
  };
}
