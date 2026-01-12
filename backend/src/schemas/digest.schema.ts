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
  themes: z.array(DigestThemeSchema).default([]),
  keyTakeaways: z.array(z.string()).default([]),
  breakthroughs: z.array(BreakthroughSchema).optional().default([]),
  contradictions: z.array(ContradictionSchema).optional().default([]),
  trends: z.object({
    emerging: z.array(TrendItemSchema).default([]),
    declining: z.array(TrendItemSchema).default([]),
    stable: z.array(TrendItemSchema).default([])
  }).default({ emerging: [], declining: [], stable: [] })
});

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
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: {
            type: 'string',
            description: 'Specific theme (e.g., "Metformin Shows 30% Response Rate")'
          },
          summary: {
            type: 'string',
            description: 'What this means for treatment decisions, including specific metrics'
          },
          category: {
            type: 'string',
            enum: ['treatment', 'mechanism', 'trial', 'outcome', 'diagnostic', 'prevention']
          },
          importance: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low']
          },
          findingIndices: {
            type: 'array',
            items: { type: 'number' },
            description: 'Indices of findings that support this theme'
          },
          entities: {
            type: 'object',
            properties: {
              medications: {
                type: 'array',
                items: { type: 'string' },
                description: 'Drug names with dosages if mentioned'
              },
              institutions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Research centers conducting studies'
              }
            },
            required: ['medications', 'institutions']
          },
          practicalInsight: {
            type: 'string',
            description: 'One specific action or consideration'
          },
          studyStrength: {
            type: 'string',
            description: 'RCT, Meta-analysis, Observational, or Case study'
          },
          avgConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low']
          }
        },
        required: ['id', 'title', 'summary', 'category', 'importance', 'findingIndices', 'entities', 'practicalInsight', 'studyStrength', 'avgConfidence']
      }
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
    trends: {
      type: 'object',
      properties: {
        emerging: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              findingCount: { type: 'number' },
              description: { type: 'string' }
            },
            required: ['topic', 'findingCount', 'description']
          }
        },
        declining: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              findingCount: { type: 'number' },
              description: { type: 'string' }
            },
            required: ['topic', 'findingCount', 'description']
          }
        },
        stable: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              findingCount: { type: 'number' },
              description: { type: 'string' }
            },
            required: ['topic', 'findingCount', 'description']
          }
        }
      },
      required: ['emerging', 'declining', 'stable']
    }
  },
  required: ['executiveSummary', 'laymanSummary', 'themes', 'keyTakeaways', 'trends'],
  additionalProperties: false
};