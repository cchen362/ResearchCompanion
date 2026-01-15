import { api } from '@/utils/api';
import type { Topic } from '@/types';

interface TopicsResponse {
  success: boolean;
  topics: Topic[];
}

interface TopicResponse {
  success: boolean;
  topic: Topic;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

class TopicsAPIService {
  private baseUrl = '/api/topics';

  async getTopics(includeArchived = false): Promise<Topic[]> {
    try {
      const response = await api.get<TopicsResponse>(
        `${this.baseUrl}?includeArchived=${includeArchived}`
      );

      if (response.data.success) {
        return response.data.topics;
      }

      throw new Error('Failed to fetch topics');
    } catch (error) {
      console.error('Error fetching topics:', error);
      throw error;
    }
  }

  async getTopic(id: string, withStats = false): Promise<Topic | undefined> {
    try {
      const response = await api.get<TopicResponse>(
        `${this.baseUrl}/${id}?withStats=${withStats}`
      );

      if (response.data.success) {
        return response.data.topic;
      }

      return undefined;
    } catch (error) {
      if (error.response?.status === 404) {
        return undefined;
      }
      console.error('Error fetching topic:', error);
      throw error;
    }
  }

  async saveTopic(topic: Partial<Topic>): Promise<Topic> {
    try {
      // Prepare the topic data for the API
      const topicData = {
        name: topic.name,
        description: topic.description || '',
        metadata: {
          diseaseProfile: topic.diseaseProfile || {},
          isSearching: topic.isSearching || false,
          searchProgress: topic.searchProgress || 0
        },
        patient_context: topic.patientContext || {},
        sort_order: 0
      };

      if (topic.id) {
        // Update existing topic
        const response = await api.put<TopicResponse>(
          `${this.baseUrl}/${topic.id}`,
          topicData
        );

        if (response.data.success) {
          return this.transformApiTopic(response.data.topic);
        }
      } else {
        // Create new topic
        const response = await api.post<TopicResponse>(
          this.baseUrl,
          topicData
        );

        if (response.data.success) {
          return this.transformApiTopic(response.data.topic);
        }
      }

      throw new Error('Failed to save topic');
    } catch (error) {
      console.error('Error saving topic:', error);
      throw error;
    }
  }

  async deleteTopic(id: string): Promise<void> {
    try {
      const response = await api.delete<DeleteResponse>(
        `${this.baseUrl}/${id}`
      );

      if (!response.data.success) {
        throw new Error('Failed to delete topic');
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      throw error;
    }
  }

  async archiveTopic(id: string, archived = true): Promise<Topic> {
    try {
      const response = await api.post<TopicResponse>(
        `${this.baseUrl}/${id}/archive`,
        { archived }
      );

      if (response.data.success) {
        return this.transformApiTopic(response.data.topic);
      }

      throw new Error('Failed to archive topic');
    } catch (error) {
      console.error('Error archiving topic:', error);
      throw error;
    }
  }

  async reorderTopics(topics: Array<{ id: string; sort_order: number }>): Promise<void> {
    try {
      const response = await api.put<{ success: boolean; message: string }>(
        `${this.baseUrl}/reorder`,
        { topics }
      );

      if (!response.data.success) {
        throw new Error('Failed to reorder topics');
      }
    } catch (error) {
      console.error('Error reordering topics:', error);
      throw error;
    }
  }

  async getActiveTopics(): Promise<Topic[]> {
    const topics = await this.getTopics();
    // Filter topics that have been updated in the last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return topics.filter(topic => {
      const updatedAt = new Date(topic.updatedAt || topic.createdAt).getTime();
      return updatedAt >= thirtyDaysAgo;
    });
  }

  async getTopicsByCategory(category: string): Promise<Topic[]> {
    const topics = await this.getTopics();
    return topics.filter(topic =>
      topic.diseaseProfile?.category?.includes(category)
    );
  }

  /**
   * Transform API response topic to match frontend Topic interface
   */
  private transformApiTopic(apiTopic: any): Topic {
    return {
      id: apiTopic.id,
      name: apiTopic.name,
      description: apiTopic.description,
      diseaseProfile: apiTopic.metadata?.diseaseProfile || {},
      patientContext: apiTopic.patient_context || {},
      createdAt: new Date(apiTopic.created_at).getTime(),
      updatedAt: new Date(apiTopic.updated_at).getTime(),
      isSearching: apiTopic.metadata?.isSearching || false,
      searchProgress: apiTopic.metadata?.searchProgress || 0,
      ...apiTopic.metadata // Spread any additional metadata
    };
  }
}

export const topicsAPIService = new TopicsAPIService();