# Plan 020: Two-Pass Digest Architecture, Count Consistency & Timeframe Cleanup

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan addresses **digest generation quality, finding count inconsistencies, and orphaned timeframe code** identified during Plan 018/019 production verification on Feb 9, 2026.

| Issue | Symptom | Root Cause |
|-------|---------|------------|
| **Count mismatch** | Home: "60 findings", Research: "50 findings" | Findings API defaults to `LIMIT 50`; dashboard uses `COUNT(*)` |
| **Digest analysis bias** | Featured Discovery favors 15 newest findings | Tiered format: first 15 get 400-char summaries, rest get title-only → AI biased by position |
| **Arbitrary 50-finding cap** | Old findings silently dropped from digest | Premature optimization — only using 5.5% of Claude's 200K context window |
| **Misleading "Weekly" label** | DigestCard: "Weekly Research Digest" | `digestTimeframe` stuck on 'weekly'; digest analyzes ALL findings regardless |
| **No scalability plan** | 200+ findings would hit the cap | Single-pass architecture can't gracefully handle growing corpus |
| **Worth Revisiting degraded** | AI says "examine ALL findings" but only sees 50 newest | `MAX_FINDINGS_FOR_DIGEST = 50` caps findings before AI prompt, excluding older findings that are most valuable for cross-temporal connections |

**Core decision**: Rather than patching the existing single-pass approach, implement the **two-pass architecture from day 1** while there are no users to impact.

**Plan is split into 5 phases:**
- **Phase 1**: Add Haiku scoring function (Pass 1) — `ai.service.ts`
- **Phase 2**: Modify digest generation to use two passes — `digest-processor.service.ts`
- **Phase 3**: Update Sonnet digest prompt with Haiku context — `ai.service.ts`
- **Phase 4**: Fix findings API default limit — `findings.routes.ts`
- **Phase 5**: Clean up frontend timeframe artifacts — 6 frontend files

---

## Pre-Requisite: Plan 019 Status

**Plan 019 is COMPLETE** (verified Feb 9, 2026). The following dead code has already been removed:
- `DigestTheme` system (~150 lines) — removed from types, DigestCard, ai.service.ts, digest-processor
- `sourceCount`/`uniqueStudies` — removed from statistics type, DB columns dropped
- `trends` field — removed from SmartDigest type, DB column dropped
- `refreshDigest`/`refreshResearchAndDigest` — consolidated into single "Update Insights" button
- ResearchToolbar: already simplified (no Update button, no `topicId` prop, no `useDigest` import)

**Terminology note**: This plan uses **"researchCategory"** for Haiku's finding classification (e.g., `drug_approval`, `clinical_trial`). This is deliberately different from the old `DigestTheme` system removed in Plan 019. `DigestTheme` was an AI-generated editorial section with title/summary/findings/UI rendering. `researchCategory` is a simple string label for triage scoring — no UI rendering, no DB storage beyond the scoring pass.

---

## Strict Rules

### MUST DO
- [ ] Follow phases IN ORDER (1 → 2 → 3 → 4 → 5)
- [ ] Run `cd backend && npx tsc --noEmit` after every backend change (Phases 1-4)
- [ ] Run `npm run build` after Phase 5 frontend changes
- [ ] Use `researchCategory` (NOT `theme`) for Haiku classification labels
- [ ] Use `categoryGroups` (NOT `themeGroups`) for Haiku grouping output
- [ ] Preserve `digestTimeframe` in `appStore.ts` — it's still used for digest keying in `researchStore.ts`

### MUST NOT DO
- [ ] Do NOT use the word "theme" in any new code — use "researchCategory" or "category"
- [ ] Do NOT change the Chat citation system — it has its own independent finding limit (see Future Focus section)
- [ ] Do NOT modify `ExportMenu` or export services — they already work correctly with the changes
- [ ] Do NOT remove `digestTimeframe` from `appStore.ts` — only remove its usage in `ResearchContainer.tsx`
- [ ] Do NOT store Haiku's scoring output in the database — it's ephemeral, used only during digest generation

---

## Architecture: Two-Pass Digest Generation

### Why Two Passes?

**Single-pass problem**: Sending 200 findings with full detail to Sonnet works token-wise but degrades analytical quality — the AI struggles to meaningfully synthesize 200 data points in one shot, and position bias persists regardless of prompt guidance.

**Two-pass solution**:

```
Pass 1 (Haiku 4.5 — fast, cheap)         Pass 2 (Sonnet 4.5 — deep, editorial)
┌─────────────────────────┐               ┌─────────────────────────────────┐
│ ALL findings (no cap)   │               │ Haiku's ranked summaries        │
│ Full title + summary    │──────────────▶│ + Full detail of top 30         │
│ Score by significance   │               │ Generate rich editorial digest  │
│ Cluster by category     │               │                                 │
│ Output: ranked list     │               │ Output: full SmartDigest        │
└─────────────────────────┘               └─────────────────────────────────┘
     ~$0.05 cost                               ~$0.10 cost
     ~15 seconds                               ~45 seconds
```

### What Haiku Produces (Pass 1)

For each finding, Haiku scores and classifies:
```json
{
  "findingId": "uuid",
  "significanceScore": 1-10,
  "significanceReason": "Phase 3 trial with 2,847 participants showing...",
  "researchCategory": "gene_therapy" | "drug_approval" | "clinical_trial" | "mechanism" | ...,
  "condensedSummary": "150-char max distilled summary"
}
```

Plus a global overview:
```json
{
  "categoryGroups": [
    { "category": "gene_therapy", "findingCount": 8, "headline": "Gene therapy trials show sustained expression" }
  ],
  "topFindingIds": ["uuid1", "uuid2", ...],
  "totalAnalyzed": 150
}
```

### What Sonnet Receives (Pass 2)

- **Haiku's full output** (category groups + significance rankings)
- **Full detail** (title + 300-char summary + source) for the **top 30 findings** by significance
- **Condensed format** (Haiku's 150-char summary) for **remaining findings**
- The disease context and patient stage

This means Sonnet's "Featured Discovery" selection is informed by **Haiku's significance scoring of ALL findings**, not just what's newest or at the top of the list.

---

## Token Budget & Cost Analysis

### Pass 1: Haiku Scoring

| Findings | Input tokens | Output tokens | Cost | Time |
|----------|-------------|---------------|------|------|
| 50 | ~10K | ~5K | $0.035 | ~10s |
| 100 | ~18K | ~8K | $0.058 | ~15s |
| 150 | ~25K | ~10K | $0.075 | ~20s |
| 300 | ~48K | ~15K | $0.123 | ~30s |

### Pass 2: Sonnet Digest

| Input | Output | Cost | Time |
|-------|--------|------|------|
| ~20K (fixed: Haiku output + top 30 full detail) | ~7K | ~$0.165 | ~45s |

### Total Per Digest

| Findings | Total Cost | Total Time |
|----------|-----------|------------|
| 50 | ~$0.20 | ~55s |
| 100 | ~$0.22 | ~60s |
| 150 | ~$0.24 | ~65s |
| 300 | ~$0.29 | ~75s |

At daily regeneration: **$6-9/month**. Scales gracefully — doubling findings adds ~$0.05/digest.

**Context window usage**: Haiku has 200K context. Even 300 findings at full detail = ~48K tokens (24%). Sonnet receives ~20K tokens (10%). **Both well within limits.**

Sources:
- [Claude API Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) — 200K standard
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Haiku: $1/$5 per MTok; Sonnet: $3/$15 per MTok

---

## Cross-Feature Impact Analysis

### Worth Revisiting — ENHANCED

**Current problem**: The AI prompt says "Examine ALL findings" for worth-revisiting connections, but it actually only sees the 50 most recent (due to `MAX_FINDINGS_FOR_DIGEST = 50`). Older findings — the ones most likely to have interesting connections with new breakthroughs — are silently excluded.

**After Plan 020**: Pass 1 (Haiku) scores ALL findings. Pass 2 (Sonnet) receives Haiku's analysis of the entire corpus, meaning the `worthRevisiting` prompt can now reference findings from across the entire history. This is exactly what Worth Revisiting was designed for.

**Data flow unchanged**: Worth Revisiting is stored in `digests.worth_revisiting` → `GET /api/dashboard/stats` → `ResearchPulseCard` → `WorthRevisitingModal`. No frontend changes needed.

### Export System — AUTO-FIXED

`ExportMenu` receives the full `findings[]` array. After Plan 020, `statistics.totalFindings` will be the real count — now consistent with the findings array. The existing inconsistency (Excel showed "50" while PDF exported all findings) is automatically resolved.

### SourceDrawer — ENHANCED

`featuredDiscovery.findingId` will be selected based on Haiku's significance scoring across ALL findings, making the star designation more meaningful. `topFindings` IDs will represent truly significant findings. No code changes needed.

### Dashboard Stats — NO IMPACT

Dashboard uses `COUNT(*) FROM findings` directly, not digest statistics. Already shows real count.

### Chat Citations — INDEPENDENT (See Future Focus Section)

Chat has its own 50-finding cap independent of the digest pipeline. Not changed in this plan. See the "Future Focus" section at the end for detailed enhancement plan.

---

## Phase 1: Add Haiku Scoring Function (Pass 1)

**File**: `backend/src/services/ai.service.ts`

### Step 1.1: Add ScoredFindingsResult Type

Add near the top of the file, after existing imports/types:

```typescript
// ============================================
// Two-Pass Scoring Types
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

interface ScoredFindingsResult {
  scoredFindings: ScoredFinding[];
  categoryGroups: CategoryGroup[];
  topFindingIds: string[];          // Top 30 by significance, most significant first
  totalAnalyzed: number;
}
```

### Step 1.2: Add scoredFindingsSchema for Tool Use

Add the JSON schema for Haiku's tool_choice structured output:

```typescript
const scoredFindingsSchema = {
  type: 'object' as const,
  properties: {
    scoredFindings: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          findingId: { type: 'string' as const },
          significanceScore: { type: 'number' as const },
          significanceReason: { type: 'string' as const },
          researchCategory: { type: 'string' as const },
          condensedSummary: { type: 'string' as const }
        },
        required: ['findingId', 'significanceScore', 'significanceReason', 'researchCategory', 'condensedSummary']
      }
    },
    categoryGroups: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          category: { type: 'string' as const },
          findingCount: { type: 'number' as const },
          headline: { type: 'string' as const }
        },
        required: ['category', 'findingCount', 'headline']
      }
    },
    topFindingIds: {
      type: 'array' as const,
      items: { type: 'string' as const }
    },
    totalAnalyzed: { type: 'number' as const }
  },
  required: ['scoredFindings', 'categoryGroups', 'topFindingIds', 'totalAnalyzed']
};
```

### Step 1.3: Add scoreAndClusterFindings Function

Add the new exported function:

```typescript
/**
 * Pass 1: Use Haiku to score and cluster all findings by significance.
 * Returns ranked findings with categories, enabling Sonnet to make
 * significance-based (not position-based) selections.
 *
 * Haiku is fast (~10-30s) and cheap (~$0.03-0.12 per call).
 * This function handles any number of findings within Haiku's 200K context.
 */
export async function scoreAndClusterFindings(
  findings: any[],
  topicName: string
): Promise<ScoredFindingsResult> {
  const findingsText = findings.map((f, idx) =>
    `[${idx + 1}] ID: ${f.id}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 300) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
  ).join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    temperature: 0.1,
    system: `You are a medical research triage analyst. Your job is to score and cluster research findings by clinical significance for ${topicName}.

For EACH finding, assess:
- significanceScore (1-10): Based on study quality, clinical impact, novelty
  10: FDA approval, major Phase 3 result, paradigm shift
  7-9: Phase 2 results, major meta-analyses, guideline changes
  4-6: Observational studies, case series, preliminary research
  1-3: Reviews, commentaries, minor updates

- researchCategory: Categorize into one of: drug_approval, clinical_trial, gene_therapy, mechanism_research, treatment_guideline, patient_outcomes, safety_alert, diagnostic_advance, other

- condensedSummary: A single sentence (max 150 chars) capturing the core finding

Then provide:
- categoryGroups: Group categories with counts and 1-sentence headlines
- topFindingIds: The top 30 finding IDs ranked by significance (most significant first)
- totalAnalyzed: How many findings you scored`,
    messages: [{
      role: 'user',
      content: `Score and cluster these ${findings.length} research findings:\n\n${findingsText}`
    }],
    tools: [{
      name: 'score_findings',
      description: 'Score and cluster research findings by significance',
      input_schema: scoredFindingsSchema
    }],
    tool_choice: { type: 'tool', name: 'score_findings' }
  });

  // Extract tool use result
  const toolUseBlock = response.content.find(
    (block: any) => block.type === 'tool_use'
  );

  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    console.error('[AI] Haiku scoring: No tool_use block in response');
    // Fallback: return all findings as top findings with default scores
    return {
      scoredFindings: findings.map(f => ({
        findingId: f.id,
        significanceScore: 5,
        significanceReason: 'Default score — Haiku scoring unavailable',
        researchCategory: 'other',
        condensedSummary: f.title?.substring(0, 150) || 'No summary'
      })),
      categoryGroups: [{ category: 'other', findingCount: findings.length, headline: 'All findings' }],
      topFindingIds: findings.slice(0, 30).map(f => f.id),
      totalAnalyzed: findings.length
    };
  }

  const result = toolUseBlock.input as ScoredFindingsResult;

  console.log(`[AI] Haiku scored ${result.totalAnalyzed} findings, ${result.categoryGroups.length} categories, top ${result.topFindingIds.length} ranked`);

  return result;
}
```

### Implementation Deviation: max_tokens Scaling

**Plan originally specified**: `max_tokens: 4000` (fixed)

**Implemented**: `Math.min(Math.max(4000, findings.length * 80), 16000)` (dynamic)

**Reason**: Fixed 4000 tokens truncates Haiku's output for 100+ findings. Each scored finding produces ~50-80 output tokens (findingId + score + reason + category + summary). With 100 findings, output reaches ~6K tokens; with 300, ~16K tokens. Truncation would silently drop scored findings from the bottom of the list, undermining the purpose of scoring ALL findings.

| Findings | Estimated Output | Fixed 4K | Dynamic |
|----------|-----------------|----------|---------|
| 50 | ~3,500 tokens | OK | 4,000 |
| 100 | ~6,000 tokens | **TRUNCATED** | 8,000 |
| 150 | ~8,500 tokens | **TRUNCATED** | 12,000 |
| 300 | ~16,000 tokens | **TRUNCATED** | 16,000 |

**Cost impact**: Negligible. Haiku output at $5/MTok means 16K tokens = $0.08. The whole point of Plan 020 is removing the 50-finding cap.

**Additional implementation note**: Fallback logic extracted into `buildFallbackScoring()` helper to DRY up the two fallback paths (no tool_use block + catch).

### Step 1.4: Build Check

```bash
cd backend && npx tsc --noEmit
```

- [x] Step 1.1 complete
- [x] Step 1.2 complete
- [x] Step 1.3 complete
- [x] Step 1.4 build passes

---

## Phase 2: Modify Digest Generation to Use Two Passes

**File**: `backend/src/services/digest-processor.service.ts`

### Step 2.1: Add Import

At the top of the file, add `scoreAndClusterFindings` to the import from `ai.service.ts`:

```typescript
import { generateSmartDigest, scoreAndClusterFindings } from './ai.service';
```

### Step 2.2: Remove MAX_FINDINGS_FOR_DIGEST Cap

Find and **delete** the entire cap block (currently around lines 181-190):

```typescript
// DELETE THIS ENTIRE BLOCK:
const MAX_FINDINGS_FOR_DIGEST = 50;
if (findings.length > MAX_FINDINGS_FOR_DIGEST) {
  console.log(`[DigestProcessor] Capping findings from ${findings.length} to ${MAX_FINDINGS_FOR_DIGEST}`);
  // Sort by created_at descending (most recent first) and take top 50
  findings = findings
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_FINDINGS_FOR_DIGEST);
}
```

### Step 2.3: Add Two-Pass Orchestration

Replace the existing `generateSmartDigest()` call with the two-pass flow. The current code passes findings directly to `generateSmartDigest()`. Replace it with:

```typescript
// Capture real total before any processing
const totalFindingsCount = findings.length;

// Transform findings for AI
const findingsForAI = findings.map(f => ({
  id: f.id,
  type: f.source?.type || 'unknown',
  title: f.title,
  summary: f.summary || f.content?.substring(0, 300),
  source: f.source
}));

// PASS 1: Haiku scores and clusters ALL findings
console.log(`[DigestProcessor] Pass 1: Scoring ${findings.length} findings with Haiku...`);
const scoredResult = await scoreAndClusterFindings(findingsForAI, topic.name);

// Build tiered finding set for Sonnet based on Haiku's ranking
const topFindingIds = new Set(scoredResult.topFindingIds);
const topFindings = findingsForAI.filter(f => topFindingIds.has(f.id));
const remainingFindings = findingsForAI.filter(f => !topFindingIds.has(f.id));

// PASS 2: Sonnet generates editorial digest with Haiku context
console.log(`[DigestProcessor] Pass 2: Generating digest with Sonnet (${topFindings.length} full + ${remainingFindings.length} condensed)...`);
const digest = await generateSmartDigest(
  topFindings,
  remainingFindings,
  scoredResult,
  topic,
  totalFindingsCount
);
```

### Step 2.4: Update Statistics in Store Logic

Where the digest metadata/statistics are assembled for storage, ensure:

```typescript
statistics: {
  totalFindings: totalFindingsCount,    // Real count, not capped
  newFindings: /* existing logic */,
  analyzedFindings: totalFindingsCount  // All findings were analyzed by Haiku
}
```

### Step 2.5: Build Check

```bash
cd backend && npx tsc --noEmit
```

**Note**: This will fail until Phase 3 updates `generateSmartDigest()` signature. If implementing incrementally, you can temporarily keep the old signature and update in Phase 3.

- [x] Step 2.1 complete
- [x] Step 2.2 complete
- [x] Step 2.3 complete
- [x] Step 2.4 complete
- [x] Step 2.5 build passes (may need Phase 3 first)

---

## Phase 3: Update Sonnet Digest Prompt to Use Haiku Context

**File**: `backend/src/services/ai.service.ts`

### Step 3.1: Update generateSmartDigest() Signature

Change from current signature (which takes a single findings array) to:

```typescript
export async function generateSmartDigest(
  topFindings: any[],                       // Full detail (top 30 by significance)
  remainingFindings: any[],                 // Condensed summaries
  scoredResult: ScoredFindingsResult,       // Haiku's analysis
  topic: any,
  totalFindingsCount: number
)
```

### Step 3.2: Remove Old Tiered Format Logic

Find and **delete** the tiered formatting code (currently around lines 217-241). This is the block that does:

```typescript
// DELETE: The old fullDetailCount / compactFindings logic
const fullDetailCount = 15;
const fullDetailFindings = findings.slice(0, fullDetailCount);
const compactFindings = findings.slice(fullDetailCount);
```

### Step 3.3: Build New Findings Text with Haiku Context

Replace the deleted tiered format with two-tier format based on Haiku's rankings:

```typescript
// Build a map of Haiku's condensed summaries for remaining findings
const condensedMap = new Map(
  scoredResult.scoredFindings.map(sf => [sf.findingId, sf.condensedSummary])
);

// TOP FINDINGS: Full detail (300-char summary)
const topFindingsText = topFindings.map((f, idx) =>
  `[${idx + 1}] ID: ${f.id}
Type: ${f.type}
Title: ${f.title}
Summary: ${f.summary?.substring(0, 300) || 'No summary'}
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
).join('\n\n');

// REMAINING FINDINGS: Haiku's condensed summary (150 chars)
const remainingFindingsText = remainingFindings.map((f, idx) =>
  `[${topFindings.length + idx + 1}] ${f.title} — ${condensedMap.get(f.id) || 'No summary'} (${f.source?.name || 'Unknown'})`
).join('\n');
```

### Step 3.4: Update System Prompt

In the system prompt, **remove** the anti-bias instructions (no longer needed — Haiku already scored significance) and **add** the pre-analysis context section:

```
## PRE-ANALYSIS CONTEXT (from automated significance scoring)

${totalFindingsCount} total findings were scored by significance (10=highest).
Top ${topFindings.length} findings are provided with full detail below.
Remaining ${remainingFindings.length} findings are provided in condensed format.

Significance Rankings:
${scoredResult.scoredFindings
  .sort((a, b) => b.significanceScore - a.significanceScore)
  .slice(0, 30)
  .map(f => `- ${f.findingId}: Score ${f.significanceScore} — ${f.significanceReason}`)
  .join('\n')}

Research Categories:
${scoredResult.categoryGroups.map(g => `- ${g.category}: ${g.findingCount} findings — ${g.headline}`).join('\n')}

INSTRUCTIONS:
- Use these significance scores to guide your Featured Discovery and Top Findings selection
- You MUST select the Featured Discovery from the highest-scored findings
- Source breakdown in statistics MUST account for ALL ${totalFindingsCount} findings
```

### Step 3.5: Update Statistics Instructions in Prompt

In the JSON schema instructions within the system prompt, update the statistics section:

```
"statistics": {
  "totalFindings": ${totalFindingsCount},  // MUST be this exact number
  "newFindings": <count of findings from last 7 days>
}
```

### Step 3.6: Summary Truncation — 300 chars

Ensure all summary truncation uses 300 chars instead of 400:
- Search for `substring(0, 400)` in the function
- Replace with `substring(0, 300)`

AI-generated summaries average 150-250 chars, so 300 provides adequate margin while saving ~25% per finding.

### Step 3.7: Build Check

```bash
cd backend && npx tsc --noEmit
```

- [x] Step 3.1 complete
- [x] Step 3.2 complete
- [x] Step 3.3 complete
- [x] Step 3.4 complete
- [x] Step 3.5 complete
- [x] Step 3.6 complete
- [x] Step 3.7 build passes

---

## Phase 4: Fix Findings API Default Limit

**File**: `backend/src/routes/findings.routes.ts` (line 49)

### Step 4.1: Remove Default LIMIT 50

```typescript
// BEFORE:
limit: req.query.limit ? parseInt(req.query.limit as string) : 50,

// AFTER:
limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
```

This ensures the findings API returns ALL findings by default, matching the dashboard's `COUNT(*)`. Callers that need a limit (like Chat) pass their own `?limit=50` parameter.

### Step 4.2: Build Check

```bash
cd backend && npx tsc --noEmit
```

- [x] Step 4.1 complete
- [x] Step 4.2 build passes

---

## Phase 5: Clean Up Frontend Artifacts

### Step 5.1: Remove `filteredFindings` from ResearchContainer

**File**: `src/components/research/ResearchContainer.tsx`

- Remove `const { digestTimeframe } = useAppStore();` (line 94)
- Remove the entire `filteredFindings` useMemo block (lines 99-113)
- Remove `useAppStore` import if no longer needed (check if other uses exist first)
- Update TopicSelector props: pass `findingsCount={findings.length}`, remove `filteredCount` prop

### Step 5.2: Remove `filteredCount` from TopicSelector

**File**: `src/components/research/topic/TopicSelector.tsx`

- Remove `filteredCount` from the props interface
- Remove `filteredCount` from destructuring
- Remove the "X in period" display block (lines 81-85):
  ```tsx
  // DELETE:
  {filteredCount !== undefined && filteredCount !== findingsCount && (
    <span className="flex items-center gap-1">
      <Calendar className="h-4 w-4" />
      {filteredCount} in period
    </span>
  )}
  ```
- Remove `Calendar` import from lucide-react if no longer used

### Step 5.3: Remove `filteredFindingsCount` from DigestPanel

**File**: `src/components/research/digest/DigestPanel.tsx`

- Remove the `filteredFindingsCount` IIFE computation (lines 52-67):
  ```typescript
  // DELETE the entire block:
  const filteredFindingsCount = (() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    switch (timeframe) { ... }
  })();
  ```
- Update any props that use `filteredFindingsCount` to use `findings.length` instead:
  - `canGenerate={findings.length > 0}`
  - `findingsCount={findings.length}`

### Step 5.4: Fix DigestCard Title

**File**: `src/components/DigestCard.tsx` (line 178)

```typescript
// BEFORE:
Weekly Research Digest

// AFTER:
Research Digest
```

### Step 5.5: Update Frontend Statistics Type

**File**: `src/types/index.ts` (around line 390)

Add `analyzedFindings` to the statistics type:

```typescript
// BEFORE:
statistics: {
  totalFindings: number;
  newFindings: number;
};

// AFTER:
statistics: {
  totalFindings: number;
  newFindings: number;
  analyzedFindings?: number;
};
```

### Step 5.6: Remove Dead `expandedThemes` Field (Optional Cleanup)

**File**: `src/types/index.ts` (line 404)

Remove `expandedThemes?: string[];` from the `userEngagement` type — this is a leftover from the removed DigestTheme system (Plan 019). It's never set or read anywhere.

### Step 5.7: Build Check

```bash
npm run build
```

- [x] Step 5.1 complete
- [x] Step 5.2 complete
- [x] Step 5.3 complete
- [x] Step 5.4 complete
- [x] Step 5.5 complete
- [x] Step 5.6 complete (optional)
- [x] Step 5.7 build passes

---

## Files Modified Summary

| File | Change | Phase |
|------|--------|-------|
| `backend/src/services/ai.service.ts` | Add `scoreAndClusterFindings()`, types, schema; update `generateSmartDigest()` signature/prompt; remove tiered format; use 300-char summaries | 1, 3 |
| `backend/src/services/digest-processor.service.ts` | Import `scoreAndClusterFindings`; remove `MAX_FINDINGS_FOR_DIGEST = 50` cap; add two-pass orchestration; update statistics | 2 |
| `backend/src/routes/findings.routes.ts` | Remove default `LIMIT 50` | 4 |
| `src/components/research/ResearchContainer.tsx` | Remove `filteredFindings` useMemo, `digestTimeframe` usage, `useAppStore` import | 5 |
| `src/components/research/topic/TopicSelector.tsx` | Remove `filteredCount` prop, "X in period" display, `Calendar` import | 5 |
| `src/components/research/digest/DigestPanel.tsx` | Remove `filteredFindingsCount` computation | 5 |
| `src/components/DigestCard.tsx` | "Weekly Research Digest" → "Research Digest" | 5 |
| `src/types/index.ts` | Add `analyzedFindings?` to statistics; remove `expandedThemes?` | 5 |

---

## Conflict Check with Plan 019 (COMPLETE)

Plan 019 is **fully complete** (verified Feb 9, 2026). All changes have been committed.

**What Plan 019 already cleaned up** (no need to re-do):
- `DigestCard.tsx`: Removed sourceCount badge, uniqueStudies, themes section, trends section
- `ResearchToolbar.tsx`: Removed Update button, `topicId` prop, `useDigest` import — now only has Export, DateFilter, ViewToggle
- `digest.service.ts`: Removed `sourceCount`/`uniqueStudies`/`themes`/`trends` from transforms
- `DigestActions.tsx`: Consolidated 3 buttons → 1 "Update Insights" tooltip button
- `useDigest.ts`: Removed `refreshDigest`, `refreshResearchAndDigest`
- DB: Dropped `themes`, `trends` columns from `digests` table

**Our plan touches files NOT modified by Plan 019**: `ResearchContainer.tsx`, `TopicSelector.tsx`, `DigestPanel.tsx`, `findings.routes.ts`, `digest-processor.service.ts`, `ai.service.ts`.

**Shared file**: `DigestCard.tsx` (our change at line 178 "Weekly" → "Research Digest"; Plan 019's changes were at line 581+ area). **No overlap.**

**No conflicts.**

---

## Scaling Analysis

| Findings | Pass 1 (Haiku) | Pass 2 (Sonnet) | Total Cost | Total Time |
|----------|----------------|-----------------|------------|------------|
| 50 | $0.035, 10s | $0.165, 45s | **$0.20** | ~55s |
| 150 | $0.075, 20s | $0.165, 45s | **$0.24** | ~65s |
| 300 | $0.123, 30s | $0.165, 45s | **$0.29** | ~75s |
| 500 | $0.195, 45s | $0.165, 45s | **$0.36** | ~90s |

Key insight: **Sonnet's cost is fixed** (~$0.165) because it always receives the same amount of data (top 30 full detail + Haiku summaries). Only Haiku's cost grows linearly, and Haiku is cheap.

Growth model: ~30-50 new findings/month with dedup. At 500 findings (~1 year): Haiku pass adds ~$0.20, well within budget.

---

## Deployment

```bash
# 1. SSH to server
ssh chee@100.94.82.35

# 2. Navigate to project
cd /home/chee/medical-pwa

# 3. Pull latest code
git pull origin feat/ui-overhaul

# 4. Rebuild containers
docker compose down && docker compose up -d --build

# 5. Verify backend starts
docker logs medical-companion --tail 50 2>&1

# 6. No DB migration needed — no new columns (analyzedFindings goes in existing metadata JSONB)
```

---

## Verification

### Build Checks
1. `cd backend && npx tsc --noEmit` — passes
2. `npm run build` — passes

### Functional Checks
3. Home and Research page show **same** finding count
4. Digest badge shows total findings in topic (not capped at 50)
5. "Research Digest" title (no "Weekly")
6. List view date filter still works independently
7. No console errors

### Two-Pass Quality Checks
8. Docker logs show: `[DigestProcessor] Pass 1: Scoring N findings with Haiku...`
9. Docker logs show: `[DigestProcessor] Pass 2: Generating digest with Sonnet (30 full + M condensed)...`
10. Docker logs show: `[AI] Haiku scored N findings, M categories, top 30 ranked`
11. Featured Discovery is from a high-significance finding (not necessarily the newest)
12. Top Findings include findings from across the full corpus (not just recent)
13. Worth Revisiting connections reference older findings (not just last 50)
14. Source breakdown matches total findings
15. Regenerate digest → compare quality with old single-pass digest

### Grep Verification
16. `grep -r "fullDetailCount\|compactFindings" backend/src/services/ai.service.ts` — 0 results
17. `grep -r "MAX_FINDINGS_FOR_DIGEST = 50" backend/` — 0 results
18. `grep -r "filteredFindings" src/components/research/ResearchContainer.tsx` — 0 results
19. `grep -r "Weekly Research Digest" src/` — 0 results
20. `grep -r "themeGroup\|DigestTheme" backend/src/services/` — 0 results (no theme terminology leakage)

### Rollback Plan

If digest quality degrades or Haiku scoring fails:

1. Revert `digest-processor.service.ts` to restore `MAX_FINDINGS_FOR_DIGEST = 50` and single-pass flow
2. Revert `ai.service.ts` to restore old `generateSmartDigest()` signature with tiered format
3. The `scoreAndClusterFindings()` function can remain — it's not called if the processor doesn't use it
4. Frontend changes (Phase 5) can remain — they're independent cleanup

---

## Future Focus: Chat Citation Enhancement (Plan 021 Candidate)

### Problem Statement

Chat's citation system has the **same 50-finding cap problem** we're fixing in the digest pipeline:

1. **Frontend** (`src/components/ChatPanel.tsx:153`): `allFindings.slice(0, 50)` — hardcoded cap
2. **Backend** (`backend/src/routes/chat.routes.ts:725`): `limit: 50` — hardcoded cap

The AI can only cite findings it can see. With 127 findings and only 50 sent to Chat, the AI might say "I don't have information about X" when finding #63 (excluded) contains exactly that information.

### Why This Matters

Unlike digest generation (one-time batch), Chat is **interactive** — users ask follow-up questions expecting the AI to know their full research corpus. A user who says "What does my research say about gene therapy for SMA?" expects the AI to reference ALL their gene therapy findings, not just the 50 most recent.

### Current Chat Architecture (What We'd Change)

```
┌─ ChatPanel.tsx (Frontend) ─────────────────────────────────────────┐
│ Line 152: const allFindings = await findingsService.getFindings()  │
│ Line 153: topicFindings = allFindings.slice(0, 50);  ← THE CAP    │
│ Line 158-166: Transform to { id, title, content, source, ... }    │
│ Line 168-173: Build context object with findings + citationMap     │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌─ chat.routes.ts (Backend) ────────────────────────────────────────┐
│ Line 466-489: buildSystemPrompt() — includes findings as:         │
│   [1] Title: ... Content: ${content.substring(0, 200)}...         │
│   Each finding gets ~50 tokens → 50 findings = ~2,500 tokens      │
│   (only 1.25% of 200K context!)                                   │
│                                                                    │
│ Line 695-812: enrichFindingsContext() — backend fallback:          │
│   Line 725: limit: 50  ← SECOND CAP                               │
│   Line 783: No limit fallback (rarely hit)                         │
└────────────────────────────────────────────────────────────────────┘
```

### Proposed Enhancement: Two-Tier Chat Context (Leveraging Plan 020)

After Plan 020 is complete, we can reuse the same two-pass pattern for Chat:

**Option A: Reuse Haiku Scoring at Chat Time**
- Before each chat message, run `scoreAndClusterFindings()` on ALL findings
- Send top 50 by significance (not recency) to the Chat AI
- Include Haiku's condensed summaries of remaining findings as a "research index"
- Cost: ~$0.05 extra per chat message (Haiku scoring)
- Tradeoff: Adds ~10s latency before first token streams

**Option B: Cache Haiku Scores from Digest Generation (Recommended)**
- During digest generation (Plan 020), **save** Haiku's scoring output to the database
- When Chat loads context, query cached scores to select the 50 most significant findings
- Include condensed summaries of remaining findings as a lightweight "research index"
- Cost: $0.00 per chat message (reuses digest scoring)
- Tradeoff: Scores may be stale if new findings arrived since last digest

**Option C: Expanded Context Window**
- Simply send ALL findings to Chat (remove both caps)
- 150 findings × 50 tokens = 7,500 tokens (3.75% of 200K context)
- 300 findings × 50 tokens = 15,000 tokens (7.5% of 200K context)
- Cost: Higher per-message API cost due to larger context
- Tradeoff: Simplest to implement, may degrade response quality with too many findings

### Recommended Approach: Option B (Cached Scoring)

**Implementation would require:**

1. **New DB column**: `digests.haiku_scores` (JSONB) — stores `ScoredFindingsResult` from Plan 020's Pass 1
2. **Modify `digest-processor.service.ts`**: Save `scoredResult` alongside the digest
3. **New backend endpoint** or modify existing: `GET /api/topics/:id/scored-findings` — returns cached scores
4. **Modify `ChatPanel.tsx`**:
   - Replace `allFindings.slice(0, 50)` with significance-based selection
   - Add condensed "research index" of remaining findings to context
5. **Modify `chat.routes.ts`**:
   - Update `enrichFindingsContext()` to use cached scores
   - Add a lightweight "research index" section to system prompt

**Key files to modify:**
- `backend/src/services/digest-processor.service.ts` — save scores
- `backend/src/models/digest.model.ts` — new column
- `backend/src/routes/chat.routes.ts` — use cached scores, add research index
- `src/components/ChatPanel.tsx` — significance-based finding selection

**Token budget for Chat with research index:**
- Top 50 findings: ~2,500 tokens (full context, as today)
- Research index (100 remaining × 20 tokens each): ~2,000 tokens
- Total: ~4,500 tokens (2.25% of 200K) — still very efficient
- Benefit: AI can acknowledge ALL findings exist and cite any of them

**Example research index format in system prompt:**
```
## Additional Research Index (condensed — cite by number if relevant)
[51] Gene therapy phase 1 results for SMA type 2 (PubMed, Score: 8)
[52] FDA advisory committee votes on risdiplam label expansion (FDA, Score: 9)
[53] Long-term follow-up of nusinersen-treated infants (PubMed, Score: 7)
...
```

This allows the AI to say: "Based on finding [52], the FDA advisory committee recently voted on label expansion for risdiplam..." even though finding #52 wasn't in the top 50 by recency.

### Pre-requisites Before Starting
- Plan 020 must be complete and deployed
- Verify Haiku scoring quality in production (at least 2-3 digest regeneration cycles)
- Confirm `ScoredFindingsResult` structure is stable and doesn't need changes

---

## Sign-Off

- [x] Phase 1 complete (Haiku scoring function)
- [x] Phase 2 complete (two-pass orchestration in digest processor)
- [x] Phase 3 complete (Sonnet prompt updated with Haiku context)
- [x] Phase 4 complete (findings API limit removed)
- [x] Phase 5 complete (frontend timeframe cleanup)
- [x] Backend compiles (`npx tsc --noEmit`)
- [x] Frontend builds (`npm run build`)
- [x] Deployed and verified
- [x] Digest quality verified (significance-based, not position-based)
- [x] Redundant "60 findings" badge removed from DigestCard header (post-deploy cleanup)
- [x] Date: February 10, 2026

*Plan created: February 9, 2026*
*Completed: February 10, 2026*
*Depends on: Plan 019 (COMPLETE)*
*Future: Plan 021 — Chat Citation Enhancement (documented in Future Focus section)*
