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
      model: 'claude-sonnet-4-5-20250929', // Using Claude Sonnet 4.5 for superior quality
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
      model: 'claude-sonnet-4-5-20250929',
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
      model: 'claude-sonnet-4-5-20250929',
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
  topicName: string
): Promise<ScoredFindingsResult> {
  if (findings.length > HAIKU_BATCH_THRESHOLD) {
    console.log(`[AI] Findings count (${findings.length}) > batch threshold (${HAIKU_BATCH_THRESHOLD}). Splitting into batches of ${HAIKU_BATCH_SIZE}...`);
    return scoreFindingsInBatches(findings, topicName);
  }
  return scoreAndClusterFindingsSingle(findings, topicName);
}

/** Single-call scoring for ≤130 findings */
async function scoreAndClusterFindingsSingle(
  findings: any[],
  topicName: string
): Promise<ScoredFindingsResult> {
  console.log(`[AI] Haiku Pass 1: Scoring ${findings.length} findings for ${topicName}...`);

  const findingsText = findings.map((f, idx) =>
    `[${idx + 1}] ID: ${f.id}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 300) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
  ).join('\n\n');

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
  topicName: string
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
      chunk.map(batch => scoreAndClusterFindingsSingle(batch, topicName))
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
  totalFindingsCount: number
) {
  console.log(`[AI Service] Starting digest generation with ${totalFindingsCount} total findings (${topFindings.length} full + ${remainingFindings.length} condensed)`);
  const startTime = Date.now();

  try {
    // Build a map of Haiku's condensed summaries for remaining findings
    const condensedMap = new Map(
      scoredResult.scoredFindings.map(sf => [sf.findingId, sf.condensedSummary])
    );

    // TOP FINDINGS: Full detail (300-char summary) — ranked by Haiku significance
    const topFindingsText = topFindings.map((f: any, idx: number) =>
      `[Finding ${idx + 1}] ID: ${f.id}
Type: ${f.type}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 300) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
    ).join('\n\n');

    // REMAINING FINDINGS: Haiku's condensed summary (150 chars)
    const remainingFindingsText = remainingFindings.length > 0
      ? '\n\n[Additional Findings - Condensed by significance scoring]\n' +
        remainingFindings.map((f: any, idx: number) =>
          `${topFindings.length + idx + 1}. ID: ${f.id} — ${f.title} — ${condensedMap.get(f.id) || 'No summary'} (${f.source?.name || 'Unknown'})`
        ).join('\n')
      : '';

    const findingsText = topFindingsText + remainingFindingsText;

    console.log(`[AI Service] Calling Anthropic API...`);

    // Using tools to encourage structured output (without beta header for compatibility)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',  // Using Claude Sonnet 4.5 for superior quality
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

USE THESE SCORES TO GUIDE:
- Featured Discovery selection MUST come from highest-scored findings
- Top Findings should prioritize high-significance findings
- Source breakdown MUST account for ALL ${totalFindingsCount} findings

CRITICAL CONTEXT:
- User is actively managing this condition (not just curious)
- They need practical, decision-relevant insights
- They're reading 10+ studies - help them prioritize
- Focus on: What changed? What matters? What's actionable?

YOUR ANALYSIS MUST:
1. Identify the SINGLE most important finding for immediate consideration
2. Extract SPECIFIC actionable insights (dosages, timelines, biomarkers)
3. Flag any safety concerns or contradictions prominently
4. Group findings by practical relevance (not just topic)
5. Provide confidence levels based on study quality, not generic ratings

AVOID:
- Generic summaries like "Research shows promise"
- Vague takeaways like "More research needed"
- Academic language without practical translation
- Missing critical details (sample sizes, effect sizes, patient populations)

Remember: Users trust this digest to make real healthcare decisions. Be specific, be practical, be honest about limitations.

## MAGAZINE EDITORIAL FORMAT (NEW REQUIREMENTS)

You are creating a curated medical research newsletter. Generate content that feels professionally edited.

### FEATURED DISCOVERY
Select the SINGLE most impactful finding as the "hero" content. Prioritize:
1. FDA approvals or major regulatory news
2. Phase 3 trial results
3. Major meta-analyses
4. Breakthrough treatments

For the featured discovery, generate TWO versions:

TECHNICAL VERSION:
- Use proper medical terminology
- Include specific drug names, mechanisms
- Reference trial names and phases
- Use clinical metrics (IGF-1, etc.)

EXPLAINED VERSION:
- Use analogies and metaphors
- Compare to everyday experiences
- Explain medical terms in parentheses
- Make it accessible to non-medical readers

### TOP FINDINGS
Select up to 12 additional notable findings. For EACH:
- Generate both technical and explained versions
- Include the finding ID for traceability
- Create a metadata string: "PubMed • Jan 2026 • Meta-analysis (n=2,847)"

### SOURCE BREAKDOWN
Count findings by type:
- pubmed: Count of academic/research sources
- clinicalTrials: Count of trial registry sources
- fda: Count of FDA sources
- web: Count of news/web sources

### CRITICAL GROUNDING RULES
1. Every findingId MUST be the exact UUID from the "ID:" field in the finding data (e.g., "5c00622b-2343-40d3-ba50-e9d1dc39d865"). NEVER use sequential numbers like "1", "2", "3".
2. NEVER invent statistics, percentages, or study results
3. The EXPLAINED version must contain the SAME FACTS as TECHNICAL
4. If no suitable finding exists for featured discovery, omit the field
5. Include finding IDs in your response for validation

### DUAL-MODE CONTENT FOR ALL SECTIONS

For the following sections, generate TWO versions of each text field — one technical, one explained. Both must contain the SAME FACTS, just expressed differently.

KEY TAKEAWAYS:
- technical: Include specific drug names, dosages, biomarker values, trial phases, sample sizes
- explained: Same fact using analogies, comparisons to everyday life, plain language

BREAKTHROUGHS (title and description):
- technical: Proper medical terminology, mechanism of action, trial names, effect sizes
- explained: Everyday language explaining why this matters to a patient/caregiver

CONTRADICTIONS (topic, claims, and explanation):
- technical: Precise medical terminology, study references, clinical metrics
- explained: Plain language describing the disagreement and why it matters

QUESTIONS FOR DOCTOR (generate 3-5 evidence-based questions):
- technical: Referencing specific biomarkers, drug interactions, trial data the doctor would recognize
- explained: Conversational, approachable phrasing a patient could read directly to their doctor

WARNING SIGNS (generate 2-4 relevant symptoms/signs to monitor):
- technical: Clinical terminology with specific thresholds (e.g., "fever >38.5°C persisting >48h")
- explained: Everyday descriptions anyone would recognize (e.g., "a high fever that doesn't go away after 2 days")

WORTH REVISITING (oldFindingSummary, newBreakthroughSummary, connectionExplanation):
- technical: Medical terminology, mechanisms, specific biomarkers, trial references
- explained: Plain language with analogies anyone could understand
- CRITICAL: Both versions must contain the SAME FACTS
- connectionBasis remains a plain string (not dual-mode)
- Titles remain plain strings (not dual-mode)

## COMPANION INTELLIGENCE

### RESEARCH PULSE
Generate a single warm, companion-voice sentence summarizing the current state of this topic's research landscape. This sentence appears on the home page as the user's "research companion" speaking to them.

RULES:
1. Address the user directly with "Your" (e.g., "Your Haemophilia research...")
2. Reference specific counts from the findings (breakthroughs, new studies, contradictions)
3. Highlight the SINGLE most noteworthy development
4. Warm, knowledgeable tone — like a research-savvy friend, not a clinical report
5. Maximum 2 sentences. Aim for 1 when possible.
6. Never use generic phrases like "Things are progressing" or "Research continues"

EXAMPLES:
- "Your Haemophilia research has 3 new breakthroughs this week, including a gene therapy trial showing 94% factor VIII restoration in Phase 2 participants."
- "Two recent PubMed studies on your Acromegaly topic present conflicting findings about pegvisomant dosing — worth reviewing with your endocrinologist."
- "A quiet week for your Cancer research, but one FDA fast-track designation for pembrolizumab in microsatellite-unstable tumors could be significant."

### WORTH REVISITING
Examine ALL findings (old and new) and identify 0-3 meaningful connections between OLDER findings and RECENT breakthroughs. Only surface genuinely significant connections.

RULES:
1. Return EMPTY ARRAY [] if no meaningful connections exist — NEVER force connections
2. The oldFindingId and newBreakthroughId MUST be exact UUIDs from the "ID:" field in the finding data
3. connectionExplanation must be SPECIFIC: cite the mechanism, pathway, or evidence that links them
4. connectionBasis must be a SHORT qualifier (2-5 words): "Shared therapeutic target", "Same gene pathway", etc.
5. Prefer connections where the newer finding VALIDATES, CONTRADICTS, or EXTENDS the older one
6. Do NOT create connections based solely on both mentioning the same disease — that is too vague
7. Include inline titles and summaries so the UI can display without database lookups`,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${totalFindingsCount} research findings and generate a comprehensive digest.

Disease Context: ${topic.diseaseProfile.name}
Patient Stage: ${topic.patientContext?.currentStage || 'monitoring'}

Research Findings:
${findingsText}

Create a structured digest with:
- Executive summary highlighting the most critical finding with immediate action items
- Layman summary in plain English
- Key takeaways with specific numbers (effect sizes, dosages, patient counts)
- Identify any breakthroughs or paradigm shifts
- Flag any contradictions between findings
- Generate 3-5 evidence-based questions to ask the doctor (questionsForDoctor), each with technical and explained versions
- Generate 2-4 warning signs to monitor (warningSigns), each with technical and explained versions

MAGAZINE EDITORIAL SECTIONS (REQUIRED):
- featuredDiscovery: The SINGLE most impactful finding as hero content. The findingId MUST be the exact UUID string from the "ID:" field (e.g. "5c00622b-2343-40d3-ba50-e9d1dc39d865"), NOT a number. Include sourceType, technical version (medical terminology), explained version (analogies/metaphors), and sourceMetadata
- topFindings: Up to 12 additional notable findings. Each findingId MUST be the exact UUID from the "ID:" field. Include sourceType, technical version, explained version, and a metadata display string like "PubMed • Jan 2026 • Meta-analysis (n=2,847)"
- sourceBreakdown: Count ALL findings by source type (pubmed, clinicalTrials, fda, web)

COMPANION INTELLIGENCE (REQUIRED):
- researchPulse: A single warm companion-voice sentence about this topic's research state. Address the user directly with "Your". Reference specific counts.
- worthRevisiting: Carefully analyze ALL findings for 1-3 connections between older findings and recent breakthroughs. Use exact finding UUIDs from the ID fields above. Each connection's oldFindingSummary, newBreakthroughSummary, and connectionExplanation must be dual-mode objects with {technical, explained} versions. Look for findings that validate, contradict, or extend each other. Only return empty array [] if there are genuinely no meaningful scientific connections after thorough analysis.

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
      hasExecutiveSummary: !!digestData.executiveSummary,
      hasLaymanSummary: !!digestData.laymanSummary,
      keyTakeawaysCount: digestData.keyTakeaways?.length || 0,
      hasFeaturedDiscovery: !!digestData.featuredDiscovery,
      topFindingsCount: digestData.topFindings?.length || 0,
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
          executiveSummary: digestData.executiveSummary || 'Analysis completed. See findings for details.',
          laymanSummary: digestData.laymanSummary || 'Medical research findings have been compiled for your review.',
          keyTakeaways: Array.isArray(digestData.keyTakeaways) ? digestData.keyTakeaways : [],
          breakthroughs: Array.isArray(digestData.breakthroughs) ? digestData.breakthroughs : [],
          contradictions: Array.isArray(digestData.contradictions) ? digestData.contradictions : [],
          questionsForDoctor: Array.isArray(digestData.questionsForDoctor) ? digestData.questionsForDoctor : [],
          warningSigns: Array.isArray(digestData.warningSigns) ? digestData.warningSigns : [],
          // Magazine editorial fields
          featuredDiscovery: digestData.featuredDiscovery || undefined,
          topFindings: Array.isArray(digestData.topFindings) ? digestData.topFindings : [],
          sourceBreakdown: digestData.sourceBreakdown || undefined,
          // Companion Intelligence fields
          researchPulse: digestData.researchPulse || '',
          worthRevisiting: Array.isArray(digestData.worthRevisiting) ? digestData.worthRevisiting : []
        };

        // Try to validate the recovered data with defaults
        const validated = SmartDigestSchema.parse(recoveredData);
        digestData = validated;
        console.log('✓ Graceful recovery successful with partial data and defaults');
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
        // Don't throw - continue with minimal data
        digestData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed.',
          laymanSummary: digestData.laymanSummary || 'Research findings compiled.',
          keyTakeaways: [],
          breakthroughs: [],
          contradictions: [],
          questionsForDoctor: [],
          warningSigns: [],
          featuredDiscovery: null,
          topFindings: [],
          sourceBreakdown: null,
          researchPulse: '',
          worthRevisiting: []
        };
        console.log('✓ Using minimal fallback data');
      }
    }

    // Generate unique ID for the digest
    const digestId = `digest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Map finding indices back to IDs and calculate statistics
    const allFindings = [...topFindings, ...remainingFindings];
    const allFindingIds = allFindings.map((f: any) => f.id);
    const newFindings = allFindings.filter((f: any) => f.isNew).length;

    // Transform breakthroughs and contradictions
    const breakthroughs = digestData.breakthroughs?.map((b: any) => ({
      ...b,
      findingIds: b.findingIndices.map((idx: number) => allFindings[idx]?.id).filter(Boolean),
      date: Date.now()
    })) || [];

    const contradictions = digestData.contradictions?.map((c: any) => ({
      ...c,
      findingA: {
        id: allFindings[c.findingA.index]?.id,
        claim: c.findingA.claim,
        source: c.findingA.source
      },
      findingB: {
        id: allFindings[c.findingB.index]?.id,
        claim: c.findingB.claim,
        source: c.findingB.source
      }
    })) || [];

    // Construct final digest
    return {
      id: digestId,
      topicId: topic.id,
      generatedAt: Date.now(),
      executiveSummary: digestData.executiveSummary,
      laymanSummary: digestData.laymanSummary,
      keyTakeaways: digestData.keyTakeaways,
      breakthroughs,
      contradictions,
      questionsForDoctor: digestData.questionsForDoctor || [],
      warningSigns: digestData.warningSigns || [],
      statistics: {
        totalFindings: totalFindingsCount,
        newFindings,
        analyzedFindings: totalFindingsCount
      },
      allFindingIds,
      // Magazine editorial fields
      featuredDiscovery: digestData.featuredDiscovery || null,
      topFindings: digestData.topFindings || [],
      sourceBreakdown: digestData.sourceBreakdown || null,
      // Companion Intelligence fields
      researchPulse: digestData.researchPulse || '',
      worthRevisiting: digestData.worthRevisiting || []
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
        executiveSummary: `Analysis of ${totalFindingsCount} recent findings about ${topic.diseaseProfile.name}.`,
        laymanSummary: 'Research findings have been compiled for your review.',
        keyTakeaways: ['Review individual findings for details'],
        questionsForDoctor: [],
        warningSigns: [],
        featuredDiscovery: null,
        topFindings: [],
        sourceBreakdown: null,
        researchPulse: '',
        worthRevisiting: []
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
        executiveSummary: simpleDigest.executiveSummary,
        laymanSummary: simpleDigest.laymanSummary,
        keyTakeaways: simpleDigest.keyTakeaways || [],
        breakthroughs: simpleDigest.breakthroughs || [],
        contradictions: simpleDigest.contradictions || [],
        statistics: {
          totalFindings: totalFindingsCount,
          newFindings: fallbackAllFindings.filter((f: any) => f.isNew).length,
          analyzedFindings: totalFindingsCount
        },
        topSources: [],
        allFindingIds,
        fallbackUsed: true,
        featuredDiscovery: null,
        topFindings: [],
        sourceBreakdown: null,
        researchPulse: '',
        worthRevisiting: []
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
