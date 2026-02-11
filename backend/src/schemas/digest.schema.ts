import { z } from 'zod';

// Dual-mode text: both a technical and explained version of the same content
export const DualModeTextSchema = z.object({
  technical: z.string(),
  explained: z.string()
});

export type DualModeText = z.infer<typeof DualModeTextSchema>;

// What's New — warm companion summary of temporal changes (dual-mode)
export const WhatsNewSchema = z.object({
  technical: z.string(),
  explained: z.string()
});

// Notable Finding — extends TopFinding with temporal awareness
export const NotableFindingSchema = z.object({
  findingId: z.string().describe('ID of the source finding - MUST exist in database'),
  sourceType: z.enum(['pubmed', 'clinical_trial', 'fda', 'web']),
  isNew: z.boolean().default(false),
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

// Simplified conflict (no findingA/findingB indices)
export const ConflictSchema = z.object({
  topic: DualModeTextSchema,
  explanation: DualModeTextSchema,
  sources: z.array(z.string()).default([]),
});

// For Your Doctor — combined section
export const ForYourDoctorSchema = z.object({
  questions: z.array(DualModeTextSchema).default([]),
  watchFor: z.array(DualModeTextSchema).default([]),
  conflicts: z.array(ConflictSchema).optional().default([]),
});

// The consolidated 6-section digest schema (Plan 022 Pillar 3)
export const SmartDigestSchema = z.object({
  whatsNew: WhatsNewSchema,
  featuredDiscovery: z.lazy(() => FeaturedDiscoverySchema),
  keyTakeaways: z.array(DualModeTextSchema).default([]),
  notableFindings: z.array(NotableFindingSchema).max(12),
  forYourDoctor: ForYourDoctorSchema,
  sourceBreakdown: z.lazy(() => SourceBreakdownSchema),
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

// Top Finding schema - kept for backward compatibility with FindingSummaryCard
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

// ============================================
// Two-Pass Scoring Validation Schemas (Plan 021)
// ============================================

export const ScoredFindingSchema = z.object({
  findingId: z.string(),
  significanceScore: z.number().min(1).max(10).default(5),
  significanceReason: z.string().default('Score assigned by AI triage'),
  researchCategory: z.string().default('other'),
  condensedSummary: z.string().default('')
});

export const CategoryGroupSchema = z.object({
  category: z.string(),
  findingCount: z.number(),
  headline: z.string()
});

export const ScoredFindingsResultSchema = z.object({
  scoredFindings: z.array(ScoredFindingSchema),            // REQUIRED — no default
  categoryGroups: z.array(CategoryGroupSchema).default([]), // Reconstructible from scoredFindings
  topFindingIds: z.array(z.string()).default([]),           // Reconstructible from scoredFindings
  totalAnalyzed: z.number().default(0)                     // Reconstructible from scoredFindings
});

// Convert Zod schema to JSON Schema format for Claude API
export const digestJSONSchema = {
  type: 'object' as const,
  properties: {
    whatsNew: {
      type: 'object',
      description: 'A warm, companion-voice summary of what changed. 2-3 sentences. Address the user directly with "Your". For returning users, reference [NEW] finding counts. For first-time users, welcome them and summarize the landscape.',
      properties: {
        technical: {
          type: 'string',
          description: 'Summary using medical terminology, specific drug names, trial references, and clinical metrics'
        },
        explained: {
          type: 'string',
          description: 'Same facts in plain language with analogies. Warm companion tone.'
        }
      },
      required: ['technical', 'explained']
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
      description: '5-8 actionable insights, each with a technical version (medical terminology) and an explained version (plain language)'
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
    notableFindings: {
      type: 'array',
      description: 'Up to 12 notable findings ordered by clinical significance. Mark isNew=true for findings with [NEW] tag. Include at least 1 finding from each research category with 5+ findings.',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          findingId: {
            type: 'string',
            description: 'ID of the source finding - MUST be exact UUID from the "ID:" field'
          },
          sourceType: {
            type: 'string',
            enum: ['pubmed', 'clinical_trial', 'fda', 'web']
          },
          isNew: {
            type: 'boolean',
            description: 'true if the finding has a [NEW] tag in the data'
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
        required: ['findingId', 'sourceType', 'isNew', 'technical', 'explained', 'metadata']
      }
    },
    forYourDoctor: {
      type: 'object',
      description: 'Combined section for doctor discussions: questions to ask, signs to watch for, and any genuine conflicting findings.',
      properties: {
        questions: {
          type: 'array',
          description: '3-5 evidence-based questions to ask at the next appointment',
          items: {
            type: 'object',
            properties: {
              technical: {
                type: 'string',
                description: 'Question referencing specific biomarkers, drug interactions, or trial data'
              },
              explained: {
                type: 'string',
                description: 'Same question in conversational, approachable language'
              }
            },
            required: ['technical', 'explained']
          }
        },
        watchFor: {
          type: 'array',
          description: '2-4 symptoms or signs to monitor based on the research',
          items: {
            type: 'object',
            properties: {
              technical: {
                type: 'string',
                description: 'Warning sign with clinical terminology and specific thresholds'
              },
              explained: {
                type: 'string',
                description: 'Same sign in everyday terms anyone would recognize'
              }
            },
            required: ['technical', 'explained']
          }
        },
        conflicts: {
          type: 'array',
          description: 'ONLY include genuine contradictions supported by evidence from different findings. Return empty array if none exist. Do NOT force contradictions.',
          items: {
            type: 'object',
            properties: {
              topic: {
                type: 'object',
                properties: {
                  technical: { type: 'string', description: 'Conflict topic in medical terminology' },
                  explained: { type: 'string', description: 'Conflict topic in plain language' }
                },
                required: ['technical', 'explained']
              },
              explanation: {
                type: 'object',
                properties: {
                  technical: { type: 'string', description: 'Why these findings conflict, using clinical references' },
                  explained: { type: 'string', description: 'Same explanation in plain language' }
                },
                required: ['technical', 'explained']
              },
              sources: {
                type: 'array',
                items: { type: 'string' },
                description: 'Names of the conflicting sources'
              }
            },
            required: ['topic', 'explanation', 'sources']
          }
        }
      },
      required: ['questions', 'watchFor', 'conflicts']
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
  required: ['whatsNew', 'featuredDiscovery', 'keyTakeaways', 'notableFindings', 'forYourDoctor', 'sourceBreakdown'],
  additionalProperties: false
};
