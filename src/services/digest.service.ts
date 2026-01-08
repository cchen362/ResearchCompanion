import { getDB } from '@/utils/db/database';
import type { SmartDigest } from '@/types';

class DigestService {
  async getDigests(topicId?: string): Promise<SmartDigest[]> {
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
    const db = await getDB();
    const tx = db.transaction('digests', 'readonly');
    const store = tx.objectStore('digests');
    const digests = await store.getAll();
    return digests.find(d => d.topicId === topicId);
  }

  async saveDigest(digest: SmartDigest): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('digests', 'readwrite');
    const store = tx.objectStore('digests');
    await store.put(digest);
    await tx.done;
  }

  async deleteDigest(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('digests', 'readwrite');
    const store = tx.objectStore('digests');
    await store.delete(id);
    await tx.done;
  }
}

export const digestService = new DigestService();