import { Router } from 'express';
import { generateSmartDigest } from '../services/ai.service.js';

const router = Router();

/**
 * Generate a smart digest from research findings
 */
router.post('/generate-digest', async (req, res) => {
  // Set a longer timeout for this specific route (3 minutes)
  req.setTimeout(180000); // 3 minutes for AI processing

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

    // Generate the smart digest using AI
    const digest = await generateSmartDigest(findings, topic, timeframe);

    const duration = Date.now() - startTime;
    console.log(`✅ Digest generated successfully in ${(duration / 1000).toFixed(1)}s`);

    res.json(digest);
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
      isSimplified: true,
      themes: digest.themes.map((theme: any) => ({
        ...theme,
        summary: theme.summary.split('.')[0] + '.' // Simplify to first sentence
      }))
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

export default router;