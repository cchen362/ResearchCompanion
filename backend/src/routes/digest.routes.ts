import { Router } from 'express';
import { generateSmartDigest, scoreAndClusterFindings } from '../services/ai.service.js';
import { searchService } from '../services/search.service.js';

const router = Router();

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