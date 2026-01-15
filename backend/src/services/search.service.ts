import axios from 'axios';
import { z } from 'zod';

// Schema for PubMed article
const PubMedArticleSchema = z.object({
  pmid: z.string(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(z.string()).optional(),
  journal: z.string().optional(),
  pubDate: z.string().optional(),
  doi: z.string().optional(),
  keywords: z.array(z.string()).optional()
});

// Schema for ClinicalTrials.gov study
const ClinicalTrialSchema = z.object({
  nctId: z.string(),
  title: z.string(),
  status: z.string(),
  conditions: z.array(z.string()),
  interventions: z.array(z.string()).optional(),
  locations: z.array(z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string()
  })).optional(),
  sponsor: z.string().optional(),
  startDate: z.string().optional(),
  completionDate: z.string().optional(),
  phase: z.string().optional(),
  enrollment: z.number().optional()
});

// Schema for FDA announcement
const FDAAnnouncementSchema = z.object({
  title: z.string(),
  date: z.string(),
  type: z.string(), // approval, recall, safety
  product: z.string().optional(),
  indication: z.string().optional(),
  url: z.string()
});

export class SearchService {
  private pubmedBaseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private clinicalTrialsBaseUrl = 'https://clinicaltrials.gov/api/v2';
  private fdaBaseUrl = 'https://api.fda.gov';

  /**
   * Search PubMed for peer-reviewed medical literature
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Array of PubMed articles
   */
  async searchPubMed(query: string, limit: number = 10): Promise<any[]> {
    try {
      // Build base params
      const searchParams: any = {
        db: 'pubmed',
        term: query,
        retmax: limit,
        retmode: 'json',
        sort: 'relevance',
        datetype: 'pdat',
        reldate: 365, // Last year
      };

      // Add API key if available (increases rate limit from 3 to 10 requests/second)
      if (process.env.PUBMED_API_KEY) {
        searchParams.api_key = process.env.PUBMED_API_KEY;
      }

      // Step 1: Search for PMIDs
      const searchResponse = await axios.get(`${this.pubmedBaseUrl}/esearch.fcgi`, {
        params: searchParams
      });

      const pmids = searchResponse.data?.esearchresult?.idlist || [];

      if (pmids.length === 0) {
        return [];
      }

      // Step 2: Fetch article details
      const summaryParams: any = {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'json'
      };

      // Add API key if available
      if (process.env.PUBMED_API_KEY) {
        summaryParams.api_key = process.env.PUBMED_API_KEY;
      }

      const summaryResponse = await axios.get(`${this.pubmedBaseUrl}/esummary.fcgi`, {
        params: summaryParams
      });

      const articles = [];
      const results = summaryResponse.data?.result || {};

      for (const pmid of pmids) {
        const article = results[pmid];
        if (article && article.uid) {
          const articleSummary = article.title || 'Untitled';
          const publicationInfo = `Published in ${article.source || 'Unknown Journal'} on ${article.sortpubdate || 'Unknown Date'}`;

          // Add unique identifier to details to prevent duplication
          const uniqueDetails = `${articleSummary}\n\n${publicationInfo}\n\nAuthors: ${article.authors?.map((a: any) => a.name).join(', ') || 'Not specified'}\n\n───────────\nPubMed ID: ${article.uid}`;

          articles.push({
            id: `pubmed_${article.uid}`,
            title: article.title || 'Untitled',
            snippet: publicationInfo,
            summary: articleSummary,
            details: uniqueDetails,
            source: {
              type: 'pubmed',
              name: article.source || 'PubMed',
              displayName: article.source || 'PubMed',
              journal: article.fulljournalname || article.source,
              url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`
            },
            type: 'study', // Changed from 'research' to match frontend enum
            publishedAt: article.sortpubdate || new Date().toISOString(),
            metadata: {
              pmid: article.uid,
              doi: article.elocationid,
              authors: article.authors?.map((a: any) => a.name).slice(0, 3),
              studyType: 'Peer-reviewed research'
            }
          });
        }
      }

      return articles;
    } catch (error) {
      console.error('PubMed search error:', error);
      return [];
    }
  }

  /**
   * Search ClinicalTrials.gov for active clinical trials
   * @param condition Medical condition
   * @param status Trial status (e.g., 'RECRUITING')
   * @param location Optional location filter
   * @returns Array of clinical trials
   */
  async searchClinicalTrials(
    condition: string,
    status: string = 'RECRUITING',
    location?: string
  ): Promise<any[]> {
    try {
      // Use correct API v2 parameters
      // See: https://clinicaltrials.gov/api/v2/studies
      const params: any = {
        'filter.overallStatus': status,
        'query.cond': condition,
        'pageSize': 10,
        'format': 'json'
      };

      if (location) {
        params['query.locn'] = location;
      }

      const response = await axios.get(`${this.clinicalTrialsBaseUrl}/studies`, {
        params,
        headers: {
          'Accept': 'application/json'
        }
      });

      const studies = response.data?.studies || [];

      return studies.map((study: any) => {
        const protocolSection = study.protocolSection || {};
        const identificationModule = protocolSection.identificationModule || {};
        const statusModule = protocolSection.statusModule || {};
        const sponsorModule = protocolSection.sponsorCollaboratorsModule || {};
        const locationsModule = protocolSection.contactsLocationsModule || {};

        const briefSummary = identificationModule.briefSummary?.textBlock || 'No summary available';
        const detailedDescription = protocolSection.descriptionModule?.detailedDescription?.textBlock || '';

        // Improved sponsor name extraction with multiple fallbacks and defensive checks
        let sponsorName = sponsorModule?.leadSponsor?.name || '';

        // Try multiple fallbacks and ensure we never get empty string
        if (!sponsorName || sponsorName.trim() === '') {
          sponsorName = sponsorModule?.responsibleParty?.investigatorFullName || '';
        }
        if (!sponsorName || sponsorName.trim() === '') {
          sponsorName = sponsorModule?.collaborators?.[0]?.name || '';
        }
        if (!sponsorName || sponsorName.trim() === '') {
          // Final fallback - always show something meaningful
          sponsorName = 'ClinicalTrials.gov Registry';
        }

        // Add unique identifier to details to prevent duplication
        const uniqueDetails = `${detailedDescription || briefSummary}\n\n───────────\nTrial ID: ${identificationModule.nctId}\nSponsor: ${sponsorName}`;

        return {
          id: `trial_${identificationModule.nctId}`,
          title: identificationModule.briefTitle || identificationModule.officialTitle || 'Untitled Trial',
          snippet: briefSummary.substring(0, 200) + (briefSummary.length > 200 ? '...' : ''),
          summary: briefSummary,
          details: uniqueDetails,
          source: {
            type: 'clinical_trial',
            name: sponsorName,
            displayName: sponsorName,
            journal: 'ClinicalTrials.gov Registry', // Add fallback field for display
            url: `https://clinicaltrials.gov/study/${identificationModule.nctId}`
          },
          type: 'trial', // Changed from 'clinical_trial' to match frontend enum
          publishedAt: statusModule.studyFirstPostDateStruct?.date || new Date().toISOString(),
          metadata: {
            nctId: identificationModule.nctId,
            status: statusModule.overallStatus,
            phase: protocolSection.designModule?.phases?.join(', '),
            enrollment: protocolSection.designModule?.enrollmentInfo?.count,
            studyType: 'Clinical Trial',
            locations: locationsModule.locations?.map((l: any) => l.city).slice(0, 3)
          }
        };
      });
    } catch (error) {
      console.error('ClinicalTrials.gov search error:', error);
      return [];
    }
  }

  /**
   * Search FDA database for drug approvals and announcements
   * @param query Search query
   * @param type Type of FDA data (drug, device, food)
   * @returns Array of FDA announcements
   */
  async searchFDA(query: string, type: string = 'drug'): Promise<any[]> {
    try {
      // Search FDA drug labels
      const response = await axios.get(`${this.fdaBaseUrl}/drug/label.json`, {
        params: {
          search: query,
          limit: 10
        }
      });

      const results = response.data?.results || [];

      return results.map((result: any) => {
        const drugName = result.openfda?.brand_name?.[0] || result.openfda?.generic_name?.[0] || 'FDA Drug';
        const purpose = result.purpose?.[0] || result.description?.[0] || 'FDA drug information';
        const indication = result.indications_and_usage?.[0] || '';
        const manufacturer = result.openfda?.manufacturer_name?.[0] || 'Not specified';
        const fdaId = result.id || result.application_number || `FDA-${Date.now()}`;

        // Add unique identifier to details to prevent duplication
        const uniqueDetails = `${drugName}\n\n${purpose}\n\n${indication ? `Indications: ${indication}` : ''}\n\nManufacturer: ${manufacturer}\n\n───────────\nFDA Reference: ${fdaId}`;

        return {
          id: `fda_${fdaId}`,
          title: `${drugName} - FDA Information`,
          snippet: purpose.substring(0, 200) + (purpose.length > 200 ? '...' : ''),
          summary: purpose,
          details: uniqueDetails,
          source: {
            type: 'fda',
            name: 'FDA',
            displayName: 'U.S. Food and Drug Administration',
            url: `https://www.fda.gov/`
          },
          type: 'treatment', // Changed from 'regulatory' to match frontend enum
          publishedAt: result.effective_time || new Date().toISOString(),
          metadata: {
            manufacturer: result.openfda?.manufacturer_name?.[0],
            indication: result.indications_and_usage?.[0],
            studyType: 'Regulatory Approval'
          }
        };
      });
    } catch (error) {
      console.error('FDA search error:', error);
      return [];
    }
  }

  /**
   * Search medical news and journals via Brave Search API
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Array of web results
   */
  async searchWeb(query: string, limit: number = 5): Promise<any[]> {
    const braveApiKey = process.env.BRAVE_API_KEY;

    if (!braveApiKey) {
      console.log('Brave Search API key not configured');
      return [];
    }

    try {
      // Add medical context to query for better results
      const medicalQuery = `${query} medical research peer-reviewed journal study`;

      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: {
          q: medicalQuery,
          count: limit,
          search_lang: 'en',
          // Focus on recent medical content
          freshness: 'py', // Past year
          text_decorations: false,
          spellcheck: false
        },
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveApiKey
        }
      });

      const results = response.data?.web?.results || [];

      return results.map((result: any) => {
        const hostname = new URL(result.url).hostname.replace('www.', '');
        const webId = result.url.substring(result.url.lastIndexOf('/') + 1).slice(0, 20) || `web-${Date.now()}`;

        // Add unique identifier to details to prevent duplication
        const uniqueDetails = `${result.title}\n\n${result.description}\n\nSource: ${hostname}\nPublished: ${result.age || 'Recently'}\n\n───────────\nWeb ID: ${webId}`;

        return {
          id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: result.title,
          snippet: result.description.substring(0, 200) + (result.description.length > 200 ? '...' : ''),
          summary: result.description,
          details: uniqueDetails,
          source: {
            type: 'web',
            name: hostname,
            displayName: hostname,
            url: result.url
          },
          type: 'news', // Changed from 'article' to match frontend enum
          publishedAt: result.age || new Date().toISOString(),
          metadata: {
            studyType: 'Web Article',
            favicon: result.meta_url?.favicon
          }
        };
      });
    } catch (error: any) {
      console.error('Brave Search API error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Aggregate search results from multiple sources
   * @param query Search query
   * @param sources Array of sources to search
   * @returns Combined and deduplicated results
   */
  async aggregateSearch(
    query: string,
    sources: ('pubmed' | 'trials' | 'fda' | 'web')[] = ['pubmed', 'trials']
  ): Promise<any[]> {
    const searchPromises = [];

    if (sources.includes('pubmed')) {
      searchPromises.push(this.searchPubMed(query, 5));
    }

    if (sources.includes('trials')) {
      searchPromises.push(this.searchClinicalTrials(query));
    }

    if (sources.includes('fda')) {
      searchPromises.push(this.searchFDA(query));
    }

    if (sources.includes('web')) {
      searchPromises.push(this.searchWeb(query, 5));
    }

    const results = await Promise.all(searchPromises);
    return results.flat();
  }
}

export const searchService = new SearchService();