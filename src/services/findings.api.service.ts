import { api } from '@/services/api';
import type { ResearchFinding } from '@/types';

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

class FindingsAPIService {
  private baseUrl = '/findings';

  /**
   * Transform backend finding to frontend ResearchFinding interface
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
      isNew: !apiFinding.is_read,
      timestamp: new Date(apiFinding.created_at).getTime(),
      extractedEntities: apiFinding.metadata?.extractedEntities,
      ...apiFinding.metadata
    };
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

  async getFindings(topicId?: string, options?: {
    category?: string;
    isStarred?: boolean;
    isRead?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ResearchFinding[]> {
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
        return response.data.findings.map(f => this.transformToFrontend(f));
      }

      throw new Error('Failed to fetch findings');
    } catch (error) {
      console.error('Error fetching findings:', error);
      throw error;
    }
  }

  async getFinding(id: string): Promise<ResearchFinding | undefined> {
    try {
      const response = await api.get<FindingResponse>(`${this.baseUrl}/${id}`);

      if (response.data.success) {
        return this.transformToFrontend(response.data.finding);
      }

      return undefined;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return undefined;
      }
      console.error('Error fetching finding:', error);
      throw error;
    }
  }

  async saveFinding(finding: ResearchFinding): Promise<ResearchFinding> {
    try {
      const backendData = this.transformToBackend(finding);

      // Always create new - POST to let server assign UUID
      // For updates, use updateFinding() method
      const response = await api.post<FindingResponse>(this.baseUrl, backendData);
      if (response.data.success) {
        return this.transformToFrontend(response.data.finding);
      }

      throw new Error('Failed to save finding');
    } catch (error) {
      console.error('Error saving finding:', error);
      throw error;
    }
  }

  async updateFinding(id: string, updates: Partial<ResearchFinding>): Promise<ResearchFinding> {
    try {
      const backendData = this.transformToBackend(updates);
      const response = await api.put<FindingResponse>(
        `${this.baseUrl}/${id}`,
        backendData
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.finding);
      }

      throw new Error('Failed to update finding');
    } catch (error) {
      console.error('Error updating finding:', error);
      throw error;
    }
  }

  async saveFindings(findings: ResearchFinding[]): Promise<ResearchFinding[]> {
    try {
      const backendData = findings.map(f => this.transformToBackend(f));

      const response = await api.post<FindingsResponse>(
        `${this.baseUrl}/bulk`,
        backendData
      );

      if (response.data.success) {
        return response.data.findings.map(f => this.transformToFrontend(f));
      }

      throw new Error('Failed to save findings');
    } catch (error) {
      console.error('Error saving findings:', error);
      throw error;
    }
  }

  async deleteFinding(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(`${this.baseUrl}/${id}`);

      if (!response.data.success) {
        throw new Error('Failed to delete finding');
      }
    } catch (error) {
      console.error('Error deleting finding:', error);
      throw error;
    }
  }

  async deleteFindings(ids: string[]): Promise<number> {
    try {
      const response = await api.post<DeleteResponse>(
        `${this.baseUrl}/bulk-delete`,
        { ids }
      );

      if (response.data.success) {
        return response.data.count || 0;
      }

      throw new Error('Failed to delete findings');
    } catch (error) {
      console.error('Error deleting findings:', error);
      throw error;
    }
  }

  async markAsRead(id: string, isRead = true): Promise<ResearchFinding> {
    try {
      const response = await api.post<FindingResponse>(
        `${this.baseUrl}/${id}/read`,
        { is_read: isRead }
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.finding);
      }

      throw new Error('Failed to mark finding as read');
    } catch (error) {
      console.error('Error marking finding as read:', error);
      throw error;
    }
  }

  async toggleStar(id: string): Promise<ResearchFinding> {
    try {
      const response = await api.post<FindingResponse>(
        `${this.baseUrl}/${id}/star`
      );

      if (response.data.success) {
        return this.transformToFrontend(response.data.finding);
      }

      throw new Error('Failed to toggle star');
    } catch (error) {
      console.error('Error toggling star:', error);
      throw error;
    }
  }

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
      console.error('Error getting stats:', error);
      throw error;
    }
  }

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
      console.error('Error searching findings:', error);
      throw error;
    }
  }
}

export const findingsAPIService = new FindingsAPIService();
