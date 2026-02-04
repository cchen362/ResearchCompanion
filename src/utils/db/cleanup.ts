/**
 * Cleanup Database Utils - DEPRECATED STUB
 *
 * This file was deprecated in Phase 1 Service Layer Consolidation.
 * Cleanup utilities are no longer used.
 * This stub exists only to prevent build errors.
 *
 * TODO: Remove in Phase 3 (Component Decomposition)
 */

/**
 * @deprecated Cleanup feature is deprecated. Returns empty stats.
 */
export async function getNotificationStats(): Promise<{ orphaned: number; total: number }> {
  console.warn('[cleanup.ts] Cleanup utilities are deprecated.');
  return { orphaned: 0, total: 0 };
}

/**
 * @deprecated Cleanup feature is deprecated. No-op function.
 */
export async function cleanupOrphanedNotifications(): Promise<number> {
  console.warn('[cleanup.ts] Cleanup utilities are deprecated.');
  return 0;
}
