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

**Fix:** Changed auth service to use PostgreSQL implementation.

**Files Modified:**
- `backend/src/services/auth.service.ts` - Re-exports from `auth.service.pg.ts`

### Issue 5: TopicManager Using Direct IndexedDB (FIXED)
**Problem:** `TopicManager.tsx` imported directly from `@/utils/db/topics` instead of using the unified `topicsService`.

**Fix:** Updated imports to use unified services.

**Files Modified:**
- `src/components/TopicManager.tsx` - Changed imports to use `topicsService` and `agentsService`

### Issue 6: Topics API Missing Transformation (PARTIALLY FIXED)
**Problem:** `topics.api.service.ts` had inconsistent transformation:
- `getTopics()` returned raw API data (snake_case)
- `getTopic()` returned raw API data (snake_case)
- `saveTopic()` and `updateTopic()` transformed to camelCase

This caused errors when accessing `topic.diseaseProfile.name` because raw API data has `metadata.diseaseProfile`.

**Fix Applied:**
- Added `.map(topic => this.transformApiTopic(topic))` to `getTopics()`
- Added `this.transformApiTopic(response.data.topic)` to `getTopic()`

**Files Modified:**
- `src/services/topics.api.service.ts`

---

## Known Remaining Issues

### Issue: App Still Not Working After Fixes
The app is not functioning correctly even after the above fixes. Further investigation needed:

1. **Check other API services for similar transformation issues:**
   - `findings.api.service.ts`
   - `agents.api.service.ts`
   - `digests.api.service.ts`

2. **Check agentRunner.ts:**
   - May still be using direct IndexedDB access instead of unified services
   - See `src/services/agentRunner.ts` lines 152-177

3. **Verify API response formats:**
   - Backend may return different field names than frontend expects
   - Need to verify all `transformApiXxx()` functions are correct

---

## Files Summary

### Frontend Files Modified
| File | Purpose |
|------|---------|
| `src/services/topics.api.service.ts` | Topics API - added transformation |
| `src/services/topics.service.ts` | Topics unified service - added `updateTopicById()` |
| `src/services/findings.api.service.ts` | Findings API - always POST |
| `src/services/agents.api.service.ts` | Agents API - always POST |
| `src/services/digests.api.service.ts` | Digests API - always POST |
| `src/components/TopicManager.tsx` | Use unified services |
| `src/utils/api.ts` | New file - API utility (if created) |

### Backend Files Modified
| File | Purpose |
|------|---------|
| `backend/src/services/auth.service.ts` | Use PostgreSQL auth |
| `backend/src/routes/findings.routes.ts` | Zod nullable |
| `backend/src/routes/agents.routes.ts` | Zod nullable |
| `backend/src/routes/digests.crud.routes.ts` | Zod nullable |
| `backend/src/routes/conversations.routes.ts` | Zod nullable |
| `backend/src/models/*.model.ts` | TypeScript null types |

---

## Development Workflow

### Local Development
1. Clone the repo to your local machine
2. Copy `.env.example` to `.env` and configure:
   ```
   VITE_USE_SERVER_STORAGE=true
   DATABASE_URL=postgresql://user:pass@localhost:5432/medcompanion
   ```
3. Run PostgreSQL locally (Docker or native)
4. Run frontend: `npm run dev`
5. Run backend: `cd backend && npm run dev`

### Testing on Debian Server
1. Push changes to GitHub
2. SSH to Debian server
3. Pull changes:
   ```bash
   cd /home/chee/medical-pwa
   git pull origin fix/digest-findings-race-condition
   ```
4. Rebuild container (NO cache to ensure fresh build):
   ```bash
   docker-compose build --no-cache medical-companion
   ```
5. Restart container:
   ```bash
   docker-compose up -d --force-recreate medical-companion
   ```
6. **Important:** Clear browser cache and service workers before testing

### Important Notes for Server Deployment
1. **Always use `--no-cache`** when rebuilding to ensure new code is included
2. **Check JS bundle hash** to verify new code is deployed:
   ```bash
   docker exec medical-companion ls /usr/share/nginx/html/assets/ | grep index
   ```
3. **Clear browser thoroughly** - service workers cache aggressively:
   - DevTools → Application → Storage → Clear site data
   - Or use incognito/private browsing

---

## Database Management

### Delete a user (to re-register with same email)
```bash
docker-compose exec medical-companion sh -c 'cd /app/backend && node -e "
const { Pool } = require(\"pg\");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"DELETE FROM users WHERE email = '\''your@email.com'\'';\").then(r => {
  console.log(\"Deleted\", r.rowCount, \"user(s)\");
  pool.end();
});
"'
```

### List users
```bash
docker-compose exec medical-companion sh -c 'cd /app/backend && node -e "
const { Pool } = require(\"pg\");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT id, email, created_at FROM users;\").then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
});
"'
```

---

---

## Production Deployment Fixes (January 2026)

The following issues were discovered and fixed during production deployment to `cl.zyroi.com`.

### Issue 7: Double API Path `/api/api/` (FIXED)
**Problem:** API requests were going to `/api/api/topics` instead of `/api/topics`, resulting in 404 errors.

**Root Cause:** The API service files had `baseUrl = '/api/topics'` but the axios client in `src/utils/api.ts` already had `baseURL: '/api'`, causing double `/api/api/` paths.

**Fix:** Changed `baseUrl` in all API service files from `/api/xxx` to `/xxx`.

**Files Modified:**
- `src/services/topics.api.service.ts` - Changed `/api/topics` to `/topics`
- `src/services/agents.api.service.ts` - Changed `/api/agents` to `/agents`
- `src/services/findings.api.service.ts` - Changed `/api/findings` to `/findings`
- `src/services/digests.api.service.ts` - Changed `/api/digests` to `/digests`
- `src/services/conversations.api.service.ts` - Changed `/api/conversations` to `/conversations`

### Issue 8: Patient Context Fields Missing from Zod Schema (FIXED)
**Problem:** Patient age group and current stage were not being saved when creating topics.

**Root Cause:** Backend Zod validation schema in `topics.routes.ts` didn't include `ageGroup` and `currentStage` fields.

**Fix:** Added missing fields to the schema and used `.passthrough()` to allow additional fields.

**Files Modified:**
- `backend/src/routes/topics.routes.ts` - Added `ageGroup: z.string().optional()` and `currentStage: z.string().optional()` to patient_context schema

### Issue 9: AgentMonitor Using IndexedDB Instead of API (FIXED)
**Problem:** Agents page showed "No agents" even though API was returning agents correctly.

**Root Cause:** `AgentMonitor.tsx` was importing and using IndexedDB utilities directly instead of the unified `agentsService`.

**Fix:** Updated imports to use `agentsService` and `topicsService`.

**Files Modified:**
- `src/components/agents/AgentMonitor.tsx` - Changed imports and function calls to use API services

### Issue 10: FindingsViewerProgressive Using IndexedDB (FIXED)
**Problem:** Findings tab showed "No Research Topics" even though topics existed.

**Root Cause:** `FindingsViewerProgressive.tsx` was using direct IndexedDB access for topics and findings.

**Fix:** Updated to use `topicsService` and `findingsService`.

**Files Modified:**
- `src/components/FindingsViewerProgressive.tsx` - Changed imports and function calls to use API services

### Issue 11: Frontend Defaulting to IndexedDB Storage (FIXED)
**Problem:** Data was being saved to browser IndexedDB instead of PostgreSQL server, causing:
- Data appeared to work but only existed locally
- Server database was empty
- Delete operations returned 404

**Root Cause:** `VITE_USE_SERVER_STORAGE` environment variable was not set during Docker build, so `storageConfig.useServerStorage` defaulted to `false`.

**Fix:** Added environment variables to the Dockerfile build stage.

**Files Modified:**
- `Dockerfile` - Added `ENV VITE_USE_SERVER_STORAGE=true` and `ENV VITE_API_URL=/api` before `npm run build`

### Issue 12: Database SSL Connection Error (FIXED)
**Problem:** Backend failed to connect to PostgreSQL with SSL errors.

**Root Cause:** Database connection code was forcing SSL in production, but the local Docker PostgreSQL doesn't use SSL.

**Fix:** Added `DB_SSL` environment variable check to conditionally enable SSL.

**Files Modified:**
- `backend/src/db/database.ts` - Added `const useSSL = process.env.DB_SSL !== 'false' && process.env.NODE_ENV === 'production';`
- `docker-compose.prod.yml` - Added `DB_SSL=false` to environment

### Issue 13: Docker Port Conflicts (FIXED)
**Problem:** PostgreSQL port 5432 was already in use on the server.

**Fix:** Changed PostgreSQL port mapping to 5434.

**Files Modified:**
- `docker-compose.prod.yml` - Changed port from `5432:5432` to `5434:5432`

---

## Important Notes for Future Agents

### Build & Deployment Checklist
1. **Always rebuild with `--no-cache`** when changing environment variables or Dockerfile:
   ```bash
   docker-compose -f docker-compose.prod.yml build --no-cache medical-companion
   ```

2. **Force recreate containers** to use new images:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --force-recreate medical-companion
   ```

3. **Clear browser data** after deployment - service workers cache aggressively:
   - DevTools → Application → Storage → Clear site data
   - Unregister service workers

### Key Architecture Points
1. **Storage Mode:** Controlled by `VITE_USE_SERVER_STORAGE` at build time (not runtime)
2. **API Base URL:** Axios client uses `/api` as baseURL, so service files should use relative paths like `/topics`, not `/api/topics`
3. **Unified Services:** Always use `topicsService`, `agentsService`, `findingsService` etc. instead of direct IndexedDB imports
4. **Zod Schemas:** Use `.passthrough()` when you want to allow additional fields not explicitly defined

### Files That Should Use API Services (Not IndexedDB)
- `src/components/agents/AgentMonitor.tsx` ✅ Fixed
- `src/components/FindingsViewerProgressive.tsx` ✅ Fixed
- `src/components/TopicManager.tsx` ✅ Previously fixed
- `src/services/agentRunner.ts` - Check this file if agent execution has issues

### Database Connection
- Production uses PostgreSQL via `DATABASE_URL`
- SSL is disabled for Docker deployment (`DB_SSL=false`)
- Port 5434 is mapped to internal 5432

---

## Next Steps

1. ~~Debug why topics are still not working correctly~~ ✅ RESOLVED
2. ~~Check all API services have proper `transformApiXxx()` functions~~ ✅ RESOLVED
3. ~~Ensure `agentRunner.ts` uses unified services~~ Verify if needed
4. Add error handling for API failures
5. Consider adding retry logic for network issues
6. Review any other components that might still use direct IndexedDB access
