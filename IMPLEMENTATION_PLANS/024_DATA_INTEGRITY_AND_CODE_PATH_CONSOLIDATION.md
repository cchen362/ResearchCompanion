# Plan 024: Data Integrity & Code Path Consolidation

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan fixes data integrity issues, eliminates duplicate/inconsistent API code paths, and removes confirmed dead code discovered during the Feb 19, 2026 comprehensive audit. Organized into 5 groups by dependency order.

| Group | Risk | Files | DB Changes |
|-------|------|-------|------------|
| 1 — Chat citation hardening | LOW (additive logging, no behavior change) | 1 | None |
| 2 — Source type parity | LOW (fixing categorization alignment) | 1 | None |
| 3 — API parameter consolidation | MEDIUM (refactoring agent-execution to delegate to search.service) | 2 | None |
| 4 — Dead code removal | ZERO (confirmed 0 frontend callers) | 2 deleted, 1 modified | None |
| 5 — Finding dedup hardening | LOW (additive fallback, new DB query method) | 2 | None |

**Prerequisite**: Plan 023 (Backend Refactor & Dead Code Cleanup) must be COMPLETE — it is (commit `cb53392`).

---

## Strict Rules

### MUST DO
- [ ] Follow groups IN ORDER (1 → 2 → 3 → 4 → 5)
- [ ] Run `cd backend && npx tsc --noEmit` after every backend file change
- [ ] Run `npm run build` (frontend) after completing all groups
- [ ] Read the referenced file and line numbers BEFORE making each change
- [ ] Verify each deletion candidate has zero importers before deleting

### MUST NOT DO
- [ ] Do NOT change the auth middleware or JWT handling
- [ ] Do NOT modify database schema or run migrations
- [ ] Do NOT change the chat streaming SSE protocol
- [ ] Do NOT add new npm dependencies
- [ ] Do NOT change any UI components (this plan is backend/service-only)
- [ ] Do NOT delete `agent-execution.service.ts` — it IS actively used by `scheduler.service.ts`
- [ ] Do NOT modify `scheduler.service.ts` — its interface with `AgentExecutionService` must remain unchanged

---

## Audit Context

**What triggered this plan**: Comprehensive data integrity audit on Feb 19, 2026 covering:
- Production DB sampling (47 findings, 2 topics, 4 users)
- All 97 DB queries audited for user_id filtering (100% pass)
- Cross-user isolation verified (0 leaks found)
- Chat citation quality verified (defense-in-depth needed)
- 3 API code paths compared parameter-by-parameter (2 inconsistencies found)
- Frontend vs backend logic parity checked (3 confirmed drifts)

**What was already clean**:
- ClinicalTrials.gov `query.cond` — fixed in commit `fad2d62`, verified correct in all paths
- Cross-user data isolation — 100% of queries filter by user_id
- Findings quality — all 34 original Acromegaly findings are topically relevant
- SQL injection — all 97 queries use parameterized values

**What the chat citation issue actually was**:
The bad chat response (dementia/transplant citations for Acromegaly) was caused by **junk findings from the old query.term bug** that existed in the DB at chat time. The citation system correctly mapped `[3]` → finding #3, but finding #3 itself was irrelevant junk. The `query.cond` fix + finding cleanup resolved the root cause. Group 1 adds defense-in-depth only.

---

## Files Modified

| File | Group | Changes |
|------|-------|---------|
| `backend/src/routes/chat.routes.ts` | 1 | Remove Finding IDs from system prompt, add stale-map warning |
| `backend/src/services/digest-processor.service.ts` | 2 | Add `medical_site` to `countSourcesByType()` |
| `backend/src/services/agent-execution.service.ts` | 3 | Replace inline PubMed/Brave search methods with delegation to `searchService` |
| `backend/src/index.ts` | 4 | Remove dead route registration and false startup docs |
| `backend/src/models/finding.model.ts` | 5 | Add `existsByTitleAndSource()` method |
| `backend/src/services/agent-execution.service.ts` | 5 | Add title+source fallback dedup |

## Files Deleted

| File | Group | Reason |
|------|-------|--------|
| `backend/src/routes/agent.ts` | 4 | 155 lines, `/run-agent` endpoint never called from frontend. Grep `run-agent` across `src/` returns 0 results |

---

## Group 1: Chat Citation Hardening

### Background

The chat citation system works correctly: `enrichFindingsContext()` fetches findings filtered by `user_id` AND `topic_id`, and `extractCitations()` maps `[N]` numbers to findings via the citation map.

The observed bad chat response was caused by **stale junk findings from the query.term bug**, not a citation system defect. However, two defense-in-depth improvements are worthwhile:

1. **Finding UUIDs are exposed to Claude in the system prompt** (line 482) — serves no purpose and wastes tokens
2. **No logging when a citation map entry points to a deleted finding** — makes debugging harder

### Step 1.1: Remove Finding IDs from system prompt

**File**: `backend/src/routes/chat.routes.ts` line 482

Claude only needs `[N]`, source, title, and content. The raw UUID wastes ~40 tokens per finding and serves no purpose.

**Current**:
```typescript
      prompt += `\n\n[${citationNumber}] - Finding ID: ${finding.id}`;
      prompt += `\nSource: ${sourceInfo}`;
      prompt += `\nTitle: ${title}`;
```

**Change to**:
```typescript
      prompt += `\n\n[${citationNumber}]`;
      prompt += `\nSource: ${sourceInfo}`;
      prompt += `\nTitle: ${title}`;
```

- [ ] Remove ` - Finding ID: ${finding.id}` from line 482
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 1.2: Add stale-map warning log

**File**: `backend/src/routes/chat.routes.ts` inside `extractCitations()`, after line 565

When a citation number maps to a findingId via the reverse map but `findings.find()` can't locate it, log a warning. This makes it easy to diagnose future "phantom citation" issues.

**After** line 565 (`finding = findings.find(f => f.id === findingId);`), add:
```typescript
      if (!finding) {
        logger.warn(`[chat.routes] extractCitations: Citation [${citationNum}] mapped to findingId ${findingId.substring(0, 8)}... but finding not in current context (stale map or deleted finding)`);
      }
```

- [ ] Add stale-map warning log after line 565
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

## Group 2: Source Type Parity Fix

### Background

Backend `countSourcesByType()` in `digest-processor.service.ts` is missing the `medical_site` → `clinical_trial` mapping that frontend `getSourceCategory()` has. This causes digest source breakdown metrics to count ClinicalTrials.gov findings (stored as `medical_site`) under `web` instead of `clinicalTrials`.

The `research_article` and `web_article` types (produced by `agent-execution.service.ts`) are already handled correctly by both frontend and backend via `includes('research')` matching. **Verify only** — no change needed for those.

### Step 2.1: Fix backend source categorization

**File**: `backend/src/services/digest-processor.service.ts` lines 38-41

**Current**:
```typescript
    } else if (sourceType.includes('clinical') || sourceType.includes('trial')) {
      breakdown.clinicalTrials++;
    }
```

**Change to**:
```typescript
    } else if (sourceType.includes('clinical') || sourceType.includes('trial') || sourceType === 'medical_site') {
      breakdown.clinicalTrials++;
    }
```

**Why**: Frontend `getSourceCategory()` in `src/utils/sourceCategory.ts` line 20 maps `medical_site` → `clinical_trial`. ClinicalTrials.gov findings are stored with `source.type = 'medical_site'` by the frontend agent path (`src/services/agents.service.ts` line 808).

- [ ] Add `|| sourceType === 'medical_site'` to the clinical trial condition
- [ ] Build verify: `cd backend && npx tsc --noEmit`

### Step 2.2: Verify legacy types are handled (no code change)

Verify the `includes('research')` check handles `research_article` and the default handles `web_article`:

- [ ] Confirm `research_article` → `sourceType.includes('research')` matches → `pubmed++` ✅
- [ ] Confirm `web_article` → falls through to `web++` ✅
- [ ] Confirm frontend `getSourceCategory('research_article')` → `s.includes('research')` → `'pubmed'` ✅
- [ ] Confirm frontend `getSourceCategory('web_article')` → falls through → `'web'` ✅
- [ ] Mark as verified — no code change

---

## Group 3: API Parameter Consolidation

### Background

**CRITICAL ARCHITECTURE CONTEXT**: `agent-execution.service.ts` is **NOT dead code**. It is actively imported by `scheduler.service.ts` (line 21) and called via `this.executionService.runAgentsForTopic()` (line 205). The scheduler runs every 15 minutes in production for autonomous agent execution.

There are two live API code paths with inconsistent parameters:

| Parameter | `agent-execution.service.ts` (scheduler path) | `search.service.ts` (manual/"Run Now" path) |
|-----------|-----------------------------------------------|----------------------------------------------|
| PubMed `reldate` | **NONE** (searches all articles ever) | `365` (1 year) |
| PubMed `sort` | `relevance` | `relevance` |
| Brave query suffix | `' medical research'` | `' medical research peer-reviewed journal study'` |
| Brave `freshness` | **NONE** (any age) | `'py'` (past year) |
| ClinicalTrials param | `query.cond` ✅ | `query.cond` ✅ |

**Strategy**: Refactor `agent-execution.service.ts` to delegate its search methods to `searchService` from `search.service.ts`, eliminating duplicate implementations. Keep the `AgentExecutionService` class and its public API unchanged so `scheduler.service.ts` doesn't need modification.

### Step 3.1: Import searchService into agent-execution.service.ts

**File**: `backend/src/services/agent-execution.service.ts`

Add import at the top of the file (after existing imports):

```typescript
import { searchService } from './search.service.js';
```

- [ ] Add the import
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 3.2: Replace `searchPubMed()` with delegation

**File**: `backend/src/services/agent-execution.service.ts` — the `private async searchPubMed()` method (approx. lines 230-271)

Replace the entire method body with delegation to `searchService`:

```typescript
  private async searchPubMed(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('pubmed');
    try {
      return await searchService.searchPubMed(query, maxResults);
    } catch (error) {
      console.error('[AgentExecution] PubMed search error:', error);
      return [];
    }
  }
```

**What this fixes**: Inherits `reldate=365` from `search.service.ts` instead of having no date filter.

- [ ] Replace `searchPubMed()` method body
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 3.3: Replace `searchWeb()` with delegation

**File**: `backend/src/services/agent-execution.service.ts` — the `private async searchWeb()` method (approx. lines 300-328)

Replace the entire method body with delegation to `searchService`:

```typescript
  private async searchWeb(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('web');
    try {
      return await searchService.searchWeb(query, maxResults);
    } catch (error: any) {
      console.error(`[AgentExecution] Web search error:`, error.message || error);
      return [];
    }
  }
```

**What this fixes**: Inherits `freshness='py'` and the fuller query modifiers from `search.service.ts`.

- [ ] Replace `searchWeb()` method body
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 3.4: Replace `searchClinicalTrials()` with delegation

**File**: `backend/src/services/agent-execution.service.ts` — the `private async searchClinicalTrials()` method (approx. lines 276-295)

Replace the entire method body with delegation to `searchService`:

```typescript
  private async searchClinicalTrials(query: string, maxResults: number): Promise<any[]> {
    await this.enforceRateLimit('clinical');
    try {
      return await searchService.searchClinicalTrials(query);
    } catch (error) {
      console.error('[AgentExecution] Clinical Trials search error:', error);
      return [];
    }
  }
```

**Note**: `searchService.searchClinicalTrials()` already uses `query.cond` correctly. Check its signature — it may not accept `maxResults` as a parameter (it may use an internal limit). Adjust the call accordingly.

- [ ] Check `searchService.searchClinicalTrials()` signature in `search.service.ts`
- [ ] Replace `searchClinicalTrials()` method body with delegation
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 3.5: Remove dead `parsePubMedXML()` method

**File**: `backend/src/services/agent-execution.service.ts`

After Step 3.2, the `parsePubMedXML()` private method (approx. lines 334-378) is no longer called. Remove it.

- [ ] Verify `parsePubMedXML` is only called from the old `searchPubMed()` method (which was just replaced)
- [ ] Delete the `parsePubMedXML()` method
- [ ] Remove the `PubMedArticle` interface if no longer referenced
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 3.6: Verify return type compatibility

**CRITICAL**: `searchService` methods may return data in a different shape than what `agent-execution.service.ts` expects downstream (in its `convertToFindings()` or `buildSource()` methods).

After replacing all three search methods, trace the data flow:
1. `searchService.searchPubMed()` returns → what format?
2. `agent-execution.service.ts` feeds search results into → `convertToFindings()` or similar
3. That method calls → `buildSource()` which expects specific fields

**If shapes differ**: Add a lightweight adapter in the replaced search methods to map `searchService` output to the format `agent-execution.service.ts` expects internally. Do NOT change `buildSource()` or `convertToFindings()`.

- [ ] Trace what `searchService.searchPubMed()` returns (read `search.service.ts`)
- [ ] Trace what `agent-execution.service.ts` does with search results after calling `searchPubMed()`
- [ ] If shapes match: no adapter needed ✅
- [ ] If shapes differ: add mapping in the delegating method to match expected format
- [ ] Build verify: `cd backend && npx tsc --noEmit`
- [ ] **Test**: Manually trigger the scheduler or backdate an agent's `last_run` to verify autonomous execution still works:
  ```sql
  UPDATE agents SET last_run = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE id = '<any-agent-id>';
  ```
  Then check logs: `docker logs medical-companion --tail 50 2>&1 | grep -i scheduler`

---

## Group 4: Dead Code Removal

### Background

| Target | Evidence of non-use |
|--------|---------------------|
| `backend/src/routes/agent.ts` (155 lines) | `grep -r "run-agent" src/` returns 0 frontend results. Route IS registered in `index.ts` line 118 but never called. |
| `index.ts` line 186-187 | Prints `/api/simplify-digest` (never existed) and `/api/run-agent` (dead route) |

**WARNING**: Do NOT delete `agent-execution.service.ts` — it IS imported by `scheduler.service.ts` line 21.

### Step 4.1: Verify zero frontend callers

```bash
# In project root:
grep -r "run-agent\|/run-agent\|/api/run-agent" src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results
```

- [ ] Run the grep command and confirm 0 results
- [ ] Document output here: _______________

---

### Step 4.2: Delete `agent.ts` route and remove registration

**File 1**: Delete `backend/src/routes/agent.ts`

**File 2**: `backend/src/index.ts` — remove two lines:
- Line 10: `import agentRoute from './routes/agent.js';`
- Line 118: `app.use('/api', authenticate, agentRoute);`

- [ ] Delete `backend/src/routes/agent.ts`
- [ ] Remove the import on line 10 of `backend/src/index.ts`
- [ ] Remove the `app.use` registration on line 118 of `backend/src/index.ts`
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 4.3: Fix false startup documentation

**File**: `backend/src/index.ts`

Remove lines that print non-existent or deleted endpoints:

- Line 186: `console.log('  - POST /api/simplify-digest');` → DELETE (endpoint never existed)
- Line 187: `console.log('  - POST /api/run-agent');` → DELETE (route deleted in Step 4.2)

- [ ] Remove the two false endpoint log lines
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

## Group 5: Finding Deduplication Hardening

### Background

Frontend agent dedup (`agents.service.ts` lines 483-504) has a fallback: when URLs are missing, it checks title + source name. The backend `agent-execution.service.ts` (scheduler path) only checks by URL via `FindingModel.existsBySourceUrl()` — when URL is null, dedup is skipped entirely.

### Step 5.1: Add `existsByTitleAndSource()` to FindingModel

**File**: `backend/src/models/finding.model.ts`

Add a new static method after the existing `existsBySourceUrl()` method (approx. line 160):

```typescript
  /**
   * Check if a finding with this title and source name already exists for this user+topic.
   * Fallback dedup for findings that lack URLs.
   */
  static async existsByTitleAndSource(
    userId: string,
    topicId: string,
    title: string,
    sourceName: string
  ): Promise<boolean> {
    const result = await queryOne(
      `SELECT 1 FROM findings
       WHERE user_id = $1 AND topic_id = $2
       AND LOWER(title) = LOWER($3)
       AND LOWER(source->>'name') = LOWER($4)`,
      [userId, topicId, title, sourceName]
    );
    return !!result;
  }
```

- [ ] Add the `existsByTitleAndSource()` method to FindingModel
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 5.2: Add title+source fallback to agent-execution dedup

**File**: `backend/src/services/agent-execution.service.ts`

Find the dedup logic where `existsBySourceUrl()` is called (search for `existsBySourceUrl`). It should look approximately like:

```typescript
const sourceUrl = this.getSourceUrl(result, agent.type);
if (sourceUrl) {
  const exists = await FindingModel.existsBySourceUrl(userId, topicId, sourceUrl);
  if (exists) continue;
}
```

Add a fallback check when `sourceUrl` is null/empty:

```typescript
const sourceUrl = this.getSourceUrl(result, agent.type);
if (sourceUrl) {
  const exists = await FindingModel.existsBySourceUrl(userId, topicId, sourceUrl);
  if (exists) continue;
} else {
  // Fallback: dedup by title + source name when URL is missing
  const title = result.title || '';
  const sourceName = result.source?.name || '';
  if (title && sourceName) {
    const exists = await FindingModel.existsByTitleAndSource(userId, topicId, title, sourceName);
    if (exists) {
      console.log(`[AgentExecution] Skipping duplicate (title match): "${title.substring(0, 60)}..."`);
      continue;
    }
  }
}
```

- [ ] Find the dedup block in `agent-execution.service.ts` (search for `existsBySourceUrl`)
- [ ] Add the `else` block with title+source fallback
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

## Deployment

### Build & Deploy

```bash
# Local build verification
cd backend && npx tsc --noEmit
cd .. && npm run build

# Deploy to production
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build

# Verify
docker logs medical-companion --tail 50 2>&1 | grep -i error
```

### Post-Deployment Verification

```bash
# 1. Verify agent.ts route is not in the container
docker exec medical-companion ls /app/backend/dist/routes/agent.js 2>&1
# Expected: No such file

# 2. Verify startup logs don't mention deleted endpoints
docker logs medical-companion --tail 30 2>&1 | grep -i "simplify-digest\|run-agent"
# Expected: Nothing

# 3. Verify scheduler still works (check recent logs)
docker logs medical-companion --tail 100 2>&1 | grep -i "scheduler"
# Expected: "[Scheduler] Checking for agents due to run..." messages

# 4. Verify chat — send a test message
# Open app → navigate to a topic → open chat → send "What are the latest findings?"
# Verify: Response cites actual findings with correct [N] numbers, no raw UUIDs in response

# 5. Verify digest source breakdown
# Generate a new digest → check source_breakdown JSON in DB:
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "SELECT source_breakdown FROM digests ORDER BY created_at DESC LIMIT 1;"
# Verify: medical_site findings counted under clinicalTrials, not web

# 6. Verify agent execution creates findings
# Either wait for scheduler cycle OR:
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "UPDATE agents SET last_run = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE id = (SELECT id FROM agents LIMIT 1);"
# Wait 1-15 minutes, then:
docker logs medical-companion --tail 50 2>&1 | grep -i "AgentExecution\|findings"
# Expected: "[AgentExecution] Found X new findings" messages

# 7. Check for duplicate findings
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "SELECT title, COUNT(*) as cnt FROM findings GROUP BY title HAVING COUNT(*) > 1;"
# Expected: 0 rows (no duplicates)
```

---

## Rollback Plan

All changes are safe to revert independently:

| Group | Rollback |
|-------|----------|
| 1 — Chat citation | `git checkout -- backend/src/routes/chat.routes.ts` |
| 2 — Source parity | `git checkout -- backend/src/services/digest-processor.service.ts` |
| 3 — API consolidation | `git checkout -- backend/src/services/agent-execution.service.ts` |
| 4 — Dead code | Restore `backend/src/routes/agent.ts` from git + restore `backend/src/index.ts` |
| 5 — Dedup | `git checkout -- backend/src/models/finding.model.ts backend/src/services/agent-execution.service.ts` |

---

## Sign-Off Checklist

- [ ] Group 1 complete (chat citation hardening)
- [ ] Group 2 complete (source type parity)
- [ ] Group 3 complete (API parameter consolidation)
- [ ] Group 4 complete (dead code removal)
- [ ] Group 5 complete (finding dedup hardening)
- [ ] Backend builds: `cd backend && npx tsc --noEmit` passes
- [ ] Frontend builds: `npm run build` passes
- [ ] Deployed to production
- [ ] Post-deployment verification passed
- [ ] CLAUDE.md updated with plan status

**Completion Date**: _______________
