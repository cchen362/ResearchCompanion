import {
  getAllTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic
} from '@/utils/db/topics';
import type { Topic } from '@/types';

class TopicsService {
  async getTopics(): Promise<Topic[]> {
    return await getAllTopics();
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    return await getTopic(id);
  }

  async saveTopic(topic: Topic): Promise<Topic> {
    if (topic.id) {
      return await updateTopic(topic.id, topic);
    }
    return await createTopic(topic);
  }

  async deleteTopic(id: string): Promise<void> {
    await deleteTopic(id);
  }

  async getActiveTopics(): Promise<Topic[]> {
    const topics = await this.getTopics();
    // Filter topics that have been updated in the last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return topics.filter(topic => topic.updatedAt >= thirtyDaysAgo);
  }

  async getTopicsByCategory(category: string): Promise<Topic[]> {
    const topics = await this.getTopics();
    return topics.filter(topic =>
      topic.diseaseProfile?.category?.includes(category)
    );
  }
}

export const topicsService = new TopicsService();