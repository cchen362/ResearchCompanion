# Plan 022: Product Readiness — PubMed Fix, Temporal Digest, Section Consolidation

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan transforms the Medical Companion from an engineering project into a product through 3 pillars:
1. **Fix broken PubMed parser** (scheduler path produces duplicate data)
2. **Add temporal awareness** ("what changed since last digest" for returning users)
3. **Consolidate digest sections** (12 → 6 via 12-layer pipeline)

| Pillar | Risk | Files | DB Changes |
|--------|------|-------|------------|
| PubMed fix | ZERO (replacing broken code with proven pattern) | 1 | None |
| Temporal awareness | LOW (additive, graceful fallbacks) | 4 | 1 column on `topics` |
| Section consolidation | MEDIUM (12-layer pipeline, schema change) | ~12 | 3 new + 6 dropped columns on `digests` |

**Prerequisite**: Plans 020 (Two-Pass Digest) and 021 (Haiku Scoring Fix) must be COMPLETE. The two-pass architecture is the foundation this plan builds on.

---

## Strict Rules

### MUST DO
- [x] Follow pillars IN ORDER (1 → 2 → 3) — Pillar 1 complete
- [ ] Run `cd backend && npx tsc --noEmit` after every backend file change
- [ ] Run `npm run build` after completing each pillar
- [x] Read the reference file (`search.service.ts:112-170`) before rewriting the PubMed parser
- [x] Check `convertToFindings()` output shape before finalizing parser output
- [ ] Verify the 12-layer pipeline checklist is complete before testing Pillar 3
- [ ] User will delete and re-add topics after deployment — NO backward compat needed

### MUST ALSO DO (Refactoring — Discovered During Pillar 1)
- [ ] When modifying any file, look for **dead fallback chains** (e.g., `a || b || c` where b and c never exist) — clean them up
- [ ] When modifying any file, look for **stale comments** that contradict the current architecture — remove them
- [ ] When a method returns `any[]`, consider adding a typed interface if it has a clear contract with consumers
- [ ] When changing a method's logic such that a parameter becomes unused, **remove the parameter and update all call sites** — don't leave dead params
- [ ] When two consumers read the same field under different names, **fix the reader** — don't add alias fields to the writer
- [ ] Trace the full data flow of any new field across all layers before adding it (see "7-Layer Pipeline" in MEMORY.md)

### MUST NOT DO
- [ ] Do NOT install xml2js or any XML parser library — use the existing regex-split approach
- [ ] Do NOT change `scoreAndClusterFindings()` return type or `ScoredFindingsResult` interface
- [ ] Do NOT modify the scheduler service (`scheduler.service.ts`) or queue service (`digestQueue.service.pg.ts`)
- [ ] Do NOT add impact badges (critical/notable/informational) to notable findings — ordering by significance is sufficient
- [ ] Do NOT add pagination to DigestCard — if needed, it's a separate future task
- [ ] Do NOT change the Haiku Pass 1 batching logic from Plan 021
- [ ] Do NOT re-generate digests on user login — use read-time enrichment only

---

## Files Modified

| File | Pillar | Changes |
|------|--------|---------|
| `backend/src/services/agent-execution.service.ts` | 1 ✅ | Replaced `parsePubMedXML` with block-splitting, added `PubMedArticle` interface, removed dead `ids` param, fixed `buildAIPrompt` date field |
| `backend/src/services/digest-processor.service.ts` | 2, 3 | Add previous digest lookup, pass temporal context, update INSERT columns |
| `backend/src/services/ai.service.ts` | 2, 3 | Add temporal context to findingsText + prompt, rewrite prompt for 6 sections, update Zod parse |
| `backend/src/routes/digest.routes.ts` | 2, 3 | GET enrichment for returning users, update SELECT aliases |
| `backend/src/models/topic.model.ts` | 2 | Add `last_digest_viewed_at` field |
| `backend/src/schemas/digest.schema.ts` | 3 | Restructure Zod + JSON schemas for 6 sections |
| `backend/src/models/digest.model.ts` | 3 | Update `Digest` interface and `create()` method |
| `backend/src/routes/digests.crud.routes.ts` | 3 | Update `CreateDigestSchema` Zod validation |
| `src/types/index.ts` | 3 | Update `SmartDigest` interface, add new types |
| `src/services/digest.service.ts` | 3 | Update `transformToFrontend` and `transformToBackend` |
| `src/components/DigestCard.tsx` | 3 | Restructure from 8 sections to 5 |
| `src/components/home/ResearchPulseCard.tsx` | 3 | Transform to WhatsNewCard (read `whatsNew` instead of `researchPulse`) |
| `src/components/home/WorthRevisitingModal.tsx` | 3 | Delete |
| `src/components/HomePage.tsx` | 3 | Update imports, remove WorthRevisiting references |

---

## Pillar 1: Fix PubMed Parser in Agent Execution — ✅ COMPLETE

### What Was Done

Replaced the broken `parsePubMedXML()` with the block-splitting approach from `search.service.ts:112-170`.

**Changes made to `agent-execution.service.ts`:**
1. Added typed `PubMedArticle` interface (replaces `any[]` return) — compile-time field name validation
2. Replaced `parsePubMedXML` method body — block-splitting per article instead of whole-XML regex
3. Removed dead `ids` parameter from method signature and call site (line 233)
4. Fixed silent `buildAIPrompt` date bug (line 603): changed `result.publishDate || result.pubdate` → `result.publishedDate` — date was always empty in scheduler AI prompts
5. Removed stale "use xml2js in production" comment

### Discoveries for Future Pillars

#### Field Name Architecture — `publishedDate` vs `publishDate`
The project uses **two conventions** by design:
- **Raw parser output** → `publishedDate` (intermediate, consumed by `buildSource()` and `buildAIPrompt()`)
- **`FindingSource` / DB / API / Frontend** → `publishDate` (canonical)
- `buildSource()` bridges them: `publishDate: result.publishedDate` (line 461)

**When touching `ai.service.ts` in Pillars 2/3**: The raw finding data passed to AI functions uses `publishedDate`. Do NOT introduce `publishDate` at the raw data level — that's the DB/API convention, not the intermediate convention.

#### Refactoring Mindset for Future Pillars
When modifying each file, look for:
- **Dead fallback chains** (like `result.publishDate || result.pubdate || ''`) — clean them up, don't add to them
- **Stale comments** that contradict current architecture
- **`any` types** that could be replaced with interfaces for compile-time safety
- **Dead parameters** that are no longer used after the logic changes
- **Duplicate field names** — trace the full data flow before adding alias fields. The right fix is usually correcting the reader, not adding another writer.

---

## Pillar 2: Add Temporal Awareness

### Architecture

Two concerns separated cleanly:

1. **At digest generation time** (background, daily): AI gets `previousDigestDate` and `[NEW]` tags on findings. Generates `whatsNew` framed as "N new since yesterday."

2. **At digest read time** (instant, when user opens app): If user was away >1 day, backend replaces the first sentence of `whatsNew` with accurate temporal framing ("42 new in your 7 days away"). No AI call, no waiting, ~10 lines.

### Temporal Scenarios

| Scenario | whatsNew Content | Wait Time |
|----------|-----------------|-----------|
| User checks daily | AI's original "5 new since yesterday" | 0 (pre-generated) |
| User away 7 days | Enriched "42 new in your 7 days away" | 0 (count query + string replace) |
| First-ever digest | "Your first digest for [topic]. We analyzed N findings..." | 0 (pre-generated) |
| No new findings | Previous digest shown as-is | 0 |
| Manual "Run Now" | Fresh digest, `userLastViewedDate = now` | Generation time |

### Steps

- [x] **Step 2.1**: Run migration SQL (pending deployment):
```sql
ALTER TABLE topics ADD COLUMN IF NOT EXISTS last_digest_viewed_at TIMESTAMPTZ;
```

- [x] **Step 2.2**: Update `backend/src/models/topic.model.ts` — add `last_digest_viewed_at?: Date` to the Topic interface

- [x] **Step 2.3**: Update `backend/src/services/digest-processor.service.ts` — In `generateAndStoreDigest()`:

After line 187 (fetching topic), add:
```typescript
// Temporal context: when was the last digest generated?
const previousDigest = await DigestModel.getLatestByTopicId(item.user_id, item.topic_id);
const previousDigestDate = previousDigest?.created_at || null;
```

In the `findingsForAI` mapping (line 202), add `created_at`:
```typescript
const findingsForAI = findings.map(f => ({
  id: f.id,
  type: f.source?.type || 'unknown',
  title: f.title,
  summary: f.summary || f.content?.substring(0, 300),
  source: f.source,
  created_at: f.created_at  // NEW: temporal context
}));
```

Pass `previousDigestDate` to both AI functions:
```typescript
const scoredResult = await scoreAndClusterFindings(findingsForAI, topicForDigest.name, previousDigestDate);
// ...
const digest = await generateSmartDigest(
  topFindings, remainingFindings, scoredResult, topicForDigest, totalFindingsCount, previousDigestDate
);
```

- [x] **Step 2.4**: Update `backend/src/services/ai.service.ts`:

**a) `scoreAndClusterFindings()`** — Add optional `previousDigestDate` param. In the findings text sent to Haiku, add `[NEW]` tags:
```typescript
export async function scoreAndClusterFindings(
  findings: any[], topicName: string, previousDigestDate?: Date | null
) {
  // In findingsText builder, for each finding:
  const isNew = previousDigestDate && f.created_at
    ? new Date(f.created_at) > previousDigestDate : true;
  // Add to finding line: `${isNew ? '[NEW] ' : ''}Title: ${f.title}`
```

**b) `generateSmartDigest()`** — Add `previousDigestDate` param. Update findingsText builder:
```typescript
// For each top finding:
const isNew = previousDigestDate && f.created_at
  ? new Date(f.created_at) > previousDigestDate : true;
// Add: `${isNew ? '[NEW] ' : ''}` prefix and `Added: ${f.created_at}` line
```

**c) Add `## TEMPORAL CONTEXT` section to system prompt** (after line 650):
```
## TEMPORAL CONTEXT
${previousDigestDate
  ? `Last digest generated: ${previousDigestDate.toISOString().split('T')[0]}.
${newCount} findings are new since then, marked [NEW] in the data.
Your whatsNew summary should focus on what changed since the last digest.
Featured Discovery and Notable Findings should prioritize [NEW] findings when clinically significant.`
  : `This is the FIRST digest for this topic. All findings are new. Your whatsNew should welcome the user and summarize the full landscape.`}
```

- [x] **Step 2.5**: Update `backend/src/routes/digest.routes.ts` (view tracking only; whatsNew enrichment deferred to Pillar 3) — In the GET digest route:

```typescript
// After fetching digest and before returning response:
const topic = await TopicModel.getById(digest.topic_id, userId);
const lastViewed = topic?.last_digest_viewed_at;

if (lastViewed) {
  const daysAway = Math.floor((Date.now() - new Date(lastViewed).getTime()) / (86400000));
  if (daysAway > 1 && digest.whats_new) {
    // Count findings added since user last viewed
    const newCount = await FindingModel.countSince(userId, digest.topic_id, lastViewed);
    if (newCount > 0) {
      const whatsNew = typeof digest.whats_new === 'string'
        ? JSON.parse(digest.whats_new) : digest.whats_new;
      // Replace first sentence with accurate temporal framing
      const restOfTechnical = whatsNew.technical?.replace(/^[^.]+\./, '').trim() || '';
      const restOfExplained = whatsNew.explained?.replace(/^[^.]+\./, '').trim() || '';
      whatsNew.technical = `${newCount} new findings in your ${daysAway} days away. ${restOfTechnical}`;
      whatsNew.explained = `${newCount} new findings in your ${daysAway} days away. ${restOfExplained}`;
      digest.whats_new = whatsNew;
    }
  }
}

// Track user viewing
await TopicModel.updateLastDigestViewed(digest.topic_id, userId);
```

Add `countSince` to `FindingModel` and `updateLastDigestViewed` to `TopicModel` (simple one-query methods).

- [x] **Step 2.6**: Build verify: `cd backend && npx tsc --noEmit` ✅ + `npm run build` ✅

---

## Pillar 3: Consolidate Digest Sections

### New Structure (6 sections)

| # | Section | Replaces | Description |
|---|---------|----------|-------------|
| 1 | **whatsNew** | executiveSummary, laymanSummary, researchPulse | 2-3 sentence warm companion summary. Dual-mode. |
| 2 | **featuredDiscovery** | (keep as-is) | Hero card. Prefer NEW findings. |
| 3 | **keyTakeaways** | (keep as-is) | Collapsible bullet points. 5-8 items. Dual-mode. |
| 4 | **notableFindings** | topFindings, breakthroughs | Up to 12 cards. `isNew` boolean. Ordered by significance. Source filter tabs. Diversity instruction. |
| 5 | **forYourDoctor** | questionsForDoctor, warningSigns, contradictions | `questions` (3-5), `watchFor` (2-4), `conflicts` (0-3, conditional). |
| 6 | **sourceBreakdown** | (keep as-is) | Inline pills. |

### What Gets Cut
- `executiveSummary` / `laymanSummary` → absorbed by `whatsNew`
- `breakthroughs` → merged into `notableFindings` (same card format, significant ones rank first)
- `contradictions` standalone → moved to `forYourDoctor.conflicts` (conditional, only if genuine)
- `researchPulse` → absorbed by `whatsNew`
- `worthRevisiting` → eliminated (temporal tags make it natural)

### Why Keep Key Takeaways?
Bullets (Key Takeaways) = **skim** in 10 seconds. Cards (Notable Findings) = **dive** into a source. Different reading modes. Token cost: ~600 tokens. Existing collapsible UI works well.

### Why 12 Notable Findings?
- **Token budget**: 12 × ~245 = ~2,940 tokens. Only 45% of 12,000 max_tokens budget.
- **UI scroll**: 12 × ~120px = ~1,440px. Manageable. 18+ needs pagination.
- **Haiku significance falloff**: Score 8-10 (2-5 findings), 6-7 (5-10), 4-5 (padding). Natural break at ~12.
- **Diversity instruction**: "Include at least 1 finding from each research category with 5+ findings" — ensures 12 findings cover all categories, not just PubMed reviews.

### 12-Layer Pipeline — Follow in EXACT order

#### Layer 1: AI JSON Schema
**File**: `backend/src/schemas/digest.schema.ts`

- [ ] **Step 3.1**: Remove `BreakthroughSchema` and `ContradictionSchema` (standalone top-level schemas)

- [ ] **Step 3.2**: Add new schemas:

```typescript
// What's New — warm companion summary of temporal changes
export const WhatsNewSchema = z.object({
  technical: z.string(),
  explained: z.string()
});

// Notable Finding — extends TopFinding with temporal awareness
export const NotableFindingSchema = z.object({
  findingId: z.string(),
  sourceType: z.enum(['pubmed', 'clinical_trial', 'fda', 'web']),
  isNew: z.boolean().default(false),
  technical: z.object({
    title: z.string(),
    summary: z.string(),
  }),
  explained: z.object({
    title: z.string(),
    summary: z.string(),
  }),
  metadata: z.string(),
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
```

- [ ] **Step 3.3**: Update `SmartDigestSchema`:
```typescript
export const SmartDigestSchema = z.object({
  whatsNew: WhatsNewSchema,
  featuredDiscovery: z.lazy(() => FeaturedDiscoverySchema),
  keyTakeaways: z.array(DualModeTextSchema).default([]),
  notableFindings: z.array(NotableFindingSchema).max(12),
  forYourDoctor: ForYourDoctorSchema,
  sourceBreakdown: z.lazy(() => SourceBreakdownSchema),
});
```

- [ ] **Step 3.4**: Update `digestJSONSchema` (the JSON Schema object for Claude tool use) to match the new Zod schema. Remove breakthroughs, contradictions, executiveSummary, laymanSummary, researchPulse, worthRevisiting. Add whatsNew, notableFindings (with isNew), forYourDoctor.

- [ ] **Step 3.5**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 2: AI Prompt
**File**: `backend/src/services/ai.service.ts`

- [ ] **Step 3.6**: Rewrite the system prompt (lines 650-798) for the 6-section structure. Key changes:
  - Remove MAGAZINE EDITORIAL FORMAT section → replace with streamlined 6-section instructions
  - Remove COMPANION INTELLIGENCE section (researchPulse, worthRevisiting)
  - Add TEMPORAL CONTEXT section (from Pillar 2)
  - Add DIVERSITY INSTRUCTION: "Include at least 1 finding from each research category that has 5+ findings. Reference categoryGroups from the pre-analysis."
  - Add CONFLICTS INSTRUCTION: "Do NOT force contradictions. Only include conflicts in forYourDoctor when genuinely supported by evidence from different findings. Return empty array if none exist."
  - WHAT'S NEW instructions: "Write 2-3 sentences in warm companion voice. Address the user directly with 'Your'. Reference specific counts of [NEW] findings. Highlight the single most significant new development."
  - NOTABLE FINDINGS: "Mark each finding's `isNew` as true if it has a [NEW] tag in the data. Order by clinical significance. Include diversity across research categories."

- [ ] **Step 3.7**: Update the user message (lines 801-828) to request the 6 sections.

- [ ] **Step 3.8**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 3: AI Return Value
**File**: `backend/src/services/ai.service.ts`

- [ ] **Step 3.9**: Update the Zod validation of Claude's response to use the new `SmartDigestSchema`. Update field access from old names to new names throughout the function.

- [ ] **Step 3.10**: Update fallback/recovery logic for fewer sections. Ensure fallback generates valid `whatsNew`, `forYourDoctor` objects.

- [ ] **Step 3.11**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 4: DB Storage (background processor)
**File**: `backend/src/services/digest-processor.service.ts`

- [ ] **Step 3.12**: Update the INSERT statement (lines 236-289) to use new columns:
  - Replace `executive_summary`, `layman_summary` with `whats_new`
  - Replace `breakthroughs`, `contradictions`, `questions_for_doctor`, `warning_signs` with `notable_findings`, `for_your_doctor`
  - Remove `research_pulse`, `worth_revisiting`
  - Keep `key_takeaways`, `featured_discovery`, `top_findings` (renamed to `notable_findings`), `source_breakdown`, `finding_ids`, `metadata`

- [ ] **Step 3.13**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 5+8: DB Model
**File**: `backend/src/models/digest.model.ts`

- [ ] **Step 3.14**: Update the `Digest` TypeScript interface:
  - Remove: `executive_summary`, `layman_summary`, `breakthroughs`, `contradictions`, `research_pulse`, `worth_revisiting`
  - Add: `whats_new`, `notable_findings`, `for_your_doctor`
  - Keep: `key_takeaways`, `featured_discovery`, `source_breakdown`

- [ ] **Step 3.15**: Update the `create()` method column list to match.

- [ ] **Step 3.16**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 6: CRUD Zod Validation
**File**: `backend/src/routes/digests.crud.routes.ts`

- [ ] **Step 3.17**: Update `CreateDigestSchema` — add `whats_new`, `notable_findings`, `for_your_doctor`. Remove old field names. **This is critical — Zod strips unknown fields silently.**

- [ ] **Step 3.18**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 7+10: Frontend Transform
**File**: `src/services/digest.service.ts`

- [ ] **Step 3.19**: Update `transformToFrontend()` — map `whats_new` → `whatsNew`, `notable_findings` → `notableFindings`, `for_your_doctor` → `forYourDoctor`. Remove old field mappings.

- [ ] **Step 3.20**: Update `transformToBackend()` — reverse mapping.

- [ ] **Step 3.21**: Build verify: `npm run build`

#### Layer 9: API Route SELECT
**File**: `backend/src/routes/digest.routes.ts`

- [ ] **Step 3.22**: Update any SELECT column aliases for new names. Ensure GET route returns new fields.

- [ ] **Step 3.23**: Build verify: `cd backend && npx tsc --noEmit`

#### Layer 11: Frontend Types
**File**: `src/types/index.ts`

- [ ] **Step 3.24**: Update `SmartDigest` interface:
```typescript
interface SmartDigest {
  // ... existing fields (id, topicId, generatedAt, etc.)
  whatsNew: { technical: string; explained: string };
  featuredDiscovery: FeaturedDiscovery;
  keyTakeaways: DualModeText[];
  notableFindings: NotableFinding[];
  forYourDoctor: ForYourDoctor;
  sourceBreakdown: SourceBreakdown;
  // ... statistics, cacheMetadata
}

interface NotableFinding {
  findingId: string;
  sourceType: 'pubmed' | 'clinical_trial' | 'fda' | 'web';
  isNew: boolean;
  technical: { title: string; summary: string };
  explained: { title: string; summary: string };
  metadata: string;
}

interface ForYourDoctor {
  questions: DualModeText[];
  watchFor: DualModeText[];
  conflicts?: Conflict[];
}

interface Conflict {
  topic: DualModeText;
  explanation: DualModeText;
  sources: string[];
}
```

- [ ] **Step 3.25**: Remove: `Breakthrough`, `Contradiction`, `WorthRevisiting` types
- [ ] **Step 3.26**: Build verify: `npm run build`

#### Layer 12: UI Rendering
**File**: `src/components/DigestCard.tsx`

- [ ] **Step 3.27**: Restructure the component to render 5 sections (plus inline pills):

1. **Header Card** — keep existing: Brain icon, "Research Digest", cache status, explanation mode toggle, source breakdown inline pills. Add **What's New** section inside the header card: 2-3 sentences, respects `explanationMode`.

2. **Featured Discovery** — keep existing `<FeaturedDiscovery>` component as-is.

3. **Key Takeaways** — keep existing collapsible card as-is.

4. **Notable Findings** — update to use `notableFindings` instead of `topFindings`. Add `NEW` chip for findings where `isNew === true`. Keep source filter tabs. Keep `FindingSummaryCard` component.

5. **For Your Doctor** — single collapsible card with 3 subsections:
   - "Questions to Ask" (reuse existing questionsForDoctor UI pattern)
   - "Watch For" (reuse existing warningSigns UI pattern)
   - "Conflicting Findings" (only if `conflicts.length > 0`, simplified display)

- [ ] **Step 3.28**: Remove old sections: Breakthroughs card, standalone Contradictions card, standalone Warning Signs card. Remove `DIGEST_SECTION_IDS` for removed sections.

- [ ] **Step 3.29**: Build verify: `npm run build`

#### Home Dashboard Updates

- [ ] **Step 3.30**: Transform `src/components/home/ResearchPulseCard.tsx`:
  - Rename to `WhatsNewCard.tsx` (or update internal references)
  - Change `signpost.researchPulse` → read `whatsNew.explained` from the digest signpost data
  - Remove the `worthRevisiting` section and related rendering
  - Keep the topic header, "Open digest →" link, and timestamp
  - Update the `formatPulse()` function to work with the new `whatsNew` text format

- [ ] **Step 3.31**: Delete `src/components/home/WorthRevisitingModal.tsx`

- [ ] **Step 3.32**: Update `src/components/HomePage.tsx`:
  - Update imports (ResearchPulseCard → WhatsNewCard)
  - Remove `WorthRevisitingModal` import and usage
  - Remove `handleWorthRevisitingClick` and related state
  - Remove `worthRevisiting` modal from UI

- [ ] **Step 3.33**: Update `src/components/home/index.ts` exports if needed

- [ ] **Step 3.34**: Update the dashboard stats API (`backend/src/routes/dashboard.routes.ts` or equivalent) to return `whatsNew` instead of `researchPulse` in digest signposts

- [ ] **Step 3.35**: Build verify: `npm run build`

---

## Database Migration SQL

Run via `docker exec medcompanion-postgres psql -U meduser -d medcompanion` after deployment:

```sql
-- Pillar 2: temporal tracking
ALTER TABLE topics ADD COLUMN IF NOT EXISTS last_digest_viewed_at TIMESTAMPTZ;

-- Pillar 3: new digest columns
ALTER TABLE digests ADD COLUMN IF NOT EXISTS whats_new JSONB;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS notable_findings JSONB;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS for_your_doctor JSONB;

-- Drop old columns (user will delete and re-add topics)
ALTER TABLE digests DROP COLUMN IF EXISTS executive_summary;
ALTER TABLE digests DROP COLUMN IF EXISTS layman_summary;
-- key_takeaways KEPT (unchanged)
ALTER TABLE digests DROP COLUMN IF EXISTS breakthroughs;
ALTER TABLE digests DROP COLUMN IF EXISTS contradictions;
ALTER TABLE digests DROP COLUMN IF EXISTS research_pulse;
ALTER TABLE digests DROP COLUMN IF EXISTS worth_revisiting;
```

---

## Deployment Steps

1. `ssh chee@100.94.82.35`
2. `cd /home/chee/medical-pwa`
3. `git pull`
4. `docker compose down && docker compose up -d --build`
5. Run migration SQL (see above)
6. User: delete existing topics and re-add them
7. Trigger agent run + digest generation to verify new format

---

## Verification Checklist

### Pillar 1: PubMed Parser ✅
- [x] `cd backend && npx tsc --noEmit` passes cleanly
- [x] `npm run build` passes cleanly
- [ ] After deployment + scheduler run: `docker logs medical-companion --tail 100 2>&1` shows different titles per article
- [ ] PubMed findings in DB have distinct titles (not duplicates)
- [ ] AI prompts include publication dates (no longer empty `Date:` lines)

### Pillar 2: Temporal Awareness
- [ ] First digest for a new topic: all findings tagged `[NEW]`, whatsNew says "first digest"
- [ ] Second digest (after agents find more findings): whatsNew references specific count of new findings
- [ ] User-away enrichment: manually set `last_digest_viewed_at` to 7 days ago, GET digest, verify whatsNew says "N new in your 7 days away"
- [ ] Daily user: whatsNew shows AI's original text unchanged

### Pillar 3: Section Consolidation
- [ ] `npm run build` passes cleanly
- [ ] DigestCard renders 5 visual sections: What's New, Featured Discovery, Key Takeaways, Notable Findings, For Your Doctor
- [ ] Source breakdown pills show in header
- [ ] Notable Findings show `NEW` chip on recent findings
- [ ] Source filter tabs work on Notable Findings
- [ ] For Your Doctor: Questions and Watch For sections render. Conflicts only show if data exists.
- [ ] Key Takeaways collapsible toggle works
- [ ] Explanation mode toggle switches all dual-mode content
- [ ] Home dashboard: WhatsNewCard shows `whatsNew.explained` from latest digest
- [ ] Home dashboard: No WorthRevisiting modal or references

---

## Rollback Plan

### Pillar 1
Revert `agent-execution.service.ts` to previous version. No DB changes to undo.

### Pillar 2
```sql
ALTER TABLE topics DROP COLUMN IF EXISTS last_digest_viewed_at;
```
Revert 4 backend files.

### Pillar 3
```sql
ALTER TABLE digests ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS layman_summary TEXT;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS breakthroughs JSONB;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS contradictions JSONB;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS research_pulse TEXT;
ALTER TABLE digests ADD COLUMN IF NOT EXISTS worth_revisiting JSONB;
ALTER TABLE digests DROP COLUMN IF EXISTS whats_new;
ALTER TABLE digests DROP COLUMN IF EXISTS notable_findings;
ALTER TABLE digests DROP COLUMN IF EXISTS for_your_doctor;
```
Revert all frontend and backend files. User would need to regenerate digests.

---

## Sign-Off

| Pillar | Completed | Date | Notes |
|--------|-----------|------|-------|
| 1 - PubMed Fix | [x] | 2026-02-11 | Block-splitting parser + PubMedArticle interface + buildAIPrompt date fix |
| 2 - Temporal Awareness | [x] | 2026-02-11 | previousDigestDate threading, [NEW] tags in Pass 1+2, TEMPORAL CONTEXT prompt, view tracking, countSince + updateLastDigestViewed infra. whatsNew enrichment deferred to Pillar 3. |
| 3 - Section Consolidation | [x] | 2026-02-11 | 12-layer pipeline complete: 6 sections (whatsNew, featuredDiscovery, keyTakeaways, notableFindings, forYourDoctor, sourceBreakdown). All sections expanded by default. TOC scroll offset fixed. |
| Deployment | [x] | 2026-02-11 | Docker rebuild + migration SQL (3 new columns, 6+7 old columns dropped). Digest cache HIT working. |
| Verification | [x] | 2026-02-11 | Logs clean (zero errors). Digest renders 5 sections. NEW chips on findings. Home dashboard shows whatsNew. Scheduled runs pending sanity check. |
