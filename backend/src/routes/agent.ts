import express from 'express';
import { searchService } from '../services/search.service.js';
import * as aiService from '../services/ai.service.js';
import {
  ResearchFindingSchema,
  determineFindingCategory,
  calculateSourceQuality,
  generateFindingTags
} from '../schemas/finding.schema.js';

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

    // IMPORTANT: No mock medical data - only real sources
    // This is an ethical requirement for medical information

    const enableRealSearch = process.env.ENABLE_REAL_MEDICAL_SEARCH === 'true';
    const enableWebSearch = process.env.ENABLE_WEB_SEARCH === 'true';

    if (enableRealSearch) {
      console.log(`Performing real medical research for: ${query}`);

      try {
        // Use real medical research APIs
        const sources: any[] = [];

        switch (agent.type) {
          case 'treatment_breakthrough':
            sources.push('pubmed', 'fda');
            if (enableWebSearch) sources.push('web');
            searchResults = await searchService.aggregateSearch(
              `${query} treatment therapy FDA approval`,
              sources
            );
            break;

          case 'clinical_trial':
            searchResults = await searchService.searchClinicalTrials(
              topic.diseaseProfile.name,
              'RECRUITING',
              topic.patientContext?.location
            );
            break;

          case 'medical_literature':
            const pubmedResults = await searchService.searchPubMed(query, 10);
            searchResults = pubmedResults;
            // Add web search for broader coverage
            if (enableWebSearch) {
              const webResults = await searchService.searchWeb(query, 5);
              searchResults = [...pubmedResults, ...webResults];
            }
            break;

          default:
            sources.push('pubmed', 'trials');
            if (enableWebSearch) sources.push('web');
            searchResults = await searchService.aggregateSearch(
              query,
              sources
            );
        }
      } catch (error) {
        console.error('Real search failed:', error);
        searchResults = [];
      }
    } else {
      // Return empty results until real search is enabled
      searchResults = [];
      console.log('Real medical search not enabled. Set ENABLE_REAL_MEDICAL_SEARCH=true to enable.');
    }

    findingsCount = searchResults.length;

    // Normalize sources to ensure displayName is always populated with meaningful defaults
    searchResults = searchResults.map(result => {
      if (result.source) {
        // Type-specific default names for better UX
        const defaultNames = {
          'clinical_trial': 'ClinicalTrials.gov Registry',
          'pubmed': 'PubMed',
          'fda': 'FDA',
          'web': 'Web Source'
        };

        // Ensure displayName is set - use existing displayName, name, or type-specific default
        if (!result.source.displayName || result.source.displayName.trim() === '') {
          if (result.source.name && result.source.name.trim() !== '') {
            result.source.displayName = result.source.name;
          } else {
            // Use type-specific default
            result.source.displayName = defaultNames[result.source.type as keyof typeof defaultNames] || 'Research Database';
          }
        }

        // Ensure name is also set for backward compatibility
        if (!result.source.name || result.source.name.trim() === '') {
          result.source.name = result.source.displayName;
        }
      }
      return result;
    });

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