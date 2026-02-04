import { getDB } from '@/utils/db/database';
import { findingsAPIService } from './findings.api.service';
import { storageConfig } from '@/config/storage.config';
import type { ResearchFinding } from '@/types';

class FindingsService {
  private get isUsingAPI() {
    return storageConfig.useServerStorage;
  }

  async getFindings(topicId?: string, options?: { limit?: number }): Promise<ResearchFinding[]> {
    if (this.isUsingAPI) {
      return await findingsAPIService.getFindings(topicId, options);
    }

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
    if (this.isUsingAPI) {
      return await findingsAPIService.getFinding(id);
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readonly');
    const store = tx.objectStore('findings');
    return await store.get(id);
  }

  async saveFinding(finding: ResearchFinding): Promise<ResearchFinding> {
    if (this.isUsingAPI) {
      return await findingsAPIService.saveFinding(finding);
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');
    await store.put(finding);
    await tx.done;
    return finding;
  }

  async saveFindings(findings: ResearchFinding[]): Promise<ResearchFinding[]> {
    if (this.isUsingAPI) {
      return await findingsAPIService.saveFindings(findings);
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');
    for (const finding of findings) {
      await store.put(finding);
    }
    await tx.done;
    return findings;
  }

  async deleteFinding(id: string): Promise<void> {
    if (this.isUsingAPI) {
      return await findingsAPIService.deleteFinding(id);
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');
    await store.delete(id);
    await tx.done;
  }

  async deleteFindings(ids: string[]): Promise<number> {
    if (this.isUsingAPI) {
      return await findingsAPIService.deleteFindings(ids);
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');
    for (const id of ids) {
      await store.delete(id);
    }
    await tx.done;
    return ids.length;
  }

  async markFindingsAsRead(topicId?: string): Promise<void> {
    if (this.isUsingAPI) {
      // For API, we need to mark each finding individually
      const findings = await this.getFindings(topicId);
      for (const finding of findings) {
        if (finding.isNew) {
          await findingsAPIService.markAsRead(finding.id, true);
        }
      }
      return;
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');

    let findings: ResearchFinding[];

    if (topicId) {
      const index = store.index('by-topic');
      findings = await index.getAll(topicId);
    } else {
      findings = await store.getAll();
    }

    // Update each finding to mark as read
    for (const finding of findings) {
      if (finding.isNew) {
        finding.isNew = false;
        await store.put(finding);
      }
    }

    await tx.done;
  }

  async markFindingAsRead(id: string): Promise<void> {
    if (this.isUsingAPI) {
      await findingsAPIService.markAsRead(id, true);
      return;
    }

    const db = await getDB();
    const tx = db.transaction('findings', 'readwrite');
    const store = tx.objectStore('findings');

    const finding = await store.get(id);
    if (finding && finding.isNew) {
      finding.isNew = false;
      await store.put(finding);
    }

    await tx.done;
  }

  async searchFindings(query: string, topicId?: string): Promise<ResearchFinding[]> {
    if (this.isUsingAPI) {
      return await findingsAPIService.searchFindings(query, topicId);
    }

    // Local search implementation
    const findings = await this.getFindings(topicId);
    const lowerQuery = query.toLowerCase();
    return findings.filter(f =>
      f.title?.toLowerCase().includes(lowerQuery) ||
      f.summary?.toLowerCase().includes(lowerQuery) ||
      f.details?.toLowerCase().includes(lowerQuery)
    );
  }

  async getStats(topicId?: string) {
    if (this.isUsingAPI) {
      return await findingsAPIService.getStats(topicId);
    }

    // Local stats implementation
    const findings = await this.getFindings(topicId);
    const unread = findings.filter(f => f.isNew).length;
    const byCategory = findings.reduce((acc, f) => {
      const category = f.type || 'unknown';
      const existing = acc.find(item => item.category === category);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ category, count: 1 });
      }
      return acc;
    }, [] as Array<{ category: string; count: number }>);

    return {
      total: findings.length,
      unread,
      starred: 0, // Not tracked in local storage
      by_category: byCategory
    };
  }
}

export const findingsService = new FindingsService();