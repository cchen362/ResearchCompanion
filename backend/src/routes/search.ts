import { Router } from 'express';
import axios from 'axios';
import { parseSearchQuery, summarizeResults } from '../services/ai.service.js';

const router = Router();

/**
 * Parse a natural language search query
 */
router.post('/parse-search-query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await parseSearchQuery(query);
    res.json(result);
  } catch (error) {
    console.error('Error in parse-search-query:', error);
    res.status(500).json({ error: 'Failed to parse query' });
  }
});

/**
 * Perform web search using search service
 */
router.post('/websearch', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Import search service
    const { searchService } = await import('../services/search.service.js');

    // Use real web search or return empty if not configured
    const results = await searchService.searchWeb(query, limit);

    res.json({ results });
  } catch (error) {
    console.error('Error in websearch:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

/**
 * Search PubMed for medical literature
 */
router.post('/pubmed-search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // PubMed E-utilities API (no key required for basic usage)
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`;

    const searchResponse = await axios.get(searchUrl);
    const idList = searchResponse.data.esearchresult?.idlist || [];

    if (idList.length === 0) {
      return res.json({ articles: [] });
    }

    // Fetch article summaries
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
    const summaryResponse = await axios.get(summaryUrl);

    const articles = idList.map((id: string) => {
      const article = summaryResponse.data.result?.[id];
      if (!article) return null;

      return {
        id,
        title: article.title || 'No title',
        authors: article.authors?.map((a: any) => a.name).join(', ') || '',
        journal: article.source || '',
        publishDate: article.pubdate || '',
        abstract: article.abstract || 'No abstract available',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        doi: article.elocationid || ''
      };
    }).filter(Boolean);

    res.json({ articles });
  } catch (error) {
    console.error('Error in pubmed-search:', error);
    res.status(500).json({ error: 'Failed to search PubMed' });
  }
});

/**
 * Search ClinicalTrials.gov
 */
router.post('/clinical-trials', async (req, res) => {
  try {
    const { query, status = 'RECRUITING', location } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // ClinicalTrials.gov API v2
    const baseUrl = 'https://clinicaltrials.gov/api/v2/studies';
    const params = new URLSearchParams({
      'query.cond': query,
      'filter.overallStatus': status,
      'pageSize': '10',
      'format': 'json'
    });

    if (location?.country) {
      params.append('filter.geo', location.country);
    }

    const response = await axios.get(`${baseUrl}?${params}`);
    const studies = response.data.studies || [];

    const trials = studies.map((study: any) => ({
      id: study.protocolSection?.identificationModule?.nctId,
      title: study.protocolSection?.identificationModule?.briefTitle,
      briefSummary: study.protocolSection?.descriptionModule?.briefSummary,
      detailedDescription: study.protocolSection?.descriptionModule?.detailedDescription,
      status: study.protocolSection?.statusModule?.overallStatus,
      sponsor: study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name,
      interventions: study.protocolSection?.armsInterventionsModule?.interventions?.map((i: any) => i.name),
      url: `https://clinicaltrials.gov/study/${study.protocolSection?.identificationModule?.nctId}`,
      lastUpdateDate: study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date
    }));

    res.json({ trials });
  } catch (error) {
    console.error('Error in clinical-trials search:', error);
    res.status(500).json({ error: 'Failed to search clinical trials' });
  }
});

/**
 * Summarize search results using Claude
 */
router.post('/summarize', async (req, res) => {
  try {
    const { results, query, context } = req.body;

    if (!results || !query) {
      return res.status(400).json({ error: 'Results and query are required' });
    }

    const summary = await summarizeResults(results, query, context);
    res.json({ summary });
  } catch (error) {
    console.error('Error in summarize:', error);
    res.status(500).json({ error: 'Failed to summarize results' });
  }
});

export default router;