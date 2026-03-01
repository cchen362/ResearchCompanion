# Plan 025: Search Query Resolution & Agent Execution Consolidation

## STOP: Read This Entire Document Before Making Any Changes

This plan fixes two critical bugs and eliminates duplicate code:

1. **Digest sourceType mismatch** (Group 0) — Zod validation rejects valid AI-generated digests because raw DB source types (`research_article`, `web_article`, `journal`) don't match the 4-value schema enum (`pubmed`, `clinical_trial`, `fda`, `web`). This caused ben4mn's March 1 digest to fall back to empty stub data.

2. **Search query using topic label** (Group 1) — The backend scheduler searches using `topic.name` (user-friendly label like "My Child's Condition") instead of `topic.metadata.diseaseProfile.name` (the actual medical condition like "Deletion syndrome").

3. **Duplicate frontend execution pipeline** (Groups 2-4) — The frontend "Run Now" runs an entirely separate search pipeline. Consolidate to a single backend code path.

**Discovery (sourceType)**: User ben4mn's "My child" (Lupus) topic generated a full 66-finding digest on March 1, but Zod rejected `notableFindings[11].sourceType` because the AI echoed `research_article` (from DB) instead of `pubmed` (what the schema expects). Both initial validation AND recovery failed, producing an empty digest with stub text.

**Discovery (query)**: User 89nictal's topic "Genetic condition" accumulated 99 junk clinical trial findings (atopic dermatitis, hemophilia, breast cancer, etc.) because the scheduler searched ClinicalTrials.gov with the vague topic label instead of the disease profile name "Deletion syndrome".

| Group | Risk | Files Changed | Description |
|-------|------|---------------|-------------|
| 0 | LOW | 2 backend | Fix digest sourceType normalization + Zod recovery |
| 1 | LOW | 1 backend | Make `agent-execution.service.ts` resolve disease name from DB internally |
| 2 | MEDIUM | 2 backend | Add `POST /api/agents/run/:topicId` execution endpoint + export singleton |
| 3 | MEDIUM | 1 frontend | Rewire AgentMonitor "Run Now" to call backend endpoint |
| 4 | LOW | 1 frontend | Remove ~480 lines of dead frontend execution code |

**Prerequisite**: Plan 024 COMPLETE (commit `5130457`)

---

## Strict Rules

### MUST DO
- [ ] Follow groups IN ORDER (0 → 1 → 2 → 3 → 4)
- [ ] Run `cd backend && npx tsc --noEmit` after every backend file change
- [ ] Run `npm run build` (frontend) after Groups 3 and 4
- [ ] Read the referenced file and line numbers BEFORE making each change
- [ ] Verify each deletion candidate has zero remaining callers before removing

### MUST NOT DO
- [ ] Do NOT change scheduler control flow (interval, batching, notification logic)
- [ ] Do NOT modify database schema
- [ ] Do NOT add new npm dependencies
- [ ] Do NOT remove agent CRUD methods from `agents.service.ts` (only execution code)
- [ ] Do NOT remove the `agent-complete` / `agents-complete` window event listeners in other components

---

## Files Modified

| File | Group | Changes |
|------|-------|---------|
| `backend/src/services/ai.service.ts` | 0 | Add `normalizeSourceType()` helper; normalize in prompt; fix recovery code |
| `backend/src/services/digest-processor.service.ts` | 0 | Add `journal` to `countSourcesByType()` mapping |
| `backend/src/services/agent-execution.service.ts` | 1, 2 | Import TopicModel; resolve `diseaseProfile.name` internally; export singleton |
| `backend/src/routes/agents.routes.ts` | 2 | Add `POST /agents/run/:topicId` endpoint |
| `src/components/agents/AgentMonitor.tsx` | 3 | Replace frontend execution with backend API call |
| `src/services/agents.service.ts` | 4 | Remove ~480 lines of dead execution code + 3 legacy exports |

---

## Group 0: Digest sourceType Normalization Fix

**Problem**: The digest Zod schema (`SmartDigestSchema`) restricts `sourceType` to `['pubmed', 'clinical_trial', 'fda', 'web']`. But the AI prompt exposes raw DB source types like `research_article`, `web_article`, `journal`, `medical_site`. When Claude echoes these back in `notableFindings` or `featuredDiscovery`, Zod rejects the entire digest. The recovery code also fails because it re-validates with the same strict schema.

**Evidence** (March 1, 2026 production logs):
```
Zod validation failed. Error details: {
  issues: [{ path: ["notableFindings", 11, "sourceType"],
             message: 'Invalid option: expected one of "pubmed"|"clinical_trial"|"fda"|"web"' }]
}
Recovery failed: ZodError: [same error]
✓ Using minimal fallback data    ← empty digest saved
```

**DB source type reality** (all 288 findings):
```
clinical_trial   | 136
research_article |  39
web_article      |  39
journal          |  34
web              |  20
medical_site     |  20
```

Only `clinical_trial` and `web` are in the Zod enum. The other 4 types (`research_article`, `web_article`, `journal`, `medical_site`) are NOT — they will crash the digest if the AI echoes them.

**Fix strategy**: Normalize at the prompt boundary (where findings are formatted for the AI). This way the AI only ever sees the 4 canonical types, and the Zod schema stays strict. Also fix the recovery code so a single bad field doesn't nuke the entire digest.

### Step 0.1: Add `normalizeSourceType()` helper to ai.service.ts

**File**: `backend/src/services/ai.service.ts`

Add this helper function near the top of the file, after the existing imports and before the first function definition. Place it before `scoreAndClusterFindings()` (around line 30):

```typescript
/**
 * Normalize raw DB source types to the 4 canonical digest types.
 * Must stay in sync with:
 *   - frontend: src/utils/sourceCategory.ts → getSourceCategory()
 *   - backend:  digest-processor.service.ts → countSourcesByType()
 */
function normalizeSourceType(rawType?: string): 'pubmed' | 'clinical_trial' | 'fda' | 'web' {
  const s = (rawType || '').toLowerCase();

  if (s.includes('pubmed') || s.includes('research') || s.includes('journal') || s === 'academic') {
    return 'pubmed';
  }
  if (s.includes('clinical') || s.includes('trial') || s === 'medical_site') {
    return 'clinical_trial';
  }
  if (s.includes('fda')) {
    return 'fda';
  }
  return 'web';
}
```

This matches the existing frontend `getSourceCategory()` in `src/utils/sourceCategory.ts` exactly.

- [ ] Add `normalizeSourceType()` helper
- [ ] `cd backend && npx tsc --noEmit`

### Step 0.2: Normalize source types in Haiku Pass 1 prompt

**File**: `backend/src/services/ai.service.ts`

**Current** (line 351):
```typescript
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`;
```

**Change to**:
```typescript
Source: ${f.source?.name || 'Unknown'} (${normalizeSourceType(f.source?.type)})`;
```

- [ ] Update line 351
- [ ] `cd backend && npx tsc --noEmit`

### Step 0.3: Normalize source types in Sonnet Pass 2 prompt (top findings)

**File**: `backend/src/services/ai.service.ts`

**Current** (line 632):
```typescript
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})${f.created_at ? `\nAdded: ${new Date(f.created_at).toISOString().split('T')[0]}` : ''}`;
```

**Change to**:
```typescript
Source: ${f.source?.name || 'Unknown'} (${normalizeSourceType(f.source?.type)})${f.created_at ? `\nAdded: ${new Date(f.created_at).toISOString().split('T')[0]}` : ''}`;
```

- [ ] Update line 632
- [ ] `cd backend && npx tsc --noEmit`

### Step 0.4: Normalize source types in fallback simple digest prompt

**File**: `backend/src/services/ai.service.ts`

**Current** (line 912):
```typescript
Source: ${f.source?.name || 'Unknown'} (${f.source?.type || 'unknown'})`
```

**Change to**:
```typescript
Source: ${f.source?.name || 'Unknown'} (${normalizeSourceType(f.source?.type)})`
```

- [ ] Update line 912
- [ ] `cd backend && npx tsc --noEmit`

### Step 0.5: Fix the Zod recovery code to sanitize before re-validating

**File**: `backend/src/services/ai.service.ts`

**Current** recovery block (lines 821-834):
```typescript
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
```

**Change to**:
```typescript
      try {
        // Sanitize sourceType fields before re-validating — this is the most common Zod failure
        const sanitizedNotable = Array.isArray(digestData.notableFindings)
          ? digestData.notableFindings.map((nf: any) => ({
              ...nf,
              sourceType: normalizeSourceType(nf.sourceType)
            }))
          : [];
        const sanitizedFeatured = digestData.featuredDiscovery
          ? {
              ...digestData.featuredDiscovery,
              sourceType: normalizeSourceType(digestData.featuredDiscovery.sourceType)
            }
          : undefined;

        const recoveredData = {
          whatsNew: digestData.whatsNew || { technical: 'Analysis completed.', explained: 'Research findings compiled.' },
          featuredDiscovery: sanitizedFeatured,
          keyTakeaways: Array.isArray(digestData.keyTakeaways) ? digestData.keyTakeaways : [],
          notableFindings: sanitizedNotable,
          forYourDoctor: digestData.forYourDoctor || { questions: [], watchFor: [], conflicts: [] },
          sourceBreakdown: digestData.sourceBreakdown || undefined,
        };

        // Try to validate the recovered data with sanitized fields
        const validated = SmartDigestSchema.parse(recoveredData);
        digestData = validated;
        console.log('✓ Graceful recovery successful with sanitized sourceType fields');
```

**Why this works**: The recovery code was already designed to handle Zod failures — it just didn't know about the sourceType problem. By normalizing sourceType values before re-validation, the recovery succeeds for the most common failure case. If there's a different Zod error, it still falls through to the minimal fallback (unchanged).

- [ ] Replace the recovery try block with sanitized version
- [ ] `cd backend && npx tsc --noEmit`

### Step 0.6: Fix `journal` mapping gap in `countSourcesByType()`

**File**: `backend/src/services/digest-processor.service.ts`

**Current** (line 39):
```typescript
    if (sourceType.includes('pubmed') || sourceType.includes('research') || sourceType === 'academic') {
```

**Change to**:
```typescript
    if (sourceType.includes('pubmed') || sourceType.includes('research') || sourceType.includes('journal') || sourceType === 'academic') {
```

**Why**: There are 34 findings with `source.type = 'journal'` in the DB. Currently they fall through to `web` in this function, but `getSourceCategory()` on the frontend correctly maps them to `pubmed`. This creates a source breakdown mismatch between backend-counted stats and frontend display. Adding `journal` brings the backend in sync with the frontend.

- [ ] Add `sourceType.includes('journal')` condition
- [ ] `cd backend && npx tsc --noEmit`

### Step 0.7: Verify — regenerate ben4mn's broken digest

After deploying Group 0, force re-generation of the broken March 1 digest:

```bash
# Delete the stale queue item so it can be re-generated
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "DELETE FROM digest_queue WHERE topic_id = '2493d6cb-16de-4a89-8613-0418bed332b3';"

# Delete the broken digest
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "DELETE FROM digests WHERE id = 'c9ef530b-4e23-419d-965c-a0716953153b';"

# Backdate one agent to trigger scheduler → agent run → digest queue
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "UPDATE agents SET last_run = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE topic_id = '2493d6cb-16de-4a89-8613-0418bed332b3' LIMIT 1;"

# Wait for scheduler cycle (~60s), then check logs:
docker logs medical-companion --tail 30 2>&1 | grep -E 'Zod|recovery|Completed digest'
# Expected: '✓ Zod validation successful' (no recovery needed if normalization works)
# OR: '✓ Graceful recovery successful with sanitized sourceType fields' (recovery works as backup)

# Verify new digest has content:
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "SELECT id, featured_discovery IS NOT NULL as has_featured, notable_findings::text != '[]' as has_notable, LEFT(whats_new::text, 100) as whats_new FROM digests WHERE topic_id = '2493d6cb-16de-4a89-8613-0418bed332b3' ORDER BY created_at DESC LIMIT 1;"
# Expected: has_featured=t, has_notable=t, whats_new contains real content
```

- [ ] Delete stale queue item and broken digest
- [ ] Trigger re-generation via scheduler
- [ ] Verify new digest has `featured_discovery`, `notable_findings`, and real `whats_new`

---

## Group 1: Backend Query Resolution Fix

**Problem**: `runAgentsForTopic()` uses caller-provided `topicName` for search queries. The scheduler passes `topic.name` (label), not `diseaseProfile.name` (medical condition).

**Fix**: `agent-execution.service.ts` looks up the topic from DB and extracts the disease name itself. Callers can no longer pass the wrong value.

### Step 1.1: Import TopicModel

**File**: `backend/src/services/agent-execution.service.ts`

Add after existing imports (after line 18):

```typescript
import { TopicModel } from '../models/topic.model.js';
```

- [ ] Add import
- [ ] `cd backend && npx tsc --noEmit`

### Step 1.2: Resolve disease name inside runAgentsForTopic

**File**: `backend/src/services/agent-execution.service.ts`

**Current** (lines 55-64):
```typescript
  async runAgentsForTopic(
    topicId: string,
    userId: string,
    agents: Agent[],
    topicName?: string
  ): Promise<Finding[]> {
    const allFindings: Finding[] = [];
    const errors: string[] = [];

    console.log(`[AgentExecution] Running ${agents.length} agents for topic ${topicId}`);
```

**Change to**:
```typescript
  async runAgentsForTopic(
    topicId: string,
    userId: string,
    agents: Agent[],
    topicName?: string  // Display/logging only — NOT used for search queries
  ): Promise<Finding[]> {
    const allFindings: Finding[] = [];
    const errors: string[] = [];

    // Resolve the actual medical condition from topic metadata (single source of truth for queries)
    let searchBaseName = '';
    try {
      const topic = await TopicModel.getById(topicId, userId);
      if (topic) {
        const metadata = typeof topic.metadata === 'string' ? JSON.parse(topic.metadata) : (topic.metadata || {});
        searchBaseName = (metadata?.diseaseProfile?.name || '').trim();
      }
    } catch (error) {
      console.warn(`[AgentExecution] Failed to look up topic ${topicId}, falling back to topicName`);
    }

    // Fallback chain: diseaseProfile.name → topicName → abort
    searchBaseName = searchBaseName || (topicName || '').trim();
    const displayName = topicName || searchBaseName || topicId;

    if (!searchBaseName) {
      console.error(`[AgentExecution] No disease name available for topic ${topicId}, aborting`);
      return [];
    }

    console.log(`[AgentExecution] Running ${agents.length} agents for "${displayName}" (searching: "${searchBaseName}")`);
```

- [ ] Replace the method header and add disease name resolution
- [ ] `cd backend && npx tsc --noEmit`

### Step 1.3: Pass searchBaseName through to buildSearchQuery

**File**: `backend/src/services/agent-execution.service.ts`

**Current** (lines 71-75):
```typescript
        const findings = await this.runSingleAgent(
          agent,
          topicId,
          userId,
          topicName
        );
```

**Change to**:
```typescript
        const findings = await this.runSingleAgent(
          agent,
          topicId,
          userId,
          searchBaseName
        );
```

- [ ] Change `topicName` → `searchBaseName` in `runSingleAgent()` call
- [ ] `cd backend && npx tsc --noEmit`

### Step 1.4: Verify — no other changes needed

The `runSingleAgent()` → `buildSearchQuery()` chain already uses the parameter correctly:
- Line 106: `const searchQuery = this.buildSearchQuery(agent, topicName);`
- Line 187: `const baseQuery = topicName || agent.name;`

These work correctly — they just needed the right value passed in, which Step 1.3 now ensures.

The scheduler at `scheduler.service.ts:208-212` still passes `topic.name` as the 4th argument. This is fine — it now serves only as the logging fallback (the `displayName` variable), not the search query.

- [ ] Confirm scheduler call at `scheduler.service.ts:208-212` needs NO changes
- [ ] `cd backend && npx tsc --noEmit`

---

## Group 2: Backend Execution Endpoint

**Problem**: The frontend "Run Now" runs an entirely separate search pipeline (own `buildSearchQuery`, own dedup, own finding conversion). This needs to delegate to the backend's single code path.

### Step 2.1: Export singleton from agent-execution.service.ts

**File**: `backend/src/services/agent-execution.service.ts`

Add after the class closing brace (after line 663):

```typescript
export const agentExecutionService = new AgentExecutionService();
```

- [ ] Add singleton export
- [ ] `cd backend && npx tsc --noEmit`

### Step 2.2: Add execution route

**File**: `backend/src/routes/agents.routes.ts`

Add import at top (after line 3):
```typescript
import { agentExecutionService } from '../services/agent-execution.service.js';
```

Add route AFTER `POST /agents/repair/:topicId` (after line 184) and BEFORE `PUT /agents/:id` (line 186).

**CRITICAL**: Must be before `POST /agents/:id/run` (line 252) — otherwise Express matches `"run"` as `:id`.

```typescript
// POST /api/agents/run/:topicId - Execute all enabled agents for a topic
// CRITICAL: Must be BEFORE /agents/:id routes to avoid Express matching "run" as :id
router.post('/agents/run/:topicId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topicId } = req.params;

    const agents = await AgentModel.getByTopicId(userId, topicId);
    const enabledAgents = agents.filter(a => a.enabled);

    if (enabledAgents.length === 0) {
      return res.json({ success: true, findingsCount: 0, agentsRun: 0 });
    }

    console.log(`[agents.routes] Executing ${enabledAgents.length} agents for topic ${topicId}`);

    const findings = await agentExecutionService.runAgentsForTopic(
      topicId,
      userId,
      enabledAgents
    );

    // Update last_run for executed agents
    for (const agent of enabledAgents) {
      try {
        await AgentModel.updateLastRun(agent.id, userId);
      } catch (err) {
        console.error(`[agents.routes] Failed to update last_run for ${agent.name}:`, err);
      }
    }

    // Queue digest if findings were found
    if (findings.length > 0) {
      try {
        const { pool } = await import('../db/database.js');
        const DigestQueueServicePG = (await import('../services/digestQueue.service.pg.js')).default;
        const queueService = new DigestQueueServicePG(pool);
        await queueService.createQueueItem({
          userId,
          topicId,
          timeframe: 'weekly',
          digestType: 'smart',
          priority: 5,
          metadata: { source: 'manual-run-now', findingsCount: findings.length }
        });
      } catch (queueError) {
        console.error('[agents.routes] Failed to queue digest:', queueError);
      }
    }

    res.json({
      success: true,
      findingsCount: findings.length,
      agentsRun: enabledAgents.length
    });
  } catch (error) {
    console.error('Error executing agents:', error);
    res.status(500).json({ success: false, error: 'Failed to execute agents' });
  }
});
```

- [ ] Add `agentExecutionService` import
- [ ] Add route after `/agents/repair/:topicId` and BEFORE `/agents/:id` routes
- [ ] Verify route ordering: `POST /agents/run/:topicId` appears before `POST /agents/:id/run`
- [ ] `cd backend && npx tsc --noEmit`

---

## Group 3: Frontend "Run Now" Rewire

### Step 3.1: Update AgentMonitor imports

**File**: `src/components/agents/AgentMonitor.tsx`

**Current** (line 2):
```typescript
import { agentsService, runAgentWithAPI, runAllResearchAgents } from '@/services/agents.service';
```

**Change to**:
```typescript
import { agentsService } from '@/services/agents.service';
import { longOperationApi } from '@/services/api';
```

Note: `longOperationApi` has 5-minute timeout (vs 60s default) — agent execution can take 1-5 minutes.

- [ ] Update imports

### Step 3.2: Replace handleRunAgent

**File**: `src/components/agents/AgentMonitor.tsx`

**Current** (lines 85-121): Calls `runAgentWithAPI(agent, topic)` which runs the entire frontend pipeline.

**Change to**:
```typescript
  const handleRunAgent = async (agent: Agent) => {
    try {
      setRunningAgentId(agent.id);

      const response = await longOperationApi.post(`/agents/run/${agent.topicId}`);
      const { findingsCount = 0 } = response.data;

      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'Agents Complete',
        message: `Found ${findingsCount} new finding${findingsCount !== 1 ? 's' : ''} for ${topics.get(agent.topicId) || 'your topic'}`,
        priority: findingsCount > 10 ? 'high' : 'medium',
        data: { topicId: agent.topicId, findingsCount }
      });

      window.dispatchEvent(new CustomEvent('agent-complete', {
        detail: { topicId: agent.topicId, findingsCount }
      }));

      await loadAgents();
    } catch (error) {
      logger.error('Error running agent:', error);
      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'Agent Run Failed',
        message: 'Agent run failed. Please try again or check settings.',
        priority: 'high'
      });
    } finally {
      setRunningAgentId(null);
    }
  };
```

Note: The backend endpoint runs ALL enabled agents for the topic (not just the clicked one). This is correct — individual agent execution is less useful, and the scheduler already runs all agents per topic.

- [ ] Replace `handleRunAgent`

### Step 3.3: Replace handleRunAllPending

**File**: `src/components/agents/AgentMonitor.tsx`

**Current** (lines 123-197): Complex function calling `runAllResearchAgents(topicId)` per topic.

**Change to**:
```typescript
  const handleRunAllPending = async () => {
    const allAgents = await agentsService.getAgents();
    const topicIds = [...new Set(allAgents.filter(a => a.status !== 'disabled').map(a => a.topicId).filter(Boolean))];

    if (topicIds.length === 0) return;

    setIsRunningAll(true);
    setRunningAllProgress({ current: 0, total: topicIds.length });

    try {
      let totalFindings = 0;

      for (let i = 0; i < topicIds.length; i++) {
        try {
          const response = await longOperationApi.post(`/agents/run/${topicIds[i]}`);
          totalFindings += response.data.findingsCount || 0;
        } catch (error) {
          logger.error(`Error running agents for topic ${topicIds[i]}:`, error);
        }
        setRunningAllProgress({ current: i + 1, total: topicIds.length });
      }

      await loadAgents();

      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'All Agents Complete',
        message: `Found ${totalFindings} new finding${totalFindings !== 1 ? 's' : ''}.`,
        priority: totalFindings > 10 ? 'high' : 'medium'
      });

      window.dispatchEvent(new CustomEvent('agent-complete', {
        detail: { findingsCount: totalFindings }
      }));
    } catch (error) {
      logger.error('Error running agents:', error);
      await notificationService.createNotification({
        type: 'agent_complete',
        title: 'Agent Run Failed',
        message: 'Failed to run agents. Please try again or check settings.',
        priority: 'high'
      });
      await loadAgents();
    } finally {
      setIsRunningAll(false);
      setRunningAllProgress({ current: 0, total: 0 });
    }
  };
```

- [ ] Replace `handleRunAllPending`

### Step 3.4: Remove unused topicsService import

After Steps 3.2-3.3, `topicsService` is no longer called in the component (it was only used in `handleRunAgent` to fetch the full topic for the frontend pipeline). Check if it's still used elsewhere in the file before removing.

- [ ] Grep for `topicsService` usage in AgentMonitor — if only the old `handleRunAgent` used it, remove the import
- [ ] `npm run build`

---

## Group 4: Dead Frontend Code Removal

### Step 4.1: Verify zero callers

```bash
# These should return ONLY agents.service.ts (definitions) — no consumers
grep -rn "runAgentWithAPI\|runAllResearchAgents\|runResearchAgents" src/ --include="*.ts" --include="*.tsx" | grep -v "agents.service.ts"
```

Expected: 0 results (AgentMonitor was updated in Group 3).

- [ ] Confirm zero callers

### Step 4.2: Remove execution methods from agents.service.ts

**File**: `src/services/agents.service.ts`

Remove the following methods from the `AgentsService` class:
1. `runAgent()` (~lines 340-539)
2. `runAllAgents()` (~lines 546-626)
3. `runAgentsByType()` (~lines 631-671)
4. `buildSearchQuery()` (~lines 717-748)
5. `analyzeExistingFindings()` (~lines 750-768)
6. `determineType()` (~lines 770-777)
7. `buildSourceObject()` (~lines 779-799)
8. `determineSourceType()` (~lines 801-810)
9. `calculateCost()` (~lines 812-814)
10. `generateId()` (~lines 816-818) — verify not called by remaining methods
11. `createNotification()` (~lines 820-851)

Replace the execution section comment with:
```typescript
  // ==================== Agent Execution ====================
  // Consolidated to backend: POST /api/agents/run/:topicId
  // See backend/src/services/agent-execution.service.ts for the single execution code path
```

- [ ] Verify `generateId()` has no remaining callers in the class
- [ ] Remove all 11 methods
- [ ] `npm run build` (verify no compile errors)

### Step 4.3: Remove legacy exports

**File**: `src/services/agents.service.ts`

**Current** (~lines 916-919):
```typescript
export const runAgentWithAPI = agentsService.runAgent.bind(agentsService);
export const runAllResearchAgents = agentsService.runAllAgents.bind(agentsService);
export const runResearchAgents = agentsService.runAgentsByType.bind(agentsService);
export const ensureDefaultAgents = agentsService.ensureDefaultAgents.bind(agentsService);
```

Remove lines 916-918. Keep `ensureDefaultAgents` (it's a CRUD operation, still needed).

- [ ] Remove 3 execution exports
- [ ] Keep `ensureDefaultAgents`

### Step 4.4: Remove dead imports

After removing execution methods, check which imports are now unused:
- `import * as searchApi from './api'` — likely dead (only used by execution methods)
- `import { findingsService } from './findings.service'` — likely dead

```bash
grep -n "searchApi\.\|findingsService\." src/services/agents.service.ts
```

- [ ] Remove confirmed-dead imports
- [ ] `npm run build`

---

## Event System Impact

Two window events exist:
- `'agent-complete'` → listened by `AppWithAuth.tsx`, `NotificationCenter.tsx`, `HomePage.tsx` (UI refresh)
- `'agents-complete'` → listened by `digest.service.ts` (triggers frontend digest queue API call)

After this plan:
- `'agent-complete'` is emitted by the new `AgentMonitor` code (Steps 3.2, 3.3) ✅
- `'agents-complete'` is NO LONGER emitted (the old `agents.service.ts` execution code emitted it)
- This is **correct** — the backend endpoint already queues digests directly via `digestQueue.service.pg`. The frontend `digest.service.ts` listener becomes a no-op (it never fires), which is harmless.
- The listener in `digest.service.ts` can be cleaned up in a future plan (not in scope here — avoid scope creep).

---

## Deployment

```bash
# Build verification
cd backend && npx tsc --noEmit
cd .. && npm run build

# Deploy
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build
```

### Post-Deployment Verification

```bash
# 1. Verify sourceType normalization (Group 0)
# Regenerate ben4mn's broken digest (see Step 0.7 for full SQL commands)
# Then check logs:
docker logs medical-companion --tail 30 2>&1 | grep -E 'Zod|recovery|Completed digest'
# Expected: '✓ Zod validation successful' — NOT 'Zod validation failed'

# 2. Verify disease name resolution in scheduler logs (Group 1)
# Backdate one agent to trigger:
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "UPDATE agents SET last_run = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE id = (SELECT id FROM agents LIMIT 1);"
# Wait for scheduler cycle, then:
docker logs medical-companion --tail 50 2>&1 | grep "searching:"
# Expected: 'searching: "Deletion syndrome"' or 'searching: "Acromegaly"' — NOT "Genetic condition"

# 3. Verify new endpoint works (Group 2)
docker logs medical-companion --tail 50 2>&1 | grep "agents.routes"

# 4. Verify no duplicate findings
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "SELECT title, COUNT(*) FROM findings GROUP BY title HAVING COUNT(*) > 1;"

# 5. Manual test: Open app → Agents → click "Run Now" → verify notification + findings
# Network tab should show single POST to /api/agents/run/<topicId>
# Should NOT show requests to /api/pubmed-search, /api/websearch, /api/clinical-trials

# 6. Verify source breakdown consistency
# Compare backend countSourcesByType vs AI-generated breakdown for a topic:
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \
  "SELECT source->>'type', COUNT(*) FROM findings WHERE topic_id = '2493d6cb-16de-4a89-8613-0418bed332b3' GROUP BY source->>'type' ORDER BY count DESC;"
# 'journal' findings should now count toward pubmed in digest source_breakdown
```

---

## Rollback Plan

| Group | Rollback |
|-------|----------|
| 0 | `git checkout -- backend/src/services/ai.service.ts backend/src/services/digest-processor.service.ts` |
| 1 | `git checkout -- backend/src/services/agent-execution.service.ts` |
| 2 | `git checkout -- backend/src/routes/agents.routes.ts backend/src/services/agent-execution.service.ts` |
| 3 | `git checkout -- src/components/agents/AgentMonitor.tsx` |
| 4 | `git checkout -- src/services/agents.service.ts` |

---

## Estimated Impact

- **Lines removed**: ~480 (execution code in `agents.service.ts`)
- **Lines added**: ~90 (sourceType normalization + disease name resolution + route endpoint)
- **Net**: ~390 lines removed
- **Runtime cost**: One `TopicModel.getById()` PK lookup per scheduler run per topic (negligible)

---

## Design Notes: Why Normalize at the Prompt Boundary

Three approaches were considered for the sourceType fix:

1. **Normalize at agent creation** (`buildSource()` in `agent-execution.service.ts`): Would change the raw `source.type` stored in findings. Risk: breaks existing DB data contracts, affects source display elsewhere.

2. **Widen the Zod enum** (add `research_article`, `web_article`, `journal`, `medical_site`): Would require updating the enum in 3 places (`NotableFindingSchema`, `FeaturedDiscoverySchema`, `TopFindingSchema`). Risk: the AI could use inconsistent types for the same source, making source breakdown unreliable.

3. **Normalize at the prompt boundary** (chosen): The AI only ever sees 4 canonical types. The Zod schema stays strict (4 values). Existing DB data is untouched. Matches the existing `getSourceCategory()` and `countSourcesByType()` normalization pattern already used for display.

Option 3 was chosen because it's the least invasive, has no data migration risk, and follows the existing codebase pattern of normalizing at consumption boundaries.

---

## Sign-Off Checklist

- [ ] Group 0 complete (sourceType normalization + recovery fix)
- [ ] Group 0 verified (ben4mn's digest regenerated with real content)
- [ ] Group 1 complete (backend query resolution)
- [ ] Group 2 complete (execution endpoint)
- [ ] Group 3 complete (frontend rewire)
- [ ] Group 4 complete (dead code removal)
- [ ] Backend builds: `cd backend && npx tsc --noEmit`
- [ ] Frontend builds: `npm run build`
- [ ] Deployed to production
- [ ] Post-deployment: Zod validation succeeds for new digests
- [ ] Post-deployment: disease name appears in query logs
- [ ] Post-deployment: manual "Run Now" works via backend endpoint
- [ ] CLAUDE.md plan table updated
