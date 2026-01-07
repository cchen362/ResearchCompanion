import { getDB } from '@/utils/db/database';
import type {
  SmartDigest,
  DigestTimeframe,
  ResearchFinding
} from '@/types';

export interface DigestCacheConfig {
  maxAge: number; // Max age in milliseconds
  staleWhileRevalidate: boolean;
  autoRefresh: boolean;
  refreshThreshold: number; // Number of new findings before auto-refresh
}

// Default cache configurations per timeframe
const DEFAULT_CACHE_CONFIGS: Record<DigestTimeframe, DigestCacheConfig> = {
  'daily': {
    maxAge: 1 * 60 * 60 * 1000, // 1 hour
    staleWhileRevalidate: true,
    autoRefresh: true,
    refreshThreshold: 3
  },
  'weekly': {
    maxAge: 6 * 60 * 60 * 1000, // 6 hours
    staleWhileRevalidate: true,
    autoRefresh: true,
    refreshThreshold: 10
  },
  'monthly': {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    staleWhileRevalidate: true,
    autoRefresh: true,
    refreshThreshold: 20
  },
  'all-time': {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    staleWhileRevalidate: true,
    autoRefresh: false,
    refreshThreshold: 50
  }
};

export class DigestCacheService {
  private static instance: DigestCacheService;
  private cacheConfigs: Map<string, DigestCacheConfig> = new Map();
  private digestVersions: Map<string, number> = new Map();

  private constructor() {
    // Initialize with default configs
    Object.entries(DEFAULT_CACHE_CONFIGS).forEach(([timeframe, config]) => {
      this.cacheConfigs.set(timeframe, config);
    });
  }

  static getInstance(): DigestCacheService {
    if (!DigestCacheService.instance) {
      DigestCacheService.instance = new DigestCacheService();
    }
    return DigestCacheService.instance;
  }

  // Get cached digest if valid
  async getCachedDigest(
    topicId: string,
    timeframe: DigestTimeframe
  ): Promise<{ digest: SmartDigest | null; isStale: boolean }> {
    const db = await getDB();

    try {
      // Get all digests for this topic
      const digests = await db.getAllFromIndex('digests', 'by-topic', topicId);

      // Find digest matching timeframe
      const matchingDigests = digests.filter(d => d.timeframe === timeframe);

      if (matchingDigests.length === 0) {
        return { digest: null, isStale: false };
      }

      // Sort by generation time (newest first)
      matchingDigests.sort((a, b) => b.generatedAt - a.generatedAt);
      const latestDigest = matchingDigests[0];

      // Get cache config
      const config = this.getCacheConfig(timeframe);

      // Check if digest is stale
      const age = Date.now() - latestDigest.generatedAt;
      const isStale = age > config.maxAge;

      // If stale but staleWhileRevalidate is enabled, still return it
      if (isStale && !config.staleWhileRevalidate) {
        return { digest: null, isStale: true };
      }

      return { digest: latestDigest, isStale };

    } catch (error) {
      console.error('Error getting cached digest:', error);
      return { digest: null, isStale: false };
    }
  }

  // Check if digest needs refresh based on new findings
  async shouldRefreshDigest(
    topicId: string,
    timeframe: DigestTimeframe,
    currentDigest: SmartDigest | null
  ): Promise<boolean> {
    if (!currentDigest) return true;

    const db = await getDB();
    const config = this.getCacheConfig(timeframe);

    // Check age first
    const age = Date.now() - currentDigest.generatedAt;
    if (age > config.maxAge) return true;

    // Check for new findings since digest generation
    const findings = await db.getAllFromIndex('findings', 'by-topic', topicId);
    const newFindings = findings.filter(f => f.timestamp > currentDigest.generatedAt);

    // If there are enough new findings, refresh
    if (newFindings.length >= config.refreshThreshold) {
      return true;
    }

    // Check if any high-relevance findings were added
    const highRelevanceNew = newFindings.filter(f => f.relevanceScore > 0.8);
    if (highRelevanceNew.length > 0 && config.autoRefresh) {
      return true;
    }

    return false;
  }

  // Save digest with version tracking
  async saveDigest(digest: SmartDigest): Promise<void> {
    const db = await getDB();

    // Increment version for this topic/timeframe combination
    const versionKey = `${digest.topicId}_${digest.timeframe}`;
    const currentVersion = this.digestVersions.get(versionKey) || 0;
    this.digestVersions.set(versionKey, currentVersion + 1);

    // Add version to digest metadata
    const digestWithVersion = {
      ...digest,
      version: currentVersion + 1,
      cacheMetadata: {
        savedAt: Date.now(),
        expiresAt: Date.now() + this.getCacheConfig(digest.timeframe).maxAge
      }
    };

    await db.put('digests', digestWithVersion);

    // Clean up old versions (keep last 3)
    await this.cleanupOldVersions(digest.topicId, digest.timeframe);
  }

  // Clean up old digest versions
  private async cleanupOldVersions(
    topicId: string,
    timeframe: DigestTimeframe,
    keepCount: number = 3
  ): Promise<void> {
    const db = await getDB();

    const digests = await db.getAllFromIndex('digests', 'by-topic', topicId);
    const matchingDigests = digests
      .filter(d => d.timeframe === timeframe)
      .sort((a, b) => b.generatedAt - a.generatedAt);

    // Delete old versions beyond keepCount
    if (matchingDigests.length > keepCount) {
      const toDelete = matchingDigests.slice(keepCount);
      for (const digest of toDelete) {
        await db.delete('digests', digest.id);
      }
    }
  }

  // Invalidate cache for a topic
  async invalidateCache(topicId: string, timeframe?: DigestTimeframe): Promise<void> {
    const db = await getDB();

    const digests = await db.getAllFromIndex('digests', 'by-topic', topicId);

    for (const digest of digests) {
      if (!timeframe || digest.timeframe === timeframe) {
        // Mark as stale by setting generatedAt to 0
        digest.generatedAt = 0;
        await db.put('digests', digest);
      }
    }
  }

  // Preload digest cache for quick access
  async preloadCache(topicId: string): Promise<void> {
    const timeframes: DigestTimeframe[] = ['daily', 'weekly', 'monthly', 'all-time'];

    // Load all digests for this topic in parallel
    await Promise.all(
      timeframes.map(tf => this.getCachedDigest(topicId, tf))
    );
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    totalDigests: number;
    staleDigests: number;
    averageAge: number;
    topicCount: number;
  }> {
    const db = await getDB();
    const allDigests = await db.getAll('digests');

    const now = Date.now();
    let totalAge = 0;
    let staleCount = 0;
    const topicSet = new Set<string>();

    for (const digest of allDigests) {
      const age = now - digest.generatedAt;
      totalAge += age;

      const config = this.getCacheConfig(digest.timeframe);
      if (age > config.maxAge) {
        staleCount++;
      }

      topicSet.add(digest.topicId);
    }

    return {
      totalDigests: allDigests.length,
      staleDigests: staleCount,
      averageAge: allDigests.length > 0 ? totalAge / allDigests.length : 0,
      topicCount: topicSet.size
    };
  }

  // Update cache configuration
  updateCacheConfig(timeframe: DigestTimeframe, config: Partial<DigestCacheConfig>): void {
    const currentConfig = this.getCacheConfig(timeframe);
    this.cacheConfigs.set(timeframe, { ...currentConfig, ...config });
  }

  // Get cache configuration for a timeframe
  private getCacheConfig(timeframe: DigestTimeframe): DigestCacheConfig {
    return this.cacheConfigs.get(timeframe) || DEFAULT_CACHE_CONFIGS[timeframe];
  }

  // Estimate cache size in bytes
  async estimateCacheSize(): Promise<number> {
    const db = await getDB();
    const allDigests = await db.getAll('digests');

    // Rough estimate: serialize and measure string length
    const totalSize = allDigests.reduce((sum, digest) => {
      return sum + JSON.stringify(digest).length;
    }, 0);

    return totalSize;
  }

  // Smart cache warming - pregenerate digests during idle time
  async warmCache(topicIds: string[]): Promise<void> {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(async () => {
        for (const topicId of topicIds) {
          await this.preloadCache(topicId);
        }
      });
    }
  }
}

// Export singleton instance
export const digestCacheService = DigestCacheService.getInstance();