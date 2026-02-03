# Server Storage Implementation - Issues & Fixes

## Overview

This document tracks the work done to enable server-side storage (PostgreSQL) for the Medical Companion PWA, replacing the default IndexedDB local storage.

## Configuration

Set `VITE_USE_SERVER_STORAGE=true` in `.env` to enable server storage mode.

---

## Issues Identified & Fixes Applied

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

### Issue 6: Registration Endpoint Missing User ID (FIXED)
**Problem:** `/api/auth/register` returned success without user ID or token, causing login after registration to fail.

**Fix:** Modified registration endpoint to:
1. Return user ID and email after registration
2. Automatically log in user after registration
3. Return JWT token immediately

**Files Modified:**
- `backend/src/routes/auth.routes.ts` - Return complete user object and token

### Issue 7: CORS Blocking Frontend Requests (FIXED)
**Problem:** Frontend at `http://localhost:5176` blocked by CORS when calling `http://localhost:3001/api/*`

**Fix:** Configured proper CORS headers in Express:
1. Allow credentials
2. Set allowed origins from environment
3. Allow all standard headers and methods

**Files Modified:**
- `backend/src/index.ts` - Comprehensive CORS configuration

### Issue 8: API Base URL Mismatch (FIXED)
**Problem:** Frontend tried to call `/api/*` but backend serves at `http://localhost:3001/api/*`

**Fix:** Updated axios baseURL configuration to use full URL in development.

**Files Modified:**
- `src/services/api.ts` - Dynamic baseURL based on environment

### Issue 9: Database Init Script Not Running (FIXED)
**Problem:** PostgreSQL container not initializing with schema - tables don't exist.

**Fix:**
1. Mounted init.sql properly in docker-compose.yml
2. Fixed SQL syntax errors (removed CASCADE in CREATE TABLE)
3. Added IF NOT EXISTS clauses

**Files Modified:**
- `docker-compose.yml` - Proper volume mount for init script
- `backend/src/db/init.sql` - Fixed SQL syntax

### Issue 10: Users Table Referencing Itself (FIXED)
**Problem:** Users table had foreign key to itself causing circular dependency.

**Fix:** Removed self-referential foreign key from users table.

**Files Modified:**
- `backend/src/db/init.sql` - Removed FK from users table

### Issue 11: Frontend Services Not Using API Mode (FIXED)
**Problem:** Services used IndexedDB even with `VITE_USE_SERVER_STORAGE=true`

**Fix:**
1. Added `isUsingAPI` getter to all services
2. Conditional logic to route to API services
3. Created `.env` file with proper flag

**Files Modified:**
- `src/services/topics.service.ts` - Added API routing
- `src/services/findings.service.ts` - Added API routing
- `src/services/agents.service.ts` - Added API routing
- `src/services/digests.service.ts` - Added API routing

### Issue 12: Database Schema Mismatches (FIXED)
**Problem:** Column names in queries didn't match actual schema.

**Fix:** Aligned all SQL queries with actual PostgreSQL schema column names.

**Files Modified:**
- `backend/src/routes/findings.routes.ts` - Fixed column names
- `backend/src/routes/topics.routes.ts` - Fixed column names
- `backend/src/routes/agents.routes.ts` - Fixed column names

### Issue 13: Missing API Response Transformations (FIXED)
**Problem:** Backend returned snake_case but frontend expected camelCase.

**Fix:** Added transformation utilities to convert between cases.

**Files Modified:**
- `backend/src/utils/transforms.ts` - Case conversion utilities
- All route handlers - Applied transformations

### Issue 14: Duplicate Key Violations (FIXED)
**Problem:** Trying to insert duplicate user_id in topics table.

**Fix:** Used INSERT ... ON CONFLICT to update existing records.

**Files Modified:**
- `backend/src/routes/topics.routes.ts` - ON CONFLICT DO UPDATE

### Issue 15: Agent Creation 404 Errors (FIXED)
**Problem:** Agent runner was trying to update non-existent agents, causing 404 errors.

**Root Cause:** Frontend generated UUIDs locally then tried to PUT to update, but record didn't exist in PostgreSQL.

**Fix:**
1. Changed agent runner to always POST new agents (never PUT)
2. Backend generates UUIDs server-side
3. Frontend accepts server-generated IDs

**Files Modified:**
- `src/components/AgentRunner.tsx` - Always POST new agents
- `src/services/agents.api.service.ts` - POST returns server-generated agent

### Issue 16: Finding Source Information Lost (FIXED)
**Problem:** Clinical trial findings showed "Unknown Source" despite backend sending complete source data.

**Root Cause:** Frontend agentRunner was reconstructing the source object with only 4 fields, destroying the complete backend structure.

**Fix:** Preserve complete backend source object using spread operator, only override missing fields.

**Files Modified:**
- `src/components/AgentRunner.tsx` - Preserve complete source object with spread operator

### Issue 17: Digest Not Loading from Cache on Page Load (IN PROGRESS)
**Problem:** Even with cached digests in PostgreSQL, the UI showed "Generate Digest" button initially, then loaded the cached digest after findings completed loading.

**Root Cause:** Race condition - `loadTopicData()` fetches findings and digest in parallel but doesn't set a loading state for the digest, causing the UI to show "Generate Digest" before the cached digest arrives.

**Fix:**
1. Added `digestLoading` state to track when digest is being fetched
2. Set `digestLoading=true` when starting to fetch digest
3. Show "Loading Digest..." UI when `digestLoading=true`
4. Distinguish between "Generating Digest..." (AI processing) and "Loading Digest..." (fetching cached)

**Files Modified:**
- `src/components/FindingsViewerEnhanced.tsx` - Added digestLoading state and proper loading UI

**Status Update (February 3, 2026):**
- Fix implemented in code but not reaching production due to Docker layer caching
- Docker's COPY command was using cached layers despite code changes
- ARG CACHE_BUST didn't work as expected
- Solution: Force complete rebuild with `docker-compose build --no-cache`

**Deployment Issues Encountered:**
1. Docker multi-stage builds aggressively cache COPY operations
2. Even with changed files, Docker may reuse cached layers
3. ARG CACHE_BUST only works if placed BEFORE the COPY command
4. Vite build output can have same hash even with source changes

**Solution Applied:**
1. Added verification step in Dockerfile to check for fix presence
2. Created deploy-clean.sh script for forced rebuilds
3. Modified Dockerfile with timestamp comments to invalidate cache
4. Will use `--no-cache` flag for this deployment

**Original Deployment Date:** February 2, 2026
**Actual Fix Deployment:** Pending (February 3, 2026)

### Issue 18: Agent Digest Generation Race Condition (FIXED)
**Problem:** Digest generated with only 10 findings when 20 were actually present, due to agents and digest generation running in parallel.

**Root Cause:**
1. Agents and digest were initiated simultaneously
2. Digest API was called before all agent findings were saved
3. No coordination between agent completion and digest generation

**Fix:** Implemented sequential execution with `runAllResearchAgents` function:
1. Start all agents in parallel
2. Wait for ALL agents to complete
3. Only then generate digest with complete findings
4. Added proper error handling and state management

**Files Modified:**
- `src/components/ResearchAgentTrigger.tsx` - Sequential execution with `runAllResearchAgents`
- `src/components/AgentRunner.tsx` - Returns completion status

### Issue 19: Chat Page Crashes with Circular Dependency (FIXED)
**Problem:** Chat page showed blank with "Cannot access 'K' before initialization" error in production build.

**Root Cause:** Circular dependency chain:
- ChatPanel → imports chatStore statically
- chatStore → imports chat.service statically
- chat.service → imports chatStore statically (CIRCULAR!)

**Fix:** Created ChatPanelMinimal.tsx with zero static imports:
1. All stores/services loaded dynamically in useEffect
2. Breaks circular chain at initialization time
3. Production build works correctly

**Files Modified:**
- `src/components/ChatPanelMinimal.tsx` - New component with dynamic imports
- `src/pages/Chat.tsx` - Uses ChatPanelMinimal
- `src/components/ResearchAgentTrigger.tsx` - Uses ChatPanelMinimal

**Current State:** Chat functional but needs UI restoration

---

## Current Production Deployment

### Server Details
- **URL:** http://100.94.82.35:6767
- **Database:** PostgreSQL on port 5434
- **Backend API:** Port 3001
- **Container IDs:**
  - App: cd48ffd5c414 → 199dfac2b964 (as of Feb 2, 2026)
  - DB: 2202725aea30 → 3ab0e039a492 (as of Feb 2, 2026)

### Deployment Process
```bash
# SSH into server
ssh chee@100.94.82.35

# Navigate to project
cd medical-pwa

# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Check logs
docker logs medical-companion --follow
```

### Recent Deployments
- **January 18, 2026:** Initial PostgreSQL deployment with auth fixes
- **January 18, 2026 (2nd):** Fixed agent creation and digest race conditions
- **January 19, 2026:** Fixed chat page circular dependency crash
- **February 2, 2026:** Fixed digest loading state to show "Loading..." immediately

---

## Known Remaining Issues

### High Priority
1. ~~Chat messages not persisting to PostgreSQL (currently only in-memory)~~ (Needs verification)
2. ~~Chat page UI restoration needed after minimal fix~~ (See CHAT_RESTORATION_GUIDE.md)
3. ~~Citations not working properly in chat responses~~ (Needs investigation)

### Medium Priority
4. Voice recordings table schema exists but not integrated
5. Timeline events table exists but feature not implemented
6. Bulk operations could be optimized with batch endpoints
7. Data export/import functionality not connected to PostgreSQL

### Low Priority
8. Performance monitoring not set up
9. Database backup strategy not implemented
10. Migration tool from IndexedDB to PostgreSQL for existing users

---

## Testing Checklist

When making changes, test these critical paths:

- [ ] User registration creates account in PostgreSQL
- [ ] Login returns JWT token and user data
- [ ] Topics create/update/delete work correctly
- [ ] Findings save with correct source information
- [ ] Agents complete and save findings
- [ ] Digests generate and cache properly
- [ ] Chat conversations persist
- [ ] Multi-device sync works
- [ ] Logout clears session properly

---

## Issue 17: Digest Shows "Generating AI-Powered Insights" Animation on Every Page Load (PENDING)

**Status:** TO BE IMPLEMENTED
**Severity:** High - Major UX issue affecting every user session
**Discovered:** February 3, 2026

### Problem Description
Users see the "Generating AI-Powered Insights" spinning animation EVERY time they visit the Findings page, even when just loading a cached digest that was generated minutes ago. This creates the false impression that AI is processing when it's actually just loading from cache.

### Root Causes
1. **No Autonomous Agent Scheduling**: App designed for background agent runs that were never implemented
2. **Aggressive Auto-Refresh**: Component refreshes digest on every page load if "stale"
3. **Poor Loading State UX**: No distinction between "loading cached digest" vs "generating new digest"
4. **Mismatched Cache Durations**: Cache expires in 1-6 hours but agents only run manually

### Evidence
- File: src/components/FindingsViewerProgressive.tsx (lines 910-923)
- Shows "Generating AI-Powered Insights" even when loadingDigest=true
- Auto-refresh logic at lines 404-437 triggers on every visit
- Cache durations in digestCache.service.ts assume frequent updates

### Implementation Requirements

#### Phase 1: Backend - Autonomous Agent Scheduling
**Files to Create:**
- backend/src/services/scheduler.service.ts - Cron-based scheduler
- backend/src/services/agent.execution.service.ts - Agent runner

**Files to Modify:**
- backend/package.json - Add node-cron dependency
- backend/src/index.ts - Initialize scheduler on startup
- backend/src/models/agent.model.ts - Add getAllDueAgents() method

**Key Features:**
- Hourly cron job checking for due agents
- Respects user agent schedules
- Updates last_run/next_run timestamps
- Queues digest generation after agents complete

#### Phase 2: Frontend - Fix Loading UX
**Files to Modify:**
- src/components/FindingsViewerProgressive.tsx

**Changes Required:**
- Add isLoadingCachedDigest state separate from isGenerating
- Show "Loading cached digest..." not "Generating AI-Powered Insights"
- Remove auto-refresh on page load (lines 404-437)
- Add cache status badge showing age
- Keep manual refresh button

#### Phase 3: Cache Duration Adjustments
**Files to Modify:**
- src/services/digestCache.service.ts

**New Durations:**
- Daily: 1hr → 3hrs
- Weekly: 6hrs → 12hrs
- Monthly: 24hrs → 48hrs
- Disable autoRefresh flag

### Testing Checklist
- [ ] Cached digest loads without animation
- [ ] Shows "Cached Digest" badge with age
- [ ] Manual refresh works properly
- [ ] Scheduler runs agents hourly
- [ ] Digest regenerates after agents complete
- [ ] No auto-refresh on page visits

### Deployment Notes
**CRITICAL**: Must use --no-cache flag when building Docker images or changes won't take effect (see Issue 16)

```bash
docker-compose build --no-cache
docker-compose up -d
docker logs medical-companion | grep scheduler
```

### Success Criteria
1. NO animation when loading cached digests
2. Clear "Cached" indicator with timestamp
3. Agents run automatically on schedule
4. Digests update in background
5. Manual refresh still available

### Files Modified Summary
- 2 NEW backend services
- 5 MODIFIED files across frontend/backend
- Total estimated LOC: ~500

---

## Lessons Learned

1. **Always check Docker logs first** - Most issues visible in container logs
2. **Test with curl** - Verify API endpoints work before debugging frontend
3. **Check database directly** - Use psql to verify data is saved correctly
4. **Frontend console is crucial** - Network tab and console reveal most issues
5. **Build vs Dev differences** - Production builds may have different issues (especially with circular dependencies)
6. **Case sensitivity matters** - PostgreSQL snake_case vs JavaScript camelCase
7. **Trace data flow completely** - From UI → Service → API → Database → Response
8. **Don't destroy backend data** - Use spread operator to preserve complete objects
9. **Coordinate parallel operations** - Agents must complete before digest generation
10. **Break circular dependencies** - Use dynamic imports when needed
11. **Add proper loading states** - Users need immediate feedback during async operations
12. **Docker caching can hide changes** - Use `--no-cache` when changes aren't appearing in production
13. **Verify fixes in build process** - Add grep/test commands in Dockerfile to ensure changes are present
14. **Multi-stage builds cache aggressively** - COPY commands may use cached layers even with file changes
15. **Distinguish loading states clearly** - "Loading from cache" vs "Generating new content" need different UX
16. **Implement scheduled tasks early** - Apps designed for automation suffer without it
17. **Cache durations must match update frequency** - Don't expire cache faster than data updates

---

## Next Steps

1. Implement comprehensive error handling and user feedback
2. Add database migration tools for existing users
3. Set up automated backups for PostgreSQL
4. Implement performance monitoring
5. Add integration tests for critical paths
6. Optimize batch operations for better performance
7. Complete chat persistence to PostgreSQL
8. Restore full chat UI functionality

---

*Last Updated: February 3, 2026*
*Document maintained by: Development Team*
*Issue 17 added - Digest loading animation fix*