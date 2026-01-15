import {
  getAllTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic
} from '@/utils/db/topics';
import { topicsAPIService } from './topics.api.service';
import { storageConfig } from '@/config/storage.config';
import type { Topic } from '@/types';

class TopicsService {
  private get isUsingAPI() {
    return storageConfig.useServerStorage;
  }

  async getTopics(): Promise<Topic[]> {
    if (this.isUsingAPI) {
      return await topicsAPIService.getTopics();
    }
    return await getAllTopics();
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    if (this.isUsingAPI) {
      return await topicsAPIService.getTopic(id);
    }
    return await getTopic(id);
  }

  async saveTopic(topic: Topic): Promise<Topic> {
    if (this.isUsingAPI) {
      return await topicsAPIService.saveTopic(topic);
    }

    if (topic.id) {
      return await updateTopic(topic.id, topic);
    }
    return await createTopic(topic);
  }

  async deleteTopic(id: string): Promise<void> {
    if (this.isUsingAPI) {
      return await topicsAPIService.deleteTopic(id);
    }
    await deleteTopic(id);
  }

  async getActiveTopics(): Promise<Topic[]> {
    if (this.isUsingAPI) {
      return await topicsAPIService.getActiveTopics();
    }

    const topics = await this.getTopics();
    // Filter topics that have been updated in the last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return topics.filter(topic => topic.updatedAt >= thirtyDaysAgo);
  }

  async getTopicsByCategory(category: string): Promise<Topic[]> {
    if (this.isUsingAPI) {
      return await topicsAPIService.getTopicsByCategory(category);
    }

    const topics = await this.getTopics();
    return topics.filter(topic =>
      topic.diseaseProfile?.category?.includes(category)
    );
  }
}

export const topicsService = new TopicsService();