import { z } from 'zod';

// Define the Zod schema for validation with sensible defaults
export const DigestThemeSchema = z.object({
  id: z.string().default(() => `theme-${Date.now()}`),
  title: z.string(),
  summary: z.string(),
  category: z.enum(['treatment', 'mechanism', 'trial', 'outcome', 'diagnostic', 'prevention']).default('treatment'),
  importance: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  findingIndices: z.array(z.number()).default([]),
  entities: z.object({
    medications: z.array(z.string()).default([]),
    institutions: z.array(z.string()).default([])
  }).default({ medications: [], institutions: [] }),
  practicalInsight: z.string().default(''),
  studyStrength: z.string().default('observational'),
  avgConfidence: z.enum(['high', 'medium', 'low']).default('medium')
});

export const BreakthroughSchema = z.object({
  id: z.string().default(() => `breakthrough-${Date.now()}`),
  title: z.string(),
  description: z.string(),
  impact: z.enum(['paradigm-shift', 'major', 'moderate']).default('moderate'),
  findingIndices: z.array(z.number()).default([]),
  source: z.string().default('Unknown')
});

export const ContradictionSchema = z.object({
  id: z.string(),
  topic: z.string(),
  findingA: z.object({
    index: z.number(),
    claim: z.string(),
    source: z.string()
  }),
  findingB: z.object({
    index: z.number(),
    claim: z.string(),
    source: z.string()
  }),
  explanation: z.string(),
  requiresAttention: z.boolean()
});

export const TrendItemSchema = z.object({
  topic: z.string(),
  findingCount: z.number().default(0),
  description: z.string().default('')
});

export const SmartDigestSchema = z.object({
  executiveSummary: z.string(),
  laymanSummary: z.string(),
  keyTakeaways: z.array(z.string()).default([]),
  breakthroughs: z.array(BreakthroughSchema).optional().default([]),
  contradictions: z.array(ContradictionSchema).optional().default([]),
  // Magazine editorial fields (REQUIRED for new digests)
  featuredDiscovery: z.lazy(() => FeaturedDiscoverySchema),
  topFindings: z.array(z.lazy(() => TopFindingSchema)).max(12),
  sourceBreakdown: z.lazy(() => SourceBreakdownSchema),
  // Legacy fields (kept optional for backward compat with old digests)
  themes: z.array(DigestThemeSchema).optional().default([]),
  trends: z.object({
    emerging: z.array(TrendItemSchema).default([]),
    declining: z.array(TrendItemSchema).default([]),
    stable: z.array(TrendItemSchema).default([])
  }).optional().default({ emerging: [], declining: [], stable: [] }),
});

// Featured Discovery schema - the "hero" content of the digest
export const FeaturedDiscoverySchema = z.object({
  findingId: z.string().describe('ID of the source finding - MUST exist in database'),
  sourceType: z.enum(['pubmed', 'clinical_trial', 'fda', 'web']),
  technical: z.object({
    quote: z.string().describe('Pull-quote style key statement in medical terminology'),
    whyItMatters: z.string().describe('2-3 sentences explaining significance'),
    actionItem: z.string().optional().describe('Specific action the patient can take'),
  }),
  explained: z.object({
    quote: z.string().describe('Same facts as technical, but with analogies/metaphors'),
    whyItMatters: z.string().describe('Same info with everyday comparisons'),
    actionItem: z.string().optional().describe('Action item in plain language'),
  }),
  sourceMetadata: z.object({
    name: z.string().describe('Source name (e.g., "FDA Drug Approval")'),
    url: z.string().optional(),
    date: z.string().optional(),
    studyType: z.string().optional(),
  }),
});

export type FeaturedDiscovery = z.infer<typeof FeaturedDiscoverySchema>;

// Top Finding schema - secondary notable findings
export const TopFindingSchema = z.object({
  findingId: z.string().describe('ID of the source finding - MUST exist in database'),
  sourceType: z.enum(['pubmed', 'clinical_trial', 'fda', 'web']),
  technical: z.object({
    title: z.string().describe('Finding title in medical terminology'),
    summary: z.string().describe('2-3 sentence summary'),
  }),
  explained: z.object({
    title: z.string().describe('Finding title with plain language'),
    summary: z.string().describe('Summary with analogies/examples'),
  }),
  metadata: z.string().describe('Display string like "PubMed • Jan 2026 • Meta-analysis (n=2,847)"'),
});

export type TopFinding = z.infer<typeof TopFindingSchema>;

// Source Breakdown schema - counts by source type
export const SourceBreakdownSchema = z.object({
  pubmed: z.number().describe('Count of PubMed/research findings'),
  clinicalTrials: z.number().describe('Count of clinical trial findings'),
  fda: z.number().describe('Count of FDA findings'),
  web: z.number().describe('Count of web/news findings'),
});

export type SourceBreakdown = z.infer<typeof SourceBreakdownSchema>;

// Convert Zod schema to JSON Schema format for Claude API
export const digestJSONSchema = {
  type: 'object' as const,
  properties: {
    executiveSummary: {
      type: 'string',
      description: '2-3 sentences: Most critical finding + Why it matters + Immediate action item'
    },
    laymanSummary: {
      type: 'string',
      description: 'Plain English explanation a family member would understand, with practical implications'
    },
    keyTakeaways: {
      type: 'array',
      items: {
        type: 'string',
        description: 'Specific insights like: "Drug X reduced symptoms by 45% at 10mg daily dose in Phase 3 trial (n=500)"'
      },
      description: 'List of actionable insights with specific metrics'
    },
    breakthroughs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: {
            type: 'string',
            description: 'Why this is significant'
          },
          impact: {
            type: 'string',
            enum: ['paradigm-shift', 'major', 'moderate']
          },
          findingIndices: {
            type: 'array',
            items: { type: 'number' }
          },
          source: { type: 'string' }
        },
        required: ['id', 'title', 'description', 'impact', 'findingIndices', 'source']
      }
    },
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          topic: {
            type: 'string',
            description: 'What aspect is contradicted'
          },
          findingA: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              claim: { type: 'string' },
              source: { type: 'string' }
            },
            required: ['index', 'claim', 'source']
          },
          findingB: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              claim: { type: 'string' },
              source: { type: 'string' }
            },
            required: ['index', 'claim', 'source']
          },
          explanation: {
            type: 'string',
            description: 'Possible reason for contradiction'
          },
          requiresAttention: { type: 'boolean' }
        },
        required: ['id', 'topic', 'findingA', 'findingB', 'explanation', 'requiresAttention']
      }
    },
    featuredDiscovery: {
      type: 'object',
      description: 'The single most impactful finding as "hero" content',
      properties: {
        findingId: {
          type: 'string',
          description: 'ID of the source finding - MUST exist in database'
        },
        sourceType: {
          type: 'string',
          enum: ['pubmed', 'clinical_trial', 'fda', 'web']
        },
        technical: {
          type: 'object',
          properties: {
            quote: {
              type: 'string',
              description: 'Pull-quote style key statement in medical terminology'
            },
            whyItMatters: {
              type: 'string',
              description: '2-3 sentences explaining significance'
            },
            actionItem: {
              type: 'string',
              description: 'Specific action the patient can take'
            }
          },
          required: ['quote', 'whyItMatters']
        },
        explained: {
          type: 'object',
          properties: {
            quote: {
              type: 'string',
              description: 'Same facts as technical, but with analogies/metaphors'
            },
            whyItMatters: {
              type: 'string',
              description: 'Same info with everyday comparisons'
            },
            actionItem: {
              type: 'string',
              description: 'Action item in plain language'
            }
          },
          required: ['quote', 'whyItMatters']
        },
        sourceMetadata: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Source name (e.g., "FDA Drug Approval")'
            },
            url: { type: 'string' },
            date: { type: 'string' },
            studyType: { type: 'string' }
          },
          required: ['name']
        }
      },
      required: ['findingId', 'sourceType', 'technical', 'explained', 'sourceMetadata']
    },
    topFindings: {
      type: 'array',
      description: '12 additional notable findings',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          findingId: {
            type: 'string',
            description: 'ID of the source finding - MUST exist in database'
          },
          sourceType: {
            type: 'string',
            enum: ['pubmed', 'clinical_trial', 'fda', 'web']
          },
          technical: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Finding title in medical terminology'
              },
              summary: {
                type: 'string',
                description: '2-3 sentence summary'
              }
            },
            required: ['title', 'summary']
          },
          explained: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Finding title with plain language'
              },
              summary: {
                type: 'string',
                description: 'Summary with analogies/examples'
              }
            },
            required: ['title', 'summary']
          },
          metadata: {
            type: 'string',
            description: 'Display string like "PubMed • Jan 2026 • Meta-analysis (n=2,847)"'
          }
        },
        required: ['findingId', 'sourceType', 'technical', 'explained', 'metadata']
      }
    },
    sourceBreakdown: {
      type: 'object',
      description: 'Count of findings by source type',
      properties: {
        pubmed: {
          type: 'number',
          description: 'Count of PubMed/research findings'
        },
        clinicalTrials: {
          type: 'number',
          description: 'Count of clinical trial findings'
        },
        fda: {
          type: 'number',
          description: 'Count of FDA findings'
        },
        web: {
          type: 'number',
          description: 'Count of web/news findings'
        }
      },
      required: ['pubmed', 'clinicalTrials', 'fda', 'web']
    }
  },
  required: ['executiveSummary', 'laymanSummary', 'keyTakeaways', 'featuredDiscovery', 'topFindings', 'sourceBreakdown'],
  additionalProperties: false
};