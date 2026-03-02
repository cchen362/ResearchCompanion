# Plan 026: Chat Citation Enhancement — Remove 50-Finding Cap

## STOP: Read This Entire Document Before Making Any Changes

The chat system caps findings context to the **50 most recent** findings. Users with 60-70+ findings per topic (growing ~30-50/month) cannot ask about older findings — the AI responds "I don't have information about that" even though the finding exists in the user's research.

| Issue | Symptom | Root Cause |
|-------|---------|------------|
| **50-finding cap** | AI can't reference older findings in chat | `allFindings.slice(0, 50)` in ChatPanel.tsx and `limit: 50` in backend fallback |
| **Wasted bandwidth** | Frontend downloads ALL findings, discards 51+ | `getFindings()` has no limit but result is sliced to 50 |
| **POST body bloat** | Full finding content sent over network | Backend only uses first 200 chars of content, but frontend sends full text |

**Approach**: Remove the 50-finding cap entirely for topics with ≤200 findings. For >200 findings, use tiered context (first 100 get full detail, remaining get title+source index). No Haiku scoring, no new DB tables, no new endpoints, no added latency.

**Prerequisite**: Plan 020 COMPLETE (two-pass digest architecture), Plan 025 COMPLETE

---

## Strict Rules

### MUST DO
- [ ] Follow phases IN ORDER (1 → 2)
- [ ] Run `cd backend && npx tsc --noEmit` after Phase 2 backend changes
- [ ] Run `npm run build` after Phase 1 frontend changes
- [ ] Verify existing conversation citation stability after changes
- [ ] Pre-truncate content in frontend to 250 chars (backend only uses 200)

### MUST NOT DO
- [ ] Do NOT add Haiku scoring to the chat path — this must work without AI pre-processing
- [ ] Do NOT create new DB columns, tables, or endpoints
- [ ] Do NOT change `createCitationMapping()` — it already handles any number of findings
- [ ] Do NOT change `extractCitations()` — it already handles any citation number
- [ ] Do NOT modify `chat.service.ts` — it's a pure transport layer

---

## Background: Current Architecture

### Data Flow (Current)

```
ChatPanel.tsx:152  ──── findingsService.getFindings(topicId) ──── ALL findings (no limit)
ChatPanel.tsx:153  ──── allFindings.slice(0, 50) ──────────────── 50 most recent only ⚠️
ChatPanel.tsx:158  ──── Transform to { id, title, content, source, type, ... }
ChatPanel.tsx:168  ──── POST to /api/chat/stream with findings + citationMap + messages
                         │
chat.routes.ts:712 ──── enrichFindingsContext(): if frontend sent findings, use directly
chat.routes.ts:729 ──── Fallback: fetch from DB with limit: 50 ⚠️
chat.routes.ts:410 ──── createCitationMapping(): assign [1], [2], ... to each finding
chat.routes.ts:477 ──── buildSystemPrompt(): [N] Source/Title/Content(200chars) per finding
```

### Token Budget Analysis

Each finding in the system prompt = ~50 tokens (title + source + 200-char content truncation).

| Scenario | Findings | Prompt Tokens | % of 200K | Cost/msg |
|----------|----------|--------------|-----------|----------|
| Current | 50 full | ~3,100 | 1.6% | ~$0.002 |
| 70 full (typical now) | 70 full | ~4,100 | 2.1% | ~$0.003 |
| 150 full | 150 full | ~8,100 | 4.1% | ~$0.005 |
| 100 full + 100 index | 200 total | ~7,600 | 3.8% | ~$0.005 |

All well within limits. The tiered approach only activates beyond 200 findings.

### Why NOT Haiku Scoring for Chat?

Plan 020's two-pass architecture works great for digests (batch, not time-sensitive) but is wrong for chat:
- **Latency**: Haiku scoring adds 10-30s before first streaming token. Chat must feel instant.
- **Cost**: $0.03-0.12 per message just for scoring. Digests run once/day; chat runs per-message.
- **Unnecessary**: Chat is question-answering (find 2-5 relevant findings), not editorial synthesis (weigh all findings). LLMs are good at retrieval from context — a flat list of 100-200 findings is fine.

---

## Cross-Feature Impact Analysis

### Citation Mapping — NO IMPACT
`createCitationMapping()` (chat.routes.ts:380) already handles arbitrary finding counts. It assigns incrementing numbers and preserves existing mappings via the `citationMap` persisted in conversation context. Expanding from 50 to all findings simply means new findings get numbers 51+.

### Existing Conversations — BACKWARD COMPATIBLE
Citation numbers already assigned in ongoing conversations remain stable. The `citationMap` is stored per-conversation and sent with each message. New findings appearing after the cap is raised simply get the next available citation numbers.

### Chat Service — NO IMPACT
`chat.service.ts` is a pure transport layer — it serializes whatever `context` it receives in the POST body. No changes needed.

### Findings Service — NO IMPACT
`findingsService.getFindings(topicId)` already returns ALL findings without limit. The cap was applied after the fetch in ChatPanel.tsx.

---

## Files Modified Summary

| File | Change | Phase |
|------|--------|-------|
| `src/components/ChatPanel.tsx` | Remove `slice(0,50)`, add tiered transform with pre-truncation | 1 |
| `backend/src/routes/chat.routes.ts` | Add `tier` to Zod schema | 2 |
| `backend/src/routes/chat.routes.ts` | Tiered rendering in `buildSystemPrompt()` | 2 |
| `backend/src/routes/chat.routes.ts` | Update `enrichFindingsContext()` limits + add tier | 2 |

---

## Phase 1: Frontend — Remove Cap & Add Tiered Transform

**File**: `src/components/ChatPanel.tsx` (lines 149-173)

### Step 1.1: Replace `slice(0, 50)` with tiered logic

**Current code** (lines 149-166):
```typescript
// 2. Load findings for AI context
let topicFindings: any[] = [];
try {
  const allFindings = await findingsService.getFindings(topicId);
  topicFindings = allFindings.slice(0, 50);
} catch (e) {
  logger.warn('[ChatPanel] Could not load findings for context');
}

const transformedFindings = topicFindings.map((f: any) => ({
  id: f.id,
  title: f.title || '',
  content: f.details || f.summary || '',
  source: f.source?.displayName || f.source?.name || 'Unknown Source',
  type: f.type || 'research',
  createdAt: f.timestamp ? new Date(f.timestamp).toISOString() : new Date().toISOString(),
  priority: f.priority || 'medium'
}));
```

**New code**:
```typescript
// 2. Load findings for AI context (all findings, tiered for >200)
let transformedFindings: any[] = [];
try {
  const allFindings = await findingsService.getFindings(topicId);
  const FULL_DETAIL_CAP = 100;
  const TOTAL_CAP = 200;

  const findingsToUse = allFindings.length > TOTAL_CAP
    ? allFindings.slice(0, TOTAL_CAP)
    : allFindings;

  transformedFindings = findingsToUse.map((f: any, index: number) => ({
    id: f.id,
    title: f.title || '',
    // Pre-truncate: backend only uses 200 chars; index-only findings send empty
    content: index < FULL_DETAIL_CAP
      ? (f.details || f.summary || '').substring(0, 250)
      : '',
    source: f.source?.displayName || f.source?.name || 'Unknown Source',
    type: f.type || 'research',
    createdAt: f.timestamp ? new Date(f.timestamp).toISOString() : new Date().toISOString(),
    priority: f.priority || 'medium',
    ...(index >= FULL_DETAIL_CAP ? { tier: 'index' } : {})
  }));
} catch (e) {
  logger.warn('[ChatPanel] Could not load findings for context');
}
```

### Step 1.2: Update context object

The `context` object (line ~168-173) references `topicFindings` which no longer exists:

```typescript
// BEFORE:
currentFindings: topicFindings.map((f: any) => f.id),

// AFTER:
currentFindings: transformedFindings.map((f: any) => f.id),
```

The `findings: transformedFindings` line stays the same.

### Step 1.3: Build Check

```bash
npm run build
```

**Design choices**:
- `tier` field only set on index-only findings (omitted = full detail) — backward compatible with in-flight requests during deployment
- Content pre-truncated to 250 chars to reduce POST body size (backend truncates to 200 anyway)
- Index-only findings get `content: ''` — saves bandwidth, backend renders title-only
- `topicFindings` variable eliminated; `transformedFindings` declared at the outer scope

- [ ] Step 1.1 complete
- [ ] Step 1.2 complete
- [ ] Step 1.3 build passes

---

## Phase 2: Backend — Tiered Prompt Rendering & Fallback Limits

**File**: `backend/src/routes/chat.routes.ts`

### Step 2.1: Add `tier` to Zod schema (line ~23)

The Zod schema silently strips unknown fields. Add `tier` so it's preserved:

```typescript
// In ChatRequestSchema → context → findings array object schema:
// After the priority field (line 23), add:
tier: z.enum(['full', 'index']).optional()
```

### Step 2.2: Update `buildSystemPrompt()` for tiered rendering (lines ~467-492)

Replace the single forEach loop with tiered rendering:

```typescript
// REPLACE the findingsWithNumbers.forEach block (lines ~477-489) with:

// Separate full-detail and index-only findings
const fullDetailFindings = findingsWithNumbers.filter(
  ({ finding }: any) => finding.tier !== 'index'
);
const indexOnlyFindings = findingsWithNumbers.filter(
  ({ finding }: any) => finding.tier === 'index'
);

// Full-detail: existing format (no change in rendering)
fullDetailFindings.forEach(({ finding, citationNumber }: any) => {
  const sourceInfo = finding.source || 'Unknown Source';
  const title = finding.title || 'Untitled';
  const content = finding.content || finding.summary || '';

  prompt += `\n\n[${citationNumber}]`;
  prompt += `\nSource: ${sourceInfo}`;
  prompt += `\nTitle: ${title}`;
  if (content) {
    prompt += `\nContent: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
  }
});

// Index-only: compact one-line format
if (indexOnlyFindings.length > 0) {
  prompt += `\n\n--- Additional Research Index (${indexOnlyFindings.length} findings, title only) ---`;
  prompt += `\nYou may cite these by number. Note when detailed information is limited.\n`;
  indexOnlyFindings.forEach(({ finding, citationNumber }: any) => {
    prompt += `\n[${citationNumber}] ${finding.title || 'Untitled'} (${finding.source || 'Unknown'})`;
  });
}
```

Also update the REMINDER text (line ~491-492):

```typescript
// BEFORE:
prompt += `\n\nREMINDER: You have exactly ${citationMap.size} findings available with citation numbers from [1] to [${citationMap.size}].`;

// AFTER:
prompt += `\n\nREMINDER: You have ${fullDetailFindings.length} detailed findings and ${indexOnlyFindings.length} indexed findings (${citationMap.size} total). Use citation numbers shown above.`;
```

### Step 2.3: Update `enrichFindingsContext()` fallback limits

Two places where `limit: 50` is hardcoded:

**Line ~729** (primary fallback):
```typescript
// BEFORE:
limit: 50  // CRITICAL: This must match the frontend limit in ChatPanel.tsx

// AFTER:
limit: 200  // Match frontend cap — tiering handled by buildSystemPrompt
```

**Line ~789** (secondary fallback, fills gaps):
```typescript
// BEFORE:
limit: 50

// AFTER:
limit: 200
```

Also add the `tier` field when the backend constructs findings from DB (in the `topicFindings.map()` at ~line 736):

```typescript
// BEFORE:
findings: topicFindings.map(f => ({
  id: f.id,
  title: f.title,
  content: f.content || f.summary || '',
  source: f.source?.displayName || f.source?.name || 'Unknown Source',
  type: f.category || 'research',
  createdAt: f.created_at,
  priority: f.relevance_score ? (f.relevance_score > 0.7 ? 'high' : f.relevance_score > 0.4 ? 'medium' : 'low') : 'medium'
}))

// AFTER:
findings: topicFindings.map((f, index) => ({
  id: f.id,
  title: f.title,
  content: index < 100 ? (f.content || f.summary || '').substring(0, 250) : '',
  source: f.source?.displayName || f.source?.name || 'Unknown Source',
  type: f.category || 'research',
  createdAt: f.created_at,
  priority: f.relevance_score ? (f.relevance_score > 0.7 ? 'high' : f.relevance_score > 0.4 ? 'medium' : 'low') : 'medium',
  ...(index >= 100 ? { tier: 'index' as const } : {})
}))
```

### Step 2.4: Build Check

```bash
cd backend && npx tsc --noEmit
```

- [ ] Step 2.1 complete
- [ ] Step 2.2 complete
- [ ] Step 2.3 complete
- [ ] Step 2.4 build passes

---

## What Does NOT Change

| Component | Why No Change |
|-----------|--------------|
| `createCitationMapping()` (chat.routes.ts:380) | Already handles any number of findings with incrementing numbers |
| `extractCitations()` (chat.routes.ts:506) | Already handles any citation number |
| `chat.service.ts` | Pure transport layer — serializes whatever context it receives |
| `findings.service.ts` | `getFindings(topicId)` already returns all findings without limit |
| `chatStore.ts` | Navigation + streaming state only — no findings logic |
| Database schema | No new columns, tables, or migrations needed |

---

## Verification

### Build Checks
1. `cd backend && npx tsc --noEmit` — passes
2. `npm run build` — passes

### Functional Checks
3. Open chat with a topic that has 60+ findings
4. Ask about a finding that's NOT in the newest 50 — AI should reference it with correct citation
5. Verify citation numbers are stable across messages (check `citationMap` in SSE metadata)
6. Check that clicking a citation number still opens the correct source finding
7. Docker logs should show `Including N findings with stable citation numbers` where N > 50
8. No console errors in browser or backend

### Grep Verification
9. `grep -r "slice(0, 50)" src/components/ChatPanel.tsx` — 0 results
10. `grep -r "limit: 50" backend/src/routes/chat.routes.ts` — 0 results

### Edge Case Testing
11. New conversation on a topic with 60 findings — all 60 should appear in context
12. Existing conversation (started before this change) — should still work, old citations stable
13. If a topic ever has 200+ findings — verify tiering works (first 100 full, rest index)

---

## Deployment

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull origin feat/ui-overhaul
docker compose down && docker compose up -d --build
docker logs medical-companion --tail 50 2>&1
```

No DB migration needed — no new columns.

---

## Sign-Off

- [ ] Phase 1 complete (frontend cap removal + tiered transform)
- [ ] Phase 2 complete (backend tiered prompt + fallback limits)
- [ ] Backend compiles (`npx tsc --noEmit`)
- [ ] Frontend builds (`npm run build`)
- [ ] Deployed and verified
- [ ] Chat quality verified (older findings now citable)
- [ ] Date: ___________

*Plan created: March 2, 2026*
*Depends on: Plan 020 (COMPLETE), Plan 025 (COMPLETE)*
*Origin: Plan 020 Future Focus section — Chat Citation Enhancement*
