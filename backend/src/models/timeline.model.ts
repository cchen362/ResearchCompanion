import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface TimelineEventDB {
  id: string;
  user_id: string;
  topic_id: string;
  type: string;
  title: string;
  description?: string;
  event_date: Date;
  data?: any;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export class TimelineModel {
  /**
   * Create a new timeline event
   */
  static async create(
    userId: string,
    topicId: string,
    type: string,
    title: string,
    data?: any,
    metadata?: any
  ): Promise<TimelineEventDB> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO timeline_events (
        id, user_id, topic_id, event_type, title,
        event_date, data, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      id,
      userId,
      topicId,
      type,
      title,
      now,
      data ? JSON.stringify(data) : null,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now
    ];

    try {
      const result = await db.query(query, values);
      return this.parseTimelineEvent(result.rows[0]);
    } catch (error) {
      console.error('Error creating timeline event:', error);
      throw error;
    }
  }

  /**
   * Get all timeline events for a user
   */
  static async getByUser(userId: string): Promise<TimelineEventDB[]> {
    const query = `
      SELECT * FROM timeline_events
      WHERE user_id = $1
      ORDER BY event_date DESC, created_at DESC
    `;

    try {
      const result = await db.query(query, [userId]);
      return result.rows.map(row => this.parseTimelineEvent(row));
    } catch (error) {
      console.error('Error getting user timeline:', error);
      throw error;
    }
  }

  /**
   * Get timeline events for a specific topic
   */
  static async getByTopic(userId: string, topicId: string): Promise<TimelineEventDB[]> {
    const query = `
      SELECT * FROM timeline_events
      WHERE user_id = $1 AND topic_id = $2
      ORDER BY event_date DESC, created_at DESC
    `;

    try {
      const result = await db.query(query, [userId, topicId]);
      return result.rows.map(row => this.parseTimelineEvent(row));
    } catch (error) {
      console.error('Error getting topic timeline:', error);
      throw error;
    }
  }

  /**
   * Get a single timeline event by ID
   */
  static async getById(userId: string, eventId: string): Promise<TimelineEventDB | null> {
    const query = `
      SELECT * FROM timeline_events
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await db.query(query, [eventId, userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.parseTimelineEvent(result.rows[0]);
    } catch (error) {
      console.error('Error getting timeline event:', error);
      throw error;
    }
  }

  /**
   * Update a timeline event
   */
  static async update(
    userId: string,
    eventId: string,
    updates: {
      title?: string;
      description?: string;
      event_date?: Date;
      data?: any;
      metadata?: any;
    }
  ): Promise<TimelineEventDB | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.event_date !== undefined) {
      fields.push(`event_date = $${paramCount++}`);
      values.push(updates.event_date);
    }
    if (updates.data !== undefined) {
      fields.push(`data = $${paramCount++}`);
      values.push(JSON.stringify(updates.data));
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return this.getById(userId, eventId);
    }

    fields.push(`updated_at = $${paramCount++}`);
    values.push(new Date());

    values.push(eventId);
    values.push(userId);

    const query = `
      UPDATE timeline_events
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    try {
      const result = await db.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      return this.parseTimelineEvent(result.rows[0]);
    } catch (error) {
      console.error('Error updating timeline event:', error);
      throw error;
    }
  }

  /**
   * Delete a timeline event
   */
  static async delete(userId: string, eventId: string): Promise<boolean> {
    const query = `
      DELETE FROM timeline_events
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    try {
      const result = await db.query(query, [eventId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting timeline event:', error);
      throw error;
    }
  }

  /**
   * Delete all timeline events for a topic
   */
  static async deleteByTopic(userId: string, topicId: string): Promise<number> {
    const query = `
      DELETE FROM timeline_events
      WHERE user_id = $1 AND topic_id = $2
      RETURNING id
    `;

    try {
      const result = await db.query(query, [userId, topicId]);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error deleting topic timeline:', error);
      throw error;
    }
  }

  /**
   * Get timeline events by type
   */
  static async getByType(userId: string, type: string): Promise<TimelineEventDB[]> {
    const query = `
      SELECT * FROM timeline_events
      WHERE user_id = $1 AND event_type = $2
      ORDER BY event_date DESC, created_at DESC
    `;

    try {
      const result = await db.query(query, [userId, type]);
      return result.rows.map(row => this.parseTimelineEvent(row));
    } catch (error) {
      console.error('Error getting timeline by type:', error);
      throw error;
    }
  }

  /**
   * Parse database row to TimelineEventDB
   */
  private static parseTimelineEvent(row: any): TimelineEventDB {
    return {
      id: row.id,
      user_id: row.user_id,
      topic_id: row.topic_id,
      type: row.event_type,  // Read from event_type column
      title: row.title,
      description: row.description,
      event_date: row.event_date,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}