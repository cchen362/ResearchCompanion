import { z } from 'zod';

// Dual-mode text: both a technical and explained version of the same content
export const DualModeTextSchema = z.object({
  technical: z.string(),
  explained: z.string()
});

export type DualModeText = z.infer<typeof DualModeTextSchema>;

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
  title: DualModeTextSchema,
  description: DualModeTextSchema,
  impact: z.enum(['paradigm-shift', 'major', 'moderate']).default('moderate'),
  findingIndices: z.array(z.number()).default([]),
  source: z.string().default('Unknown')
});

export const ContradictionSchema = z.object({
  id: z.string(),
  topic: DualModeTextSchema,
  findingA: z.object({
    index: z.number(),
    claim: DualModeTextSchema,
    source: z.string()
  }),
  findingB: z.object({
    index: z.number(),
    claim: DualModeTextSchema,
    source: z.string()
  }),
  explanation: DualModeTextSchema,
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
  keyTakeaways: z.array(DualModeTextSchema).default([]),
  questionsForDoctor: z.array(DualModeTextSchema).optional().default([]),
  warningSigns: z.array(DualModeTextSchema).optional().default([]),
  breakthroughs: z.array(BreakthroughSchema).optional().default([]),
  contradictions: z.array(ContradictionSchema).optional().default([]),
  // Magazine editorial fields (REQUIRED for new digests)
  featuredDiscovery: z.lazy(() => FeaturedDiscoverySchema),
  topFindings: z.array(z.lazy(() => TopFindingSchema)).max(12),
  sourceBreakdown: z.lazy(() => SourceBreakdownSchema),
  // Companion Intelligence fields (Plan 015c)
  researchPulse: z.string().optional().default(''),
  worthRevisiting: z.array(z.object({
    oldFindingId: z.string(),
    oldFindingTitle: z.string(),
    oldFindingSummary: z.string(),
    newBreakthroughId: z.string(),
    newBreakthroughTitle: z.string(),
    newBreakthroughSummary: z.string(),
    connectionExplanation: z.string(),
    connectionBasis: z.string()
  })).optional().default([]),
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
        type: 'object',
        properties: {
          technical: {
            type: 'string',
            description: 'Specific insight with drug names, dosages, biomarkers, trial phases, sample sizes. Example: "Pembrolizumab 200mg q3w achieved 45% ORR in KEYNOTE-189 Phase 3 (n=616)"'
          },
          explained: {
            type: 'string',
            description: 'Same fact in plain language with analogies. Example: "A cancer drug called Pembrolizumab helped about half the patients in a large study — imagine flipping a coin and getting heads"'
          }
        },
        required: ['technical', 'explained']
      },
      description: 'Actionable insights, each with a technical version (medical terminology) and an explained version (plain language)'
    },
    breakthroughs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: {
            type: 'object',
            properties: {
              technical: { type: 'string', description: 'Title using proper medical terminology and mechanisms' },
              explained: { type: 'string', description: 'Title in everyday language anyone can understand' }
            },
            required: ['technical', 'explained']
          },
          description: {
            type: 'object',
            properties: {
              technical: { type: 'string', description: 'Why this is significant, using clinical metrics and study references' },
              explained: { type: 'string', description: 'Why this matters, explained with analogies and comparisons' }
            },
            required: ['technical', 'explained']
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
            type: 'object',
            properties: {
              technical: { type: 'string', description: 'Contradiction topic using medical terminology' },
              explained: { type: 'string', description: 'Contradiction topic in plain language' }
            },
            required: ['technical', 'explained']
          },
          findingA: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              claim: {
                type: 'object',
                properties: {
                  technical: { type: 'string', description: 'Claim in medical terminology' },
                  explained: { type: 'string', description: 'Claim in plain language' }
                },
                required: ['technical', 'explained']
              },
              source: { type: 'string' }
            },
            required: ['index', 'claim', 'source']
          },
          findingB: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              claim: {
                type: 'object',
                properties: {
                  technical: { type: 'string', description: 'Claim in medical terminology' },
                  explained: { type: 'string', description: 'Claim in plain language' }
                },
                required: ['technical', 'explained']
              },
              source: { type: 'string' }
            },
            required: ['index', 'claim', 'source']
          },
          explanation: {
            type: 'object',
            properties: {
              technical: { type: 'string', description: 'Reason for contradiction using medical terminology' },
              explained: { type: 'string', description: 'Reason in plain language' }
            },
            required: ['technical', 'explained']
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
    },
    questionsForDoctor: {
      type: 'array',
      description: 'Evidence-based questions the patient should ask their doctor at their next appointment. Generate 3-5 questions.',
      items: {
        type: 'object',
        properties: {
          technical: {
            type: 'string',
            description: 'Question referencing specific biomarkers, drug interactions, or trial data. Example: "Should we monitor my IGF-1 levels given the Phase 3 data on pegvisomant dose adjustment?"'
          },
          explained: {
            type: 'string',
            description: 'Same question in conversational, approachable language. Example: "Based on the new research, should we check my hormone levels to see if my medication dose needs changing?"'
          }
        },
        required: ['technical', 'explained']
      }
    },
    warningSigns: {
      type: 'array',
      description: 'Symptoms or signs the patient should monitor based on the research findings. Generate 2-4 warning signs.',
      items: {
        type: 'object',
        properties: {
          technical: {
            type: 'string',
            description: 'Warning sign with clinical terminology and specific thresholds. Example: "New-onset peripheral edema or arthralgia persisting >72h may indicate GH receptor antagonist adverse effects"'
          },
          explained: {
            type: 'string',
            description: 'Same sign in everyday terms. Example: "Watch for unusual swelling in your hands/feet or joint pain lasting more than 3 days — this could be a side effect worth mentioning to your doctor"'
          }
        },
        required: ['technical', 'explained']
      }
    },
    researchPulse: {
      type: 'string',
      description: 'A single warm, companion-voice sentence summarizing the state of research for this topic. Address the user directly with "Your". Example: "Your Haemophilia research has 3 new breakthroughs this week, including a promising gene therapy trial that could change treatment approaches." Write in a caring, knowledgeable companion tone — not clinical, not overly casual. 1-2 sentences max.'
    },
    worthRevisiting: {
      type: 'array',
      description: 'Identify 0-3 meaningful connections between OLDER findings and RECENT breakthroughs. Only include genuinely significant connections with strong reasoning. Return empty array [] if no meaningful connections exist. Each connection MUST reference real finding IDs from the data.',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          oldFindingId: {
            type: 'string',
            description: 'UUID of the older finding — MUST be exact ID from the "ID:" field in the finding data'
          },
          oldFindingTitle: {
            type: 'string',
            description: 'Title of the older finding (for immediate display without DB lookup)'
          },
          oldFindingSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the older finding'
          },
          newBreakthroughId: {
            type: 'string',
            description: 'UUID of the recent breakthrough finding — MUST be exact ID from the "ID:" field in the finding data'
          },
          newBreakthroughTitle: {
            type: 'string',
            description: 'Title of the recent breakthrough (for immediate display)'
          },
          newBreakthroughSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the recent breakthrough'
          },
          connectionExplanation: {
            type: 'string',
            description: 'WHY these two findings connect. 1-2 sentences explaining the meaningful link. Must be specific — cite the mechanism, pathway, or evidence, not vague associations.'
          },
          connectionBasis: {
            type: 'string',
            description: 'Brief qualifier phrase (2-5 words). Examples: "Shared therapeutic target", "Same gene pathway", "Contradictory dosing evidence", "Complementary mechanisms"'
          }
        },
        required: ['oldFindingId', 'oldFindingTitle', 'oldFindingSummary', 'newBreakthroughId', 'newBreakthroughTitle', 'newBreakthroughSummary', 'connectionExplanation', 'connectionBasis']
      }
    }
  },
  required: ['executiveSummary', 'laymanSummary', 'keyTakeaways', 'featuredDiscovery', 'topFindings', 'sourceBreakdown'],
  additionalProperties: false
};