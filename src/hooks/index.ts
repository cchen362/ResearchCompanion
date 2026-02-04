/**
 * Custom Hooks - Central Export (Phase 2)
 *
 * Phase 2 Refactoring: These hooks wrap the NEW Zustand stores
 * (researchStore, uiStore, appStore) to provide convenient,
 * domain-specific APIs for components.
 *
 * Key principles:
 * 1. Hooks are the PRIMARY interface for components to access stores
 * 2. Components should NOT import stores directly (use hooks instead)
 * 3. Hooks handle derived state, filtering, sorting
 * 4. Hooks manage loading state coordination
 */

// Hydration hook - MUST be used before loading data
export { useStoreHydration, useStoreHydrationWithLoading } from './useStoreHydration';

// Domain hooks
export { useTopics } from './useTopics';
export { useFindings, type UseFindingsOptions } from './useFindings';
export { useDigest } from './useDigest';
