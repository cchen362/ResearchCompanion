import express from 'express';
// import * as searchService from '../services/search.service';
import * as aiService from '../services/ai.service.js';

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
    const currentYear = new Date().getFullYear();
    const query = `${topic.diseaseProfile.name} ${agent.type.replace('_', ' ')} latest ${currentYear}`;

    // Perform searches based on agent type
    let searchResults: any[] = [];
    let findingsCount = 0;

    // For now, return mock findings to test the system
    // TODO: Implement real search service
    const mockFindings = [
      {
        id: `finding-${Date.now()}-1`,
        title: `New ${agent.type} research for ${topic.diseaseProfile.name}`,
        summary: `Recent research findings about ${topic.diseaseProfile.name} from ${agent.name}`,
        type: agent.type,
        source: {
          name: 'Mock Research Database',
          type: 'research',
          credibilityScore: 0.8
        },
        relevanceScore: 0.75,
        confidenceLevel: 'medium',
        isNew: true,
        timestamp: Date.now(),
        url: 'https://example.com/research'
      },
      {
        id: `finding-${Date.now()}-2`,
        title: `Clinical updates for ${topic.diseaseProfile.name}`,
        summary: `Important clinical information discovered by ${agent.name}`,
        type: agent.type,
        source: {
          name: 'Mock Clinical Database',
          type: 'clinical',
          credibilityScore: 0.9
        },
        relevanceScore: 0.85,
        confidenceLevel: 'high',
        isNew: true,
        timestamp: Date.now(),
        url: 'https://example.com/clinical'
      }
    ];

    searchResults = mockFindings;
    findingsCount = mockFindings.length;

    // TODO: Uncomment and implement when search service is ready
    // switch (agent.type) {
    //   case 'treatment_breakthrough':
    //     const webResults = await searchService.searchWeb(`${query} FDA approval new treatment`, 5);
    //     const pubmedResults = await searchService.searchPubMed(`${query} treatment therapy`, 5);
    //     searchResults = [...(webResults.results || []), ...(pubmedResults.articles || [])];
    //     break;

    //   case 'clinical_trial':
    //     const trials = await searchService.searchClinicalTrials(
    //       topic.diseaseProfile.name,
    //       'RECRUITING',
    //       topic.patientContext?.location
    //     );
    //     searchResults = trials.trials || [];
    //     break;

    //   case 'medical_literature':
    //     const literature = await searchService.searchPubMed(query, 10);
    //     searchResults = literature.articles || [];
    //     break;

    //   default:
    //     const generalWeb = await searchService.searchWeb(query, 5);
    //     const generalPubmed = await searchService.searchPubMed(query, 5);
    //     searchResults = [...(generalWeb.results || []), ...(generalPubmed.articles || [])];
    // }

    findingsCount = searchResults.length;

    // Summarize if we have results
    if (searchResults.length > 0) {
      const summaryResponse = await aiService.summarizeResults(searchResults, query);

      res.json({
        success: true,
        agentId: agent.id,
        topicId: topic.id,
        findingsCount,
        findings: searchResults,  // Include the actual findings
        summary: summaryResponse,
        timestamp: Date.now()
      });
    } else {
      res.json({
        success: true,
        agentId: agent.id,
        topicId: topic.id,
        findingsCount: 0,
        findings: [],  // Empty findings array
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