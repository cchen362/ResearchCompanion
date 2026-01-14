/**
 * Centralized version management for database and cache
 *
 * IMPORTANT: When changing DB_VERSION:
 * 1. Update this file
 * 2. Update public/sw.js - indexedDB.open('MedCompanionDB', VERSION)
 * 3. Update public/sw.js - CACHE_NAME = 'med-companion-vVERSION'
 * 4. Clear browser cache after deployment
 */

export const DB_VERSION = 5;
export const CACHE_VERSION = 'v5';
export const DB_NAME = 'MedCompanionDB';

// Version history for documentation
export const VERSION_HISTORY = {
  1: 'Initial schema',
  2: 'Added topics and findings',
  3: 'Added notifications and timeline',
  4: 'Added digestQueue store for digest generation',
  5: 'Added userId field to all stores for multi-user support'
};