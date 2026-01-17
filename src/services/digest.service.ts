import { getDB } from '@/utils/db/database';
import { digestsAPIService } from './digests.api.service';
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

  async getDigest(topicId: string): Promise<SmartDigest | undefined> {
    if (this.isUsingAPI) {
      return await digestsAPIService.getLatestDigest(topicId);
    }

    const db = await getDB();
    const tx = db.transaction('digests', 'readonly');
    const store = tx.objectStore('digests');
    const digests = await store.getAll();
    return digests.find(d => d.topicId === topicId);
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
      return await digestsAPIService.saveDigest(digest);
    }

    const db = await getDB();
    const tx = db.transaction('digests', 'readwrite');
    const store = tx.objectStore('digests');
    await store.put(digest);
    await tx.done;
    return digest;
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