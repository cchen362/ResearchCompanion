import { query, queryOne } from '../db/database.js';

export interface Digest {
  id: string;
  user_id: string;
  topic_id?: string | null;
  type: string;
  title?: string;
  executive_summary?: string;
  contradictions?: any[];
  breakthroughs?: any[];
  knowledge_gaps?: any[];
  next_steps?: any[];
  finding_ids?: string[];
  metadata?: any;
  featured_discovery?: any;
  top_findings?: any[];
  source_breakdown?: any;
  research_pulse?: string;
  worth_revisiting?: any[];
  created_at: Date;
}

export interface CreateDigestData {
  topic_id?: string | null;
  type: string;
  title?: string;
  executive_summary?: string;
  contradictions?: any[];
  breakthroughs?: any[];
  knowledge_gaps?: any[];
  next_steps?: any[];
  finding_ids?: string[];
  metadata?: any;
  featured_discovery?: any;
  top_findings?: any[];
  source_breakdown?: any;
  research_pulse?: string;
  worth_revisiting?: any[];
}

export class DigestModel {
  // Get all digests for a user
  static async getAllByUserId(userId: string, limit = 50): Promise<Digest[]> {
    return query<Digest>(
      `SELECT * FROM digests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }

  // Get digests for a specific topic
  static async getByTopicId(userId: string, topicId: string, limit = 20): Promise<Digest[]> {
    return query<Digest>(
      `SELECT * FROM digests
       WHERE user_id = $1 AND topic_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, topicId, limit]
    );
  }

  // Get latest digest for a topic
  static async getLatestByTopicId(userId: string, topicId: string): Promise<Digest | null> {
    return queryOne<Digest>(
      `SELECT * FROM digests
       WHERE user_id = $1 AND topic_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, topicId]
    );
  }

  // Get a single digest
  static async getById(id: string, userId: string): Promise<Digest | null> {
    return queryOne<Digest>(
      'SELECT * FROM digests WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  // Create a new digest
  static async create(userId: string, data: CreateDigestData): Promise<Digest> {
    const digest = await queryOne<Digest>(
      `INSERT INTO digests (
         user_id, topic_id, type, title, executive_summary,
         contradictions, breakthroughs, knowledge_gaps, next_steps,
         finding_ids, metadata,
         featured_discovery, top_findings, source_breakdown,
         research_pulse, worth_revisiting
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        userId,
        data.topic_id || null,
        data.type,
        data.title || null,
        data.executive_summary || null,
        JSON.stringify(data.contradictions || []),
        JSON.stringify(data.breakthroughs || []),
        JSON.stringify(data.knowledge_gaps || []),
        JSON.stringify(data.next_steps || []),
        data.finding_ids || [],
        JSON.stringify(data.metadata || {}),
        JSON.stringify(data.featured_discovery || null),
        JSON.stringify(data.top_findings || []),
        JSON.stringify(data.source_breakdown || null),
        data.research_pulse || '',
        JSON.stringify(data.worth_revisiting || [])
      ]
    );

    if (!digest) {
      throw new Error('Failed to create digest');
    }

    return digest;
  }

  // Update a digest
  static async update(id: string, userId: string, updates: Partial<Digest>): Promise<Digest | null> {
    const allowedFields = [
      'title', 'executive_summary', 'contradictions',
      'breakthroughs', 'knowledge_gaps', 'next_steps', 'metadata',
      'research_pulse', 'worth_revisiting'
    ];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (['contradictions', 'breakthroughs', 'knowledge_gaps', 'next_steps', 'metadata', 'worth_revisiting'].includes(key)) {
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

    return queryOne<Digest>(
      `UPDATE digests
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
  }

  // Delete a digest
  static async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM digests WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.length > 0;
  }

  // Delete all digests for a topic
  static async deleteByTopicId(userId: string, topicId: string): Promise<number> {
    const result = await query(
      'DELETE FROM digests WHERE user_id = $1 AND topic_id = $2 RETURNING id',
      [userId, topicId]
    );
    return result.length;
  }

  // Get digest statistics for a user
  static async getStats(userId: string): Promise<any> {
    const [total, byType, byTopic] = await Promise.all([
      queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM digests WHERE user_id = $1',
        [userId]
      ),
      query<{ type: string; count: number }>(
        'SELECT type, COUNT(*) as count FROM digests WHERE user_id = $1 GROUP BY type',
        [userId]
      ),
      query<{ topic_id: string; count: number }>(
        'SELECT topic_id, COUNT(*) as count FROM digests WHERE user_id = $1 AND topic_id IS NOT NULL GROUP BY topic_id',
        [userId]
      )
    ]);

    return {
      total: total?.count || 0,
      by_type: byType || [],
      by_topic: byTopic || []
    };
  }
}
