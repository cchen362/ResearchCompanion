import express from 'express';
// import * as searchService from '../services/search.service';
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

    // Generate better quality mock findings with proper sources
    // TODO: Implement real search service
    const generateMockFinding = (index: number) => {
      const findingTypes = ['treatment', 'trial', 'study', 'guideline', 'news'] as const;
      const type = findingTypes[Math.floor(Math.random() * findingTypes.length)];

      const sources = [
        {
          name: 'New England Journal of Medicine',
          displayName: 'NEJM',
          type: 'journal' as const,
          url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2023123',
          journal: 'N Engl J Med',
          doi: '10.1056/NEJMoa2023123',
          credibility: 'peer-reviewed' as const,
          impactFactor: 91.245,
          citationCount: 45,
          publishDate: '2024-01-15',
          authors: ['Smith, J.', 'Johnson, K.', 'Williams, R.']
        },
        {
          name: 'Blood Journal - ASH Publications',
          displayName: 'Blood',
          type: 'journal' as const,
          url: 'https://ashpublications.org/blood/article/143/1/123',
          journal: 'Blood',
          doi: '10.1182/blood.2024012345',
          credibility: 'peer-reviewed' as const,
          impactFactor: 22.113,
          citationCount: 23,
          publishDate: '2024-01-10',
          authors: ['Chen, L.', 'Davis, M.']
        },
        {
          name: 'ClinicalTrials.gov - NCT05123456',
          displayName: 'Clinical Trial NCT05123456',
          type: 'clinical_trial' as const,
          url: 'https://clinicaltrials.gov/ct2/show/NCT05123456',
          credibility: 'peer-reviewed' as const,
          publishDate: '2023-12-01'
        },
        {
          name: 'FDA Approval Announcement',
          displayName: 'FDA',
          type: 'fda' as const,
          url: 'https://www.fda.gov/news-events/press-announcements',
          credibility: 'peer-reviewed' as const,
          publishDate: '2024-01-20'
        }
      ];

      const source = sources[Math.floor(Math.random() * sources.length)];
      const sourceQuality = calculateSourceQuality(source);

      const titles = {
        treatment: `Gene Therapy Shows Promise for ${topic.diseaseProfile.name} Treatment`,
        trial: `Phase 3 Trial Results for ${topic.diseaseProfile.name} Therapy`,
        study: `New Biomarkers Identified for ${topic.diseaseProfile.name}`,
        guideline: `Updated Clinical Guidelines for ${topic.diseaseProfile.name} Management`,
        news: `Breakthrough Treatment Approved for ${topic.diseaseProfile.name}`
      };

      const summaries = {
        treatment: `A novel gene therapy approach using CRISPR-Cas9 technology has shown significant efficacy in treating ${topic.diseaseProfile.name}. Early results indicate a 75% reduction in transfusion requirements.`,
        trial: `Multi-center randomized controlled trial (n=450) demonstrates superior outcomes with new combination therapy. Primary endpoint met with p<0.001.`,
        study: `Researchers identify three novel biomarkers that predict treatment response in ${topic.diseaseProfile.name} patients with 85% accuracy.`,
        guideline: `Professional society releases updated evidence-based guidelines incorporating recent clinical trial data and real-world evidence.`,
        news: `FDA grants accelerated approval for innovative treatment based on compelling phase 2 data showing unprecedented response rates.`
      };

      const title = titles[type];
      const summary = summaries[type];

      const finding = {
        id: `finding-${Date.now()}-${index}`,
        agentId: agent.id,
        agentType: agent.type,
        topicId: topic.id,
        type,
        title,
        summary,
        details: `${summary} This finding represents important progress in the field of ${topic.diseaseProfile.name} research and treatment.`,

        // Enhanced source with quality
        source: {
          ...source,
          sourceQuality,
          sourceIcon: source.type === 'journal' ? 'book' : source.type === 'clinical_trial' ? 'flask' : 'file'
        },
        sourceQuality,

        // Proper categorization
        category: determineFindingCategory(type, title, summary),
        tags: generateFindingTags({ title, summary, type, category: determineFindingCategory(type, title, summary) }),
        priority: type === 'treatment' || type === 'trial' ? 'high' : 'medium',

        // Scoring
        relevanceScore: 7 + Math.random() * 3, // 7-10 range for high relevance
        confidenceLevel: source.credibility === 'peer-reviewed' ? 'high' : 'medium',

        // Status
        isNew: index === 0, // First finding is new
        isContradictory: false,

        // Timestamps
        timestamp: Date.now() - (index * 24 * 60 * 60 * 1000), // Stagger by days
        foundDate: new Date().toISOString(),
        publishedAt: source.publishDate,

        // Clinical details
        keyInsights: [
          'Statistically significant improvement observed',
          'Well-tolerated safety profile',
          'Applicable to pediatric populations'
        ],
        clinicalRelevance: 'High clinical relevance for treatment decision-making',
        clinicalImplications: ['May change standard of care', 'Requires specialized monitoring'],
        limitations: ['Long-term data not yet available', 'Cost-effectiveness analysis pending']
      };

      // Validate with schema
      try {
        return ResearchFindingSchema.parse(finding);
      } catch (error) {
        console.error('Finding validation error:', error);
        return finding; // Return unvalidated if schema fails (for backward compatibility)
      }
    };

    const mockFindings = [
      generateMockFinding(0),
      generateMockFinding(1),
      generateMockFinding(2)
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