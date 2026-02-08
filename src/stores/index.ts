/**
 * Zustand Stores - Central Export (Phase 2)
 *
 * Phase 2 Refactoring: 3 focused stores replace the previous 5+ stores
 *
 * Architecture:
 * - researchStore: All research data (findings, topics, digests, agents)
 * - uiStore: UI state (loading, modals, progress, view settings)
 * - appStore: Global app state (user, theme, preferences)
 *
 * Key principles:
 * 1. Components should use HOOKS (from @/hooks) not stores directly
 * 2. Stores are the single source of truth for their domain
 * 3. No prop drilling - access state anywhere via hooks
 * 4. Hydration tracking prevents race conditions
 */

// ============================================
// Phase 2 Stores (NEW)
// ============================================

// Research Store - All research data
export { useResearchStore, useResearchHydrated } from './researchStore';

// UI Store - Interface state
export { useUIStore } from './uiStore';

// App Store - Global settings
export { useAppStore } from './appStore';

// ============================================
// Legacy Stores (kept for backwards compatibility during migration)
// These will be removed after full migration is complete
// ============================================

export { useChatStore } from './chatStore';
export { useUserStore, useFeature } from './userStore';

// Legacy stores - commented out, will be deleted after Phase 2
// export { useDigestStore, useDigestHydrated } from './digestStore';
// export { useFindingsStore } from './findingsStore';
// export { useTopicsStore, useTopicsLoaded } from './topicsStore';
// export { useUIStore as useUIStoreLegacy, useShortcuts } from './uiStore';
