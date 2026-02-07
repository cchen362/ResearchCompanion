/**
 * FindingsService - Consolidated service for research findings
 *
 * Phase 1 Refactoring: Service Layer Consolidation
 *
 * This service merges:
 * - findings.service.ts (old version with dual API/local paths)
 * - findings.api.service.ts (transformation functions + API calls)
 *
 * Architecture: Server-first with IndexedDB cache for offline support
 */

import { api } from './api';
import { getDB } from '@/utils/db/database';
import { logger } from '@/utils/logger';
import type { ResearchFinding } from '@/types';

// API Response types
interface FindingsResponse {
  success: boolean;
  findings: any[];
  count?: number;
}

interface FindingResponse {
  success: boolean;
  finding: any;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  count?: number;
}

interface StatsResponse {
  success: boolean;
  stats: {
    total: number;
    unread: number;
    starred: number;
    by_category: Array<{ category: string; count: number }>;
  };
}

export interface FindingsOptions {
  category?: string;
  isStarred?: boolean;
  isRead?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

class FindingsService {
  private baseUrl = '/findings';

  // ==================== Transformation Functions ====================

  /**
   * Transform backend finding to frontend ResearchFinding interface
   * Preserves all backend fields while mapping to frontend structure
   */
  private transformToFrontend(apiFinding: any): ResearchFinding {
    return {
      id: apiFinding.id,
      agentId: apiFinding.agent_id || '',
      agentType: apiFinding.metadata?.agentType || apiFinding.category || 'study',
      topicId: apiFinding.topic_id || '',
      type: apiFinding.category || 'study',
      title: apiFinding.title,
      summary: apiFinding.summary || apiFinding.content,
      details: apiFinding.content,
      source: apiFinding.source || {
        type: 'unknown',
        name: 'Unknown Source',
        displayName: 'Unknown Source',
        url: ''
      },
      isNew: this.calculateIsNew(apiFinding),
      timestamp: new Date(apiFinding.created_at).getTime(),
      extractedEntities: apiFinding.metadata?.extractedEntities,
      ...apiFinding.metadata
    };
  }

  /**
   * A finding is "new" (unread) if is_read is false.
   * No time-based heuristics — trust the database column.
   */
  private calculateIsNew(apiFinding: any): boolean {
    return apiFinding.is_read === false;
  }

  /**
   * Transform frontend ResearchFinding to backend format
   */
  private transformToBackend(finding: Partial<ResearchFinding>): any {
    return {
      topic_id: finding.topicId || null,
      agent_id: finding.agentId || null,
      title: finding.title,
      content: finding.details || finding.summary || '',
      summary: finding.summary || '',
      source: finding.source,
      category: finding.type || 'study',
      metadata: {
        agentType: finding.agentType,
        extractedEntities: finding.extractedEntities,
        isNew: finding.isNew,
        timestamp: finding.timestamp
      },
      relevance_score: null,
      tags: []
    };
  }

  // ==================== CRUD Operations ====================

  /**
   * Get findings with optional filtering
   * Server-first with cache fallback when offline
   */
  async getFindings(topicId?: string, options?: FindingsOptions): Promise<ResearchFinding[]> {
    try {
      const params = new URLSearchParams();
      if (topicId) params.append('topic_id', topicId);
      if (options?.category) params.append('category', options.category);
      if (options?.isStarred !== undefined) params.append('is_starred', String(options.isStarred));
      if (options?.isRead !== undefined) params.append('is_read', String(options.isRead));
      if (options?.search) params.append('search', options.search);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));

      const queryString = params.toString();
      const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;

      const response = await api.get<FindingsResponse>(url);

      if (response.data.success) {
        const findings = response.data.findings.map(f => this.transformToFrontend(f));
        // Cache the results
        await this.cacheFindings(findings);
        return findings;
      }

      throw new Error('Failed to fetch findings');
    } catch (error) {
      // Fallback to cache if offline
      if (!navigator.onLine) {
        return await this.getCachedFindings(topicId, options);
      }
      logger.error('[FindingsService] Error fetching findings:', error);
      throw error;
    }
  }

  /**
   * Get a single finding by ID
   */
  async getFinding(id: string): Promise<ResearchFinding | undefined> {
    try {
      const response = await api.get<FindingResponse>(`${this.baseUrl}/${id}`);

      if (response.data.success) {
        const finding = this.transformToFrontend(response.data.finding);
        await this.cacheFinding(finding);
        return finding;
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }

      // Fallback to cache if offline
      if (!navigator.onLine) {
        return await this.getCachedFinding(id);
      }

      logger.error('[FindingsService] Error fetching finding:', error);
      throw error;
    }
  }

  /**
   * Save a single finding (create or update)
   */
  async saveFinding(finding: ResearchFinding): Promise<ResearchFinding> {
    try {
      const backendData = this.transformToBackend(finding);

      let response;
      if (finding.id && finding.id !== '') {
        // Update existing finding
        response = await api.put<FindingResponse>(`${this.baseUrl}/${finding.id}`, backendData);
      } else {
        // Create new finding - let server assign UUID
        response = await api.post<FindingResponse>(this.baseUrl, backendData);
      }

      if (response.data.success) {
        const savedFinding = this.transformToFrontend(response.data.finding);
        await this.cacheFinding(savedFinding);
        return savedFinding;
      }

      throw new Error('Failed to save finding');
    } catch (error) {
      logger.error('[FindingsService] Error saving finding:', error);
      throw error;
    }
  }

  /**
   * Save multiple findings in bulk
   */
  async saveFindings(findings: ResearchFinding[]): Promise<ResearchFinding[]> {
    try {
      const backendData = findings.map(f => this.transformToBackend(f));

      const response = await api.post<FindingsResponse>(
        `${this.baseUrl}/bulk`,
        backendData
      );

      if (response.data.success) {
        const savedFindings = response.data.findings.map(f => this.transformToFrontend(f));
        await this.cacheFindings(savedFindings);
        return savedFindings;
      }

      throw new Error('Failed to save findings');
    } catch (error) {
      logger.error('[FindingsService] Error saving findings:', error);
      throw error;
    }
  }

  /**
   * Update an existing finding
   */
  async updateFinding(id: string, updates: Partial<ResearchFinding>): Promise<ResearchFinding> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<FindingResponse>(
        `${this.baseUrl}/${id}`,
        backendData
      );

      if (response.data.success) {
        const updatedFinding = this.transformToFrontend(response.data.finding);
        await this.cacheFinding(updatedFinding);
        return updatedFinding;
      }

      throw new Error('Failed to update finding');
    } catch (error) {
      logger.error('[FindingsService] Error updating finding:', error);
      throw error;
    }
  }

  /**
   * Delete a single finding
   */
  async deleteFinding(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete finding');
      }

      await this.removeCachedFinding(id);
    } catch (error) {
      logger.error('[FindingsService] Error deleting finding:', error);
      throw error;
    }
  }

  /**
   * Delete multiple findings
   */
  async deleteFindings(ids: string[]): Promise<number> {
    try {
      const response = await api.post<DeleteResponse>(
        `${this.baseUrl}/bulk-delete`,
        { ids }
      );

      if (response.data.success) {
        // Remove from cache
        for (const id of ids) {
          await this.removeCachedFinding(id);
        }
        return response.data.count || 0;
      }

      throw new Error('Failed to delete findings');
    } catch (error) {
      logger.error('[FindingsService] Error deleting findings:', error);
      throw error;
    }
  }

  // ==================== Read/Star Operations ====================

  /**
   * Mark a finding as read
   */
  async markFindingAsRead(id: string): Promise<ResearchFinding> {
    try {
      const response = await api.post<FindingResponse>(
        `${this.baseUrl}/${id}/read`,
        { is_read: true }
      );

      if (response.data.success) {
        const finding = this.transformToFrontend(response.data.finding);
        await this.cacheFinding(finding);
        return finding;
      }

      throw new Error('Failed to mark finding as read');
    } catch (error) {
      logger.error('[FindingsService] Error marking finding as read:', error);
      throw error;
    }
  }

  /**
   * Mark all unread findings as read (single bulk API call).
   * Optionally filter by topic.
   */
  async markFindingsAsRead(topicId?: string): Promise<number> {
    try {
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.put<{ success: boolean; markedCount: number }>(
        `${this.baseUrl}/mark-all-read${params}`
      );

      if (response.data.success) {
        return response.data.markedCount;
      }

      throw new Error('Failed to bulk mark findings as read');
    } catch (error) {
      logger.error('[FindingsService] Error bulk marking findings as read:', error);
      throw error;
    }
  }

  /**
   * Toggle star status on a finding
   */
  async toggleStar(id: string): Promise<ResearchFinding> {
    try {
      const response = await api.post<FindingResponse>(
        `${this.baseUrl}/${id}/star`
      );

      if (response.data.success) {
        const finding = this.transformToFrontend(response.data.finding);
        await this.cacheFinding(finding);
        return finding;
      }

      throw new Error('Failed to toggle star');
    } catch (error) {
      logger.error('[FindingsService] Error toggling star:', error);
      throw error;
    }
  }

  // ==================== Search & Stats ====================

  /**
   * Search findings by query
   */
  async searchFindings(query: string, topicId?: string): Promise<ResearchFinding[]> {
    try {
      const params = new URLSearchParams({ q: query });
      if (topicId) params.append('topic_id', topicId);

      const response = await api.get<FindingsResponse>(
        `${this.baseUrl}/search?${params.toString()}`
      );

      if (response.data.success) {
        return response.data.findings.map(f => this.transformToFrontend(f));
      }

      throw new Error('Failed to search findings');
    } catch (error) {
      // Fallback to local search if offline
      if (!navigator.onLine) {
        return await this.searchCachedFindings(query, topicId);
      }
      logger.error('[FindingsService] Error searching findings:', error);
      throw error;
    }
  }

  /**
   * Get findings statistics
   */
  async getStats(topicId?: string): Promise<StatsResponse['stats']> {
    try {
      const url = topicId
        ? `${this.baseUrl}/stats?topic_id=${topicId}`
        : `${this.baseUrl}/stats`;

      const response = await api.get<StatsResponse>(url);

      if (response.data.success) {
        return response.data.stats;
      }

      throw new Error('Failed to get stats');
    } catch (error) {
      // Fallback to local stats if offline
      if (!navigator.onLine) {
        return await this.getCachedStats(topicId);
      }
      logger.error('[FindingsService] Error getting stats:', error);
      throw error;
    }
  }

  // ==================== Cache Operations ====================

  /**
   * Cache a single finding in IndexedDB
   */
  private async cacheFinding(finding: ResearchFinding): Promise<void> {
    try {
      const db = await getDB();
      await db.put('findings', {
        ...finding,
        _cachedAt: Date.now()
      });
    } catch (error) {
      logger.warn('[FindingsService] Failed to cache finding:', error);
    }
  }

  /**
   * Cache multiple findings in IndexedDB
   */
  private async cacheFindings(findings: ResearchFinding[]): Promise<void> {
    if (!findings.length) return;

    try {
      const db = await getDB();
      const tx = db.transaction('findings', 'readwrite');
      const timestamp = Date.now();

      for (const finding of findings) {
        await tx.store.put({ ...finding, _cachedAt: timestamp });
      }

      await tx.done;
    } catch (error) {
      logger.warn('[FindingsService] Failed to cache findings:', error);
    }
  }

  /**
   * Get a cached finding from IndexedDB
   */
  private async getCachedFinding(id: string): Promise<ResearchFinding | undefined> {
    try {
      const db = await getDB();
      return await db.get('findings', id);
    } catch (error) {
      logger.warn('[FindingsService] Failed to get cached finding:', error);
      return undefined;
    }
  }

  /**
   * Get cached findings from IndexedDB with filtering
   */
  private async getCachedFindings(topicId?: string, options?: FindingsOptions): Promise<ResearchFinding[]> {
    try {
      const db = await getDB();
      let findings: ResearchFinding[];

      if (topicId) {
        const index = db.transaction('findings', 'readonly').store.index('by-topic');
        findings = await index.getAll(topicId);
      } else {
        findings = await db.getAll('findings');
      }

      // Apply local filtering
      if (options?.category) {
        findings = findings.filter(f => f.type === options.category);
      }
      if (options?.limit) {
        findings = findings.slice(0, options.limit);
      }

      return findings;
    } catch (error) {
      logger.warn('[FindingsService] Failed to get cached findings:', error);
      return [];
    }
  }

  /**
   * Remove a cached finding from IndexedDB
   */
  private async removeCachedFinding(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('findings', id);
    } catch (error) {
      logger.warn('[FindingsService] Failed to remove cached finding:', error);
    }
  }

  /**
   * Search cached findings locally
   */
  private async searchCachedFindings(query: string, topicId?: string): Promise<ResearchFinding[]> {
    const findings = await this.getCachedFindings(topicId);
    const lowerQuery = query.toLowerCase();

    return findings.filter(f =>
      f.title?.toLowerCase().includes(lowerQuery) ||
      f.summary?.toLowerCase().includes(lowerQuery) ||
      f.details?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Calculate stats from cached findings
   */
  private async getCachedStats(topicId?: string): Promise<StatsResponse['stats']> {
    const findings = await this.getCachedFindings(topicId);
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
      starred: 0, // Not tracked in local cache
      by_category: byCategory
    };
  }
}

export const findingsService = new FindingsService();
