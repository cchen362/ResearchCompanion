import express from 'express';
import { query } from '../db/database.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/dashboard/stats - Aggregated dashboard statistics
 * Returns everything the Home page needs in a single request.
 * Optional query param: topic_id (filters to specific topic)
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;

    // 1. Unread count
    const unreadRows = await query(
      topicId
        ? `SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND topic_id = $2 AND is_read = false`
        : `SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND is_read = false`,
      topicId ? [userId, topicId] : [userId]
    );
    const unreadCount = parseInt(unreadRows[0]?.count || '0');

    // 2. Total findings count
    const totalRows = await query(
      topicId
        ? `SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND topic_id = $2`
        : `SELECT COUNT(*) as count FROM findings WHERE user_id = $1`,
      topicId ? [userId, topicId] : [userId]
    );
    const totalFindings = parseInt(totalRows[0]?.count || '0');

    // 3. Topic count
    const topicRows = await query(
      `SELECT COUNT(*) as count FROM topics WHERE user_id = $1`,
      [userId]
    );
    const topicCount = parseInt(topicRows[0]?.count || '0');

    // 4. Recent unread findings (for highlights, max 5)
    const recentUnread = await query(
      topicId
        ? `SELECT id, title, summary, source, category, created_at, is_read, topic_id
           FROM findings WHERE user_id = $1 AND topic_id = $2 AND is_read = false
           ORDER BY created_at DESC LIMIT 5`
        : `SELECT id, title, summary, source, category, created_at, is_read, topic_id
           FROM findings WHERE user_id = $1 AND is_read = false
           ORDER BY created_at DESC LIMIT 5`,
      topicId ? [userId, topicId] : [userId]
    );

    // 5. Latest digest metadata per topic (signposts, not full content)
    const digestRows = await query(
      topicId
        ? `SELECT d.id, d.topic_id, t.name as topic_name,
                  d.breakthroughs, d.contradictions, d.knowledge_gaps,
                  d.created_at
           FROM digests d
           JOIN topics t ON t.id = d.topic_id
           WHERE d.user_id = $1 AND d.topic_id = $2
           ORDER BY d.created_at DESC LIMIT 1`
        : `SELECT DISTINCT ON (d.topic_id)
                  d.id, d.topic_id, t.name as topic_name,
                  d.breakthroughs, d.contradictions, d.knowledge_gaps,
                  d.created_at
           FROM digests d
           JOIN topics t ON t.id = d.topic_id
           WHERE d.user_id = $1
           ORDER BY d.topic_id, d.created_at DESC`,
      topicId ? [userId, topicId] : [userId]
    );

    const digestSignposts = digestRows.map((d: any) => {
      // Parse JSONB fields — they might be strings or already objects
      const breakthroughs = typeof d.breakthroughs === 'string' ? JSON.parse(d.breakthroughs) : d.breakthroughs;
      const contradictions = typeof d.contradictions === 'string' ? JSON.parse(d.contradictions) : d.contradictions;
      const knowledgeGaps = typeof d.knowledge_gaps === 'string' ? JSON.parse(d.knowledge_gaps) : d.knowledge_gaps;

      return {
        id: d.id,
        topicId: d.topic_id,
        topicName: d.topic_name,
        breakthroughCount: Array.isArray(breakthroughs) ? breakthroughs.length : 0,
        contradictionCount: Array.isArray(contradictions) ? contradictions.length : 0,
        knowledgeGapCount: Array.isArray(knowledgeGaps) ? knowledgeGaps.length : 0,
        createdAt: d.created_at
      };
    });

    // 6. Source breakdown
    const sourceRows = await query(
      topicId
        ? `SELECT source->>'type' as source_type, COUNT(*) as count
           FROM findings WHERE user_id = $1 AND topic_id = $2
           GROUP BY source->>'type' ORDER BY count DESC`
        : `SELECT source->>'type' as source_type, COUNT(*) as count
           FROM findings WHERE user_id = $1
           GROUP BY source->>'type' ORDER BY count DESC`,
      topicId ? [userId, topicId] : [userId]
    );
    const sourceBreakdown = sourceRows.map((r: any) => ({
      type: r.source_type || 'unknown',
      count: parseInt(r.count)
    }));

    // 7. Activity timeline (last 7 days)
    const activityRows = await query(
      topicId
        ? `SELECT DATE(created_at) as date, COUNT(*) as count
           FROM findings WHERE user_id = $1 AND topic_id = $2
             AND created_at >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY DATE(created_at) ORDER BY date`
        : `SELECT DATE(created_at) as date, COUNT(*) as count
           FROM findings WHERE user_id = $1
             AND created_at >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY DATE(created_at) ORDER BY date`,
      topicId ? [userId, topicId] : [userId]
    );
    const activityTimeline = activityRows.map((r: any) => ({
      date: r.date,
      count: parseInt(r.count)
    }));

    res.json({
      success: true,
      stats: {
        unreadCount,
        totalFindings,
        topicCount,
        recentUnread,
        digestSignposts,
        sourceBreakdown,
        activityTimeline
      }
    });
  } catch (error) {
    logger.error('[dashboard.routes] Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

export default router;
