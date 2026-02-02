import { getDB } from '@/utils/db/database';
import { digestsAPIService } from './digests.api.service';
import { digestCacheService } from './digestCache.service';
import { storageConfig } from '@/config/storage.config';
import type { SmartDigest } from '@/types';

class DigestService {
  private get isUsingAPI() {
    return storageConfig.useServerStorage;
  }

  async getDigests(topicId?: string): Promise<SmartDigest[]> {
    if (this.isUsingAPI) {
      return await digestsAPIService.getDigests(topicId);
    }

    const db = await getDB();
    const tx = db.transaction('digests', 'readonly');
    const store = tx.objectStore('digests');
    const digests = await store.getAll();

    if (topicId) {
      return digests.filter(d => d.topicId === topicId);
    }

    return digests;
  }

  async getDigest(topicId: string, timeframe?: string): Promise<SmartDigest | undefined> {
    if (this.isUsingAPI) {
      // First check cache for a valid digest
      const cachedDigest = await digestCacheService.getCachedDigest(topicId, timeframe || 'weekly');

      if (cachedDigest && digestCacheService.isCacheValid(cachedDigest)) {
        // Return cached digest with metadata indicating it's from cache
        if (!cachedDigest.cacheMetadata) {
          cachedDigest.cacheMetadata = {};
        }
        cachedDigest.cacheMetadata.source = 'postgresql';
        cachedDigest.cacheMetadata.isCached = true;
        cachedDigest.cacheMetadata.cacheRetrievedAt = Date.now();
        return cachedDigest;
      }

      // No valid cache, fetch from API
      const digest = await digestsAPIService.getLatestDigest(topicId, timeframe);

      // Cache the fetched digest if valid
      if (digest) {
        await digestCacheService.cacheDigest(digest);
      }

      return digest;
    }

    // Local IndexedDB logic (unchanged)
    const db = await getDB();
    const tx = db.transaction('digests', 'readonly');
    const store = tx.objectStore('digests');
    const digests = await store.getAll();
    // Filter by topic and optionally by timeframe
    const digest = digests.find(d =>
      d.topicId === topicId &&
      (!timeframe || d.timeframe === timeframe)
    );

    if (digest && !digest.cacheMetadata) {
      digest.cacheMetadata = {
        source: 'indexeddb',
        isCached: true,
        cacheRetrievedAt: Date.now()
      };
    }

    return digest;
  }

  async getDigestById(id: string): Promise<SmartDigest | undefined> {
    if (this.isUsingAPI) {
      return await digestsAPIService.getDigest(id);
    }

    const db = await getDB();
    const tx = db.transaction('digests', 'readonly');
    const store = tx.objectStore('digests');
    return await store.get(id);
  }

  async saveDigest(digest: SmartDigest): Promise<SmartDigest> {
    if (this.isUsingAPI) {
      const savedDigest = await digestsAPIService.saveDigest(digest);
      // Update cache with the newly saved digest
      if (savedDigest && !savedDigest.cacheMetadata?.deduplicated) {
        await digestCacheService.cacheDigest(savedDigest);
      }
      return savedDigest;
    }

    const db = await getDB();
    const tx = db.transaction('digests', 'readwrite');
    const store = tx.objectStore('digests');
    await store.put(digest);
    await tx.done;
    return digest;
  }

  async warmCache(topicIds?: string[]): Promise<void> {
    if (this.isUsingAPI) {
      await digestCacheService.warmCache(topicIds);
    }
    // No need to warm cache for local IndexedDB
  }

  async deleteDigest(id: string): Promise<void> {
    if (this.isUsingAPI) {
      return await digestsAPIService.deleteDigest(id);
    }

    const db = await getDB();
    const tx = db.transaction('digests', 'readwrite');
    const store = tx.objectStore('digests');
    await store.delete(id);
    await tx.done;
  }

  async getStats() {
    if (this.isUsingAPI) {
      return await digestsAPIService.getStats();
    }

    // Local stats implementation
    const digests = await this.getDigests();
    const byType = digests.reduce((acc, d) => {
      const type = d.timeframe || 'weekly';
      const existing = acc.find(item => item.type === type);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ type, count: 1 });
      }
      return acc;
    }, [] as Array<{ type: string; count: number }>);

    const byTopic = digests.reduce((acc, d) => {
      const topicId = d.topicId;
      const existing = acc.find(item => item.topic_id === topicId);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ topic_id: topicId, count: 1 });
      }
      return acc;
    }, [] as Array<{ topic_id: string; count: number }>);

    return {
      total: digests.length,
      by_type: byType,
      by_topic: byTopic
    };
  }
}

export const digestService = new DigestService();