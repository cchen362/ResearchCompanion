import { query, queryOne } from '../db/database.js';

export interface Finding {
  id: string;
  user_id: string;
  topic_id?: string | null;
  agent_id?: string | null;
  title: string;
  content: string;
  summary?: string;
  source: {
    type: string;
    name: string;
    displayName?: string;
    url?: string;
    journal?: string;
    publishDate?: string;
  };
  metadata?: any;
  relevance_score?: number | null;
  category?: string;
  tags?: string[];
  is_read: boolean;
  is_starred: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FindingFilter {
  topic_id?: string;
  category?: string;
  is_starred?: boolean;
  is_read?: boolean;
  search?: string;
  date_from?: Date;
  date_to?: Date;
  limit?: number;
  offset?: number;
}

export class FindingModel {
  // Get findings with filters
  static async getFiltered(userId: string, filters: FindingFilter = {}): Promise<Finding[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];
    let paramCount = 2;

    if (filters.topic_id) {
      conditions.push(`topic_id = $${paramCount}`);
      params.push(filters.topic_id);
      paramCount++;
    }

    if (filters.category) {
      conditions.push(`category = $${paramCount}`);
      params.push(filters.category);
      paramCount++;
    }

    if (filters.is_starred !== undefined) {
      conditions.push(`is_starred = $${paramCount}`);
      params.push(filters.is_starred);
      paramCount++;
    }

    if (filters.is_read !== undefined) {
      conditions.push(`is_read = $${paramCount}`);
      params.push(filters.is_read);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(`(title ILIKE $${paramCount} OR content ILIKE $${paramCount} OR summary ILIKE $${paramCount})`);
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.date_from) {
      conditions.push(`created_at >= $${paramCount}`);
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      conditions.push(`created_at <= $${paramCount}`);
      params.push(filters.date_to);
      paramCount++;
    }

    let queryStr = `SELECT * FROM findings WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;

    if (filters.limit) {
      queryStr += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      queryStr += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
    }

    return query<Finding>(queryStr, params);
  }

  // Get a single finding
  static async getById(id: string, userId: string): Promise<Finding | null> {
    return queryOne<Finding>(
      'SELECT * FROM findings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  // Create a new finding
  static async create(userId: string, data: Partial<Finding>): Promise<Finding> {
    const finding = await queryOne<Finding>(
      `INSERT INTO findings (
         user_id, topic_id, agent_id, title, content, summary,
         source, metadata, relevance_score, category, tags
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        data.topic_id || null,
        data.agent_id || null,
        data.title,
        data.content,
        data.summary || null,
        JSON.stringify(data.source),
        JSON.stringify(data.metadata || {}),
        data.relevance_score || null,
        data.category || null,
        data.tags || []
      ]
    );

    if (!finding) {
      throw new Error('Failed to create finding');
    }

    return finding;
  }

  // Check if a finding with this source URL already exists for this user+topic
  static async existsBySourceUrl(
    userId: string,
    topicId: string,
    sourceUrl: string
  ): Promise<boolean> {
    if (!sourceUrl || sourceUrl === '#') return false;
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM findings
       WHERE user_id = $1 AND topic_id = $2 AND source->>'url' = $3
       LIMIT 1`,
      [userId, topicId, sourceUrl]
    );
    return !!existing;
  }

  // Create multiple findings in bulk
  static async createBulk(userId: string, findings: Partial<Finding>[]): Promise<Finding[]> {
    if (findings.length === 0) return [];

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramCount = 1;

    for (const finding of findings) {
      const row = [
        userId,
        finding.topic_id || null,
        finding.agent_id || null,
        finding.title,
        finding.content,
        finding.summary || null,
        JSON.stringify(finding.source),
        JSON.stringify(finding.metadata || {}),
        finding.relevance_score || null,
        finding.category || null,
        finding.tags || []
      ];

      const rowPlaceholders = row.map(() => `$${paramCount++}`).join(', ');
      placeholders.push(`(${rowPlaceholders})`);
      values.push(...row);
    }

    return query<Finding>(
      `INSERT INTO findings (
         user_id, topic_id, agent_id, title, content, summary,
         source, metadata, relevance_score, category, tags
       )
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values
    );
  }

  // Update a finding
  static async update(id: string, userId: string, updates: Partial<Finding>): Promise<Finding | null> {
    const allowedFields = ['title', 'content', 'summary', 'source', 'metadata',
                         'relevance_score', 'category', 'tags', 'is_read', 'is_starred'];
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'source' || key === 'metadata') {
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

    return queryOne<Finding>(
      `UPDATE findings
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
  }

  // Delete a finding
  static async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM findings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.length > 0;
  }

  // Delete multiple findings
  static async deleteBulk(ids: string[], userId: string): Promise<number> {
    const result = await query(
      'DELETE FROM findings WHERE id = ANY($1) AND user_id = $2',
      [ids, userId]
    );
    return result.length;
  }

  // Mark finding as read
  static async markAsRead(id: string, userId: string, isRead = true): Promise<Finding | null> {
    return this.update(id, userId, { is_read: isRead });
  }

  // Toggle star status
  static async toggleStar(id: string, userId: string): Promise<Finding | null> {
    const finding = await this.getById(id, userId);
    if (!finding) return null;

    return this.update(id, userId, { is_starred: !finding.is_starred });
  }

  // Get statistics
  static async getStats(userId: string, topicId?: string): Promise<any> {
    const conditions = ['user_id = $1'];
    const params: any[] = [userId];

    if (topicId) {
      conditions.push('topic_id = $2');
      params.push(topicId);
    }

    const whereClause = conditions.join(' AND ');

    const [total, unread, starred, byCategory] = await Promise.all([
      queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM findings WHERE ${whereClause}`,
        params
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM findings WHERE ${whereClause} AND is_read = false`,
        params
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM findings WHERE ${whereClause} AND is_starred = true`,
        params
      ),
      query<{ category: string; count: number }>(
        `SELECT category, COUNT(*) as count FROM findings WHERE ${whereClause} GROUP BY category`,
        params
      )
    ]);

    return {
      total: total?.count || 0,
      unread: unread?.count || 0,
      starred: starred?.count || 0,
      by_category: byCategory || []
    };
  }

  // Count findings created after a given date for a specific topic
  static async countSince(userId: string, topicId: string, since: Date): Promise<number> {
    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND topic_id = $2 AND created_at > $3',
      [userId, topicId, since]
    );
    return parseInt(result?.count || '0', 10);
  }

  // Search findings
  static async search(userId: string, searchTerm: string, topicId?: string): Promise<Finding[]> {
    const conditions = [
      'user_id = $1',
      '(title ILIKE $2 OR content ILIKE $2 OR summary ILIKE $2)'
    ];
    const params: any[] = [userId, `%${searchTerm}%`];

    if (topicId) {
      conditions.push('topic_id = $3');
      params.push(topicId);
    }

    return query<Finding>(
      `SELECT * FROM findings
       WHERE ${conditions.join(' AND ')}
       ORDER BY relevance_score DESC NULLS LAST, created_at DESC
       LIMIT 50`,
      params
    );
  }
}