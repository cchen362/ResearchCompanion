# Plan 021: Haiku Scoring Fix & Sustainable Scaling

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan fixes the **Haiku Pass 1 scoring failure** discovered during production sanity check on Feb 11, 2026. Without this fix, the two-pass digest architecture (Plan 020) is non-functional — Haiku scoring silently fails and falls back to useless default scores, defeating the purpose of significance-based ranking.

| Issue | Symptom | Root Cause |
|-------|---------|------------|
| **Haiku scoring crash** | `Cannot read properties of undefined (reading 'length')` | Token truncation → incomplete tool_use response → blind `as` cast |
| **All-5s fallback** | Featured Discovery selected by position, not significance | Fallback assigns score 5 to every finding, top 30 = first 30 by insertion |
| **No response validation** | Crash on line 377 accessing `.categoryGroups.length` on undefined | No Zod validation (unlike Sonnet's `generateSmartDigest` which has it) |
| **No scalability** | 130+ findings risk re-triggering same truncation | Fixed `max_tokens` cap with no batching strategy |

**Core decision**: Fix the root cause (token budget), add defense-in-depth (Zod validation + reconstruction), and build sustainable scaling (auto-batching) — all in one plan, touching only 2 backend files.

**Plan is split into 3 phases:**
- **Phase 1**: Fix token budget + reorder schema + tighten prompt — `ai.service.ts`
- **Phase 2**: Add Zod validation + reconstruction + truncation detection — `digest.schema.ts`, `ai.service.ts`
- **Phase 3**: Add auto-batching for 130+ findings — `ai.service.ts`

---

## Pre-Requisite: Plan 020 Status

**Plan 020 is COMPLETE** (verified Feb 10, 2026). The two-pass architecture is in place:
- `scoreAndClusterFindings()` exists in `ai.service.ts:312-384`
- `generateSmartDigest()` consumes scored results in `ai.service.ts:407+`
- `digest-processor.service.ts:214-230` orchestrates both passes
- `digest.routes.ts:110-114` and `:257-261` have two additional call sites

**The problem**: Pass 1 crashes silently, fallback runs, Pass 2 receives useless all-5s scores.

---

## Strict Rules

### MUST DO
- [ ] Follow phases IN ORDER (1 → 2 → 3)
- [ ] Run `cd backend && npx tsc --noEmit` after every file change
- [ ] Run `cd backend && npm run build` after Phase 3
- [ ] Preserve `ScoredFindingsResult` interface exactly (Plan 021 Chat Enhancement depends on it)
- [ ] Keep `condensedSummary` at 150 characters (verified against production data — 100 chars loses clinical detail)
- [ ] Test with current 70 findings on production

### MUST NOT DO
- [ ] Do NOT change `ScoredFindingsResult`, `ScoredFinding`, or `CategoryGroup` interface shapes
- [ ] Do NOT modify `generateSmartDigest()` or its Sonnet prompt
- [ ] Do NOT modify `digest-processor.service.ts` or `digest.routes.ts` (consumers are fine once scoring returns valid data)
- [ ] Do NOT modify any frontend files
- [ ] Do NOT add database columns or migrations
- [ ] Do NOT shorten `condensedSummary` below 150 chars

---

## Root Cause Analysis

### Token Budget Math

Current formula (line 327): `Math.min(Math.max(4000, findings.length * 80), 16000)`

**Per-finding output tokens** (production data analysis):
- `findingId` (UUID): ~15 tokens
- `significanceScore` (number): ~5 tokens
- `significanceReason` (current: unbounded, often 60-100 chars): ~30 tokens
- `researchCategory` (~20 chars): ~10 tokens
- `condensedSummary` (150 chars): ~50 tokens
- JSON overhead (braces, commas, quotes): ~10 tokens
- **Total: ~120 tokens/finding** (current), **~100 tokens/finding** (with shortened reason)

**Fixed overhead** (once per response):
- `totalAnalyzed`: ~5 tokens
- `categoryGroups` (~8 groups): ~400 tokens
- `topFindingIds` (30 UUIDs): ~450 tokens
- JSON wrapping: ~50 tokens
- **Fixed total: ~900 tokens**

**For 70 findings (current):**
- Budget: `min(max(4000, 5600), 16000)` = **5,600 tokens**
- Actual need: 900 + (70 × 120) = **9,300 tokens**
- **Budget is 60% of what's needed → guaranteed truncation**

### Why Metadata Fields Are Lost

The JSON schema lists `scoredFindings` (the large array) as the **first** property. Tool_use generates properties in schema order. When the response hits `max_tokens` mid-generation:
1. `scoredFindings` array starts generating (consuming all budget)
2. `categoryGroups`, `topFindingIds`, `totalAnalyzed` never generated
3. SDK returns partial object with those fields as `undefined`
4. Line 375: `toolUseBlock.input as ScoredFindingsResult` — no runtime check
5. Line 377: `result.categoryGroups.length` → crash

### Haiku 4.5 Output Token Limit

Confirmed: Haiku 4.5 supports **64K output tokens** ([source](https://www.anthropic.com/claude/haiku)). The 16K cap in the formula is not the model's limit — it's an arbitrary cap we set that's too low.

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/schemas/digest.schema.ts` | Add `ScoredFindingsResultSchema` Zod validation |
| `backend/src/services/ai.service.ts` | Token budget, schema reorder, prompt, validation, batching |

**No other files modified.** No frontend. No DB. No new dependencies.

---

## Phase 1: Fix Token Budget + Schema Reorder + Prompt

### Step 1.1: Reorder JSON Schema — Metadata First

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 53-117 (`scoredFindingsSchema`)

Reorder the `properties` object so metadata fields come BEFORE the large `scoredFindings` array. This ensures that if truncation ever occurs, it loses the tail of `scoredFindings` (partial scoring — salvageable) instead of losing `categoryGroups`/`topFindingIds` entirely (fatal crash — what happened).

**Replace** the entire `scoredFindingsSchema` (lines 53-117) with:

```typescript
const scoredFindingsSchema = {
  type: 'object' as const,
  properties: {
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
```

**Key changes from original**:
1. Property order: `totalAnalyzed` → `categoryGroups` → `topFindingIds` → `scoredFindings` (was: `scoredFindings` first)
2. `significanceReason` description: `'Brief justification, max 40 characters'` (was: unbounded)
3. `required` array reordered to match

- [ ] Schema reordered
- [ ] `significanceReason` description updated
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 1.2: Fix Token Budget Formula

**File**: `backend/src/services/ai.service.ts`
**Location**: Line 327

**Replace**:
```typescript
const maxTokens = Math.min(Math.max(4000, findings.length * 80), 16000);
```

**With**:
```typescript
const maxTokens = Math.min(Math.max(4000, findings.length * 150), 16384);
```

**Token budget table** (with shortened `significanceReason`, keeping 150-char `condensedSummary`):

| Findings | Old budget | New budget | Need (~100 tok/finding + 900) | Headroom |
|----------|-----------|-----------|-------------------------------|----------|
| 50 | 4,000 | 7,500 | 5,900 | 27% |
| 70 | **5,600** | **10,500** | 7,900 | **33%** |
| 100 | 8,000 | 15,000 | 10,900 | 38% |
| 109 | 8,720 | 16,350 | 11,800 | 39% |
| 130 | capped | 16,384 | 13,900 | 18% |
| 130+ | N/A | N/A | **Batched** (Phase 3) | N/A |

- [ ] Formula updated
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 1.3: Tighten Prompt for Token Efficiency

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 334-352 (system prompt inside `scoreAndClusterFindings`)

**Add** to the end of the system prompt (before the closing backtick), after the existing instructions:

```
CONDENSED SUMMARIES:
Generate a single-sentence summary (max 150 characters) capturing the core finding.
Keep significanceReason to max 40 characters — a brief phrase, not a full sentence.

CRITICAL: You MUST output ALL four top-level fields: totalAnalyzed, categoryGroups, topFindingIds, scoredFindings. Never omit any field.
```

**Note**: If the prompt already has a `CONDENSED SUMMARIES` section, update it in place. If there's already an `OUTPUT REQUIREMENTS` section, add the "CRITICAL" line to it. The goal is to add the 40-char reason constraint and the explicit "output all fields" instruction. Do NOT remove or rewrite existing prompt content — only add/modify the specific lines mentioned.

- [ ] Prompt updated with 40-char reason constraint
- [ ] "Output ALL four fields" instruction added
- [ ] Run `cd backend && npx tsc --noEmit` ✅

---

## Phase 2: Zod Validation + Reconstruction + Truncation Detection

### Step 2.1: Add Zod Schemas to `digest.schema.ts`

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: After `SourceBreakdownSchema` export (line 112), before `digestJSONSchema` (line 115)

**Add**:

```typescript
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
```

**Design rationale**: `scoredFindings` is required (the expensive, irreplaceable data from Haiku). The other three fields have defaults because they can be **reconstructed** from `scoredFindings` if the response was truncated. This is the key insight — we don't discard a $0.05 Haiku response just because the metadata fields are missing.

- [ ] Schemas added to `digest.schema.ts`
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 2.2: Update Import in `ai.service.ts`

**File**: `backend/src/services/ai.service.ts`
**Location**: Line 6

**Replace**:
```typescript
import { digestJSONSchema, SmartDigestSchema } from '../schemas/digest.schema.js';
```

**With**:
```typescript
import { digestJSONSchema, SmartDigestSchema, ScoredFindingsResultSchema, ScoredFindingSchema } from '../schemas/digest.schema.js';
```

**Also** add `z` import if not present — check top of file for existing `import { z } from 'zod'`. If missing, add:
```typescript
import { z } from 'zod';
```

- [ ] Imports updated
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 2.3: Add Truncation Detection

**File**: `backend/src/services/ai.service.ts`
**Location**: Inside `scoreAndClusterFindings`, after the `anthropic.messages.create()` call (after line 363), before the `tool_use` extraction (line 366)

**Add**:
```typescript
    // Detect truncation and log response metadata
    if (response.stop_reason === 'max_tokens') {
      console.warn(`[AI] Haiku scoring TRUNCATED (stop_reason=max_tokens). Budget: ${maxTokens}, findings: ${findings.length}, usage: ${JSON.stringify(response.usage)}`);
    }
    console.log(`[AI] Haiku response: stop_reason=${response.stop_reason}, blocks=${response.content.length}, output_tokens=${response.usage?.output_tokens}`);
```

- [ ] Truncation detection added
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 2.4: Replace `as` Cast with Zod Validation + Recovery

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 375-379 (inside `scoreAndClusterFindings`, after finding `toolUseBlock`)

**Replace** these lines:
```typescript
    const result = toolUseBlock.input as ScoredFindingsResult;

    console.log(`[AI] Haiku scored ${result.totalAnalyzed} findings, ${result.categoryGroups.length} categories, top ${result.topFindingIds.length} ranked`);

    return result;
```

**With**:
```typescript
    const rawResult = toolUseBlock.input as Record<string, unknown>;
    console.log(`[AI] Haiku raw keys: [${Object.keys(rawResult)}], scoredFindings: ${Array.isArray(rawResult.scoredFindings) ? (rawResult.scoredFindings as any[]).length : 'MISSING'}`);

    // Layer 1: Zod validation with defaults for missing metadata fields
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
```

- [ ] `as` cast replaced with Zod validation
- [ ] Three recovery layers implemented
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 2.5: Add Reconstruction Helper Functions

**File**: `backend/src/services/ai.service.ts`
**Location**: After `buildFallbackScoring()` (after line 405)

**Add these two functions**:

```typescript
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
```

**Note**: The `ScoredFinding` type used in `reconstructFromScoredFindings` already exists at line 28-34. No new type definitions needed.

- [ ] `reconstructScoredResult` added
- [ ] `reconstructFromScoredFindings` added
- [ ] Run `cd backend && npx tsc --noEmit` ✅

---

## Phase 3: Auto-Batching for 130+ Findings

### Step 3.1: Refactor Entry Point for Batch Dispatch

**File**: `backend/src/services/ai.service.ts`
**Location**: `scoreAndClusterFindings` function (line 312-384)

**Strategy**: Rename the existing function to `scoreAndClusterFindingsSingle`, then create a new `scoreAndClusterFindings` that dispatches to either single or batched path.

**Replace** the function signature and the first few lines (lines 312-316):

```typescript
/** Batch threshold: 130 findings at ~100 tokens/finding safely fits in 16K token budget with 18% headroom */
const HAIKU_BATCH_THRESHOLD = 130;
const HAIKU_BATCH_SIZE = 75;

/**
 * Pass 1 of Two-Pass Digest Architecture (Plan 020):
 * Score and cluster ALL findings by clinical significance using Haiku.
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
```

Then **rename** the existing function body (keeping all the Phase 1 & 2 changes):

```typescript
/** Single-call scoring for ≤130 findings */
async function scoreAndClusterFindingsSingle(
  findings: any[],
  topicName: string
): Promise<ScoredFindingsResult> {
  console.log(`[AI] Haiku Pass 1: Scoring ${findings.length} findings for ${topicName}...`);
  // ... rest of existing function body with Phase 1 & 2 fixes ...
}
```

**Important**: The existing function body stays exactly the same (with the fixes from Phase 1 and 2 applied). We're just wrapping it with the dispatch logic.

- [ ] `HAIKU_BATCH_THRESHOLD` and `HAIKU_BATCH_SIZE` constants added
- [ ] `scoreAndClusterFindings` refactored as dispatch function
- [ ] Existing function renamed to `scoreAndClusterFindingsSingle`
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 3.2: Add Batch Scoring Function

**File**: `backend/src/services/ai.service.ts`
**Location**: After `reconstructFromScoredFindings` (added in Step 2.5)

**Add**:

```typescript
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
```

- [ ] `scoreFindingsInBatches` added
- [ ] Concurrency limit of 3
- [ ] Per-batch fallback (doesn't kill other batches)
- [ ] Run `cd backend && npx tsc --noEmit` ✅

### Step 3.3: Add Merge Function

**File**: `backend/src/services/ai.service.ts`
**Location**: After `scoreFindingsInBatches`

**Add**:

```typescript
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
```

- [ ] `mergeScoredResults` added
- [ ] Global re-ranking across batches
- [ ] Run `cd backend && npx tsc --noEmit` ✅

---

## Build & Deploy

### Step 4.1: Build Verification

```bash
cd backend && npx tsc --noEmit
cd backend && npm run build
```

- [ ] TypeScript compilation passes
- [ ] Build completes without errors

### Step 4.2: Deploy to Production

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build
```

- [ ] Deployed successfully

### Step 4.3: Trigger Digest Regeneration

```bash
# Clear the existing queue entry to allow regeneration
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "DELETE FROM digest_queue WHERE topic_id = '954e8da0-5af3-4012-a4d9-3e6d59e64148';"
```

Then use the UI to request a new digest (click "Update Insights" on the Haemophilia topic).

- [ ] Queue cleared
- [ ] Digest regeneration triggered

### Step 4.4: Verify via Logs

```bash
docker logs medical-companion --tail 100 2>&1 | grep -E '\[AI\]|\[Digest'
```

**Expected success log sequence**:
```
[DigestProcessor] Pass 1: Scoring 70 findings with Haiku...
[AI] Haiku Pass 1: Scoring 70 findings for Haemophilia...
[AI] Haiku response: stop_reason=end_turn, blocks=1, output_tokens=XXXX
[AI] Haiku raw keys: [totalAnalyzed,categoryGroups,topFindingIds,scoredFindings], scoredFindings: 70
[AI] Haiku scored 70 findings, N categories, top 30 ranked
[DigestProcessor] Pass 2: Generating digest with Sonnet (30 full + 40 condensed)...
```

**Failure indicators** (should NOT appear):
- `Haiku scoring TRUNCATED` — would mean token budget still too low
- `Haiku Zod validation failed` — would mean response shape changed
- `Using fallback scoring` — would mean all recovery layers failed
- `Cannot read properties of undefined` — would mean the fix didn't apply

- [ ] `stop_reason=end_turn` confirmed (not `max_tokens`)
- [ ] `Haiku scored 70 findings` with real category count (not "1 categories")
- [ ] No fallback messages
- [ ] No errors

---

## Verification Checklist

- [ ] Haiku scoring succeeds for 70 findings (no fallback)
- [ ] `stop_reason=end_turn` in logs
- [ ] `output_tokens` in logs is reasonable (~7000-10000 for 70 findings)
- [ ] Digest in DB has significance-ranked top findings (not insertion-order)
- [ ] Scheduler autonomous runs continue working uninterrupted
- [ ] Frontend digest display unchanged
- [ ] All three call sites work: digest-processor, /generate-digest, /research-and-digest

---

## Rollback Plan

If the fix causes unexpected issues:

1. **Revert the two changed files** to their pre-fix state:
   ```bash
   git checkout HEAD~1 -- backend/src/services/ai.service.ts backend/src/schemas/digest.schema.ts
   ```
2. **Rebuild and redeploy**: The old fallback behavior (all-5s scores) will resume — degraded but functional
3. The `ScoredFindingsResult` interface is unchanged, so no downstream impact

---

## Defense-in-Depth Summary

| Layer | What | Handles | Phase |
|-------|------|---------|-------|
| Token budget | 150 tok/finding, 16K cap | Prevents truncation for ≤130 findings | 1 |
| Schema reorder | Metadata first, big array last | If truncation occurs, metadata survives | 1 |
| Prompt tightening | 40-char reason limit | Reduces per-finding token cost | 1 |
| Truncation detection | Log `stop_reason` + `usage` | Immediate observability | 2 |
| Zod validation | `safeParse` with defaults | Catches malformed responses, fills gaps | 2 |
| Reconstruction | Derive metadata from scores | Salvages partial results vs useless fallback | 2 |
| Auto-batching | Split at 130+, parallel exec | Scales to any finding count indefinitely | 3 |
| Fallback (existing) | `buildFallbackScoring()` | Last resort — still backward compat | existing |

---

## What We're NOT Changing (and Why)

- **`ScoredFindingsResult` interface** — kept identical for upcoming Chat Enhancement (Plan 020 Future Focus)
- **`condensedSummary` at 150 chars** — verified against production data: real summaries average 200+ chars, 150-char condensed versions capture core results alongside titles. Shortening to 100 chars saves ~1,190 tokens for 70 findings but risks losing clinically useful detail that Sonnet needs for editorial judgment
- **`generateSmartDigest()`** — untouched. It already has robust Zod validation (lines 664-721). The fix is upstream in the scoring function
- **Frontend** — no changes. The digest shape flowing to the UI is identical
- **Database** — no migrations needed. Haiku scores remain ephemeral (used only during digest generation)
- **`digest-processor.service.ts` and `digest.routes.ts`** — consumers are fine once `scoreAndClusterFindings` returns a valid `ScoredFindingsResult`. No changes needed at call sites

---

## Sign-Off

| Step | Status | Date |
|------|--------|------|
| Phase 1: Token + Schema + Prompt | | |
| Phase 2: Zod + Reconstruction | | |
| Phase 3: Auto-Batching | | |
| Build & Deploy | | |
| Production Verification | | |
