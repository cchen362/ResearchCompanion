import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';
import { digestJSONSchema, SmartDigestSchema, ScoredFindingsResultSchema, ScoredFindingSchema } from '../schemas/digest.schema.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Initialize API clients with retry configuration
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  maxRetries: 2,
  timeout: 300000, // 5 minutes — matches nginx (300s), Express (300s), and frontend longOperationApi (300s)
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ============================================
// Two-Pass Scoring Types (Plan 020)
// ============================================

interface ScoredFinding {
  findingId: string;
  significanceScore: number;        // 1-10
  significanceReason: string;       // Why this score
  researchCategory: string;         // e.g., 'drug_approval', 'clinical_trial', etc.
  condensedSummary: string;         // 150-char max distilled summary
}

interface CategoryGroup {
  category: string;
  findingCount: number;
  headline: string;                 // 1-sentence summary of this category
}

export interface ScoredFindingsResult {
  scoredFindings: ScoredFinding[];
  categoryGroups: CategoryGroup[];
  topFindingIds: string[];          // Top 30 by significance, most significant first
  totalAnalyzed: number;
}

/**
 * JSON Schema for Haiku's scoring tool_use structured output.
 * Defines the contract for the score_findings tool.
 */
const scoredFindingsSchema = {
  type: 'object' as const,
  properties: {
    // Metadata fields FIRST — if response truncates, these survive (Plan 021)
    totalAnalyzed: {
      type: 'number' as const,
      description: 'Total number of findings scored'
    },
    categoryGroups: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string' as const,
            description: 'Category name'
          },
          findingCount: {
            type: 'number' as const,
            description: 'Count of findings in this category'
          },
          headline: {
            type: 'string' as const,
            description: 'One-sentence summary of this category'
          }
        },
        required: ['category', 'findingCount', 'headline']
      }
    },
    topFindingIds: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Top 30 finding UUIDs ranked by significance (most significant first)'
    },
    // Large array LAST — safe to truncate tail (Plan 021)
    scoredFindings: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          findingId: {
            type: 'string' as const,
            description: 'UUID of the finding being scored'
          },
          significanceScore: {
            type: 'number' as const,
            description: 'Clinical significance score from 1-10'
          },
          significanceReason: {
            type: 'string' as const,
            description: 'Brief justification, max 40 characters'
          },
          researchCategory: {
            type: 'string' as const,
            description: 'Category: drug_approval, clinical_trial, gene_therapy, mechanism_research, treatment_guideline, patient_outcomes, safety_alert, diagnostic_advance, or other'
          },
          condensedSummary: {
            type: 'string' as const,
            description: 'Single sentence summary, max 150 characters'
          }
        },
        required: ['findingId', 'significanceScore', 'significanceReason', 'researchCategory', 'condensedSummary']
      }
    }
  },
  required: ['totalAnalyzed', 'categoryGroups', 'topFindingIds', 'scoredFindings']
};

/**
 * Parse a natural language search query using Claude
 */
export async function parseSearchQuery(query: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', // Using Claude Sonnet 4.6
      max_tokens: 500,
      temperature: 0.3,
      system: `You are a health research query parser for a personal medical research assistant app.
Your job is to extract structured intent from natural language queries about health topics.
Current date: ${new Date().toISOString().split('T')[0]} (Year ${new Date().getFullYear()})

CRITICAL: Return ONLY valid JSON, no markdown, no code blocks, no explanations - just the raw JSON object.

REQUIRED OUTPUT FORMAT (JSON):
{
  "topic": "string - primary health condition or disease",
  "focus": "treatments | symptoms | trials | overview | diagnosis | prognosis",
  "modifiers": ["array of relevant modifiers: latest, new, children, adults, rare, etc."],
  "needsClarification": boolean,
  "suggestions": ["array of 2-3 clarifying questions if needsClarification=true"]
}

GUIDELINES:
1. Only process queries related to health, medical conditions, treatments, or medical research
2. For vague queries, set needsClarification=true
3. For off-topic queries, set needsClarification=true and suggest health-related alternatives
4. Extract the most specific condition name possible
5. Identify the user's research focus
6. Capture temporal and demographic modifiers
7. Interpret "latest" or "recent" as referring to ${new Date().getFullYear()} and ${new Date().getFullYear() - 1}`,
      messages: [
        {
          role: 'user',
          content: query
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Clean up the response - remove markdown code blocks if present
      let jsonText = content.text.trim();
      jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      try {
        return JSON.parse(jsonText);
      } catch (e) {
        console.error('Failed to parse JSON:', jsonText);
        throw new Error('Failed to parse AI response as JSON');
      }
    }
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Error parsing search query:', error);
    throw error;
  }
}

/**
 * Summarize search results using Claude
 */
export async function summarizeResults(
  searchResults: any[],
  query: string,
  context?: string
) {
  try {
    // Better error handling for missing fields
    const resultsText = searchResults.map(r => {
      const title = r.title || 'Untitled';
      const url = r.url || r.source?.url || 'No URL';
      const content = r.snippet || r.description || r.summary || r.abstract || 'No content available';

      return `Source: ${title}\nURL: ${url}\nContent: ${content}`;
    }).join('\n\n');

    // Log for debugging
    console.log(`Summarizing ${searchResults.length} results for query: ${query}`);

    const systemPrompt = context
      ? `You are a medical research assistant. Summarize the following search results, focusing on what's NEW or DIFFERENT from the previous context.
Previous context: ${context}`
      : `You are a medical research assistant. Summarize the following search results into clear, organized sections.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,  // Increased from 2000 to handle more search results
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Query: ${query}\n\nSearch Results:\n${resultsText}\n\nProvide a structured summary with:
1. Overview
2. New Research (if any)
3. Treatment Updates (if applicable)
4. Key Considerations
5. Layman Summary (simple language)`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Error summarizing results:', error);
    console.error('Search results structure:', JSON.stringify(searchResults.slice(0, 1), null, 2));
    throw error;
  }
}

/**
 * Generate a Smart Digest from research findings
 */
// Fallback function for when tools approach fails
async function generateSimpleDigest(
  findings: any[],
  topic: any,
  timeframe: string,
  findingsText: string
) {
  console.log('Falling back to simple digest generation without tools...');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      temperature: 0.3,
      system: `You are a medical research analyst. Create a structured digest in valid JSON format.

CRITICAL: Return ONLY valid JSON, no markdown, no explanations, just the JSON object.

Required JSON structure:
{
  "executiveSummary": "2-3 sentences with the most critical finding",
  "laymanSummary": "Plain English explanation",
  "keyTakeaways": ["array of specific insights"]
}`,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${findings.length} findings about ${topic.diseaseProfile.name} and return a JSON digest:

${findingsText.substring(0, 8000)}

Remember: Return ONLY valid JSON, nothing else.`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Try to parse the JSON, with multiple attempts to clean it
      let jsonText = content.text.trim();

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      // Try to parse
      try {
        const parsed = JSON.parse(jsonText);
        console.log('✓ Simple digest parsed successfully');
        return parsed;
      } catch (e) {
        console.error('Simple digest parse failed:', e);
        // Last resort: return minimal valid structure
        return {
          executiveSummary: 'Analysis completed. See findings for details.',
          laymanSummary: 'Medical research findings have been compiled for your review.',
          keyTakeaways: [`${findings.length} findings analyzed from ${timeframe} timeframe`]
        };
      }
    }
  } catch (error) {
    console.error('Simple digest generation failed:', error);
    throw error;
  }
}

/**
 * Pass 1 of Two-Pass Digest Architecture (Plan 020):
 * Score and cluster ALL findings by clinical significance using Haiku.
 *
 * Enables Sonnet (Pass 2) to make significance-based selections for
 * Featured Discovery and Top Findings, eliminating position bias.
 *
 * Cost: ~$0.03-0.12 per call | Time: ~10-30s | Context: within 200K limit
 */

/** Batch threshold: 130 findings at ~100 tokens/finding safely fits in 16K token budget with 18% headroom */
const HAIKU_BATCH_THRESHOLD = 130;
const HAIKU_BATCH_SIZE = 75;

/**
 * Pass 1 entry point: Score and cluster ALL findings by clinical significance using Haiku.
 * Auto-batches at 130+ findings for sustainable scaling.
 */
export async function scoreAndClusterFindings(
  findings: any[],
  topicName: string,
  previousDigestDate?: Date | null
): Promise<ScoredFindingsResult> {
  if (findings.length > HAIKU_BATCH_THRESHOLD) {
    console.log(`[AI] Findings count (${findings.length}) > batch threshold (${HAIKU_BATCH_THRESHOLD}). Splitting into batches of ${HAIKU_BATCH_SIZE}...`);
    return scoreFindingsInBatches(findings, topicName, previousDigestDate);
  }
  return scoreAndClusterFindingsSingle(findings, topicName, previousDigestDate);
}

/** Single-call scoring for ≤130 findings */
async function scoreAndClusterFindingsSingle(
  findings: any[],
  topicName: string,
  previousDigestDate?: Date | null
): Promise<ScoredFindingsResult> {
  console.log(`[AI] Haiku Pass 1: Scoring ${findings.length} findings for ${topicName}...`);

  const findingsText = findings.map((f, idx) => {
    const isNew = previousDigestDate && f.created_at
      ? new Date(f.created_at) > new Date(previousDigestDate)
      : true;
    return `[${idx + 1}] ${isNew ? '[NEW] ' : ''}ID: ${f.id}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 300) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`;
  }).join('\n\n');

  // Dynamic token scaling (Plan 021): 150 tokens/finding accounts for 150-char condensedSummary + metadata.
  // Cap at 16384. Auto-batching kicks in at 130+ findings (see HAIKU_BATCH_THRESHOLD).
  const maxTokens = Math.min(Math.max(4000, findings.length * 150), 16384);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature: 0.1,
      system: `You are a medical research triage analyst scoring findings for ${topicName}.

SIGNIFICANCE SCORING CRITERIA (1-10):
- 10: FDA approval, Phase 3 breakthrough, paradigm-shifting discovery
- 7-9: Phase 2 results, major meta-analyses, guideline changes
- 4-6: Observational studies, case series, preliminary research
- 1-3: Reviews, commentaries, minor updates

RESEARCH CATEGORIES:
Classify each finding into one of: drug_approval, clinical_trial, gene_therapy, mechanism_research, treatment_guideline, patient_outcomes, safety_alert, diagnostic_advance, other

CONDENSED SUMMARIES:
Generate a single-sentence summary (max 150 characters) capturing the core finding.
Keep significanceReason to max 40 characters — a brief phrase, not a full sentence.

OUTPUT REQUIREMENTS:
1. Score EVERY finding provided
2. Group findings into categoryGroups with counts and headlines
3. Identify the top 30 finding IDs ranked by significance (most significant first)
4. Report totalAnalyzed count
CRITICAL: You MUST output ALL four top-level fields: totalAnalyzed, categoryGroups, topFindingIds, scoredFindings. Never omit any field.`,
      messages: [{
        role: 'user',
        content: `Score and cluster these ${findings.length} research findings:\n\n${findingsText}`
      }],
      tools: [{
        name: 'score_findings',
        description: 'Score and cluster research findings by clinical significance',
        input_schema: scoredFindingsSchema
      }],
      tool_choice: { type: 'tool', name: 'score_findings' }
    });

    // Detect truncation and log response metadata (Plan 021)
    if (response.stop_reason === 'max_tokens') {
      console.warn(`[AI] Haiku scoring TRUNCATED (stop_reason=max_tokens). Budget: ${maxTokens}, findings: ${findings.length}, usage: ${JSON.stringify(response.usage)}`);
    }
    console.log(`[AI] Haiku response: stop_reason=${response.stop_reason}, blocks=${response.content.length}, output_tokens=${response.usage?.output_tokens}`);

    // Extract tool use result
    const toolUseBlock = response.content.find(
      (block: any) => block.type === 'tool_use'
    );

    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      console.error('[AI] Haiku scoring: No tool_use block in response');
      return buildFallbackScoring(findings, 'Haiku scoring unavailable');
    }

    // Zod validation with graceful recovery (Plan 021)
    const rawResult = toolUseBlock.input as Record<string, unknown>;
    console.log(`[AI] Haiku raw keys: [${Object.keys(rawResult)}], scoredFindings: ${Array.isArray(rawResult.scoredFindings) ? (rawResult.scoredFindings as any[]).length : 'MISSING'}`);

    // Layer 1: Zod validation (defaults fill missing metadata fields)
    const parseResult = ScoredFindingsResultSchema.safeParse(rawResult);

    if (parseResult.success) {
      const result = reconstructScoredResult(parseResult.data);
      console.log(`[AI] Haiku scored ${result.totalAnalyzed} findings, ${result.categoryGroups.length} categories, top ${result.topFindingIds.length} ranked`);
      return result;
    }

    // Layer 2: Partial recovery — Zod failed but scoredFindings array may be parseable
    console.warn('[AI] Haiku Zod validation failed:', parseResult.error.issues.map(i => `${i.path}: ${i.message}`).join(', '));

    if (Array.isArray(rawResult.scoredFindings) && rawResult.scoredFindings.length > 0) {
      console.log(`[AI] Attempting partial recovery from ${rawResult.scoredFindings.length} scored findings...`);
      const partialParse = z.array(ScoredFindingSchema).safeParse(rawResult.scoredFindings);
      if (partialParse.success && partialParse.data.length > 0) {
        const recovered = reconstructFromScoredFindings(partialParse.data);
        console.log(`[AI] Partial recovery: ${recovered.totalAnalyzed} scored, ${recovered.categoryGroups.length} categories, top ${recovered.topFindingIds.length}`);
        return recovered;
      }
    }

    // Layer 3: Complete failure — use existing fallback
    return buildFallbackScoring(findings, 'Zod validation and partial recovery both failed');
  } catch (error: any) {
    console.error('[AI] Haiku scoring failed:', error.message);
    return buildFallbackScoring(findings, error.message);
  }
}

/** Fallback scoring when Haiku is unavailable — returns valid structure with default scores */
function buildFallbackScoring(findings: any[], reason: string): ScoredFindingsResult {
  console.warn(`[AI] Using fallback scoring (reason: ${reason})`);
  return {
    scoredFindings: findings.map(f => ({
      findingId: f.id,
      significanceScore: 5,
      significanceReason: `Default score — ${reason}`,
      researchCategory: 'other',
      condensedSummary: f.title?.substring(0, 150) || 'No summary'
    })),
    categoryGroups: [{
      category: 'other',
      findingCount: findings.length,
      headline: 'All findings (scoring unavailable)'
    }],
    topFindingIds: findings.slice(0, 30).map(f => f.id),
    totalAnalyzed: findings.length
  };
}

/** Reconstruct missing metadata from scoredFindings (when Zod defaults kicked in) */
function reconstructScoredResult(validated: ScoredFindingsResult): ScoredFindingsResult {
  const result = { ...validated };

  // If totalAnalyzed was 0 (Zod default), set from actual data
  if (result.totalAnalyzed === 0 && result.scoredFindings.length > 0) {
    result.totalAnalyzed = result.scoredFindings.length;
  }

  // If categoryGroups is empty but we have scoredFindings, reconstruct
  if (result.categoryGroups.length === 0 && result.scoredFindings.length > 0) {
    const groups = new Map<string, number>();
    for (const sf of result.scoredFindings) {
      const cat = sf.researchCategory || 'other';
      groups.set(cat, (groups.get(cat) || 0) + 1);
    }
    result.categoryGroups = Array.from(groups.entries()).map(([category, count]) => ({
      category,
      findingCount: count,
      headline: `${count} finding${count > 1 ? 's' : ''} in ${category.replace(/_/g, ' ')}`
    }));
    console.log(`[AI] Reconstructed ${result.categoryGroups.length} category groups from scored findings`);
  }

  // If topFindingIds is empty but we have scoredFindings, derive from scores
  if (result.topFindingIds.length === 0 && result.scoredFindings.length > 0) {
    result.topFindingIds = [...result.scoredFindings]
      .sort((a, b) => b.significanceScore - a.significanceScore)
      .slice(0, 30)
      .map(sf => sf.findingId);
    console.log(`[AI] Reconstructed top ${result.topFindingIds.length} finding IDs from significance scores`);
  }

  return result;
}

/** Build complete ScoredFindingsResult from just the scoredFindings array (deepest recovery) */
function reconstructFromScoredFindings(scoredFindings: ScoredFinding[]): ScoredFindingsResult {
  const groups = new Map<string, number>();
  for (const sf of scoredFindings) {
    const cat = sf.researchCategory || 'other';
    groups.set(cat, (groups.get(cat) || 0) + 1);
  }

  return {
    scoredFindings,
    categoryGroups: Array.from(groups.entries()).map(([category, count]) => ({
      category,
      findingCount: count,
      headline: `${count} finding${count > 1 ? 's' : ''} in ${category.replace(/_/g, ' ')}`
    })),
    topFindingIds: [...scoredFindings]
      .sort((a, b) => b.significanceScore - a.significanceScore)
      .slice(0, 30)
      .map(sf => sf.findingId),
    totalAnalyzed: scoredFindings.length
  };
}

/** Score findings in parallel batches when count exceeds threshold */
async function scoreFindingsInBatches(
  findings: any[],
  topicName: string,
  previousDigestDate?: Date | null
): Promise<ScoredFindingsResult> {
  // Split into batches
  const batches: any[][] = [];
  for (let i = 0; i < findings.length; i += HAIKU_BATCH_SIZE) {
    batches.push(findings.slice(i, i + HAIKU_BATCH_SIZE));
  }

  console.log(`[AI] Scoring ${findings.length} findings in ${batches.length} batches of ≤${HAIKU_BATCH_SIZE}...`);

  // Run batches with concurrency limit of 3
  const batchResults: ScoredFindingsResult[] = [];
  for (let i = 0; i < batches.length; i += 3) {
    const chunk = batches.slice(i, i + 3);
    const results = await Promise.allSettled(
      chunk.map(batch => scoreAndClusterFindingsSingle(batch, topicName, previousDigestDate))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        batchResults.push(result.value);
      } else {
        console.error(`[AI] Batch ${i + j + 1} failed:`, result.reason?.message || result.reason);
        // Fallback for failed batch only — other batches still contribute real scores
        batchResults.push(buildFallbackScoring(chunk[j], `Batch ${i + j + 1} failed`));
      }
    }
  }

  return mergeScoredResults(batchResults, findings.length);
}

/** Merge results from multiple scoring batches into a single coherent result */
function mergeScoredResults(
  results: ScoredFindingsResult[],
  totalFindings: number
): ScoredFindingsResult {
  // Concatenate all scored findings
  const allScored = results.flatMap(r => r.scoredFindings);

  // Merge category groups — aggregate counts per category across batches
  const categoryMap = new Map<string, { count: number; headline: string }>();
  for (const r of results) {
    for (const g of r.categoryGroups) {
      const existing = categoryMap.get(g.category);
      if (existing) {
        existing.count += g.findingCount;
      } else {
        categoryMap.set(g.category, { count: g.findingCount, headline: g.headline });
      }
    }
  }
  const categoryGroups = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    findingCount: data.count,
    headline: data.headline
  }));

  // Global re-rank: sort ALL findings by significance, take top 30
  // This mitigates cross-batch scoring drift by selecting the best across all batches
  const topFindingIds = [...allScored]
    .sort((a, b) => b.significanceScore - a.significanceScore)
    .slice(0, 30)
    .map(sf => sf.findingId);

  console.log(`[AI] Merged ${results.length} batches: ${allScored.length} scored, ${categoryGroups.length} categories, top ${topFindingIds.length} ranked`);

  return {
    scoredFindings: allScored,
    categoryGroups,
    topFindingIds,
    totalAnalyzed: totalFindings
  };
}

export async function generateSmartDigest(
  topFindings: any[],
  remainingFindings: any[],
  scoredResult: ScoredFindingsResult,
  topic: any,
  totalFindingsCount: number,
  previousDigestDate?: Date | null
) {
  console.log(`[AI Service] Starting digest generation with ${totalFindingsCount} total findings (${topFindings.length} full + ${remainingFindings.length} condensed)`);
  const startTime = Date.now();

  try {
    // Build a map of Haiku's condensed summaries for remaining findings
    const condensedMap = new Map(
      scoredResult.scoredFindings.map(sf => [sf.findingId, sf.condensedSummary])
    );

    // TOP FINDINGS: Full detail (300-char summary) — ranked by Haiku significance
    const topFindingsText = topFindings.map((f: any, idx: number) => {
      const isNew = previousDigestDate && f.created_at
        ? new Date(f.created_at) > new Date(previousDigestDate)
        : true;
      return `[Finding ${idx + 1}] ${isNew ? '[NEW] ' : ''}ID: ${f.id}
Type: ${f.type}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 300) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})${f.created_at ? `\nAdded: ${new Date(f.created_at).toISOString().split('T')[0]}` : ''}`;
    }).join('\n\n');

    // REMAINING FINDINGS: Haiku's condensed summary (150 chars)
    const remainingFindingsText = remainingFindings.length > 0
      ? '\n\n[Additional Findings - Condensed by significance scoring]\n' +
        remainingFindings.map((f: any, idx: number) => {
          const isNew = previousDigestDate && f.created_at
            ? new Date(f.created_at) > new Date(previousDigestDate)
            : true;
          return `${topFindings.length + idx + 1}. ${isNew ? '[NEW] ' : ''}ID: ${f.id} — ${f.title} — ${condensedMap.get(f.id) || 'No summary'} (${f.source?.name || 'Unknown'})`;
        }).join('\n')
      : '';

    const findingsText = topFindingsText + remainingFindingsText;

    console.log(`[AI Service] Calling Anthropic API...`);

    // Using tools to encourage structured output (without beta header for compatibility)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',  // Using Claude Sonnet 4.6
      max_tokens: 12000,
      temperature: 0.3,
      tools: [
        {
          name: 'generate_digest',
          description: 'Generate a structured smart digest from research findings',
          input_schema: digestJSONSchema
        }
      ],
      tool_choice: { type: 'tool', name: 'generate_digest' },
      system: `You are an expert medical research analyst creating ACTIONABLE digests for patients/caregivers managing ${topic.diseaseProfile.name}.

## PRE-ANALYSIS CONTEXT (from automated significance scoring)

${totalFindingsCount} total findings were scored by clinical significance (1-10 scale).
Top ${topFindings.length} findings are provided with full detail below.
Remaining ${remainingFindings.length} findings are provided in condensed format.

Significance Rankings (top 30):
${scoredResult.scoredFindings
  .sort((a, b) => b.significanceScore - a.significanceScore)
  .slice(0, 30)
  .map(f => `- ${f.findingId}: Score ${f.significanceScore}/10 — ${f.significanceReason}`)
  .join('\n')}

Research Categories:
${scoredResult.categoryGroups.map(g => `- ${g.category}: ${g.findingCount} findings — ${g.headline}`).join('\n')}
${previousDigestDate ? `
## TEMPORAL CONTEXT
Last digest generated: ${new Date(previousDigestDate).toISOString().split('T')[0]}.
${[...topFindings, ...remainingFindings].filter((f: any) =>
  f.created_at && new Date(f.created_at) > new Date(previousDigestDate)
).length} findings are new since then, marked [NEW] in the data.
Your whatsNew summary should focus on what changed since the last digest.
Featured Discovery and Notable Findings should prioritize [NEW] findings when clinically significant.
` : `
## TEMPORAL CONTEXT
This is the FIRST digest for this topic. All findings are new.
Your whatsNew should welcome the user and summarize the full research landscape.
`}
USE THESE SCORES TO GUIDE:
- Featured Discovery selection MUST come from highest-scored findings
- Notable Findings should prioritize high-significance findings
- Source breakdown MUST account for ALL ${totalFindingsCount} findings

CRITICAL CONTEXT:
- User is actively managing this condition (not just curious)
- They need practical, decision-relevant insights
- They're reading 10+ studies - help them prioritize
- Focus on: What changed? What matters? What's actionable?

AVOID:
- Generic summaries like "Research shows promise"
- Vague takeaways like "More research needed"
- Academic language without practical translation
- Missing critical details (sample sizes, effect sizes, patient populations)

Remember: Users trust this digest to make real healthcare decisions. Be specific, be practical, be honest about limitations.

## DIGEST STRUCTURE (6 SECTIONS)

### 1. WHAT'S NEW (whatsNew)
Write 2-3 sentences in warm companion voice. Address the user directly with "Your".
For returning users: reference specific counts of [NEW] findings and the most significant new development.
For first-time users: welcome them and summarize the research landscape.
Both technical and explained versions must contain the SAME FACTS.

### 2. FEATURED DISCOVERY (featuredDiscovery)
Select the SINGLE most impactful finding as the "hero" content. Prioritize:
1. FDA approvals or major regulatory news
2. Phase 3 trial results
3. Major meta-analyses
4. Breakthrough treatments

Generate TWO versions (technical: medical terminology, explained: analogies/metaphors).
The findingId MUST be the exact UUID from the "ID:" field.

### 3. KEY TAKEAWAYS (keyTakeaways)
5-8 actionable insights, each dual-mode:
- technical: Specific drug names, dosages, biomarker values, trial phases, sample sizes
- explained: Same fact using analogies, comparisons to everyday life, plain language

### 4. NOTABLE FINDINGS (notableFindings)
Up to 12 findings ordered by clinical significance.
- Mark each finding's isNew as true if it has a [NEW] tag in the data
- DIVERSITY: Include at least 1 finding from each research category with 5+ findings (reference categoryGroups above)
- Generate both technical and explained versions
- Each findingId MUST be the exact UUID from the "ID:" field
- Create a metadata string: "PubMed • Jan 2026 • Meta-analysis (n=2,847)"

### 5. FOR YOUR DOCTOR (forYourDoctor)
Combined section with three parts:
- questions: 3-5 evidence-based questions (dual-mode) to ask at the next appointment
- watchFor: 2-4 symptoms/signs to monitor (dual-mode) with specific thresholds
- conflicts: ONLY include genuine contradictions supported by evidence from different findings. Each has topic (dual-mode), explanation (dual-mode), and sources (string array). Do NOT force contradictions — return empty array if none exist.

### 6. SOURCE BREAKDOWN (sourceBreakdown)
Count ALL ${totalFindingsCount} findings by type: pubmed, clinicalTrials, fda, web.

### CRITICAL GROUNDING RULES
1. Every findingId MUST be the exact UUID from the "ID:" field in the finding data. NEVER use sequential numbers.
2. NEVER invent statistics, percentages, or study results
3. The EXPLAINED version must contain the SAME FACTS as TECHNICAL
4. If no suitable finding exists for featured discovery, omit the field
5. Include finding IDs in your response for validation`,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${totalFindingsCount} research findings and generate a 6-section digest.

Disease Context: ${topic.diseaseProfile.name}
Patient Stage: ${topic.patientContext?.currentStage || 'monitoring'}

Research Findings:
${findingsText}

Generate ALL 6 sections:
1. whatsNew: Warm companion summary (2-3 sentences, dual-mode {technical, explained})
2. featuredDiscovery: Single most impactful finding as hero content with exact UUID findingId, sourceType, technical/explained versions, sourceMetadata
3. keyTakeaways: 5-8 actionable dual-mode insights
4. notableFindings: Up to 12 findings with exact UUID findingIds, isNew boolean (true if [NEW] tagged), dual-mode title+summary, metadata string
5. forYourDoctor: { questions (3-5 dual-mode), watchFor (2-4 dual-mode), conflicts (only genuine, or empty array) }
6. sourceBreakdown: Count ALL findings by type (pubmed, clinicalTrials, fda, web)

Focus on practical, actionable information that helps with treatment decisions.`
        }
      ]
    });

    const responseTime = Date.now() - startTime;
    console.log(`[AI Service] Anthropic API responded in ${responseTime}ms`);

    // When using tools, the response format is different
    console.log('Claude response type:', response.content.map(c => c.type));
    const toolUse = response.content.find(c => c.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('No tool use in response. Full response:', JSON.stringify(response.content, null, 2));
      throw new Error('Expected tool use response from Claude');
    }

    // The tool input already contains our structured data
    let digestData = toolUse.input as any;
    console.log('Tool input keys:', Object.keys(digestData));
    console.log('Raw digest data sample:', JSON.stringify({
      hasWhatsNew: !!digestData.whatsNew,
      keyTakeawaysCount: digestData.keyTakeaways?.length || 0,
      hasFeaturedDiscovery: !!digestData.featuredDiscovery,
      notableFindingsCount: digestData.notableFindings?.length || 0,
      hasForYourDoctor: !!digestData.forYourDoctor,
      hasSourceBreakdown: !!digestData.sourceBreakdown
    }));

    // Validate with Zod schema for type safety
    try {
      const validated = SmartDigestSchema.parse(digestData);
      digestData = validated;
      console.log('✓ Zod validation successful');
    } catch (zodError: any) {
      console.error('Zod validation failed. Error details:', {
        issues: zodError.issues,
        rawDataKeys: Object.keys(digestData)
      });

      // Attempt graceful recovery with partial data
      console.log('Attempting graceful recovery with partial data...');

      // Try to use what we have, with defaults for missing fields
      try {
        // Ensure all required fields have at least default values
        const recoveredData = {
          whatsNew: digestData.whatsNew || { technical: 'Analysis completed.', explained: 'Research findings compiled.' },
          featuredDiscovery: digestData.featuredDiscovery || undefined,
          keyTakeaways: Array.isArray(digestData.keyTakeaways) ? digestData.keyTakeaways : [],
          notableFindings: Array.isArray(digestData.notableFindings) ? digestData.notableFindings : [],
          forYourDoctor: digestData.forYourDoctor || { questions: [], watchFor: [], conflicts: [] },
          sourceBreakdown: digestData.sourceBreakdown || undefined,
        };

        // Try to validate the recovered data with defaults
        const validated = SmartDigestSchema.parse(recoveredData);
        digestData = validated;
        console.log('✓ Graceful recovery successful with partial data and defaults');
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
        // Don't throw - continue with minimal data
        digestData = {
          whatsNew: { technical: 'Analysis completed.', explained: 'Research findings compiled.' },
          featuredDiscovery: null,
          keyTakeaways: [],
          notableFindings: [],
          forYourDoctor: { questions: [], watchFor: [], conflicts: [] },
          sourceBreakdown: null,
        };
        console.log('✓ Using minimal fallback data');
      }
    }

    // Generate unique ID for the digest
    const digestId = `digest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map finding indices back to IDs and calculate statistics
    const allFindings = [...topFindings, ...remainingFindings];
    const allFindingIds = allFindings.map((f: any) => f.id);
    const newFindings = previousDigestDate
      ? allFindings.filter((f: any) => f.created_at && new Date(f.created_at) > new Date(previousDigestDate)).length
      : allFindings.length;

    // Construct final digest
    return {
      id: digestId,
      topicId: topic.id,
      generatedAt: Date.now(),
      whatsNew: digestData.whatsNew,
      keyTakeaways: digestData.keyTakeaways,
      statistics: {
        totalFindings: totalFindingsCount,
        newFindings,
        analyzedFindings: totalFindingsCount
      },
      allFindingIds,
      featuredDiscovery: digestData.featuredDiscovery || null,
      notableFindings: digestData.notableFindings || [],
      forYourDoctor: digestData.forYourDoctor || { questions: [], watchFor: [], conflicts: [] },
      sourceBreakdown: digestData.sourceBreakdown || null,
    };
  } catch (error: any) {
    const errorTime = Date.now() - startTime;
    console.error(`[AI Service] Error after ${errorTime}ms:`, error.message);

    // Reconstruct allFindings for fallback paths (not in scope from try block)
    const fallbackAllFindings = [...topFindings, ...remainingFindings];

    // Check for timeout specifically
    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT') || errorTime > 30000) {
      console.error('[AI Service] Request timed out - using minimal fallback');
      // Return a minimal valid digest to avoid 504
      return {
        whatsNew: {
          technical: `Analysis of ${totalFindingsCount} recent findings about ${topic.diseaseProfile.name}.`,
          explained: 'Research findings have been compiled for your review.'
        },
        keyTakeaways: [],
        featuredDiscovery: null,
        notableFindings: [],
        forYourDoctor: { questions: [], watchFor: [], conflicts: [] },
        sourceBreakdown: null,
      };
    }

    // If tools approach fails for other reasons, try the simple approach
    try {
      console.log('Attempting fallback to simple digest...');
      // Re-create findingsText for fallback
      const fallbackFindingsText = fallbackAllFindings.slice(0, 5).map((f: any, idx: number) =>
        `[Finding ${idx + 1}]
Type: ${f.type}
Title: ${f.title}
Summary: ${f.summary}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
      ).join('\n\n───────────\n\n');

      const simpleDigest = await generateSimpleDigest(fallbackAllFindings, topic, 'all-time', fallbackFindingsText);

      // Generate ID and stats for the simple digest
      const digestId = `digest-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const allFindingIds = fallbackAllFindings.map((f: any) => f.id);

      return {
        id: digestId,
        topicId: topic.id,
        generatedAt: Date.now(),
        whatsNew: {
          technical: simpleDigest.executiveSummary || 'Analysis completed.',
          explained: simpleDigest.laymanSummary || 'Research findings compiled.'
        },
        keyTakeaways: simpleDigest.keyTakeaways || [],
        statistics: {
          totalFindings: totalFindingsCount,
          newFindings: fallbackAllFindings.filter((f: any) => f.isNew).length,
          analyzedFindings: totalFindingsCount
        },
        allFindingIds,
        fallbackUsed: true,
        featuredDiscovery: null,
        notableFindings: [],
        forYourDoctor: { questions: [], watchFor: [], conflicts: [] },
        sourceBreakdown: null,
      };
    } catch (fallbackError) {
      console.error('Both tools and simple approaches failed:', fallbackError);
      throw new Error(`Failed to generate digest: ${error.message}`);
    }
  }
}

// Export aiService object for use in other modules
export const aiService = {
  client: anthropic,
  openai: openai,
  parseSearchQuery,
  summarizeResults,
  generateSmartDigest,
  scoreAndClusterFindings
};
