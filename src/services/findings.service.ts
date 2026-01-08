import { getDB } from '@/utils/db/database';
import type { ResearchFinding } from '@/types';

class FindingsService {
  async getFindings(topicId?: string): Promise<ResearchFinding[]> {
    const db = await getDB();
    const tx = db.transaction('findings', 'readonly');
    const store = tx.objectStore('findings');

    if (topicId) {
      const index = store.index('by-topic');
      return await index.getAll(topicId);
    }

    return await store.getAll();
  }

  async getFinding(id: string): Promise<ResearchFinding | undefined> {
    const db = await getDB();
    const tx = db.transaction('findings', 'readonly');
    const store = tx.objectStore('findings');
    return await store.get(id);
  }

  async saveFinding(finding: ResearchFinding): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');
    await store.put(finding);
    await tx.done;
  }

  async deleteFinding(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');
    await store.delete(id);
    await tx.done;
  }
}

export const findingsService = new FindingsService();