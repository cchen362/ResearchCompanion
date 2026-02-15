# Plan 023: Backend Refactoring — Critical Bugs, Dedup, Dead Code Cleanup

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan fixes critical backend bugs, eliminates duplicate API calls, consolidates endpoints, and removes ~850 lines of dead code. Organized into 5 groups by dependency order.

| Group | Risk | Files | DB Changes |
|-------|------|-------|------------|
| 1 — Critical bug fixes | ZERO (one-line fixes, proven patterns) | 3 | None |
| 2 — init.sql sync | ZERO (schema-only, no runtime effect on existing DB) | 1 | None (schema file update) |
| 3 — Dead code cleanup | LOW (deleting confirmed-dead files) | 8 deleted, 2 modified | None |
| 4 — Endpoint consolidation | LOW (moving working code between files) | 2 | None |
| 5 — Frontend performance | LOW (props/polling changes) | 3 | None |

**Prerequisite**: Plan 022 (Product Readiness) must be COMPLETE.

---

## Strict Rules

### MUST DO
- [ ] Follow groups IN ORDER (1 → 2 → 3 → 4 → 5)
- [ ] Run `cd backend && npx tsc --noEmit` after every backend file change
- [ ] Run `npm run build` after completing Groups 3 and 5
- [ ] Read the referenced file and line numbers BEFORE making each change
- [ ] Verify each deletion candidate has zero importers before deleting

### MUST NOT DO
- [ ] Do NOT delete `src/services/researchInsights.service.ts` — it IS actively used by `export.service.ts:5`
- [ ] Do NOT modify the scheduler service, queue service, or agent-execution service
- [ ] Do NOT change any mobile/responsive CSS (not in scope)
- [ ] Do NOT add new npm dependencies
- [ ] Do NOT modify the auth middleware (`backend/src/middleware/auth.ts`)
- [ ] Do NOT change the database connection config (`backend/src/db/database.ts`)

---

## Files Modified

| File | Group | Changes |
|------|-------|---------|
| `backend/src/routes/digest.routes.ts` | 1, 4 | Fix userId accessor (line 16), remove dead GET + simplify-digest endpoints |
| `backend/src/models/finding.model.ts` | 1 | Add `RETURNING id` to delete + deleteBulk queries |
| `backend/src/routes/chat.routes.ts` | 1 | Add `limit: 50` to unbounded findings query |
| `backend/src/db/init.sql` | 2 | Rewrite digests table, add digest_queue + notifications tables, add topics column, remove dead tables |
| `backend/src/index.ts` | 3 | Remove SQLite userDatabase import and initialization |
| `backend/src/routes/digests.crud.routes.ts` | 4 | Add temporal enrichment and view tracking to GET /latest/:topicId |
| `src/components/TopicManager.tsx` | 5 | Accept parent props, remove duplicate topics fetch, parallelize agent counts |
| `src/components/agents/AgentMonitor.tsx` | 5 | Accept optional topics prop, replace N+1 topic name lookups |
| `src/components/NotificationCenter.tsx` | 5 | Replace 2-second polling with visibility-based refresh |
| `src/components/home/index.ts` | 3 | Remove dead exports |

## Files Deleted

| File | Group | Reason |
|------|-------|--------|
| `src/App.tsx` | 3 | Dead — `main.tsx` imports only `AppWithAuth` (288 lines) |
| `src/services/notification-stream.service.ts` | 3 | Only imported by dead `App.tsx` |
| `backend/src/database/users.db.ts` | 3 | Legacy SQLite — all auth uses PostgreSQL |
| `src/components/home/ActivityChart.tsx` | 3 | Never imported (also imports heavyweight recharts) |
| `src/components/home/DigestSignposts.tsx` | 3 | Never imported |
| `src/components/CitationLink.tsx` | 3 | Never imported |

---

## Group 1: Critical Backend Bug Fixes

### Step 1.1: Fix wrong userId accessor in digest.routes.ts

**File**: `backend/src/routes/digest.routes.ts` line 16

**Current** (BROKEN):
```typescript
const userId = (req as any).userId;
```

**Fix**:
```typescript
const userId = (req as any).user.id;
```

**Why**: The auth middleware (`backend/src/middleware/auth.ts` lines 38-42) sets `req.user = { id, userId, email }`. It does NOT set `req.userId` directly. Every other route file in the codebase uses `(req as any).user.id`. This bug causes `userId` to be `undefined`, so the SQL query `WHERE topic_id = $1 AND user_id = $2` matches nothing — temporal enrichment and view tracking are completely broken.

- [ ] Change line 16
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 1.2: Fix finding delete always returning false

**File**: `backend/src/models/finding.model.ts`

The `query()` helper in `database.ts` line 47 returns `result.rows`. Without `RETURNING`, PostgreSQL `DELETE` returns zero rows — so `result.length` is always 0.

**`delete()` method (lines 237-243)** — change line 239:
```diff
- 'DELETE FROM findings WHERE id = $1 AND user_id = $2',
+ 'DELETE FROM findings WHERE id = $1 AND user_id = $2 RETURNING id',
```

**`deleteBulk()` method (lines 246-252)** — change line 248:
```diff
- 'DELETE FROM findings WHERE id = ANY($1) AND user_id = $2',
+ 'DELETE FROM findings WHERE id = ANY($1) AND user_id = $2 RETURNING id',
```

**Reference**: `digest.model.ts` line 151 already uses this pattern: `'DELETE FROM digests WHERE id = $1 AND user_id = $2 RETURNING id'`

- [ ] Fix `delete()` query (line 239)
- [ ] Fix `deleteBulk()` query (line 248)
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 1.3: Fix chat unbounded findings query

**File**: `backend/src/routes/chat.routes.ts` line 783-785

**Current** (BUG — contradicts the `limit: 50` on line 723):
```typescript
const allTopicFindings = await FindingModel.getFiltered(userId, {
  topic_id: topicId
  // No limit - get all findings for complete context
});
```

**Fix**:
```typescript
const allTopicFindings = await FindingModel.getFiltered(userId, {
  topic_id: topicId,
  limit: 50
});
```

**Why**: A topic with 500+ findings would load all of them into the AI prompt, exploding token costs (~25K+ wasted tokens) and causing slow/failed responses. The comment on line 725 says `// CRITICAL: This must match the frontend limit in ChatPanel.tsx`, confirming 50 is the design limit.

- [ ] Add `limit: 50` at line 784
- [ ] Remove the misleading "No limit" comment
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

## Group 2: Sync init.sql with Current Schema

This group updates the schema file for fresh deployments only. The production database already has the correct schema via manual migrations. No runtime effect.

**File**: `backend/src/db/init.sql`

### Step 2.1: Rewrite the digests table (lines 87-113)

Replace the entire `CREATE TABLE IF NOT EXISTS digests` block. The current definition has 13 dead columns and is missing 3 required columns.

**New digests table** (must match `digest.model.ts` create() at lines 79-99):
```sql
CREATE TABLE IF NOT EXISTS digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500),
    whats_new JSONB DEFAULT '{}'::jsonb,
    key_takeaways JSONB DEFAULT '[]'::jsonb,
    featured_discovery JSONB DEFAULT NULL,
    notable_findings JSONB DEFAULT '[]'::jsonb,
    source_breakdown JSONB DEFAULT NULL,
    for_your_doctor JSONB DEFAULT '{}'::jsonb,
    finding_ids UUID[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Columns removed** (dead — not written by any model/service):
1. `executive_summary` 2. `contradictions` 3. `breakthroughs` 4. `knowledge_gaps`
5. `next_steps` 6. `layman_summary` 7. `clinical_implications` 8. `lifestyle_considerations`
9. `questions_for_doctor` 10. `warning_signs` 11. `top_findings` 12. `research_pulse`
13. `worth_revisiting`

- [ ] Replace digests CREATE TABLE block

---

### Step 2.2: Add `last_digest_viewed_at` to topics table (line 47)

In the `CREATE TABLE IF NOT EXISTS topics` block, add after `sort_order INTEGER DEFAULT 0`:
```sql
    last_digest_viewed_at TIMESTAMP WITH TIME ZONE,
```

This column is used by `TopicModel.updateLastDigestViewed()` (topic.model.ts line 124) and the temporal enrichment code.

- [ ] Add column to topics table

---

### Step 2.3: Add `digest_queue` table

Add after the digests table definition. Copy from `backend/src/db/migrations/006_create_digest_queue.sql`:

```sql
-- Digest generation queue
CREATE TABLE IF NOT EXISTS digest_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL,
    digest_type VARCHAR(50) NOT NULL DEFAULT 'smart',
    timeframe VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    result_id UUID REFERENCES digests(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT unique_active_queue UNIQUE NULLS NOT DISTINCT (user_id, topic_id, digest_type, timeframe, status)
);
```

Also add the queue indexes:
```sql
CREATE INDEX idx_digest_queue_user_topic ON digest_queue(user_id, topic_id);
CREATE INDEX idx_digest_queue_status ON digest_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_digest_queue_created_at ON digest_queue(created_at DESC);
CREATE INDEX idx_digest_queue_topic_timeframe ON digest_queue(topic_id, timeframe);
```

And the two PL/pgSQL functions (`cancel_stale_digest_queue_items` and `get_active_queue_for_topic`) from the migration file.

- [ ] Add digest_queue table + indexes + functions

---

### Step 2.4: Add `notifications` table

The `NotificationModel` (`backend/src/models/notification.model.ts`) INSERTs into a `notifications` table that is NOT defined anywhere in init.sql or migrations. Add:

```sql
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
```

- [ ] Add notifications table + indexes

---

### Step 2.5: Remove dead tables

Remove these CREATE TABLE blocks and their associated indexes/triggers from init.sql:
- `timeline_events` (lines 116-129) — deprecated per CLAUDE.md
- `audio_recordings` (lines 132-146) — deprecated
- `api_usage` (lines 191-200) — never used by any model/route

Also remove:
- `idx_timeline_*` indexes (lines 227-229)
- `idx_audio_*` index (line 230)
- `idx_api_usage_*` indexes (lines 238-239)
- `update_timeline_updated_at` trigger (lines 262-263)

- [ ] Remove timeline_events table, indexes, trigger
- [ ] Remove audio_recordings table, index
- [ ] Remove api_usage table, indexes

---

### Step 2.6: Add composite indexes for common query patterns

Add these after existing indexes:
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_findings_user_topic ON findings(user_id, topic_id);
CREATE INDEX idx_digests_user_topic ON digests(user_id, topic_id);
CREATE INDEX idx_digests_created_at ON digests(created_at DESC);
```

- [ ] Add composite indexes
- [ ] Review: compare final init.sql columns with `digest.model.ts` create() and `digests.crud.routes.ts` CreateDigestSchema

---

## Group 3: Dead Code Cleanup

### Step 3.1: Delete dead `App.tsx` and orphaned notification-stream service

**Verification**: `src/main.tsx` line 4 imports `AppWithAuth`, NOT `App`. No other file imports `./App`.

**Files to delete**:
1. `src/App.tsx` (288 lines — old pre-auth app shell)
2. `src/services/notification-stream.service.ts` (only imported by dead App.tsx)

- [ ] Verify no imports of `App.tsx` (grep for `from ['"].*\/App['"]` excluding `App.css`, `AppWithAuth`)
- [ ] Verify no imports of `notification-stream.service` outside App.tsx
- [ ] Delete `src/App.tsx`
- [ ] Delete `src/services/notification-stream.service.ts`

---

### Step 3.2: Delete legacy SQLite user database

**File to delete**: `backend/src/database/users.db.ts`

**File to modify**: `backend/src/index.ts`
- Remove line 26: `import { userDatabase } from './database/users.db.js';`
- Remove line 50: `await userDatabase.initialize();`
- The comment on line 49 (`// Initialize legacy user database (for backward compatibility)`) should also be removed

After removal, `initializeDatabases()` (lines 41-54) should be:
```typescript
const initializeDatabases = async () => {
  try {
    const pgConnected = await testConnection();
    if (!pgConnected) {
      console.error('⚠️ PostgreSQL connection failed - some features may not work');
    }
  } catch (error) {
    console.error('Failed to initialize databases:', error);
  }
};
```

- [ ] Delete `backend/src/database/users.db.ts`
- [ ] Remove import and initialization from `backend/src/index.ts`
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 3.3: Delete dead frontend components

**Files to delete** (confirmed zero importers):
1. `src/components/home/ActivityChart.tsx` — barrel-exported but never consumed; imports heavyweight `recharts`
2. `src/components/home/DigestSignposts.tsx` — barrel-exported but never consumed
3. `src/components/CitationLink.tsx` — defined but never imported

**File to modify**: `src/components/home/index.ts`

Current (lines 1-6):
```typescript
export { HeroSection } from './HeroSection';
export { TopicFilter } from './TopicFilter';
export { FindingsHighlights } from './FindingsHighlights';
export { DigestSignposts } from './DigestSignposts';
export { ContextualCTAs } from './ContextualCTAs';
export { ActivityChart } from './ActivityChart';
```

After:
```typescript
export { HeroSection } from './HeroSection';
export { TopicFilter } from './TopicFilter';
export { FindingsHighlights } from './FindingsHighlights';
export { ContextualCTAs } from './ContextualCTAs';
```

- [ ] Delete `src/components/home/ActivityChart.tsx`
- [ ] Delete `src/components/home/DigestSignposts.tsx`
- [ ] Delete `src/components/CitationLink.tsx`
- [ ] Remove dead exports from `src/components/home/index.ts` (lines 4 and 6)
- [ ] Build verify: `npm run build`

---

## Group 4: Endpoint Consolidation

**Depends on**: Group 1 (Bug 1 fix) — the temporal enrichment code must use the correct userId before we move it.

### Step 4.1: Migrate temporal enrichment to the CRUD endpoint

**Source**: `backend/src/routes/digest.routes.ts` lines 64-91 (the temporal enrichment + view tracking code)

**Target**: `backend/src/routes/digests.crud.routes.ts` — the `GET /digests/latest/:topicId` handler (lines 55-153)

**Add imports** at the top of `digests.crud.routes.ts`:
```typescript
import { TopicModel } from '../models/topic.model.js';
import { FindingModel } from '../models/finding.model.js';
```

**Add temporal enrichment block** — insert AFTER digest is resolved (~after line 89, inside the `if (digest)` path) and BEFORE the response (line 141). Add between lines 89 and 131:

```typescript
    // Temporal enrichment: personalize whatsNew based on time away
    if (digest) {
      try {
        const topic = await TopicModel.getById(topicId, userId);
        const lastViewed = topic?.last_digest_viewed_at;
        if (lastViewed && digest.whats_new) {
          const daysAway = Math.floor((Date.now() - new Date(lastViewed).getTime()) / 86400000);
          if (daysAway > 1) {
            const newCount = await FindingModel.countSince(userId, topicId, new Date(lastViewed));
            if (newCount > 0) {
              const whatsNew = typeof digest.whats_new === 'string'
                ? JSON.parse(digest.whats_new) : digest.whats_new;
              const restTech = whatsNew.technical?.replace(/^[^.]+\./, '').trim() || '';
              const restExpl = whatsNew.explained?.replace(/^[^.]+\./, '').trim() || '';
              whatsNew.technical = `${newCount} new findings in your ${daysAway} days away. ${restTech}`;
              whatsNew.explained = `${newCount} new findings in your ${daysAway} days away. ${restExpl}`;
              digest.whats_new = whatsNew;
            }
          }
        }
      } catch (temporalErr) {
        console.error('[DIGEST] Temporal enrichment failed:', temporalErr);
      }

      // Track that user viewed this digest
      try {
        await TopicModel.updateLastDigestViewed(topicId, userId);
      } catch (trackErr) {
        console.error('[DIGEST] Failed to track digest view:', trackErr);
      }
    }
```

**⚠️ CRITICAL FIELD NAME**: Use `digest.whats_new` (snake_case). The CRUD endpoint uses raw DB column names from `SELECT *`. The old `digest.routes.ts` used SQL aliases (`whats_new as "whatsNew"`) which is why it accessed `digest.whatsNew`. The CRUD route does NOT alias.

- [ ] Add imports for TopicModel and FindingModel
- [ ] Add temporal enrichment block after line 89
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

### Step 4.2: Remove duplicate/dead endpoints from digest.routes.ts

**File**: `backend/src/routes/digest.routes.ts`

**Remove** the entire `GET /by-topic/:topicId` handler (lines 10-104):
- This endpoint is now fully replaced by the enriched CRUD endpoint
- The frontend never called it anyway (uses `/api/digests/latest/:topicId`)

**Remove** the entire `POST /simplify-digest` handler (find it after the generate-digest handler):
- This is a placeholder that just adds `isSimplified: true` — no actual simplification

**Clean up imports** — after removing these handlers, the following imports are no longer needed:
- `pool` (line 4) — was used for the direct SQL query in the GET handler
- `TopicModel` (line 5) — was used for temporal enrichment (now in CRUD route)
- `FindingModel` (line 6) — was used for countSince (now in CRUD route)

**Keep**: `POST /generate-digest` and `POST /research-and-digest` — these serve distinct purposes.

After cleanup, the remaining imports should be:
```typescript
import { Router } from 'express';
import { generateSmartDigest, scoreAndClusterFindings } from '../services/ai.service.js';
import { searchService } from '../services/search.service.js';
```

Also check if `DigestModel` is imported and still needed by the remaining endpoints. If not, remove that import too.

- [ ] Remove GET /by-topic/:topicId handler (lines 10-104)
- [ ] Remove POST /simplify-digest handler
- [ ] Clean up unused imports
- [ ] Build verify: `cd backend && npx tsc --noEmit`

---

## Group 5: Frontend Performance Fixes

### Step 5.1: Fix TopicManager — accept parent props, eliminate duplicate fetch

**File**: `src/components/TopicManager.tsx`

**Change props interface** (lines 7-9):
```typescript
interface TopicManagerProps {
  topics: Topic[];
  setTopics: (topics: Topic[]) => void;
  selectedTopic: Topic | null;
  setSelectedTopic: (topic: Topic | null) => void;
}
```

**Change component signature** (line 11):
```typescript
export default function TopicManager({ topics, setTopics, selectedTopic, setSelectedTopic }: TopicManagerProps) {
```

**Remove internal state** that duplicates parent data:
- Remove `const [topics, setTopics] = useState<Topic[]>([]);` (line 12) — now comes from props
- Remove `const [loading, setLoading] = useState(true);` (line 15) — parent handles initial load

**Rewrite `loadTopics()`** (lines 22-44) to refresh via the parent AND parallelize agent counts:
```typescript
const loadTopics = async () => {
  try {
    const allTopics = await topicsService.getTopics();
    setTopics(allTopics);

    // Fetch agent counts in parallel (fixes N+1 sequential pattern)
    const counts: Record<string, number> = {};
    const results = await Promise.all(
      allTopics.map(async (topic) => {
        const agents = await agentsService.getAgents(topic.id);
        return { topicId: topic.id, count: agents.length };
      })
    );
    results.forEach(({ topicId, count }) => { counts[topicId] = count; });
    setAgentCounts(counts);
  } catch (error) {
    logger.error('[TopicManager] Error loading topics:', error);
  }
};
```

**Update useEffect** (lines 18-20) — only load agent counts when topics are available:
```typescript
useEffect(() => {
  if (topics.length > 0) {
    // Load agent counts for topics provided by parent
    const loadAgentCounts = async () => {
      const counts: Record<string, number> = {};
      const results = await Promise.all(
        topics.map(async (topic) => {
          const agents = await agentsService.getAgents(topic.id);
          return { topicId: topic.id, count: agents.length };
        })
      );
      results.forEach(({ topicId, count }) => { counts[topicId] = count; });
      setAgentCounts(counts);
    };
    loadAgentCounts();
  }
}, [topics]);
```

**Remove loading spinner** (around lines 72-78) — the parent already provides topics.

**Note**: The `loadTopics()` function is still needed for after creating/editing/deleting topics (to refresh via parent's `setTopics`). The `onTopicsChange` callback can be removed since `setTopics` now serves that purpose.

- [ ] Update props interface and component signature
- [ ] Remove duplicate internal state
- [ ] Rewrite loadTopics with Promise.all
- [ ] Update useEffect for initial load
- [ ] Remove loading spinner
- [ ] Build verify: `npm run build`

---

### Step 5.2: Fix AgentMonitor — accept topics prop, eliminate N+1 lookups

**File**: `src/components/agents/AgentMonitor.tsx`

**Add props interface** and update signature (line 32):
```typescript
interface AgentMonitorProps {
  topics?: Topic[];
  selectedTopic?: Topic | null;
}

export default function AgentMonitor({ topics: passedTopics, selectedTopic }: AgentMonitorProps = {}) {
```

**Add import** for `Topic` type if not present:
```typescript
import type { Agent, DigestSourceType, Topic } from '@/types';
```

**Replace the N+1 topic name loading** in `loadAgents()` (lines 57-66):

```typescript
// Current (N+1 sequential):
for (const topicId of uniqueTopicIds) {
  try {
    const topic = await topicsService.getTopic(topicId);
    if (topic) {
      topicMap.set(topicId, topic.name);
    }
  } catch (error) { ... }
}

// Replace with:
if (passedTopics && passedTopics.length > 0) {
  // Use parent's topics — zero API calls
  for (const t of passedTopics) {
    topicMap.set(t.id, t.name);
  }
} else {
  // Fallback: parallel API calls
  await Promise.all(uniqueTopicIds.map(async (topicId) => {
    try {
      const topic = await topicsService.getTopic(topicId);
      if (topic) topicMap.set(topicId, topic.name);
    } catch (error) {
      logger.error(`Error loading topic ${topicId}:`, error);
    }
  }));
}
```

- [ ] Add props interface and update signature
- [ ] Add Topic type import
- [ ] Replace sequential topic loading with props-based approach
- [ ] Build verify: `npm run build`

---

### Step 5.3: Replace 2-second notification polling with visibility-based refresh

**File**: `src/components/NotificationCenter.tsx`

**Remove** the 2-second interval (lines 28-31):
```typescript
// DELETE THIS:
const interval = setInterval(() => {
  loadNotifications();
}, 2000);
```

**Replace with** visibility-based refresh:
```typescript
// Refresh when user returns to tab
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    loadNotifications();
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);
```

**Update cleanup** (lines 41-45):
```typescript
return () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('notification-created', handleNotificationCreated);
  window.removeEventListener('agent-complete', handleNotificationCreated);
};
```

Remove `clearInterval(interval)` from cleanup since there's no interval.

**Keep**: The `notification-created` and `agent-complete` event listeners (lines 34-39) — these provide real-time updates when agents complete.

- [ ] Remove 2-second setInterval
- [ ] Add visibilitychange listener
- [ ] Update cleanup function
- [ ] Build verify: `npm run build`

---

## Verification Checklist

### Group 1: Critical Bug Fixes
- [ ] `cd backend && npx tsc --noEmit` passes cleanly
- [ ] Grep for `(req as any).userId` in all route files — should find ZERO matches (all should be `(req as any).user.id`)
- [ ] `finding.model.ts` delete() and deleteBulk() both have `RETURNING id`
- [ ] `chat.routes.ts` unbounded query now has `limit: 50`

### Group 2: init.sql
- [ ] Digests table columns match `digest.model.ts` create() exactly: `user_id, topic_id, type, title, whats_new, key_takeaways, finding_ids, metadata, featured_discovery, notable_findings, source_breakdown, for_your_doctor`
- [ ] Topics table has `last_digest_viewed_at` column
- [ ] `digest_queue` table defined with all indexes and functions
- [ ] `notifications` table defined with indexes
- [ ] No `timeline_events`, `audio_recordings`, or `api_usage` tables
- [ ] No dead digest columns (executive_summary, contradictions, breakthroughs, etc.)

### Group 3: Dead Code
- [ ] `src/App.tsx` deleted
- [ ] `src/services/notification-stream.service.ts` deleted
- [ ] `backend/src/database/users.db.ts` deleted
- [ ] `backend/src/index.ts` has no SQLite imports or initialization
- [ ] `src/components/home/ActivityChart.tsx` deleted
- [ ] `src/components/home/DigestSignposts.tsx` deleted
- [ ] `src/components/CitationLink.tsx` deleted
- [ ] `npm run build` passes cleanly

### Group 4: Endpoint Consolidation
- [ ] `digests.crud.routes.ts` GET /latest/:topicId has temporal enrichment code
- [ ] Temporal enrichment uses `digest.whats_new` (snake_case, NOT camelCase)
- [ ] `digest.routes.ts` no longer has GET /by-topic/:topicId
- [ ] `digest.routes.ts` no longer has POST /simplify-digest
- [ ] `digest.routes.ts` still has POST /generate-digest and POST /research-and-digest
- [ ] `cd backend && npx tsc --noEmit` passes cleanly

### Group 5: Frontend Performance
- [ ] TopicManager accepts `topics`, `setTopics`, `selectedTopic`, `setSelectedTopic` props
- [ ] TopicManager does NOT call `topicsService.getTopics()` on mount (uses parent's data)
- [ ] TopicManager uses `Promise.all` for agent count loading
- [ ] AgentMonitor accepts optional `topics` prop and uses it for topic names
- [ ] NotificationCenter has NO `setInterval` — uses `visibilitychange` instead
- [ ] `npm run build` passes cleanly

### Final
- [ ] `cd backend && npx tsc --noEmit` — zero errors
- [ ] `npm run build` — zero errors

---

## Deployment Steps

1. `ssh chee@100.94.82.35`
2. `cd /home/chee/medical-pwa`
3. `git pull`
4. `docker compose down && docker compose up -d --build`
5. No migration SQL needed — all changes are in code. init.sql only affects fresh deploys.
6. Verify: `docker logs medical-companion --tail 50 2>&1` — no startup errors

---

## Rollback Plan

### Groups 1-4 (backend)
Revert the 4 backend files to previous versions. No DB changes to undo.

### Group 5 (frontend)
Revert the 3 frontend files to previous versions.

### init.sql
Only affects fresh deployments. Revert to previous version if needed.

---

## Sign-Off

| Group | Completed | Date | Notes |
|-------|-----------|------|-------|
| 1 — Critical bug fixes | [ ] | | |
| 2 — init.sql sync | [ ] | | |
| 3 — Dead code cleanup | [ ] | | |
| 4 — Endpoint consolidation | [ ] | | |
| 5 — Frontend performance | [ ] | | |
| Deployment | [ ] | | |
| Verification | [ ] | | |
