# Plan 018: Fix Agent Scheduler, Finding Deduplication, Digest Regeneration & Dead Code Removal

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan fixes **four interconnected production bugs** and removes one dead component. All bugs were confirmed via live server DB queries and Docker logs on Feb 9, 2026.

| Bug | Symptom | Root Cause | Evidence |
|-----|---------|-----------|----------|
| **870 garbage findings** | "Unknown" title, LLM "I'm ready to analyze" summaries | `buildSource()` only handles `pubmed`/`clinical_trials`/`web` but agents use `medical_literature`/`clinical_trial`/`treatment_breakthrough` | 870/910 findings have `source_type: unknown` |
| **Inflated count (910)** | Dashboard says "910 findings across 1 topic" | No dedup — same articles re-inserted every run | Only 41 unique URLs in 910 rows |
| **Agents never stop** | "Next Run" stale, agents run every 15 min | Scheduler never updates `last_run`/`next_run` | 44 notifications in 24h; `last_run` stuck at Feb 7 |
| **Digest never refreshes** | "Updated 23 hours ago" | 24h throttle blocks re-queue even with new findings | Log: "Queue item completed 23.4 hours ago, not resetting" |

**Cascade**: Bug 3 (scheduler never updates timestamps) → agents always "due" → Bug 1 (type mismatch → garbage) + Bug 2 (no dedup → 910 rows) → Bug 4 (throttle blocks digest refresh)

**Plan is split into 6 phases:**
- **Phase 0**: Database cleanup migration (run BEFORE code deploy)
- **Phase 1**: Fix agent type mapping in `agent-execution.service.ts`
- **Phase 2**: Fix scheduler timestamp updates in `scheduler.service.ts`
- **Phase 3**: Add finding deduplication in `finding.model.ts` + `agent-execution.service.ts`
- **Phase 4**: Fix digest queue throttle in `digestQueue.service.pg.ts`
- **Phase 5**: Remove dead DigestSettings component + related dead code (6 frontend files)

---

## Strict Rules

### MUST DO
- [ ] Follow steps IN ORDER within each phase
- [ ] Run `npx tsc --noEmit` in `backend/` after every Phase 1-4 step
- [ ] Run `npm run build` in frontend after every Phase 5 step
- [ ] Run Phase 0 SQL on production BEFORE deploying code changes
- [ ] Git commit after each phase (not after each step)

### MUST NOT DO
- [ ] Do NOT skip Phase 0 — deploying code without DB cleanup will cause constraint violations on the 870 garbage rows
- [ ] Do NOT change any logic beyond what this plan specifies
- [ ] Do NOT modify any other implementation plans
- [ ] Do NOT add console.log statements beyond what this plan specifies — use existing logger patterns
- [ ] Do NOT change the `runSingleAgent()` switch statement (lines 115-134) — it already maps types correctly for search; the bug is only in downstream methods

---

## Phase 0: Database Cleanup Migration

**Risk level**: Medium — deletes garbage data and duplicates. Run BEFORE code deploy.

**How to run**: SSH into production server, then execute each SQL statement:
```bash
ssh chee@100.94.82.35
docker exec -it medcompanion-postgres psql -U meduser -d medcompanion
```

---

### Step 0.1: Delete All Garbage "Unknown Source" Findings

**Reason**: 870 findings have `source->>'type' = 'unknown'` with garbage AI summaries like "I'm ready to analyze research findings...". These were created because `buildSource()` fell through to `default` case.

**SQL**:
```sql
DELETE FROM findings WHERE source->>'type' = 'unknown';
```

**Expected result**: 870 rows deleted.

- [ ] Completed

---

### Step 0.2: Deduplicate Remaining Findings by Source URL

**Reason**: Of the ~40 remaining findings, some may still be duplicates (same source URL, different rows). Keep only the newest per unique URL per user+topic.

**SQL**:
```sql
DELETE FROM findings
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, topic_id, source->>'url')
    id
  FROM findings
  WHERE source->>'url' IS NOT NULL
  ORDER BY user_id, topic_id, source->>'url', created_at DESC
);
```

**Expected result**: Small number of rows deleted (exact count depends on duplicates among non-garbage findings).

- [ ] Completed

---

### Step 0.3: Add Unique Index to Prevent Future Duplicates

**Reason**: Database-level protection against duplicate source URLs. This is the safety net — even if application-level dedup (Phase 3) misses a race condition, the DB will reject it.

**SQL**:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_unique_source_url
ON findings (user_id, topic_id, (source->>'url'))
WHERE source->>'url' IS NOT NULL AND source->>'url' <> '#';
```

**Note**: The `WHERE` clause excludes NULL URLs and placeholder `#` URLs, which legitimately can repeat.

- [ ] Completed

---

### Step 0.4: Fix Agent Timestamps

**Reason**: `last_run` is stuck at Feb 7, `next_run` at Feb 8. Without fixing these, agents will immediately run again after deploy (before the code fix in Phase 2 takes effect).

**SQL**:
```sql
UPDATE agents
SET last_run = CURRENT_TIMESTAMP,
    next_run = CASE
      WHEN schedule = 'hourly' THEN CURRENT_TIMESTAMP + INTERVAL '1 hour'
      WHEN schedule = 'daily' THEN CURRENT_TIMESTAMP + INTERVAL '24 hours'
      WHEN schedule = 'weekly' THEN CURRENT_TIMESTAMP + INTERVAL '7 days'
      ELSE CURRENT_TIMESTAMP + INTERVAL '24 hours'
    END
WHERE enabled = true;
```

- [ ] Completed

---

### Step 0.5: Reset Digest Queue

**Reason**: Stale completed/failed queue items block re-generation. Clear them so digests regenerate with clean data after next agent run.

**SQL**:
```sql
DELETE FROM digest_queue WHERE status IN ('completed', 'failed', 'cancelled');
```

- [ ] Completed

---

### Step 0.6: Clean Up Stale Notifications

**Reason**: 44 agent_complete notifications accumulated from the runaway scheduler. Clean them up.

**SQL**:
```sql
DELETE FROM notifications WHERE type = 'agent_complete';
```

- [ ] Completed

---

### Step 0.7: Verify Cleanup

**SQL** (run all, verify expected results):
```sql
SELECT COUNT(*) FROM findings;                                    -- Should be ~40 (down from 910)
SELECT COUNT(*) FROM findings WHERE source->>'type' = 'unknown';  -- Should be 0
SELECT last_run, next_run, schedule FROM agents WHERE enabled = true;  -- Should show current + interval
SELECT COUNT(*) FROM digest_queue;                                -- Should be 0
SELECT COUNT(*) FROM notifications WHERE type = 'agent_complete'; -- Should be 0
```

- [ ] Completed

---

## Phase 1: Fix Agent Type Mapping in buildSource / buildAIPrompt / extractTags

**File**: `backend/src/services/agent-execution.service.ts`

**Problem**: `runSingleAgent()` (line 115) correctly maps frontend agent types to search methods:
- `'medical_literature'` → `searchPubMed()`
- `'clinical_trial'` → `searchClinicalTrials()`
- `'treatment_breakthrough'` → `searchWeb()`

But `createFinding()` (line 346) passes raw `agent.type` to three downstream methods that only handle API types (`pubmed`, `clinical_trials`, `web`):
- `buildSource()` (line 399) — falls through to `default` → `{type: 'unknown', name: 'Unknown Source'}`
- `buildAIPrompt()` (line 516) — falls through to `default` → `"Analyze this research finding: [object Object]"`
- `extractTags()` (line 586) — misses type-specific tags

---

### Step 1.1: Add normalizeAgentType() Helper Method

**Action**: Add this private method to the `AgentExecutionService` class, BEFORE `buildSource()` (before line 399):

```typescript
  /** Normalize frontend agent types to API types used by buildSource/buildAIPrompt/extractTags */
  private normalizeAgentType(agentType: string): string {
    switch (agentType) {
      case 'medical_literature': return 'pubmed';
      case 'clinical_trial': return 'clinical_trials';
      case 'treatment_breakthrough': return 'web';
      default: return agentType;
    }
  }
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 1.2: Use normalizeAgentType() in createFinding()

**Action**: In `createFinding()` (line 346-394), add a normalization call at the top of the method and use it for all downstream calls.

**Find** (around line 350-353):
```typescript
  private async createFinding(result: any, agent: any, topicId: string, userId: string): Promise<any | null> {
    try {
      const source = this.buildSource(result, agent.type);
```

**Replace with**:
```typescript
  private async createFinding(result: any, agent: any, topicId: string, userId: string): Promise<any | null> {
    try {
      const normalizedType = this.normalizeAgentType(agent.type);
      const source = this.buildSource(result, normalizedType);
```

**Then find** the `analyzeWithAI` call (around line 361) — change `agent.type` to `normalizedType`:

**Find**:
```typescript
      const aiAnalysis = await this.analyzeWithAI(result, agent.type);
```

**Replace with**:
```typescript
      const aiAnalysis = await this.analyzeWithAI(result, normalizedType);
```

**Then find** the `extractTags` call (around line 386) — change `agent.type` to `normalizedType`:

**Find**:
```typescript
        tags: this.extractTags(result, agent.type),
```

**Replace with**:
```typescript
        tags: this.extractTags(result, normalizedType),
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 1.3: Add Guard Against Unknown Source in createFinding()

**Action**: After the `buildSource()` call (now using `normalizedType`), add a guard to reject results that would produce garbage findings.

**Find** (the line right after `const source = this.buildSource(result, normalizedType);`):
```typescript
      const source = this.buildSource(result, normalizedType);
```

**Add AFTER that line**:
```typescript
      // Guard: reject results that would produce garbage findings
      if (source.type === 'unknown' || source.url === '#') {
        console.warn(`[AgentExecution] Skipping result with unknown source (agent type: ${agent.type}, normalized: ${normalizedType})`);
        return null;
      }
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

## Phase 2: Fix Scheduler Not Updating last_run / next_run

**File**: `backend/src/services/scheduler.service.ts`

**Problem**: `executeAgentsInBackground()` (line 188) runs agents but never calls `AgentModel.updateLastRun()` or updates `next_run`. The `calculateNextRun()` method exists (line 286) but is never invoked. Result: agents are always "due" and run every 15 minutes.

---

### Step 2.1: Add AgentModel Import (if not present)

**Action**: Check if `AgentModel` is already imported at the top of `scheduler.service.ts`. If not, add:

```typescript
import { AgentModel } from '../models/agent.model.js';
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 2.2: Add Timestamp Update After Agent Execution

**Action**: In `executeAgentsInBackground()`, find the completion log line (line 214):

```typescript
      console.log(`[Scheduler] Topic "${topicName}": Found ${findings.length} findings in ${duration}ms`);
```

**Add AFTER that line** (BEFORE the `if (findings.length > 0)` block at line 216):

```typescript
      // Update last_run and next_run for all executed agents
      for (const agent of agents) {
        try {
          const now = new Date();
          const nextRun = this.calculateNextRun(agent.schedule || 'daily', now);
          await AgentModel.update(agent.id, userId, {
            last_run: now,
            next_run: nextRun
          });
        } catch (updateError) {
          console.error(`[Scheduler] Failed to update timestamps for agent ${agent.name}:`, updateError);
        }
      }
```

**Why update even when findings.length === 0**: The agents ran successfully — they just found no new results. Updating timestamps prevents them from running again before their next scheduled time.

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

## Phase 3: Add Finding Deduplication

Two layers of protection: application-level pre-filter (saves AI API calls) + DB constraint safety net (Phase 0 Step 0.3).

---

### Step 3.1: Add existsBySourceUrl() to FindingModel

**File**: `backend/src/models/finding.model.ts`

**Action**: Add this static method to the `FindingModel` class (after the `create()` method, around line 143):

```typescript
  // Check if a finding with this source URL already exists for this user+topic
  static async existsBySourceUrl(
    userId: string,
    topicId: string,
    sourceUrl: string
  ): Promise<boolean> {
    if (!sourceUrl || sourceUrl === '#') return false;
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM findings
       WHERE user_id = $1 AND topic_id = $2 AND source->>'url' = $3
       LIMIT 1`,
      [userId, topicId, sourceUrl]
    );
    return !!existing;
  }
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 3.2: Add getSourceUrl() Helper to AgentExecutionService

**File**: `backend/src/services/agent-execution.service.ts`

**Action**: Add this private method to the class (near `normalizeAgentType()`, before `buildSource()`):

```typescript
  /** Extract source URL from raw search result before AI processing */
  private getSourceUrl(result: any, agentType: string): string {
    const normalized = this.normalizeAgentType(agentType);
    switch (normalized) {
      case 'pubmed':
        return result.id ? `https://pubmed.ncbi.nlm.nih.gov/${result.id}/` : '';
      case 'clinical_trials': {
        const nctId = result.protocolSection?.identificationModule?.nctId;
        return nctId ? `https://clinicaltrials.gov/study/${nctId}` : '';
      }
      case 'web':
        return result.url || '';
      default:
        return '';
    }
  }
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 3.3: Add FindingModel Import to agent-execution.service.ts

**File**: `backend/src/services/agent-execution.service.ts`

**Action**: At the top of the file, add import for FindingModel (if not already present):

```typescript
import { FindingModel } from '../models/finding.model.js';
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 3.4: Pre-Filter Duplicates in runSingleAgent()

**File**: `backend/src/services/agent-execution.service.ts`

**Action**: In `runSingleAgent()` (line 104-148), find the line where `searchResults` are passed to `convertToFindings()`. It should look something like:

```typescript
      const findings = await this.convertToFindings(searchResults, agent, topicId, userId);
```

**Replace** that single line with:

```typescript
      // Pre-filter: skip results whose source URL already exists in DB (saves AI API calls)
      const newResults: any[] = [];
      for (const result of searchResults) {
        const sourceUrl = this.getSourceUrl(result, agent.type);
        if (sourceUrl) {
          const exists = await FindingModel.existsBySourceUrl(userId, topicId, sourceUrl);
          if (exists) continue;
        }
        newResults.push(result);
      }

      if (newResults.length === 0) {
        console.log(`[AgentExecution] All ${searchResults.length} results already exist, skipping AI analysis`);
        return [];
      }

      console.log(`[AgentExecution] ${newResults.length}/${searchResults.length} results are new, processing`);

      const findings = await this.convertToFindings(newResults, agent, topicId, userId);
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 3.5: Add DB Constraint Safety Net in storeFindings()

**File**: `backend/src/services/agent-execution.service.ts`

**Action**: Find `storeFindings()` method (line 616-624). It currently looks like:

```typescript
  private async storeFindings(findings: any[], userId: string): Promise<any[]> {
    const stored: any[] = [];
    for (const finding of findings) {
      try {
        await FindingModel.create(userId, finding);
        stored.push(finding);
      } catch (error) {
        console.error('[AgentExecution] Error storing finding:', error);
      }
    }
    return stored;
  }
```

**Replace with**:

```typescript
  private async storeFindings(findings: any[], userId: string): Promise<any[]> {
    const stored: any[] = [];
    for (const finding of findings) {
      try {
        await FindingModel.create(userId, finding);
        stored.push(finding);
      } catch (error: any) {
        if (error?.code === '23505') {
          // unique_violation — duplicate caught by DB constraint (race condition)
          console.log(`[AgentExecution] Duplicate caught by DB constraint: ${finding.source?.url}`);
          continue;
        }
        console.error('[AgentExecution] Error storing finding:', error);
      }
    }
    return stored;
  }
```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step 3.6: Add Unique Index to init.sql for Fresh Deployments

**File**: `backend/src/db/init.sql`

**Action**: Find the findings indexes section (around lines 220-224). After the last `CREATE INDEX` for findings, add:

```sql
-- Prevent duplicate findings by source URL per user+topic
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_unique_source_url
ON findings (user_id, topic_id, (source->>'url'))
WHERE source->>'url' IS NOT NULL AND source->>'url' <> '#';
```

**Note**: This is the same index from Phase 0 Step 0.3 — adding it here ensures fresh Docker deployments also get it.

- [ ] Completed

---

## Phase 4: Fix Digest Queue 24-Hour Throttle

**File**: `backend/src/services/digestQueue.service.pg.ts`

**Problem**: `createQueueItem()` (line 133) refuses to reset a completed queue item if it completed within 24 hours, even when the scheduler reports genuinely new findings exist. The scheduler passes `metadata.findingsCount` and `metadata.source = 'scheduled-agent-run'`, but the throttle ignores these.

---

### Step 4.1: Modify Throttle Condition to Allow Re-Queue on New Findings

**Action**: Find the 24-hour throttle block (around lines 174-188). It currently looks like:

```typescript
        // Don't reset if completed within the last 24 hours
        if (existing.status === 'completed' && existing.completedAt) {
          const completedTime = new Date(existing.completedAt).getTime();
          const now = Date.now();
          const hoursSinceCompletion = (now - completedTime) / (1000 * 60 * 60);

          if (data.metadata?.force !== true && hoursSinceCompletion < 24) {
            console.log(`[DigestQueueService] Queue item completed ${hoursSinceCompletion.toFixed(1)} hours ago, not resetting`);
            return existing;
          }
        }
```

**Replace with**:

```typescript
        // Don't reset if completed within the last 24 hours
        // UNLESS: force=true OR scheduler reports genuinely new findings
        if (existing.status === 'completed' && existing.completedAt) {
          const completedTime = new Date(existing.completedAt).getTime();
          const now = Date.now();
          const hoursSinceCompletion = (now - completedTime) / (1000 * 60 * 60);

          const forceRegenerate = data.metadata?.force === true;
          const hasNewFindings = data.metadata?.source === 'scheduled-agent-run'
            && (data.metadata?.findingsCount || 0) > 0;

          if (!forceRegenerate && !hasNewFindings && hoursSinceCompletion < 24) {
            console.log(`[DigestQueueService] Completed ${hoursSinceCompletion.toFixed(1)}h ago, no new findings, not resetting`);
            return existing;
          }

          if (hasNewFindings) {
            console.log(`[DigestQueueService] ${data.metadata?.findingsCount} new findings, resetting for re-generation`);
          }
        }
```

**Why this is safe**: After Phase 3 dedup, the scheduler's `findings.length` only counts genuinely new (non-duplicate) findings. If agents find 0 new results, the scheduler doesn't queue a digest at all (scheduler.service.ts line 216: `if (findings.length > 0)`).

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

## Phase 5: Remove Dead DigestSettings Component & Related Code

**Reason**: The DigestSettings panel (343 lines) is 90% dead code — calls methods that don't exist (`getCacheStats()`, `updateCacheConfig()`), writes to IndexedDB instead of PostgreSQL, and gives users a false sense of control. It survived 2 major refactorings undetected.

---

### Step 5.1: Delete DigestSettings Component File

**Action**: Delete this file entirely:
```
src/components/DigestSettings.tsx    (343 lines)
```

- [ ] Completed

---

### Step 5.2: Remove DigestSettings from ResearchPage

**File**: `src/components/research/ResearchPage.tsx`

**Action 1**: Remove the import (line 21):
```typescript
// DELETE this line:
import DigestSettings from '@/components/DigestSettings';
```

**Action 2**: Remove the `handleSettingsClick` function (lines 67-69):
```typescript
// DELETE these lines:
  const handleSettingsClick = () => {
    openModal('digestSettings');
  };
```

**Action 3**: Remove the `onSettingsClick` prop passed to ResearchContainer (line 108). Find:
```typescript
        onSettingsClick={handleSettingsClick}
```
Delete that line.

**Action 4**: Remove the settings modal block (lines 135-144):
```typescript
// DELETE this entire block:
      {/* Settings Modal */}
      {modals.digestSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DigestSettings
              topicId={selectedTopicId || ''}
              onClose={() => closeModal('digestSettings')}
            />
          </div>
        </div>
      )}
```

**Verify**: `npm run build` (will fail until Steps 5.3-5.4 remove the prop chain)

- [ ] Completed

---

### Step 5.3: Remove onSettingsClick from ResearchContainer

**File**: `src/components/research/ResearchContainer.tsx`

**Action 1**: Remove from interface (line 41):
```typescript
// DELETE this line:
  onSettingsClick: () => void;
```

**Action 2**: Remove from destructured props (line 57). Find where `onSettingsClick` appears in the destructuring and remove it.

**Action 3**: Remove prop passed to ResearchToolbar (line 203):
```typescript
// DELETE this line:
              onSettingsClick={onSettingsClick}
```

**Verify**: `npm run build` (will fail until Step 5.4 removes from toolbar)

- [ ] Completed

---

### Step 5.4: Remove Settings Button from ResearchToolbar

**File**: `src/components/research/toolbar/ResearchToolbar.tsx`

**Action 1**: Remove `Settings` from lucide-react import (line 18). Change:
```typescript
import { RefreshCw, Settings } from 'lucide-react';
```
To:
```typescript
import { RefreshCw } from 'lucide-react';
```

**Action 2**: Remove `onSettingsClick` from props interface (line 35):
```typescript
// DELETE this line:
  onSettingsClick: () => void;
```

**Action 3**: Remove `onSettingsClick` from destructured props (line 47).

**Action 4**: Remove the Settings button JSX (lines 106-112):
```typescript
// DELETE this entire block:
          {/* Settings button */}
          <Button
            size="sm"
            variant="outline"
            onClick={onSettingsClick}
          >
            <Settings className="h-4 w-4" />
          </Button>
```

**Verify**: `npm run build` — should now pass

- [ ] Completed

---

### Step 5.5: Clean Up uiStore Modal Key

**File**: `src/stores/uiStore.ts`

**Action 1**: Remove `'digestSettings'` from `ModalKey` type (line 24).

**Action 2**: Remove `digestSettings: boolean;` from `ModalStates` interface (line 54).

**Action 3**: Remove `digestSettings: false,` from `defaultModals` (line 184).

**Verify**: `npm run build`

- [ ] Completed

---

### Step 5.6: Remove Dead Cache Code from digest.service.ts

**File**: `src/services/digest.service.ts`

**Action 1**: Remove `DigestCacheConfig` interface (lines 80-85):
```typescript
// DELETE:
export interface DigestCacheConfig {
  maxAge: number;
  staleWhileRevalidate: boolean;
  autoRefresh: boolean;
  refreshThreshold: number;
}
```

**Action 2**: Remove `DEFAULT_CACHE_CONFIGS` (lines 87-112):
```typescript
// DELETE the entire DEFAULT_CACHE_CONFIGS block
```

**Action 3**: Remove `cacheConfigs` Map and its initialization from the constructor (lines 128-135):
```typescript
// DELETE:
  private cacheConfigs: Map<string, DigestCacheConfig> = new Map();
// and the Object.entries loop that populates it
```

**Action 4**: Remove `invalidateCache()` method (lines 717-727):
```typescript
// DELETE the entire invalidateCache() method
```

**Action 5**: Remove `getCacheConfig()` method (lines 799-801):
```typescript
// DELETE the entire getCacheConfig() method
```

**Note**: Check if `DigestCacheConfig` is imported/used anywhere else. If so, remove those imports too.

**Verify**: `npm run build`

- [ ] Completed

---

## Deployment

### Build and Deploy

```bash
# 1. Type check backend
cd backend && npx tsc --noEmit

# 2. Build frontend
cd .. && npm run build

# 3. Deploy to production
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build

# 4. Check logs
docker logs medical-companion --tail 50 2>&1
```

### What to Watch For in Logs

**Good signs**:
- `[Scheduler] ... 0 agents due` (agents respecting next_run)
- `[AgentExecution] X/10 results are new, processing` (dedup working)
- `[Scheduler] Updated agent ...` → timestamps updating (Phase 2)
- `[DigestQueueService] N new findings, resetting for re-generation` (throttle bypass working)

**Bad signs**:
- `source_type: unknown` in any new finding → Phase 1 fix didn't take
- `23505` errors flooding logs → Unique constraint catching too many dupes (expected for a short period during first run, should stop)
- `Failed to update timestamps for agent` → Phase 2 error, check agent IDs

---

## Testing Scenarios

### After Phase 0 (DB cleanup):
```sql
SELECT COUNT(*) FROM findings;                                    -- ~40
SELECT COUNT(*) FROM findings WHERE source->>'type' = 'unknown';  -- 0
SELECT last_run, next_run FROM agents WHERE enabled = true;       -- current + 24h
SELECT COUNT(*) FROM digest_queue;                                -- 0
```

### After Full Deploy:

**Scenario 1: Agent type mapping (Phase 1)**
- Wait for next scheduled agent run (or trigger manually)
- Check: `SELECT source->>'type', COUNT(*) FROM findings GROUP BY source->>'type'`
- Expected: Only `pubmed`, `clinical_trials`, `web` — no `unknown`

**Scenario 2: Scheduler timestamps (Phase 2)**
- After an agent run completes, check: `SELECT name, last_run, next_run FROM agents WHERE enabled = true`
- Expected: `last_run` should be recent, `next_run` should be last_run + 24 hours

**Scenario 3: Deduplication (Phase 3)**
- After a second agent run, check: `SELECT COUNT(*) FROM findings`
- Expected: Count should NOT increase if no genuinely new articles exist
- Check logs: `[AgentExecution] All X results already exist, skipping AI analysis`

**Scenario 4: Digest refresh (Phase 4)**
- After an agent run that finds new results, check dashboard
- Expected: Digest shows "Updated just now" (not "23 hours ago")
- Check logs: `[DigestQueueService] N new findings, resetting for re-generation`

**Scenario 5: DigestSettings removed (Phase 5)**
- Navigate to Research page
- Expected: No Settings gear icon in toolbar
- Expected: No errors in browser console related to DigestSettings

### Dashboard verification:
- Homepage hero should show accurate finding count (~40, not 910)
- Unread Findings section should show real titles (not "Unknown")
- Research Pulse card should show updated digest

---

## Rollback Plan

### If Phase 1-4 Causes Issues (Backend):
```bash
# Revert to previous code
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git revert HEAD
docker compose down && docker compose up -d --build
```

### If Phase 0 SQL Needs Undo:
The deleted garbage findings (870 "Unknown" rows) are not recoverable and should not need to be. They contained no useful data. The unique index can be dropped:
```sql
DROP INDEX IF EXISTS idx_findings_unique_source_url;
```

### If Phase 5 Causes Frontend Build Failure:
Restore `DigestSettings.tsx` from git and revert the 5 file edits. The component is dead code — keeping it doesn't hurt functionality, just cleanliness.

---

## Files Modified Summary

| File | What Changes | Phase |
|------|-------------|-------|
| `backend/src/services/agent-execution.service.ts` | Add `normalizeAgentType()`, `getSourceUrl()`, use in `createFinding()`, add unknown source guard, pre-filter dedup in `runSingleAgent()`, safety net in `storeFindings()` | 1, 3 |
| `backend/src/services/scheduler.service.ts` | Add timestamp update loop after agent execution (~12 lines) | 2 |
| `backend/src/models/finding.model.ts` | Add `existsBySourceUrl()` static method (~12 lines) | 3 |
| `backend/src/db/init.sql` | Add unique index (~3 lines) | 3 |
| `backend/src/services/digestQueue.service.pg.ts` | Modify throttle condition to allow re-queue on new findings (~10 lines) | 4 |
| **DELETE** `src/components/DigestSettings.tsx` | Remove entirely (343 lines dead code) | 5 |
| `src/components/research/ResearchPage.tsx` | Remove DigestSettings import, modal block, settings handler | 5 |
| `src/components/research/ResearchContainer.tsx` | Remove `onSettingsClick` prop pass-through | 5 |
| `src/components/research/toolbar/ResearchToolbar.tsx` | Remove settings button, Settings icon import, `onSettingsClick` prop | 5 |
| `src/stores/uiStore.ts` | Remove `digestSettings` modal key | 5 |
| `src/services/digest.service.ts` | Remove dead cache config code (~50 lines) | 5 |

---

## Sign-Off

- [ ] Phase 0 completed (DB cleanup) — Date: ___
- [ ] Phase 1 completed (agent type mapping) — Date: ___
- [ ] Phase 2 completed (scheduler timestamps) — Date: ___
- [ ] Phase 3 completed (deduplication) — Date: ___
- [ ] Phase 4 completed (digest throttle) — Date: ___
- [ ] Phase 5 completed (DigestSettings removal) — Date: ___
- [ ] Backend compiles successfully (`npx tsc --noEmit`)
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Deployed to production
- [ ] Dashboard shows accurate finding count
- [ ] No "Unknown" findings in Unread Findings
- [ ] Agent timestamps update after runs
- [ ] Digest refreshes when new findings arrive
- [ ] No Settings gear icon on Research page

---

*Plan created: February 9, 2026*
*This plan can be deleted after completion.*
