# Server Storage Implementation - Issues & Fixes

## Overview

This document tracks the work done to enable server-side storage (PostgreSQL) for the Medical Companion PWA, replacing the default IndexedDB local storage.

## Configuration

Set `VITE_USE_SERVER_STORAGE=true` in `.env` to enable server storage mode.

---

## Issues Identified & Fixes Applied

### CRITICAL FIX (February 3, 2026): Digest Generation Race Conditions (PARTIALLY FIXED)
**Problem:** Multiple cascading issues causing digest persistence problems:
1. Digest resets when navigating away from Findings page
2. Queue items stuck in PENDING state but never processing
3. Old digests (2+ days old) being returned instead of generating new ones
4. Auto-queue interference causing unnecessary regeneration
5. Result_id not being set after digest generation completes

**Root Causes Discovered:**
1. **State Loss on Navigation**: Component unmounting lost all digest/queue state
2. **Queue Reset Logic Flaw**: Completed queue items reset to pending without checking recency
3. **Deduplication Race**: Old digest returned while queue still pending/processing
4. **Missing result_id**: Digest creation didn't update queue with result_id
5. **Auto-queue Interference**: Automatic queue creation conflicting with manual requests

**CRITICAL DISCOVERY - The Real Issue:**
The digest IS being generated successfully (60+ seconds of AI processing), but when trying to SAVE the new digest:
- Deduplication logic kicks in AFTER generation
- Returns the OLD digest (Feb 1) instead of saving the new one
- New digest is thrown away, wasting the AI generation
- result_id points to old digest

**Fixes Applied:**
1. **Prevented Recent Queue Resets**: Added 24-hour check before resetting completed queues
2. **Fixed result_id Assignment**: Queue now properly updated with digest ID after creation
3. **Queue-First Deduplication**: Check queue status BEFORE returning cached digest
4. **Zustand State Persistence**: Created digestStore to persist state across navigation
5. **Removed Auto-Queue**: Disabled automatic digest generation on page load
6. **5-Minute Fresh Digest Window**: Skip deduplication if queue completed < 5 minutes ago (NEW)

**Files Modified:**
- `backend/src/services/digestQueue.service.pg.ts` - Added 24-hour completion check
- `backend/src/routes/digests.crud.routes.ts` - Update queue with result_id, check queue before dedup, added 5-min window
- `src/stores/digestStore.ts` - NEW: Zustand store for persistent digest state
- `src/components/FindingsViewerProgressive.tsx` - Use digest store, removed auto-queue

**Deployment:** Deployed to production at 100.94.82.35 on February 3, 2026

**Status:** ISSUE PERSISTS - Deduplication still returning old digests after generation

### Issue 1: ID Format Mismatch (FIXED)
**Problem:** Frontend generated timestamp-based IDs (`1768649044376-4cx3941qu`) but PostgreSQL expects UUIDs.

**Fix:** Changed API services to always POST new records and let the server assign UUIDs, rather than generating IDs client-side.

**Files Modified:**
- `src/services/findings.api.service.ts` - Always POST for new findings
- `src/services/agents.api.service.ts` - Always POST for new agents
- `src/services/digests.api.service.ts` - Always POST for new digests
- `src/services/topics.api.service.ts` - Always POST for new topics, added `updateTopic()` method

### Issue 2: Zod Validation Rejecting Null Values (FIXED)
**Problem:** Backend Zod schemas used `.optional()` which allows `undefined` but not `null`. Frontend sometimes sends `null` for optional fields.

**Fix:** Added `.nullable()` to Zod schemas for optional UUID fields.

**Files Modified:**
- `backend/src/routes/findings.routes.ts` - Added `.nullable()` to topic_id, agent_id
- `backend/src/routes/agents.routes.ts` - Added `.nullable()` to topic_id
- `backend/src/routes/digests.crud.routes.ts` - Added `.nullable()` to topic_id
- `backend/src/routes/conversations.routes.ts` - Added `.nullable()` to topic_id

### Issue 3: TypeScript Model Types (FIXED)
**Problem:** Backend TypeScript interfaces didn't allow `null` for optional fields.

**Fix:** Added `| null` to type definitions.

**Files Modified:**
- `backend/src/models/finding.model.ts`
- `backend/src/models/agent.model.ts`
- `backend/src/models/digest.model.ts`
- `backend/src/models/conversation.model.ts`

### Issue 4: Auth Using SQLite Instead of PostgreSQL (FIXED)
**Problem:** Auth service used SQLite for users, but other tables had foreign key constraints to PostgreSQL users table.

**Fix:** Migrated auth.service.ts to use PostgreSQL pool instead of SQLite database.

**Files Modified:**
- `backend/src/services/auth.service.ts` - Replaced SQLite with PostgreSQL queries
- `backend/src/db/init.sql` - Added user_sessions table
- `backend/src/types/session.ts` - Added session interface

### Issue 5: Database Connection Errors (FIXED)
**Problem:** Docker container couldn't connect to PostgreSQL - "connection terminated" errors.

**Fix:**
1. Fixed hardcoded localhost in database.ts
2. Used proper Docker network DNS (`medcompanion-postgres:5432`)
3. Added connection retry logic with 5 second delay
4. Added health checks in docker-compose.yml

**Files Modified:**
- `backend/src/db/database.ts` - Dynamic connection string from DATABASE_URL
- `docker-compose.yml` - Added depends_on with health check
- `backend/.env.docker` - Set DATABASE_URL with Docker network hostname

### Issue 6: Missing Fields in Database Tables (FIXED)
**Problem:** Some tables missing columns that the models expected.

**Fix:** Created comprehensive migration scripts to add missing columns.

**Files Modified:**
- `backend/src/db/migrations/*.sql` - Multiple migration files for each table
- Created separate migration for each missing field to avoid conflicts

### Issue 7: Transaction Support for Data Consistency (FIXED)
**Problem:** Complex operations like creating topic + agents + findings could partially fail.

**Fix:** Wrapped operations in PostgreSQL transactions.

**Files Modified:**
- `backend/src/routes/agents.routes.ts` - Added transaction support for batch operations
- `backend/src/routes/findings.routes.ts` - Transaction wrapper for multi-finding saves

### Issue 8: Frontend Not Using Server Storage (FIXED)
**Problem:** Even with VITE_USE_SERVER_STORAGE=true, frontend still used IndexedDB.

**Fix:**
1. Fixed import paths to use `.api.service` modules
2. Added proper error handling with fallback to IndexedDB
3. Fixed environment variable checks

**Files Modified:**
- `src/services/topics.service.ts` - Import from topics.api.service when server storage enabled
- `src/services/findings.service.ts` - Conditional import based on env var
- `src/services/agents.service.ts` - Dynamic service selection

### Issue 9: CORS Errors in Production (FIXED)
**Problem:** Production domain blocked by CORS policy.

**Fix:** Added production URL to allowed origins.

**Files Modified:**
- `backend/src/index.ts` - Added production domain to CORS whitelist
- `.env.production` - Set correct API URL

### Issue 10: Agent Creation Breaking Transactions (FIXED)
**Problem:** Frontend creating agents with IDs that don't exist in PostgreSQL.

**Fix:** Changed agent creation flow to let backend assign IDs.

**Files Modified:**
- `src/services/agentRunner.ts` - Use response ID instead of pre-generated
- `src/components/AgentsModal.tsx` - Don't pre-assign IDs

---

## Known Remaining Issues

### 1. Digest Deduplication Still Returning Old Data
- New digests generate but get thrown away
- Deduplication happens AFTER generation completes
- Need to completely rethink deduplication strategy
- Consider adding a "force_new" flag to bypass deduplication

### 2. Frontend State Management
- Still using component state instead of Zustand in many places
- Need to complete migration to Zustand for all shared state

### 3. Performance
- Digest generation takes 60+ seconds
- Consider caching strategies
- Optimize database queries

---

## Deployment Summary

### Latest Deployment (February 3, 2026)
```bash
# Build
cd backend && npm run build
cd .. && npm run build

# Deploy
scp -r backend/dist/* chee@100.94.82.35:~/medical-pwa/backend/dist/
scp -r dist/* chee@100.94.82.35:~/medical-pwa/dist/

# Restart
ssh chee@100.94.82.35 "cd medical-pwa && docker-compose restart medical-companion"
```

### Production Server
- IP: 100.94.82.35
- Port: 6767
- Containers: medical-companion, medcompanion-postgres

---

## Lessons Learned

1. **Always trace the complete data flow** - Issues often occur at unexpected stages
2. **Deduplication timing is critical** - Must happen BEFORE expensive operations, not after
3. **State persistence is essential** - Component unmounting loses critical state
4. **Queue state machines need careful design** - Status transitions must be atomic
5. **Log everything** - Production logs were essential for finding the real issue
6. **Test the actual deployed code** - Local fixes don't always make it to production

---

## Next Steps

1. **Rethink Deduplication Strategy**
   - Add "force_new" parameter to bypass deduplication
   - Move deduplication to BEFORE generation
   - Consider using digest content hash instead of time-based dedup

2. **Complete Zustand Migration**
   - Migrate all component state to stores
   - Add persistence middleware

3. **Add Comprehensive Logging**
   - Log all critical decision points
   - Add timing metrics

4. **Performance Optimization**
   - Cache digest generation results
   - Optimize database queries
   - Consider background processing

---

## Issue 21: Zustand Hydration Race Condition (FIXED)
**Date**: February 3, 2026
**Status**: FIXED

### Problem
FindingsViewerProgressive always rendered empty UI first, then loaded data ~300ms later. This happened on EVERY page load and navigation, even when data existed in localStorage.

### Root Cause
**Classic Zustand hydration race condition**: Component was reading from store BEFORE localStorage hydration completed.

The component had multiple anti-patterns:
1. **useState([])** for findings (line 117-118) - Started with empty array
2. **Local state instead of store** - Maintained duplicate state
3. **useEffect fetch without store check** - Always fetched on mount
4. **UI based on array.length** - Rendered empty when findings=[]
5. **Store read before hydration** - digest = getDigest() returned null before hydration

### The Fix
Added hydration tracking to digestStore:
```typescript
// digestStore.ts
interface DigestState {
  hasHydrated: boolean; // NEW
  // ... rest of state
}

// Track when hydration completes
onRehydrateStorage: () => (state) => {
  if (state) state.hasHydrated = true;
}
```

Modified FindingsViewerProgressive to wait for hydration:
```typescript
// Only read after hydration
const digest = hasHydrated && selectedTopicId ? getDigest(selectedTopicId) : null;

// Show loading during hydration
if (!hasHydrated) {
  return <LoadingSpinner message="Loading saved data..." />;
}

// Check store BEFORE fetching
if (hasHydrated && getDigest(topicId)) {
  // Use existing data, don't fetch
  return;
}
```

### Files Modified
- `src/stores/digestStore.ts` - Added hasHydrated flag and tracking
- `src/components/FindingsViewerProgressive.tsx` - Added hydration checks

### Result
✅ No more empty-first rendering
✅ Data appears instantly on navigation back
✅ Eliminated unnecessary API calls
✅ Professional UX without flashing

### Deployment
Deployed to production on February 3, 2026

### Update: Date Serialization Fix
After initial deployment, discovered "RangeError: Invalid time value" errors due to improper date handling in localStorage serialization.

**Additional Issues Found:**
1. **Date parsing without validation** - `new Date(invalidValue)` threw errors
2. **No error handling in storage operations** - Crashes when parsing fails
3. **Missing null checks** - Attempted to parse undefined dates

**Complete Fix Applied:**
```typescript
// Safe date parsing with validation
const parseDate = (dateValue: any) => {
  if (!dateValue) return undefined;
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? undefined : date;
};

// Wrap storage operations in try-catch
try {
  const parsed = JSON.parse(str);
  // ... process data
} catch (error) {
  console.error('Failed to parse digest store:', error);
  return null;
}
```

**Files Updated:**
- `src/stores/digestStore.ts` - Added safe date parsing and error handling
- `public/clear-digest-store.html` - Created utility to clear corrupt localStorage

**Result:**
✅ No more "Invalid time value" errors
✅ Graceful handling of corrupt localStorage data
✅ Recovery utility available at /clear-digest-store.html

**Redeployed:** February 4, 2026

---

## Issue 22: Digest Showing Only 10 of 20 Findings (FIXED)
**Date**: February 4, 2026
**Status**: FIXED

### Problem
Digest displayed "20 findings / 20 in period" in the header but only showed 10 findings in the metrics section.

### Root Cause
The `digestQueue.service.ts` was calling `findingsService.getFindings(topicId)` without specifying a limit parameter, which defaulted to 10 findings somewhere in the backend chain. This happened even though all 20 findings from 2 agents (Treatment Breakthrough + Clinical Trial, 10 findings each) were successfully saved to the database.

### The Fix

**1. Added explicit limit to digest queue service** (`src/services/digestQueue.service.ts`):
```typescript
// Changed from:
const findings = await findingsService.getFindings(topicId);

// To:
const findings = await findingsService.getFindings(topicId, { limit: 100 });
```

**2. Updated findings service to accept options** (`src/services/findings.service.ts`):
```typescript
async getFindings(topicId?: string, options?: { limit?: number }): Promise<ResearchFinding[]> {
  if (this.isUsingAPI) {
    return await findingsAPIService.getFindings(topicId, options);
  }
  // IndexedDB path remains unchanged
}
```

**3. Added logging for debugging**:
```typescript
console.log(`[DigestQueue] Fetched ${findings.length} findings for digest generation`);
if (findings.length < 15) {
  console.warn(`[DigestQueue] Only ${findings.length} findings found - expected ~20 from 2 agents`);
}
```

### Files Modified
- `src/services/digestQueue.service.ts` - Added explicit limit of 100 and logging
- `src/services/findings.service.ts` - Added options parameter to getFindings method

### Deployment
Deployed to production at 100.94.82.35 on February 4, 2026

### Result
✅ Digest now correctly shows all 20 findings in both header and metrics
✅ Clear logging shows how many findings are being fetched for digest
✅ No more mismatch between actual findings and digest statistics

---

## Issue 23: Agent Update Error - "updateAgent is not a function" (FIXED)
**Date**: February 4, 2026
**Status**: FIXED

### Problem
Console showed error "oc.updateAgent is not a function" after agents completed successfully. The error didn't prevent findings from being created but prevented updating agent's lastRun and nextRun timestamps.

### Root Cause
`agentRunner.ts` (line 491) was calling `agentsService.updateAgent()` but this method didn't exist in `agents.service.ts`. The method existed in `agents.api.service.ts` but was missing from the service wrapper.

### The Fix

**Added missing updateAgent method** to `src/services/agents.service.ts`:
```typescript
async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
  if (this.isUsingAPI) {
    return await agentsAPIService.updateAgent(id, updates);
  }

  // For local storage, update the agent in IndexedDB
  const db = await getDB();
  const tx = db.transaction('agents', 'readwrite');
  const store = tx.objectStore('agents');
  const agent = await store.get(id);

  if (!agent) {
    throw new Error(`Agent ${id} not found`);
  }

  const updated = { ...agent, ...updates };
  await store.put(updated);
  await tx.done;

  return updated;
}
```

### Files Modified
- `src/services/agents.service.ts` - Added updateAgent method

### Deployment
Deployed to production at 100.94.82.35 on February 4, 2026

### Result
✅ No more "updateAgent is not a function" errors in console
✅ Agent lastRun and nextRun timestamps now update correctly
✅ Agents continue to create findings successfully

---

## Issue 12: Chat Architecture Rebuild (Plan 012) (FIXED)

**Date**: February 7-8, 2026

### Problem
The chat system had four critical issues:
1. **Messages lost on close/reopen** — Zustand `persist` middleware with fragile Map serialization to localStorage
2. **Dual service confusion** — Two frontend services (`chat.service.ts` and `chat.api.service.ts`) with conflicting endpoints
3. **Circular dependency crash** — `ChatPanel -> chatStore -> chat.service -> chatStore` caused production build failures
4. **Sterile bot persona** — Clinical, cold system prompt unsuitable for caregivers navigating medical conditions

### Root Cause
The chat relied on localStorage as its primary data store instead of PostgreSQL. The `chatStore.ts` (758 lines) used Zustand `persist` middleware with custom Map serialization that silently failed. Dynamic `import()` was used as a band-aid for circular dependencies, breaking TypeScript type safety and introducing race conditions.

### Fix — 5-Phase Rebuild
**Phase 1**: Deleted dead `conversation.model.ts` and `conversations.routes.ts` (575 lines removed). Replaced all `console.log` with `logger` in chat backend files.

**Phase 2**: Rewrote `chat.service.ts` as a pure API client with ZERO store imports. Deleted deprecated `chat.api.service.ts` stub. This breaks the circular dependency chain permanently.

**Phase 3**: Rewrote `chatStore.ts` from 758 lines to ~50 lines. Navigation + streaming state only. No persist middleware, no localStorage, no service imports.

**Phase 4**: Rebuilt `ChatPanel.tsx` with static imports (no dynamic `import()`), server-first loading from PostgreSQL, POST-based SSE streaming. Deleted old `ChatPanelMinimal.tsx` (658 lines).

**Phase 5**: Updated `buildSystemPrompt()` with warm companion persona for caregivers. Updated title generation and suggested questions prompts for natural, empathetic language.

### Files Modified
- `backend/src/models/conversation.model.ts` — DELETED (253 lines)
- `backend/src/routes/conversations.routes.ts` — DELETED (322 lines)
- `backend/src/index.ts` — Removed conversation route registration
- `backend/src/routes/chats.routes.ts` — Replaced console.log with logger, removed duplicate route
- `backend/src/routes/chat.routes.ts` — Replaced console.log with logger, updated system prompts
- `backend/src/models/chat.model.ts` — Replaced console.log with logger
- `src/services/chat.api.service.ts` — DELETED (181 lines)
- `src/services/chat.service.ts` — REWRITTEN as pure API client (~200 lines)
- `src/stores/chatStore.ts` — REWRITTEN navigation-only (~50 lines)
- `src/components/ChatPanelMinimal.tsx` — DELETED (658 lines)
- `src/components/ChatPanel.tsx` — CREATED server-first component (~280 lines)
- `src/components/ChatMessage.tsx` — Removed debug logs, fixed copy citation numbering
- `src/components/ChatInput.tsx` — Removed dead attachment/voice code
- `src/App.tsx` — Updated import, added localStorage cleanup

### Architecture After Rebuild
- **Storage**: PostgreSQL is the SOLE source of truth for chat data
- **Dependencies**: Zero circular dependencies (chatService has no store imports)
- **Imports**: All static (no dynamic `import()`)
- **Net reduction**: ~2,030 lines removed

### Result
- Messages persist across close/reopen, page refresh, logout/login, and browser data clear
- Streaming tokens appear in real-time via POST-based SSE
- Citations render as clickable blue pill buttons
- Bot persona is warm and supportive for caregivers
- No circular dependency crashes

---

### Dashboard & Research Insights → Unified Home Page (February 8, 2026) — Plan 013

**Problem:** The Dashboard showed meaningless stat cards (fake $0.00 monthly cost, broken "new findings" count using time-based heuristics instead of `is_read`), and Research Insights required per-topic selection before showing anything. Both pages were low-value and fragmented.

**Solution:** Merged Dashboard + Research Insights into a single unified Home page with:
- Template-based hero section (conditional on unread count, no LLM calls)
- Topic chip/pill filter (frontend-only state)
- Unread findings highlights (top 5 teasers)
- Digest signposts (breakthrough/contradiction/gap counts, not full content)
- Contextual CTAs (rule-based feature nudges, max 3)
- Recharts activity timeline + source breakdown donut chart
- Single aggregated `GET /api/dashboard/stats` endpoint (replaces 5+ API calls)
- Bulk `PUT /api/findings/mark-all-read` endpoint (replaces N+1 individual calls)

**Backend Changes:**
- `backend/src/routes/dashboard.routes.ts` — NEW: Aggregated stats endpoint
- `backend/src/routes/findings.routes.ts` — Added bulk mark-all-read endpoint
- `backend/src/index.ts` — Registered dashboard routes

**Frontend Changes:**
- `src/components/HomePage.tsx` — NEW: Unified Home page container
- `src/components/home/HeroSection.tsx` — NEW: Template-based narrative hero
- `src/components/home/TopicFilter.tsx` — NEW: Chip/pill topic filter
- `src/components/home/FindingsHighlights.tsx` — NEW: Unread finding teasers
- `src/components/home/DigestSignposts.tsx` — NEW: Digest metadata signposts
- `src/components/home/ContextualCTAs.tsx` — NEW: Rule-based feature nudges
- `src/components/home/ActivityChart.tsx` — NEW: Recharts area chart + donut
- `src/AppWithAuth.tsx` — Replaced Dashboard with HomePage, removed Research Insights nav, removed 5-second polling
- `src/App.tsx` — Same changes as AppWithAuth
- `src/services/findings.service.ts` — Simplified `calculateIsNew` to pure `is_read` check, updated bulk mark-read to use new endpoint
- `src/components/research/drawers/FindingDetailDrawer.tsx` — Mark finding as read on drawer open

**Deleted Files:**
- `src/components/Dashboard.tsx` (302 lines)
- `src/components/AnalyticsView.tsx` (196 lines)
- `src/components/ResearchInsightsDashboard.tsx` (615 lines)
- `src/services/digest.service.ts` — Removed dead `warmCache()` method

**Net Result:** ~346 lines net reduction, single API call for home page data, no more 5-second polling (720 API calls/hour eliminated)

**New Dependency:** `recharts@^3.7.0`

---

*Last Updated: February 8, 2026*