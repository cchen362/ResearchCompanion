import { useState, useEffect } from 'react';
import { digestCacheService } from '@/services/digestCache.service';
import type { DigestTimeframe } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Settings,
  Zap,
  Clock,
  RefreshCw,
  Trash2,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DigestSettingsProps {
  topicId?: string;
  onClose?: () => void;
}

export default function DigestSettings({ topicId, onClose }: DigestSettingsProps) {
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Analysis depth options (with localStorage persistence)
  const [analysisDepth, setAnalysisDepth] = useState<'quick' | 'standard' | 'deep'>(() => {
    const saved = localStorage.getItem('digestAnalysisDepth');
    return (saved as 'quick' | 'standard' | 'deep') || 'standard';
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<'1h' | '6h' | '24h' | 'never'>('6h');

  // Save analysis depth preference when it changes
  useEffect(() => {
    localStorage.setItem('digestAnalysisDepth', analysisDepth);
  }, [analysisDepth]);

  // Cache configuration per timeframe
  const [cacheConfigs, setCacheConfigs] = useState({
    daily: { maxAge: 1, unit: 'hours' },
    weekly: { maxAge: 6, unit: 'hours' },
    monthly: { maxAge: 24, unit: 'hours' },
    'all-time': { maxAge: 7, unit: 'days' }
  });

  const loadCacheStats = async () => {
    setLoading(true);
    try {
      const stats = await digestCacheService.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
      setMessage({ type: 'error', text: 'Failed to load cache statistics' });
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async (timeframe?: DigestTimeframe) => {
    setLoading(true);
    try {
      if (topicId) {
        await digestCacheService.invalidateCache(topicId, timeframe);
        setMessage({ type: 'success', text: 'Cache cleared successfully' });
      }
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear cache' });
    } finally {
      setLoading(false);
    }
  };

  const updateCacheConfig = (timeframe: DigestTimeframe, maxAge: number, unit: string) => {
    const milliseconds = unit === 'days' ? maxAge * 24 * 60 * 60 * 1000 : maxAge * 60 * 60 * 1000;

    digestCacheService.updateCacheConfig(timeframe, {
      maxAge: milliseconds,
      staleWhileRevalidate: true,
      autoRefresh: autoRefresh
    });

    setCacheConfigs(prev => ({
      ...prev,
      [timeframe]: { maxAge, unit }
    }));

    setMessage({ type: 'success', text: `Cache settings updated for ${timeframe}` });
  };

  const getRefreshIntervalMs = () => {
    switch (refreshInterval) {
      case '1h': return 3600000;
      case '6h': return 21600000;
      case '24h': return 86400000;
      default: return 0;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Digest Generation Settings
          </CardTitle>
          <CardDescription>
            Configure how research findings are analyzed and cached
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Analysis Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Analysis Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Analysis Depth */}
          <div>
            <label className="text-sm font-medium mb-2 block">Analysis Depth</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAnalysisDepth('quick')}
                className={`p-3 border-2 rounded-md text-center transition-all relative ${
                  analysisDepth === 'quick'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">Quick</div>
                <div className="text-xs text-muted-foreground">~5 seconds</div>
                <div className="text-xs mt-1">Basic insights</div>
              </button>
              <button
                onClick={() => setAnalysisDepth('standard')}
                className={`p-3 border-2 rounded-md text-center transition-all relative ${
                  analysisDepth === 'standard'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">Standard</div>
                <div className="text-xs text-muted-foreground">~15 seconds</div>
                <div className="text-xs mt-1">Balanced analysis</div>
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </button>
              <button
                onClick={() => setAnalysisDepth('deep')}
                className={`p-3 border-2 rounded-md text-center transition-all relative ${
                  analysisDepth === 'deep'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">Deep</div>
                <div className="text-xs text-muted-foreground">~30 seconds</div>
                <div className="text-xs mt-1">Full analysis</div>
              </button>
            </div>
          </div>

          {/* Auto Refresh */}
          <div>
            <label className="text-sm font-medium mb-2 block">Automatic Refresh</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Enable auto-refresh</span>
              </label>

              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value as any)}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="1h">Every hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="24h">Daily</option>
                  <option value="never">Manual only</option>
                </select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Cache Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(cacheConfigs) as DigestTimeframe[]).map((timeframe) => {
            const config = cacheConfigs[timeframe];
            return (
              <div key={timeframe} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium capitalize">{timeframe.replace('-', ' ')}</div>
                  <div className="text-xs text-muted-foreground">
                    Cache for {config.maxAge} {config.unit}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={config.maxAge}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 1;
                      updateCacheConfig(timeframe, newValue, config.unit);
                    }}
                    className="w-16 px-2 py-1 border rounded text-sm"
                  />
                  <select
                    value={config.unit}
                    onChange={(e) => updateCacheConfig(timeframe, config.maxAge, e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearCache(timeframe)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Cache Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!cacheStats ? (
            <Button onClick={loadCacheStats} disabled={loading} className="w-full">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Load Statistics
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Digests</div>
                <div className="text-xl font-semibold">{cacheStats.totalDigests}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Stale Digests</div>
                <div className="text-xl font-semibold flex items-center gap-2">
                  {cacheStats.staleDigests}
                  {cacheStats.staleDigests > 0 && (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Topics Cached</div>
                <div className="text-xl font-semibold">{cacheStats.topicCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Avg. Age</div>
                <div className="text-xl font-semibold">
                  {Math.round(cacheStats.averageAge / 3600000)}h
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => clearCache()}
              disabled={loading || !topicId}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Cache
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message display */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}
    </div>
  );
}