import express from 'express';
import * as searchService from '../services/search.service';
import * as aiService from '../services/ai.service';

const router = express.Router();

// Service Worker agent run endpoint
router.post('/run-agent', async (req, res) => {
  try {
    const { agent, topic } = req.body;

    if (!agent || !topic) {
      return res.status(400).json({ error: 'Agent and topic required' });
    }

    console.log(`Running agent ${agent.name} for topic ${topic.name} via service worker`);

    // Build search query based on agent type and topic
    const query = `${topic.diseaseProfile.name} ${agent.type.replace('_', ' ')} latest 2024`;

    // Perform searches based on agent type
    let searchResults = [];
    let findingsCount = 0;

    switch (agent.type) {
      case 'treatment_breakthrough':
        const webResults = await searchService.searchWeb(`${query} FDA approval new treatment`, 5);
        const pubmedResults = await searchService.searchPubMed(`${query} treatment therapy`, 5);
        searchResults = [...(webResults.results || []), ...(pubmedResults.articles || [])];
        break;

      case 'clinical_trial':
        const trials = await searchService.searchClinicalTrials(
          topic.diseaseProfile.name,
          'RECRUITING',
          topic.patientContext?.location
        );
        searchResults = trials.trials || [];
        break;

      case 'medical_literature':
        const literature = await searchService.searchPubMed(query, 10);
        searchResults = literature.articles || [];
        break;

      default:
        const generalWeb = await searchService.searchWeb(query, 5);
        const generalPubmed = await searchService.searchPubMed(query, 5);
        searchResults = [...(generalWeb.results || []), ...(generalPubmed.articles || [])];
    }

    findingsCount = searchResults.length;

    // Summarize if we have results
    if (searchResults.length > 0) {
      const summaryResponse = await aiService.summarizeResults(searchResults, query);

      res.json({
        success: true,
        agentId: agent.id,
        topicId: topic.id,
        findingsCount,
        summary: summaryResponse,
        timestamp: Date.now()
      });
    } else {
      res.json({
        success: true,
        agentId: agent.id,
        topicId: topic.id,
        findingsCount: 0,
        message: 'No new findings',
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({
      error: 'Failed to run agent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;