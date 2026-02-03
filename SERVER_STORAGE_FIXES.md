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

---

*Last Updated: February 3, 2026*