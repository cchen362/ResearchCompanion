# 009 - Digest Generation Timeout & Queue Race Condition Fix

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for fixing the digest generation 504 timeout and queue race condition. Digest generation with 40+ findings takes ~100s but fails because two competing systems (frontend + backend) fight over the same queue item, and timeout configurations are misaligned.**

Agents MUST follow this guide exactly. NO deviations, NO quick fixes, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **Server SSH**: `ssh chee@100.94.82.35`
- **Project path**: `/home/chee/medical-pwa`
- **Backend container**: `medical-companion`
- **Postgres container**: `medcompanion-postgres`
- **DB credentials**: User `meduser`, Database `medcompanion`

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│ PHASES 1-5: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `npm run build` after each file change                     │
│ - Run `cd backend && npm run build` for backend changes          │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: BUILD VERIFICATION                                      │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - Fix any errors before proceeding                               │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: DEPLOYMENT TO DEBIAN SERVER                             │
│ - Push changes to remote repository                              │
│ - SSH into Debian server                                         │
│ - Pull updated repository                                        │
│ - Rebuild Docker containers                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 8: PRODUCTION VERIFICATION                                 │
│ - Clear stale queue items from DB                                │
│ - Click "Generate Digest" on topic with 40 findings              │
│ - Verify NO 504 errors in browser console                        │
│ - Verify digest generated and displayed correctly                │
│ - Wait for autonomous scheduler cycle to verify same behavior    │
│ - Document any issues in this file                               │
└─────────────────────────────────────────────────────────────────┘
```

### Build Verification Commands
```bash
# Frontend (from project root)
npm run build
# Should complete with exit code 0

# Backend (from backend directory)
cd backend && npm run build
# Should complete with exit code 0
```

---

## Current Status

- **Phase**: Ready for Implementation
- **Created**: February 6, 2026
- **Priority**: CRITICAL - Digest generation completely broken for manual user clicks
- **Branch**: `fix/digest-findings-race-condition` (existing)
- **Predecessor**: Plan 008 (Digest & Findings UX Enhancement) - All phases 1-10 complete

---

## Root Cause Analysis

### The Problem

When a user clicks "Generate Digest" with 40 findings, the system returns a 504 timeout. Server logs show the AI call actually succeeds at ~101.6 seconds, but the digest is never saved to the database.

### The Architecture Bug: Two Competing Processors

There are TWO independent systems that both try to process digest queue items:

**System A - Frontend `processQueueItem()`** (digest.service.ts:650-729):
- Triggered immediately when user clicks "Generate Digest" (100ms after queue creation)
- Makes a synchronous HTTP request: `longOperationApi.post('/digest/generate-digest')`
- Holds the HTTP connection open for the ENTIRE AI generation duration (~100s)
- If HTTP fails (504/timeout), the catch block marks queue as **'failed'**
- This system immediately marks items as 'processing', preventing System B from seeing them

**System B - Backend `DigestProcessorService`** (digest-processor.service.ts:107-148):
- Polls every 30 seconds for `status = 'pending'` items
- Generates digest directly on the server (no HTTP connection dependency)
- Saves digest via direct SQL INSERT
- Works reliably for autonomous/scheduled runs
- NEVER sees manual-click items because System A marks them 'processing' first

### The Race Condition Sequence

```
T+0ms     Frontend creates queue item → status: 'pending'
T+100ms   Frontend System A grabs it → PATCH to 'processing'
T+200ms   Frontend starts longOperationApi.post('/digest/generate-digest')
T+~60s    HTTP connection drops (network timeout / Tailscale / proxy)
T+~60s    Frontend catch block → PATCH queue to 'failed'
T+101.6s  Backend AI call SUCCEEDS → digest generated, Zod validated
T+101.7s  Backend returns response → but nobody is listening (connection dropped)
T+102s    "✅ Digest generated successfully" in server logs → result is ORPHANED
```

### Contributing Factors

1. **Anthropic SDK timeout (120s)** dangerously close to actual generation time (~101s). With `maxRetries: 2`, worst case = 240s.
2. **Frontend holds a long-lived HTTP connection** for the entire AI duration — fragile over Tailscale/VPN/mobile networks.
3. **Polling loop in useDigest.ts** restarts on React unmount/remount, causing repeated 404s to `/api/digests/latest/...` after failure.
4. **Timeframe Zod mismatch**: Frontend sends `'all-time'` but backend Zod only accepts `'all'` — latent bug.

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run build verification after EACH phase
- [ ] Test BOTH paths: manual click AND autonomous scheduled run
- [ ] Preserve ALL existing method signatures (they may be called from other files)
- [ ] Do NOT remove the `POST /digest/generate-digest` backend route (it may be used by other callers)
- [ ] Do NOT modify the DigestProcessor's `generateAndStoreDigest()` method (it already works)

## MUST NOT DO Rules

- [ ] Do NOT add new npm dependencies
- [ ] Do NOT modify the database schema
- [ ] Do NOT change the AI prompt or Zod schema
- [ ] Do NOT add new API endpoints
- [ ] Do NOT modify the nginx.conf
- [ ] Do NOT touch the autonomous scheduler code

---

## Phase 1: Increase Anthropic SDK Timeout

**File**: `backend/src/services/ai.service.ts`
**Line**: 17

### Step 1.1: Change SDK timeout from 120s to 300s

Find this code (around line 14-18):
```typescript
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  maxRetries: 2, // Reduce retries to 2
  timeout: 120000, // Increased to 120 seconds to allow complex digests to complete
});
```

Change to:
```typescript
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  maxRetries: 2,
  timeout: 300000, // 5 minutes — matches nginx (300s), Express (300s), and frontend longOperationApi (300s)
});
```

**Rationale**: With 40+ findings and magazine format (featured discovery + 12 top findings + dual technical/explained modes), a single AI call takes 100-120s. With `maxRetries: 2`, total could reach 240s. The 120s timeout is too tight. 300s aligns with every other timeout in the system.

### Build Verification
```bash
cd backend && npm run build
# Must exit with code 0
```

- [ ] Phase 1 complete

---

## Phase 2: Fix Timeframe Zod Validation Mismatch

**File**: `backend/src/routes/digestQueue.routes.ts`
**Line**: 16

### Step 2.1: Add 'all-time' to timeframe enum

Find this code (around line 13-19):
```typescript
const CreateQueueItemSchema = z.object({
  topicId: z.string().uuid(),
  digestType: z.enum(['smart', 'simple']).optional().default('smart'),
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'all']),
  priority: z.number().int().min(0).max(10).optional().default(0),
  metadata: z.record(z.string(), z.any()).optional()
});
```

Change the timeframe line to:
```typescript
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'all-time']),
```

**Rationale**: Frontend `DigestTimeframe` type uses `'all-time'`, not `'all'`. Currently masked because default timeframe is `'weekly'`, but will silently fail with 400 validation error if `'all-time'` is ever sent.

### Build Verification
```bash
cd backend && npm run build
# Must exit with code 0
```

- [ ] Phase 2 complete

---

## Phase 3: Speed Up Backend DigestProcessor + Add Orphan Recovery

**File**: `backend/src/services/digest-processor.service.ts`

### Step 3.1: Reduce poll interval from 30s to 10s

Find this code (around line 70):
```typescript
private readonly POLL_INTERVAL_MS = 30000; // 30 seconds
```

Change to:
```typescript
private readonly POLL_INTERVAL_MS = 10000; // 10 seconds — faster pickup for user-initiated digests
```

**Rationale**: After Phase 4, the backend DigestProcessor becomes the SOLE digest processor for both manual and autonomous runs. 10s is acceptable UX with the frontend showing "Queued for generation..." progress indicator.

### Step 3.2: Add recovery for orphaned "processing" items

Find the `getNextPendingItem()` method (around line 153-162):
```typescript
private async getNextPendingItem(): Promise<QueueItem | null> {
  const result = await query<QueueItem>(
    `SELECT * FROM digest_queue
     WHERE status = 'pending'
     AND retry_count < max_retries
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`,
    []
  );
  return result[0] || null;
}
```

Change to:
```typescript
private async getNextPendingItem(): Promise<QueueItem | null> {
  const result = await query<QueueItem>(
    `SELECT * FROM digest_queue
     WHERE (
       status = 'pending'
       OR (status = 'processing' AND started_at < NOW() - INTERVAL '5 minutes')
     )
     AND retry_count < max_retries
     ORDER BY
       CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
       priority DESC,
       created_at ASC
     LIMIT 1`,
    []
  );
  return result[0] || null;
}
```

**Rationale**: This recovers queue items that were:
- Marked 'processing' by the old frontend code before this fix was deployed
- Orphaned by server crashes during processing
- Stuck due to any other unexpected failure

Items stuck in 'processing' for more than 5 minutes are treated as failed and re-attempted. Pending items are prioritized over stale processing items via the `CASE WHEN` ordering.

### Build Verification
```bash
cd backend && npm run build
# Must exit with code 0
```

- [ ] Phase 3 complete

---

## Phase 4: Decouple Frontend from Long HTTP Request (Core Fix)

**File**: `src/services/digest.service.ts`

This is the most important phase. The frontend should NOT hold a long HTTP connection for AI generation. Instead, it creates the queue item and lets the backend DigestProcessor handle the actual generation. The frontend only polls for completion (which useDigest.ts already does).

### Step 4.1: Remove `processQueue()` call from `queueDigestGeneration()`

Find this code (around line 523-524, inside `queueDigestGeneration()`):
```typescript
    window.dispatchEvent(new CustomEvent('digest-queued', { detail: { queueItem } }));
    this.processQueue();

    return queueItem;
```

Change to:
```typescript
    window.dispatchEvent(new CustomEvent('digest-queued', { detail: { queueItem } }));
    // Backend DigestProcessor handles queue processing — no frontend processing needed
    logger.debug('[DigestService] Queue item created, backend processor will pick it up');

    return queueItem;
```

### Step 4.2: Remove `processQueue()` call from `queueDigestFromExistingFindings()`

Find this code (around line 596, inside `queueDigestFromExistingFindings()`):
```typescript
  setTimeout(() => this.processQueue(), 100);
  return queueItem;
```

Change to:
```typescript
  // Backend DigestProcessor handles queue processing — no frontend processing needed
  return queueItem;
```

### Step 4.3: Gut `processQueue()` method — make it a no-op

Find the `processQueue()` method (around line 622-648):
```typescript
async processQueue(): Promise<void> {
  if (this.processingQueue) return;

  const token = localStorage.getItem('auth_token');
  if (!token) return;

  this.processingQueue = true;

  try {
    const response = await api.get(`${this.queueBaseUrl}?limit=10`);
    const pendingItems = response.data.items?.filter((item: any) =>
      item.status === 'pending' || item.status === 'processing'
    ) || [];

    for (const item of pendingItems) {
      if (item.status === 'processing' && this.currentProcessingId !== item.id) {
        continue;
      }

      if (item.status === 'pending') {
        await this.processQueueItem(item);
      }
    }
  } finally {
    this.processingQueue = false;
  }
}
```

Replace the entire method body with:
```typescript
async processQueue(): Promise<void> {
  // No-op: Backend DigestProcessor handles all queue processing.
  // This method is kept for interface compatibility but does nothing.
  // Both manual (user click) and autonomous (scheduler) paths now use
  // the backend DigestProcessor exclusively.
  logger.debug('[DigestService] processQueue called — backend processor handles this');
}
```

### Step 4.4: Gut `processQueueItem()` method — make it a no-op

Find the `processQueueItem()` method (around line 650-729). This is the method that holds the long HTTP connection and marks queue as 'failed' on error.

Replace the entire method body with:
```typescript
private async processQueueItem(item: any): Promise<void> {
  // No-op: Backend DigestProcessor handles all queue processing.
  // Previously, this method held a long HTTP connection to POST /digest/generate-digest
  // which was fragile and caused 504 timeouts + race conditions.
  logger.debug(`[DigestService] processQueueItem called for ${item.id} — backend processor handles this`);
}
```

### Step 4.5: Gut `generateDigestFromFindings()` method — make it a no-op

Find the `generateDigestFromFindings()` method (around line 731-767). This method called `longOperationApi.post('/digest/generate-digest')`.

Replace the entire method body with:
```typescript
private async generateDigestFromFindings(
  queueItem: DigestQueueItem,
  topic: Topic,
  findings: ResearchFinding[],
  timeframe: DigestTimeframe
): Promise<SmartDigest> {
  // No-op: Backend DigestProcessor handles digest generation directly.
  // This method previously made a long HTTP request that was fragile.
  throw new Error('Frontend digest generation disabled — backend processor handles this');
}
```

### Step 4.6: Remove `processQueue()` call from `startPolling()`

Find the `startPolling()` method (search for `startPolling` in the file):
```typescript
public startPolling(): void {
  logger.debug('[DigestService] Initializing queue service after login');
  setTimeout(() => this.processQueue(), 1000);
}
```

Change to:
```typescript
public startPolling(): void {
  logger.debug('[DigestService] Initializing digest service after login');
  // Backend DigestProcessor handles queue processing — no frontend polling needed
}
```

### IMPORTANT: Do NOT remove the `longOperationApi` import

The `longOperationApi` import may be used by other code paths. Leave the import as-is:
```typescript
import { api, longOperationApi } from './api';
```

### Build Verification
```bash
npm run build
# Must exit with code 0
```

- [ ] Phase 4 complete

---

## Phase 5: Stop Excessive Polling After Resolution

**File**: `src/hooks/useDigest.ts`

### Step 5.1: Add `hasResolvedOnce` guard to the queue status useEffect

Find the useEffect that polls queue status (around line 271-331):
```typescript
useEffect(() => {
  if (!topicId) return;

  let isMounted = true;
  let pollTimer: NodeJS.Timeout | null = null;

  const checkQueueStatus = async () => {
    setLoading('digest', true);
    try {
      logger.debug(`[useDigest] Checking queue status for topic ${topicId}...`);
      const status = await digestService.getQueueStatusByTopic(topicId);

      if (!isMounted) return;

      if (status && (status.status === 'pending' || status.status === 'processing')) {
        // Active queue found! Show generation progress
        logger.debug(`[useDigest] Active queue found:`, status);
        const percentage = status.status === 'processing' ? 50 : 10;
        const message = status.status === 'processing'
          ? 'Generating digest...'
          : 'Queued for generation...';

        setDigestProgress(percentage, message);

        // Continue polling until complete
        pollTimer = setTimeout(checkQueueStatus, 2000);
      } else if (status?.status === 'completed') {
        // Just completed - load the digest
        logger.debug(`[useDigest] Queue completed, loading digest...`);
        await loadDigestFromStore(topicId, timeframe);
        setDigestProgress(0, '');
        setLoading('digest', false);
      } else {
        // No active queue - try to load existing digest
        logger.debug(`[useDigest] No active queue for topic ${topicId}, trying to load digest...`);

        // Always try to load the digest when there's no active queue
        // This handles the case where digest was generated but queue was cleared
        try {
          await loadDigestFromStore(topicId, timeframe);
        } catch (loadError) {
          logger.debug(`[useDigest] No digest found for topic ${topicId}`);
        }

        setDigestProgress(0, '');
        setLoading('digest', false);
      }
    } catch (error) {
      logger.error('[useDigest] Error checking queue status:', error);
      setLoading('digest', false);
    }
  };

  // Check immediately on mount
  checkQueueStatus();

  return () => {
    isMounted = false;
    if (pollTimer) clearTimeout(pollTimer);
  };
}, [topicId, timeframe, setDigestProgress, loadDigestFromStore, setLoading]);
```

Replace the ENTIRE useEffect with:
```typescript
useEffect(() => {
  if (!topicId) return;

  let isMounted = true;
  let pollTimer: NodeJS.Timeout | null = null;
  let hasResolvedOnce = false;

  const checkQueueStatus = async () => {
    if (hasResolvedOnce || !isMounted) return;

    setLoading('digest', true);
    try {
      logger.debug(`[useDigest] Checking queue status for topic ${topicId}...`);
      const status = await digestService.getQueueStatusByTopic(topicId);

      if (!isMounted) return;

      if (status && (status.status === 'pending' || status.status === 'processing')) {
        // Active queue found! Show generation progress
        logger.debug(`[useDigest] Active queue found:`, status);
        const percentage = status.status === 'processing' ? 50 : 10;
        const message = status.status === 'processing'
          ? 'Generating digest...'
          : 'Queued for generation...';

        setDigestProgress(percentage, message);

        // Continue polling until complete
        pollTimer = setTimeout(checkQueueStatus, 2000);
      } else {
        // Queue resolved (completed, failed, or absent) — resolve once and stop
        hasResolvedOnce = true;

        if (status?.status === 'completed') {
          logger.debug(`[useDigest] Queue completed, loading digest...`);
        } else {
          logger.debug(`[useDigest] No active queue for topic ${topicId}, trying to load digest...`);
        }

        try {
          await loadDigestFromStore(topicId, timeframe);
        } catch (loadError) {
          logger.debug(`[useDigest] No digest found for topic ${topicId}`);
        }

        setDigestProgress(0, '');
        setLoading('digest', false);
      }
    } catch (error) {
      logger.error('[useDigest] Error checking queue status:', error);
      hasResolvedOnce = true;
      setDigestProgress(0, '');
      setLoading('digest', false);
    }
  };

  // Check immediately on mount
  checkQueueStatus();

  return () => {
    isMounted = false;
    if (pollTimer) clearTimeout(pollTimer);
  };
}, [topicId, timeframe, setDigestProgress, loadDigestFromStore, setLoading]);
```

**Key changes:**
1. Added `hasResolvedOnce` flag — prevents re-polling after queue resolves
2. Early return if `hasResolvedOnce` is true
3. Merged the `completed` and `absent/failed` branches — both resolve once and load digest
4. Set `hasResolvedOnce = true` on error too — prevents error-retry loops

### Build Verification
```bash
npm run build
# Must exit with code 0
```

- [ ] Phase 5 complete

---

## Phase 6: Build Verification

Run both builds:

```bash
# Frontend
npm run build
# Must exit with code 0

# Backend
cd backend && npm run build
# Must exit with code 0
```

- [ ] Frontend builds successfully
- [ ] Backend builds successfully

---

## Phase 7: Deployment

### Step 7.1: Commit and push

```bash
git add backend/src/services/ai.service.ts \
       backend/src/routes/digestQueue.routes.ts \
       backend/src/services/digest-processor.service.ts \
       src/services/digest.service.ts \
       src/hooks/useDigest.ts

git commit -m "fix: decouple digest generation from frontend HTTP — use backend processor exclusively

- Increase Anthropic SDK timeout from 120s to 300s (matches nginx/Express/frontend)
- Remove frontend processQueue/processQueueItem (held fragile long HTTP connection)
- Backend DigestProcessor now handles ALL digest generation (manual + autonomous)
- Reduce processor poll interval from 30s to 10s for faster user-initiated pickup
- Add orphaned 'processing' item recovery (stale > 5 minutes)
- Fix useDigest polling to stop after queue resolution (no repeated 404s)
- Fix Zod timeframe validation: 'all' → 'all-time' to match frontend type"

git push
```

### Step 7.2: Deploy to server

```bash
ssh chee@100.94.82.35 "cd /home/chee/medical-pwa && git pull && docker compose down && docker compose up -d --build"
```

### Step 7.3: Clear stale queue items

```bash
ssh chee@100.94.82.35 "docker exec medcompanion-postgres psql -U meduser -d medcompanion -c \"UPDATE digest_queue SET status = 'cancelled' WHERE status IN ('pending', 'processing', 'failed');\""
```

- [ ] Phase 7 complete

---

## Phase 8: Production Verification

### Test 1: Manual Digest Generation

1. Open the app and navigate to a topic with 40+ findings
2. Click "Generate Digest"
3. **Expected**: UI shows "Queued for generation..." then "Generating digest..." within 10s
4. **Expected**: NO 504 errors in browser console
5. **Expected**: Digest completes in 60-120s and displays correctly
6. **Expected**: NO repeated 404s to `/api/digests/latest/...`

### Test 2: Check Server Logs

```bash
ssh chee@100.94.82.35 "docker logs medical-companion --tail 50 2>&1"
```

**Expected log sequence:**
```
[DigestQueue] Creating queue item → pending
[DigestProcessor] Processing queue item {id} for topic {topicId}
[AI Service] Starting digest generation with N findings
[AI Service] Anthropic API responded in Xs
✅ Digest generated successfully
[DigestProcessor] ✅ Completed digest {digestId} for topic {topicId}
```

**Must NOT see:**
- `[DigestService] Failed to process queue item` (frontend processing)
- `504` or `timeout` errors
- `Updating queue ... to status failed`

### Test 3: Browser Network Tab

1. Open DevTools → Network tab
2. Click "Generate Digest"
3. **Must see**: `POST /api/digest-queue` (queue creation)
4. **Must see**: `GET /api/digest-queue/status/{topicId}` (polling every 2s)
5. **Must NOT see**: `POST /api/digest/generate-digest` (the old long HTTP request)

### Test 4: Autonomous Scheduled Run

1. Wait for the autonomous scheduler cycle (check logs for `[Scheduler]`)
2. If scheduler creates a queue item, verify DigestProcessor picks it up
3. Verify digest is generated and saved without errors

### Test 5: Edge Cases

1. **Double-click**: Click "Generate Digest" twice quickly — should not create duplicate queue items
2. **Page refresh during generation**: Refresh the page while digest is generating — polling should resume and detect the in-progress generation
3. **Failed generation**: If AI returns an error, verify queue is marked 'failed' and UI shows error message (not infinite loading)

- [ ] Test 1 passed: Manual digest generation works
- [ ] Test 2 passed: Server logs show correct sequence
- [ ] Test 3 passed: No long HTTP requests in Network tab
- [ ] Test 4 passed: Autonomous path works
- [ ] Test 5 passed: Edge cases handled

---

## Architecture After Fix

### Before (Broken)
```
Manual Click → Frontend processQueueItem() → longOperationApi.post (holds HTTP 60-120s) → 504 → FAILED
Autonomous   → Backend DigestProcessor → direct AI call → SQL INSERT → SUCCESS
```

Two competing systems, only one works reliably.

### After (Fixed)
```
Manual Click → Create queue (pending) → Backend DigestProcessor picks up → AI → SQL INSERT → SUCCESS
Autonomous   → Create queue (pending) → Backend DigestProcessor picks up → AI → SQL INSERT → SUCCESS
```

Both paths use the EXACT SAME processing logic. No competing systems.

### Timeout Chain (All Aligned at 300s)
```
Nginx proxy_read_timeout:    300s ✅
Express server timeout:       300s ✅
Express route timeout:        300s ✅
Anthropic SDK timeout:        300s ✅ (was 120s — FIXED)
Frontend longOperationApi:    300s ✅ (no longer used for digest gen)
```

---

## Files Modified

| File | Change | Risk |
|------|--------|------|
| `backend/src/services/ai.service.ts` | SDK timeout 120s → 300s | Low |
| `backend/src/routes/digestQueue.routes.ts` | Zod timeframe `'all'` → `'all-time'` | Minimal |
| `backend/src/services/digest-processor.service.ts` | Poll 30s → 10s + orphan recovery | Low |
| `src/services/digest.service.ts` | Gut processQueue/processQueueItem/generateDigestFromFindings | Medium |
| `src/hooks/useDigest.ts` | Add hasResolvedOnce guard to polling | Low |

---

## Rollback Plan

If something breaks after deployment:

1. **Revert the commit**: `git revert HEAD`
2. **Push and redeploy**: `git push && ssh chee@100.94.82.35 "cd /home/chee/medical-pwa && git pull && docker compose down && docker compose up -d --build"`
3. **Clear queue**: `docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "UPDATE digest_queue SET status = 'cancelled' WHERE status IN ('pending', 'processing');"`

The previous behavior (frontend processing) will be restored. It has the 504 timeout issue but at least the autonomous path works.

---

## Sign-off

| Phase | Description | Date | Status |
|-------|-------------|------|--------|
| 1 | Increase Anthropic SDK timeout | | |
| 2 | Fix Zod timeframe validation | | |
| 3 | Speed up DigestProcessor + orphan recovery | | |
| 4 | Decouple frontend from HTTP (core fix) | | |
| 5 | Stop excessive polling | | |
| 6 | Build verification | | |
| 7 | Deployment | | |
| 8 | Production verification | | |

---

*Created: February 6, 2026*
*Author: Claude (Plan 009)*
