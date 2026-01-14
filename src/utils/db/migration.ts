/**
 * Database Migration Handler
 * Ensures smooth version upgrades and handles version mismatches
 */

import { DB_VERSION, DB_NAME } from './version';

export class DatabaseMigrationHandler {
  /**
   * Handle version mismatch errors gracefully
   */
  static async handleVersionMismatch(error: Error): Promise<void> {
    if (error.name === 'VersionError') {
      console.warn('Database version mismatch detected:', error.message);

      // Extract versions from error message
      const match = error.message.match(/requested version \((\d+)\).*existing version \((\d+)\)/);
      if (match) {
        const requestedVersion = parseInt(match[1]);
        const existingVersion = parseInt(match[2]);

        console.log(`App wants version ${requestedVersion}, DB is at version ${existingVersion}`);

        if (requestedVersion < existingVersion) {
          // This is our current issue - old cached code trying to open newer DB
          console.warn('⚠️ Cached code is outdated. Clearing cache and reloading...');

          // Clear all caches
          await this.clearAllCaches();

          // Reload the page to get fresh code
          window.location.reload();
        } else {
          // This shouldn't happen with our current setup
          console.error('Database version is behind app version. Manual intervention needed.');
        }
      }
    } else {
      throw error; // Re-throw if not a version error
    }
  }

  /**
   * Clear all application caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('✅ Cleared all caches');
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.log('✅ Unregistered all service workers');
      }

      // Clear sessionStorage and localStorage
      sessionStorage.clear();
      localStorage.clear();
      console.log('✅ Cleared local and session storage');

    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Check if migration is needed and handle it
   */
  static async checkAndMigrate(): Promise<boolean> {
    try {
      // Try to open the database with current version
      const request = indexedDB.open(DB_NAME);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const db = request.result;
          const currentVersion = db.version;
          db.close();

          if (currentVersion !== DB_VERSION) {
            console.log(`Database needs migration from v${currentVersion} to v${DB_VERSION}`);
            resolve(true);
          } else {
            console.log(`Database is at correct version: ${DB_VERSION}`);
            resolve(false);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error checking database version:', error);
      return false;
    }
  }

  /**
   * Get version mismatch info for user display
   */
  static getVersionMismatchInfo(error: Error): {
    isVersionError: boolean;
    message: string;
    action: string;
  } {
    if (error.name === 'VersionError') {
      return {
        isVersionError: true,
        message: 'Your browser has outdated cached files.',
        action: 'The app will clear the cache and reload automatically.'
      };
    }

    return {
      isVersionError: false,
      message: 'An unexpected error occurred.',
      action: 'Please try refreshing the page.'
    };
  }
}

export default DatabaseMigrationHandler;