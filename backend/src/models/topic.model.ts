import { query, queryOne } from '../db/database.js';

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  metadata?: any;
  patient_context?: any;
  created_at: Date;
  updated_at: Date;
  archived: boolean;
  sort_order: number;
}

export class TopicModel {
  // Get all topics for a user
  static async getAllByUserId(userId: string, includeArchived = false): Promise<Topic[]> {
    const whereClause = includeArchived ? '' : 'AND archived = false';
    return query<Topic>(
      `SELECT * FROM topics
       WHERE user_id = $1 ${whereClause}
       ORDER BY sort_order ASC, created_at DESC`,
      [userId]
    );
  }

  // Get a single topic
  static async getById(id: string, userId: string): Promise<Topic | null> {
    return queryOne<Topic>(
      'SELECT * FROM topics WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  // Create a new topic
  static async create(userId: string, data: Partial<Topic>): Promise<Topic> {
    const topic = await queryOne<Topic>(
      `INSERT INTO topics (user_id, name, description, metadata, patient_context, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        data.name,
        data.description || null,
        JSON.stringify(data.metadata || {}),
        JSON.stringify(data.patient_context || {}),
        data.sort_order || 0
      ]
    );

    if (!topic) {
      throw new Error('Failed to create topic');
    }

    return topic;
  }

  // Update a topic
  static async update(id: string, userId: string, updates: Partial<Topic>): Promise<Topic | null> {
    const allowedFields = ['name', 'description', 'metadata', 'patient_context', 'archived', 'sort_order'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'metadata' || key === 'patient_context') {
          setClause.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      return this.getById(id, userId);
    }

    values.push(id, userId);

    return queryOne<Topic>(
      `UPDATE topics
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
  }

  // Delete a topic
  static async delete(id: string, userId: string): Promise<boolean> {
    // First check if topic exists
    const topic = await this.getById(id, userId);
    if (!topic) {
      return false;
    }

    // Delete the topic
    await query(
      'DELETE FROM topics WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return true;
  }

  // Archive/unarchive a topic
  static async setArchived(id: string, userId: string, archived: boolean): Promise<Topic | null> {
    return queryOne<Topic>(
      `UPDATE topics
       SET archived = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [archived, id, userId]
    );
  }

  // Update sort order for multiple topics
  static async updateSortOrders(userId: string, topicOrders: Array<{ id: string; sort_order: number }>): Promise<void> {
    // Use a transaction to update all at once
    const promises = topicOrders.map(({ id, sort_order }) =>
      query(
        'UPDATE topics SET sort_order = $1 WHERE id = $2 AND user_id = $3',
        [sort_order, id, userId]
      )
    );
    await Promise.all(promises);
  }

  // Get topic with related counts
  static async getWithStats(id: string, userId: string): Promise<any> {
    const topic = await this.getById(id, userId);
    if (!topic) return null;

    // Get counts of related data
    const [findingsCount, digestsCount, timelineCount] = await Promise.all([
      queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM findings WHERE topic_id = $1 AND user_id = $2',
        [id, userId]
      ),
      queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM digests WHERE topic_id = $1 AND user_id = $2',
        [id, userId]
      ),
      queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM timeline_events WHERE topic_id = $1 AND user_id = $2',
        [id, userId]
      )
    ]);

    return {
      ...topic,
      findings_count: findingsCount?.count || 0,
      digests_count: digestsCount?.count || 0,
      timeline_count: timelineCount?.count || 0
    };
  }
}