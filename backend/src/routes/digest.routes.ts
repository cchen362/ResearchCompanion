import { Router } from 'express';
import { generateSmartDigest, scoreAndClusterFindings } from '../services/ai.service.js';
import { searchService } from '../services/search.service.js';
import { pool } from '../db/database.js';
import { TopicModel } from '../models/topic.model.js';
import { FindingModel } from '../models/finding.model.js';

const router = Router();

/**
 * Get existing digest for a topic
 */
router.get('/by-topic/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = (req as any).userId;

    if (!topicId) {
      return res.status(400).json({ error: 'Topic ID is required' });
    }

    // Query for the most recent digest for this topic
    const query = `
      SELECT
        id,
        user_id as "userId",
        topic_id as "topicId",
        whats_new as "whatsNew",
        key_takeaways as "keyTakeaways",
        featured_discovery as "featuredDiscovery",
        notable_findings as "notableFindings",
        source_breakdown as "sourceBreakdown",
        for_your_doctor as "forYourDoctor",
        finding_ids,
        metadata,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM digests
      WHERE topic_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [topicId, userId]);

    if (result.rows[0]) {
      console.log(`[DigestRoute] Found existing digest for topic ${topicId}`);

      // Also check if there's a queue item linked to this digest
      const queueQuery = `
        SELECT status, completed_at
        FROM digest_queue
        WHERE result_id = $1
        LIMIT 1
      `;
      const queueResult = await pool.query(queueQuery, [result.rows[0].id]);

      const digest = {
        ...result.rows[0],
        topicId, // Ensure topicId is included
        queueStatus: queueResult.rows[0] || null
      };

      // Pillar 2 temporal enrichment: personalize whatsNew based on time away
      try {
        const topic = await TopicModel.getById(topicId, userId);
        const lastViewed = topic?.last_digest_viewed_at;
        if (lastViewed && digest.whatsNew) {
          const daysAway = Math.floor((Date.now() - new Date(lastViewed).getTime()) / 86400000);
          if (daysAway > 1) {
            const newCount = await FindingModel.countSince(userId, topicId, new Date(lastViewed));
            if (newCount > 0) {
              const whatsNew = typeof digest.whatsNew === 'string' ? JSON.parse(digest.whatsNew) : digest.whatsNew;
              const restTech = whatsNew.technical?.replace(/^[^.]+\./, '').trim() || '';
              const restExpl = whatsNew.explained?.replace(/^[^.]+\./, '').trim() || '';
              whatsNew.technical = `${newCount} new findings in your ${daysAway} days away. ${restTech}`;
              whatsNew.explained = `${newCount} new findings in your ${daysAway} days away. ${restExpl}`;
              digest.whatsNew = whatsNew;
            }
          }
        }
      } catch (temporalErr) {
        console.error('[DigestRoute] Temporal enrichment failed:', temporalErr);
      }

      // Track that user viewed this digest
      try {
        await TopicModel.updateLastDigestViewed(topicId, userId);
      } catch (trackErr) {
        console.error('[DigestRoute] Failed to track digest view:', trackErr);
      }

      res.json(digest);
    } else {
      res.status(404).json({ error: 'No digest found for this topic' });
    }
  } catch (error) {
    console.error('Error fetching digest by topic:', error);
    res.status(500).json({
      error: 'Failed to fetch digest',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate a smart digest from research findings
 */
router.post('/generate-digest', async (req, res) => {
  // Set a longer timeout for this specific route (5 minutes)
  req.setTimeout(300000); // 5 minutes for AI processing (increased for handling more findings)

  try {
    const { findings, topic, timeframe } = req.body;

    if (!findings || !topic || !timeframe) {
      return res.status(400).json({
        error: 'Missing required fields: findings, topic, and timeframe are required'
      });
    }

    if (findings.length === 0) {
      return res.status(400).json({
        error: 'No findings provided for digest generation'
      });
    }

    console.log(`📊 Starting digest generation for ${topic.name} (${findings.length} findings, ${timeframe} timeframe)`);
    const startTime = Date.now();

    // Two-pass digest generation: Haiku scoring → Sonnet editorial
    const scoredResult = await scoreAndClusterFindings(findings, topic.name || topic.diseaseProfile?.name || 'Unknown');
    const topFindingIdSet = new Set(scoredResult.topFindingIds);
    const topFndgs = findings.filter((f: any) => topFindingIdSet.has(f.id));
    const remainFndgs = findings.filter((f: any) => !topFindingIdSet.has(f.id));
    const digest = await generateSmartDigest(topFndgs, remainFndgs, scoredResult, topic, findings.length);

    // CRITICAL: Include topicId in the response
    const digestWithTopicId = {
      ...digest,
      topicId: topic.id || topic.topicId
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Digest generated successfully in ${(duration / 1000).toFixed(1)}s`);

    res.json(digestWithTopicId);
  } catch (error) {
    console.error('Error generating digest:', error);
    res.status(500).json({
      error: 'Failed to generate digest',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate a simplified version of existing digest
 */
router.post('/simplify-digest', async (req, res) => {
  try {
    const { digest } = req.body;

    if (!digest) {
      return res.status(400).json({
        error: 'Digest is required'
      });
    }

    // For now, return the layman summary if it exists
    // In the future, this could use AI to simplify the entire digest
    const simplifiedDigest = {
      ...digest,
      isSimplified: true
    };

    res.json(simplifiedDigest);
  } catch (error) {
    console.error('Error simplifying digest:', error);
    res.status(500).json({
      error: 'Failed to simplify digest',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Integrated endpoint to fetch research and generate digest
 * This combines research fetching with digest generation in one operation
 */
router.post('/research-and-digest', async (req, res) => {
  // Set a longer timeout for this combined operation (8 minutes)
  req.setTimeout(480000); // 8 minutes for research + AI processing

  try {
    const { topic, timeframe, agentTypes } = req.body;

    if (!topic || !timeframe) {
      return res.status(400).json({
        error: 'Missing required fields: topic and timeframe are required'
      });
    }

    console.log(`🔍 Starting integrated research and digest for ${topic.name}`);
    const startTime = Date.now();

    // Step 1: Fetch new research from multiple sources
    const searchQuery = topic.diseaseProfile?.name || topic.name;
    const allFindings: any[] = [];

    // Default agent types if not specified
    const agents = agentTypes || ['pubmed', 'clinical_trials', 'web'];

    // Run research searches in parallel
    const searchPromises: Promise<any[]>[] = [];

    if (agents.includes('pubmed')) {
      searchPromises.push(
        searchService.searchPubMed(`${searchQuery} treatment therapy`, 15)
          .then((result: any) => {
            console.log(`📚 PubMed returned ${result.articles?.length || 0} articles`);
            return result.articles || [];
          })
          .catch((err: any) => {
            console.error('PubMed search failed:', err);
            return [];
          })
      );
    }

    if (agents.includes('clinical_trials')) {
      searchPromises.push(
        searchService.searchClinicalTrials(`${searchQuery} recruiting`)
          .then((result: any) => {
            console.log(`🧪 ClinicalTrials returned ${result.trials?.length || 0} trials`);
            return result.trials || [];
          })
          .catch((err: any) => {
            console.error('Clinical trials search failed:', err);
            return [];
          })
      );
    }

    if (agents.includes('web')) {
      searchPromises.push(
        searchService.searchWeb(`${searchQuery} treatment breakthrough FDA approval`, 10)
          .then((result: any) => {
            console.log(`🌐 Web search returned ${result.results?.length || 0} results`);
            return result.results || [];
          })
          .catch((err: any) => {
            console.error('Web search failed:', err);
            return [];
          })
      );
    }

    const searchResults = await Promise.all(searchPromises);

    // Combine all results
    searchResults.forEach((results: any[]) => {
      allFindings.push(...results);
    });

    console.log(`📊 Total findings collected: ${allFindings.length}`);

    // If no findings were found, return early
    if (allFindings.length === 0) {
      return res.json({
        digest: null,
        newFindings: [],
        message: 'No new research findings found'
      });
    }

    // Step 2: Two-pass digest generation: Haiku scoring → Sonnet editorial
    console.log(`🤖 Generating digest from ${allFindings.length} findings...`);
    const scoredResult2 = await scoreAndClusterFindings(allFindings, topic.name || topic.diseaseProfile?.name || 'Unknown');
    const topFindingIdSet2 = new Set(scoredResult2.topFindingIds);
    const topFndgs2 = allFindings.filter((f: any) => topFindingIdSet2.has(f.id));
    const remainFndgs2 = allFindings.filter((f: any) => !topFindingIdSet2.has(f.id));
    const digest = await generateSmartDigest(topFndgs2, remainFndgs2, scoredResult2, topic, allFindings.length);

    const duration = Date.now() - startTime;
    console.log(`✅ Integrated research and digest completed in ${(duration / 1000).toFixed(1)}s`);

    res.json({
      digest,
      newFindings: allFindings,
      stats: {
        totalFindings: allFindings.length,
        duration: duration,
        sources: agents
      }
    });
  } catch (error) {
    console.error('Error in research-and-digest:', error);
    res.status(500).json({
      error: 'Failed to complete research and digest',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;