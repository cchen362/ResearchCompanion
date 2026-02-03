import { api } from '@/services/api';
import type { SmartDigest } from '@/types';

interface DigestsResponse {
  success: boolean;
  digests: any[];
}

interface DigestResponse {
  success: boolean;
  digest: any;
  deduplicated?: boolean;  // Flag from backend when returning existing digest
  message?: string;        // Optional message about deduplication
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

interface StatsResponse {
  success: boolean;
  stats: {
    total: number;
    by_type: Array<{ type: string; count: number }>;
    by_topic: Array<{ topic_id: string; count: number }>;
  };
}

class DigestsAPIService {
  private baseUrl = '/digests';

  /**
   * Transform backend digest to frontend SmartDigest interface
   * Now includes cache metadata from the response context
   */
  private transformToFrontend(apiDigest: any, responseContext?: { deduplicated?: boolean; source?: string }): SmartDigest {
    const digest: SmartDigest = {
      id: apiDigest.id,
      topicId: apiDigest.topic_id || '',
      timeframe: apiDigest.type || 'weekly',
      generatedAt: new Date(apiDigest.created_at).getTime(),
      executiveSummary: apiDigest.executive_summary || '',
      laymanSummary: apiDigest.metadata?.laymanSummary || '',
      themes: apiDigest.themes || [],
      keyTakeaways: apiDigest.metadata?.keyTakeaways || [],
      breakthroughs: apiDigest.breakthroughs || [],
      contradictions: apiDigest.contradictions || [],
      trends: apiDigest.metadata?.trends || {
        emerging: [],
        declining: [],
        stable: []
      },
      statistics: apiDigest.metadata?.statistics || {
        totalFindings: apiDigest.finding_ids?.length || 0,
        newFindings: 0,
        highRelevanceCount: 0,
        sourceCount: 0,
        avgConfidence: 0
      },
      topSources: apiDigest.metadata?.topSources || [],
      allFindingIds: apiDigest.finding_ids || [],
      userEngagement: apiDigest.metadata?.userEngagement
    };

    // Add cache metadata if we have context about the response
    if (responseContext) {
      digest.cacheMetadata = {
        source: responseContext.source as 'postgresql' | 'indexeddb' | 'generated' || 'postgresql',
        isCached: responseContext.deduplicated || false,
        deduplicated: responseContext.deduplicated || false,
        originalGeneratedAt: new Date(apiDigest.created_at).getTime(),
        cacheRetrievedAt: Date.now()
      };
    }

    return digest;
  }

  /**
   * Transform frontend SmartDigest to backend format
   */
  private transformToBackend(digest: Partial<SmartDigest>): any {
    console.log('[DigestsAPIService] transformToBackend input:', digest);
    if (!digest) {
      console.error('[DigestsAPIService] ERROR: digest is undefined in transformToBackend!');
      throw new Error('Cannot transform undefined digest');
    }
    return {
      topic_id: digest.topicId || null,
      type: digest.timeframe || 'weekly',
      title: digest.executiveSummary?.substring(0, 100) || 'Research Digest',
      executive_summary: digest.executiveSummary || '',
      themes: digest.themes || [],
      contradictions: digest.contradictions || [],
      breakthroughs: digest.breakthroughs || [],
      knowledge_gaps: digest.knowledgeGaps || [],
      next_steps: digest.recommendations || [],
      // FIX: Use allFindingIds from SmartDigest interface
      finding_ids: digest.allFindingIds || [],
      metadata: {
        laymanSummary: digest.laymanSummary,
        keyTakeaways: digest.keyTakeaways,
        trendsAndPatterns: digest.trendsAndPatterns,
        statistics: digest.statistics,
        status: digest.status,
        progress: digest.progress
      }
    };
  }

  async getDigests(topicId?: string, limit = 50): Promise<SmartDigest[]> {
    try {
      const params = new URLSearchParams();
      if (topicId) params.append('topic_id', topicId);
      if (limit) params.append('limit', String(limit));

      const queryString = params.toString();
      const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;

      const response = await api.get<DigestsResponse>(url);

      if (response.data.success) {
        return response.data.digests.map(d => this.transformToFrontend(d));
      }

      throw new Error('Failed to fetch digests');
    } catch (error) {
      console.error('Error fetching digests:', error);
      throw error;
    }
  }

  async getLatestDigest(topicId: string, timeframe?: string): Promise<SmartDigest | undefined> {
    try {
      const url = timeframe
        ? `${this.baseUrl}/latest/${topicId}?timeframe=${timeframe}`
        : `${this.baseUrl}/latest/${topicId}`;

      const response = await api.get<DigestResponse>(url);

      if (response.data.success) {
        // Pass deduplicated flag to transformation
        return this.transformToFrontend(response.data.digest, {
          deduplicated: response.data.deduplicated,
          source: 'postgresql'
        });
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      console.error('Error fetching latest digest:', error);
      throw error;
    }
  }

  async getDigest(id: string): Promise<SmartDigest | undefined> {
    try {
      const response = await api.get<DigestResponse>(`${this.baseUrl}/${id}`);

      if (response.data.success) {
        return this.transformToFrontend(response.data.digest);
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      console.error('Error fetching digest:', error);
      throw error;
    }
  }

  async saveDigest(digest: SmartDigest): Promise<SmartDigest> {
    try {
      const backendData = this.transformToBackend(digest);

      // Always create new - POST to let server assign UUID
      // For updates, use updateDigest() method
      const response = await api.post<DigestResponse>(this.baseUrl, backendData);
      if (response.data.success) {
        // Pass deduplicated flag if backend returned existing digest
        return this.transformToFrontend(response.data.digest, {
          deduplicated: response.data.deduplicated,
          source: response.data.deduplicated ? 'postgresql' : 'generated'
        });
      }

      throw new Error('Failed to save digest');
    } catch (error) {
      console.error('Error saving digest:', error);
      throw error;
    }
  }

  async updateDigest(id: string, updates: Partial<SmartDigest>): Promise<SmartDigest> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<DigestResponse>(
        `${this.baseUrl}/${id}`,
        backendData
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.digest);
      }

      throw new Error('Failed to update digest');
    } catch (error) {
      console.error('Error updating digest:', error);
      throw error;
    }
  }

  async deleteDigest(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete digest');
      }
    } catch (error) {
      console.error('Error deleting digest:', error);
      throw error;
    }
  }

  async getStats(): Promise<StatsResponse['stats']> {
    try {
      const response = await api.get<StatsResponse>(`${this.baseUrl}/stats`);

      if (response.data.success) {
        return response.data.stats;
      }

      throw new Error('Failed to get stats');
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
}

export const digestsAPIService = new DigestsAPIService();
