import { z } from 'zod';

/**
 * Validation schemas for research findings with enhanced data quality
 */

// Category enum matching the frontend type
export const FindingCategorySchema = z.enum([
  'clinical_trial',
  'treatment',
  'mechanism',
  'outcome',
  'diagnostic',
  'prevention',
  'epidemiology'
]);

// Priority enum
export const FindingPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

// Source type enum
export const SourceTypeSchema = z.enum([
  'journal',
  'fda',
  'clinical_trial',
  'medical_site',
  'community',
  'pubmed',
  'guidelines',
  'research_paper'
]);

// Source credibility enum
export const SourceCredibilitySchema = z.enum([
  'peer-reviewed',
  'preprint',
  'news',
  'blog',
  'unknown'
]);

// Research source schema with quality indicators
export const ResearchSourceSchema = z.object({
  name: z.string().min(1).default('Unknown Source'),
  title: z.string().optional(),
  url: z.string().url().optional(),
  type: SourceTypeSchema,

  // Quality indicators
  sourceQuality: z.number().min(0).max(100).optional(),
  credibility: SourceCredibilitySchema.optional(),
  impactFactor: z.number().positive().optional(),
  citationCount: z.number().nonnegative().optional(),

  // Metadata
  publishDate: z.string().optional(),
  authors: z.array(z.string()).optional(),
  doi: z.string().optional(),
  journal: z.string().optional(),

  // Display helpers
  displayName: z.string().optional(),
  sourceIcon: z.string().optional(),
  warning: z.string().optional()
});

// Main research finding schema
export const ResearchFindingSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  agentType: z.string().optional(),
  topicId: z.string(),
  type: z.enum(['treatment', 'trial', 'study', 'guideline', 'news']),

  // Core content
  title: z.string().min(1).max(500),
  summary: z.string().min(10).max(2000),
  details: z.string().min(10),
  content: z.string().optional(),

  // Source and quality
  source: ResearchSourceSchema,

  // Categorization
  category: FindingCategorySchema.optional(),
  tags: z.array(z.string()).optional().default([]),
  priority: FindingPrioritySchema.optional().default('medium'),

  // Status flags
  isNew: z.boolean().default(true),
  isContradictory: z.boolean().optional(),
  relatedFindings: z.array(z.string()).optional(),

  // Extracted entities
  extractedEntities: z.object({
    medications: z.array(z.string()).optional(),
    dosages: z.array(z.string()).optional(),
    sideEffects: z.array(z.string()).optional(),
    institutions: z.array(z.string()).optional()
  }).optional(),

  // Timestamps
  timestamp: z.number(),
  foundDate: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),

  // User engagement
  userEngagement: z.object({
    viewed: z.boolean().optional(),
    clicked: z.boolean().optional(),
    dismissed: z.boolean().optional(),
    shared: z.boolean().optional(),
    notes: z.string().optional()
  }).optional(),

  // Clinical details
  snippet: z.string().optional(),
  keyInsights: z.array(z.string()).optional(),
  clinicalRelevance: z.string().optional(),
  clinicalImplications: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),

  // Metadata
  metadata: z.object({
    sampleSize: z.number().positive().optional(),
    duration: z.string().optional(),
    studyType: z.string().optional(),
    evidenceLevel: z.string().optional(),
    digestReferences: z.array(z.string()).optional()
  }).optional()
});

// Function to determine category from finding type
export function determineFindingCategory(
  type: string,
  title: string,
  summary: string
): z.infer<typeof FindingCategorySchema> | undefined {
  const lowerTitle = title.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  const combined = `${lowerTitle} ${lowerSummary}`;

  // Clinical trial keywords
  if (type === 'trial' || combined.includes('clinical trial') || combined.includes('phase i') || combined.includes('phase ii') || combined.includes('phase iii')) {
    return 'clinical_trial';
  }

  // Treatment keywords
  if (type === 'treatment' || combined.includes('therapy') || combined.includes('treatment') || combined.includes('drug') || combined.includes('medication')) {
    return 'treatment';
  }

  // Mechanism keywords
  if (combined.includes('mechanism') || combined.includes('pathway') || combined.includes('pathophysiology')) {
    return 'mechanism';
  }

  // Outcome keywords
  if (combined.includes('outcome') || combined.includes('survival') || combined.includes('prognosis')) {
    return 'outcome';
  }

  // Diagnostic keywords
  if (combined.includes('diagnostic') || combined.includes('biomarker') || combined.includes('screening')) {
    return 'diagnostic';
  }

  // Prevention keywords
  if (combined.includes('prevention') || combined.includes('prophylaxis') || combined.includes('vaccine')) {
    return 'prevention';
  }

  // Epidemiology keywords
  if (combined.includes('prevalence') || combined.includes('incidence') || combined.includes('epidemiology')) {
    return 'epidemiology';
  }

  // Default based on type
  switch (type) {
    case 'study':
      return 'mechanism';
    case 'guideline':
      return 'treatment';
    case 'news':
      return undefined;
    default:
      return undefined;
  }
}

// Function to calculate source quality score
export function calculateSourceQuality(source: z.infer<typeof ResearchSourceSchema>): number {
  let score = 50; // Base score

  // Credibility factor
  switch (source.credibility) {
    case 'peer-reviewed':
      score += 30;
      break;
    case 'preprint':
      score += 10;
      break;
    case 'news':
      score -= 10;
      break;
    case 'blog':
      score -= 20;
      break;
    case 'unknown':
      score -= 15;
      break;
  }

  // Source type factor
  switch (source.type) {
    case 'journal':
    case 'pubmed':
      score += 20;
      break;
    case 'clinical_trial':
    case 'fda':
    case 'guidelines':
      score += 15;
      break;
    case 'medical_site':
      score += 5;
      break;
    case 'community':
      score -= 15;
      break;
  }

  // Impact factor bonus
  if (source.impactFactor) {
    if (source.impactFactor > 10) score += 10;
    else if (source.impactFactor > 5) score += 5;
  }

  // Citation count bonus
  if (source.citationCount) {
    if (source.citationCount > 100) score += 5;
    else if (source.citationCount > 50) score += 3;
  }

  // Has DOI bonus
  if (source.doi) score += 5;

  // Missing crucial info penalties
  if (source.name === 'Unknown Source' || !source.name) score -= 10;
  if (!source.url) score -= 5;
  if (!source.publishDate) score -= 5;

  return Math.max(0, Math.min(100, score));
}

// Function to generate tags from content
export function generateFindingTags(finding: {
  title: string;
  summary: string;
  type: string;
  category?: string;
}): string[] {
  const tags: string[] = [];
  const combined = `${finding.title} ${finding.summary}`.toLowerCase();

  // Add type and category as tags
  tags.push(finding.type);
  if (finding.category) {
    tags.push(finding.category);
  }

  // Treatment-related tags
  if (combined.includes('gene therapy')) tags.push('gene-therapy');
  if (combined.includes('transplant')) tags.push('transplant');
  if (combined.includes('transfusion')) tags.push('transfusion');
  if (combined.includes('hydroxyurea')) tags.push('hydroxyurea');

  // Patient population tags
  if (combined.includes('pediatric') || combined.includes('children')) tags.push('pediatric');
  if (combined.includes('adult')) tags.push('adult');
  if (combined.includes('elderly')) tags.push('elderly');

  // Severity tags
  if (combined.includes('severe')) tags.push('severe');
  if (combined.includes('mild')) tags.push('mild');
  if (combined.includes('moderate')) tags.push('moderate');

  // Outcome tags
  if (combined.includes('cure')) tags.push('curative');
  if (combined.includes('palliative')) tags.push('palliative');
  if (combined.includes('quality of life')) tags.push('quality-of-life');

  // Research stage tags
  if (combined.includes('phase 1') || combined.includes('phase i')) tags.push('phase-1');
  if (combined.includes('phase 2') || combined.includes('phase ii')) tags.push('phase-2');
  if (combined.includes('phase 3') || combined.includes('phase iii')) tags.push('phase-3');
  if (combined.includes('approved')) tags.push('fda-approved');

  return [...new Set(tags)]; // Remove duplicates
}

// Export type inference helpers
export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type FindingCategory = z.infer<typeof FindingCategorySchema>;
export type FindingPriority = z.infer<typeof FindingPrioritySchema>;