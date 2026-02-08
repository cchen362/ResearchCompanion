/**
 * Centralized version management for database
 *
 * IMPORTANT: When changing DB_VERSION:
 * 1. Update this file
 * 2. Clear browser cache after deployment
 */

export const DB_VERSION = 8;
export const DB_NAME = 'MedCompanionDB';

// Version history for documentation
export const VERSION_HISTORY = {
  1: 'Initial schema',
  2: 'Added topics and findings',
  3: 'Added notifications and timeline',
  4: 'Added digestQueue store for digest generation',
  5: 'Added userId field to all stores for multi-user support',
  8: 'Removed deprecated timeline store (feature removed)'
};