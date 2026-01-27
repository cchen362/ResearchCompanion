import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '../services/api';

interface BuildInfo {
  version: string;
  buildTime: string;
  gitCommit: string;
  nodeVersion: string;
}

export function UpdateNotification() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState<BuildInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        setIsChecking(true);
        const response = await api.get<{ success: boolean } & BuildInfo>('/api/version');
        const serverVersion = response.data;

        // Get stored version from localStorage
        const storedCommit = localStorage.getItem('app_git_commit');
        const storedBuildTime = localStorage.getItem('app_build_time');

        // If stored commit exists and differs from server, show update notification
        if (storedCommit && storedCommit !== serverVersion.gitCommit) {
          console.log(`Update available: ${storedCommit} -> ${serverVersion.gitCommit}`);
          setNeedsUpdate(true);
          setNewVersion(serverVersion);
        } else if (!storedCommit) {
          // First time visit - store the version
          console.log(`First visit, storing version: ${serverVersion.gitCommit}`);
        }

        // Always update stored version info for comparison
        localStorage.setItem('app_git_commit', serverVersion.gitCommit);
        localStorage.setItem('app_build_time', serverVersion.buildTime);
        localStorage.setItem('app_version', serverVersion.version);
      } catch (error) {
        console.error('Version check failed:', error);
        // Don't show error to user - version check is non-critical
      } finally {
        setIsChecking(false);
      }
    };

    // Check on mount
    checkVersion();

    // Check every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    // Also check when window regains focus
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleUpdate = async () => {
    console.log('User requested update, clearing caches and reloading...');

    // Clear all caches if service worker is present
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('All caches cleared');
      } catch (error) {
        console.error('Failed to clear caches:', error);
      }
    }

    // Clear localStorage version to force fresh check on reload
    localStorage.removeItem('app_git_commit');
    localStorage.removeItem('app_build_time');

    // Hard refresh - bypass cache
    window.location.reload();
  };

  const handleDismiss = () => {
    setNeedsUpdate(false);
    // Store dismissed version to avoid nagging
    if (newVersion) {
      localStorage.setItem('dismissed_version', newVersion.gitCommit);
    }
  };

  // Don't show if this version was already dismissed
  useEffect(() => {
    const dismissedVersion = localStorage.getItem('dismissed_version');
    if (dismissedVersion && newVersion?.gitCommit === dismissedVersion) {
      setNeedsUpdate(false);
    }
  }, [newVersion]);

  if (!needsUpdate || !newVersion) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 z-50 shadow-lg animate-in slide-in-from-top-2 duration-300">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 animate-pulse" />
          <div>
            <p className="font-semibold">Update Available</p>
            <p className="text-sm text-blue-100">
              A new version ({newVersion.gitCommit}) is ready. Refresh to get the latest features and fixes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="text-white hover:text-blue-100 hover:bg-blue-600"
          >
            Later
          </Button>
          <Button
            onClick={handleUpdate}
            variant="secondary"
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </Button>
        </div>
      </div>
    </div>
  );
}