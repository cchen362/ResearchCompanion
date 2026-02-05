# Grand Comeback: Autonomous Agents & Digest Integration

## ⛔ STOP: Read This Before Writing ANY Code

**This document is the STRICT implementation guide for autonomous agents and digest integration.**

Agents MUST follow this guide exactly. NO deviations, NO quick wins, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **No local backend testing** - All functional testing on production server

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: LOCAL DEVELOPMENT                                      │
│ - Implement ALL phases (0, 1, 2) locally                        │
│ - Run `npm run build` after each file change                    │
│ - Run `cd backend && npm run build` for backend changes         │
│ - Verify NO compile errors before proceeding                    │
│ - Commit changes to git                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: DEPLOYMENT TO DEBIAN SERVER                            │
│ - Push changes to remote repository                             │
│ - SSH into Debian server                                        │
│ - Pull updated repository                                       │
│ - Rebuild Docker containers                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: PRODUCTION TESTING                                     │
│ - Run ALL test scenarios on production server                   │
│ - If issues found, fix locally → redeploy → retest              │
│ - Document any issues in this file                              │
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

- **Phase**: Phase 0 - UX Critical Fix
- **Start Date**: TBD
- **Estimated Duration**: 3-4 hours (implementation) + 1 hour (deployment/testing)
- **Status**: Ready for implementation

---

## The Critical Problem

The Medical Companion PWA has THREE fundamental issues preventing autonomous operation:

1. **Backend scheduler is disabled** - Line 91 hardcodes empty array instead of fetching topics
2. **Digest UI doesn't detect background generation** - `useDigest` has no `useEffect` to check queue on mount
3. **User sees "Ready to Generate" when digest is generating** - Critical UX failure

**Result**: Users manually trigger everything. No autonomous behavior.

---

## The 3-Phase Solution

### Phase 0: Fix Digest UI (CRITICAL - DO FIRST)
- Add `useEffect` to check queue status on mount
- Show "Generating..." if queue is active
- NEVER show "Ready to Generate" when digest is in progress

### Phase 1: Enable Backend Scheduler
- Add `getAllActive()` method to TopicModel
- Enable scheduler to fetch and process topics
- Queue digest after agents complete

### Phase 2: Connect Events
- Bridge SSE notifications to browser events
- Ensure real-time UI updates

---

## Strict Rules for All Agents

### ✅ MUST DO:
1. **Follow each step IN ORDER** - No skipping ahead
2. **Run `npm run build` after each file change** - Verify no errors
3. **Test after each phase** - Use the exact test scenarios provided
4. **Add console.log for debugging** - Use `logger.debug()` format
5. **Update this document** - Mark steps complete as you go

### ❌ MUST NOT DO:
1. **Add ANY new features** - Only implement what's specified
2. **Create new files** - Edit existing files only
3. **Refactor surrounding code** - Touch only the lines specified
4. **Add "improvements"** - No type changes, no cleanups, no optimizations
5. **Skip testing** - Every phase must pass tests before proceeding

---

## Phase 0: Fix Digest UI Detection

**Goal**: When user navigates to Findings page, detect if digest is generating and show progress.

**Problem**: `useDigest.ts` imports `useEffect` (line 38) but NEVER USES IT.

### Step 0.1: Add useEffect to useDigest Hook

**File**: `src/hooks/useDigest.ts`

**Location**: Add after the `setTimeframe` callback (after line ~264), before the final return statement

**Code to Add**:

```typescript
/**
 * PHASE 0 FIX: Check for active digest queue on mount.
 * This ensures UI shows "Generating..." even if generation was started
 * elsewhere (scheduler, another page, after agent completion).
 */
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
        // No active queue
        logger.debug(`[useDigest] No active queue for topic ${topicId}`);
        // Only reset if not in user-initiated generation
        const currentProgress = useUIStore.getState().digestProgress;
        if (currentProgress === 0 || currentProgress >= 100) {
          setDigestProgress(0, '');
        }
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

**Verification**:
```bash
npm run build
# Should complete with no errors
```

### Step 0.2: Add Loading State to DigestPanel

**File**: `src/components/research/digest/DigestPanel.tsx`

**Location**: Add BEFORE the `if (isGenerating)` check (before line 83)

**Code to Add**:

```typescript
  // PHASE 0 FIX: Show brief loading while checking queue status
  // This prevents "Ready to Generate" flash during queue check
  if (isLoading && !digest && !isGenerating) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
        <p className="text-muted-foreground">Loading digest...</p>
      </Card>
    );
  }
```

**Verification**:
```bash
npm run build
# Should complete with no errors
```

### Step 0.3: Local Verification (Build Only)

**NOTE**: Functional testing happens AFTER deployment to Debian server.

**Local verification**:
```bash
npm run build
# Must complete with exit code 0 and no TypeScript errors
```

**✅ Phase 0 Local Checklist**:
- [ ] `useEffect` added to useDigest.ts
- [ ] Loading state added to DigestPanel.tsx
- [ ] `npm run build` passes with no errors

---

## Phase 1: Enable Backend Scheduler

**Goal**: Make the scheduler actually run agents autonomously.

### Step 1.1: Add getAllActive() to TopicModel

**File**: `backend/src/models/topic.model.ts`

**Location**: Add after `getWithStats` method (after line 160)

**Code to Add**:

```typescript
/**
 * Get all active topics across all users that have enabled agents.
 * Used by the scheduler service for autonomous execution.
 *
 * PHASE 1: This method enables the scheduler to find topics to process.
 */
static async getAllActive(): Promise<(Topic & { user_id: string })[]> {
  return query<Topic & { user_id: string }>(
    `SELECT DISTINCT t.*, t.user_id
     FROM topics t
     INNER JOIN agents a ON a.topic_id = t.id
     WHERE t.archived = false
       AND a.enabled = true
       AND a.schedule IS NOT NULL
       AND a.schedule != 'manual'
     ORDER BY t.updated_at DESC`,
    []
  );
}
```

**Verification**:
```bash
cd backend && npm run build
# Should complete with no errors
```

### Step 1.2: Enable Scheduler Topic Fetching

**File**: `backend/src/services/scheduler.service.ts`

**Location**: Line 91

**Change FROM**:
```typescript
const activeTopics: any[] = []; // await TopicModel.getAllActive();
```

**Change TO**:
```typescript
const activeTopics = await TopicModel.getAllActive();
```

**Verification**:
```bash
cd backend && npm run build
# Should complete with no errors
```

### Step 1.3: Add Timeout Protection

**File**: `backend/src/services/scheduler.service.ts`

**Location**: In `executeAgentsInBackground` method, wrap the execution

**Find this code** (around line 189):
```typescript
private async executeAgentsInBackground(
  topicId: string,
  userId: string,
  topicName: string,
  agents: Agent[]
) {
```

**Replace the method body with**:

```typescript
private async executeAgentsInBackground(
  topicId: string,
  userId: string,
  topicName: string,
  agents: Agent[]
) {
  const startTime = Date.now();
  const AGENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes max

  console.log(`[Scheduler] Starting background execution for topic "${topicName}"`);

  try {
    // Wrap execution with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Agent execution timed out')), AGENT_TIMEOUT);
    });

    const executionPromise = this.executionService.runAgentsForTopic(
      topicId,
      userId,
      agents
    );

    const findings = await Promise.race([executionPromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    console.log(`[Scheduler] Topic "${topicName}": Found ${findings.length} findings in ${duration}ms`);

    if (findings.length > 0) {
      // PHASE 1: Queue digest generation directly in backend
      try {
        const { pool } = await import('../db/database.js');
        const DigestQueueServicePG = (await import('./digestQueue.service.pg.js')).default;
        const queueService = new DigestQueueServicePG(pool);

        await queueService.createQueueItem({
          userId,
          topicId,
          timeframe: 'all-time',
          digestType: 'smart',
          priority: 5,
          metadata: {
            source: 'scheduled-agent-run',
            findingsCount: findings.length
          }
        });
        console.log(`[Scheduler] Queued digest generation for topic "${topicName}"`);
      } catch (queueError) {
        console.error(`[Scheduler] Failed to queue digest for topic "${topicName}":`, queueError);
      }

      // Create notification
      await this.createBackgroundNotification(userId, topicId, topicName, findings.length);
    }
  } catch (error: any) {
    if (error.message === 'Agent execution timed out') {
      console.log(`[Scheduler] Topic "${topicName}": Timed out after 5 minutes`);
    } else {
      console.error(`[Scheduler] Error executing agents for topic "${topicName}":`, error);
    }
  }
}
```

**Verification**:
```bash
cd backend && npm run build
# Should complete with no errors
```

### Step 1.4: Local Verification (Build Only)

**NOTE**: Functional testing happens AFTER deployment to Debian server.

**Local verification**:
```bash
cd backend && npm run build
# Must complete with exit code 0 and no TypeScript errors
```

**✅ Phase 1 Local Checklist**:
- [ ] `getAllActive()` added to topic.model.ts
- [ ] Scheduler line 91 enabled
- [ ] Timeout protection added
- [ ] `cd backend && npm run build` passes with no errors

---

## Phase 2: Connect SSE Events

**Goal**: When backend scheduler completes agents, frontend auto-detects and shows progress.

### Step 2.1: Bridge SSE to Browser Events

**File**: `src/services/notification-stream.service.ts`

**Location**: In `processNotification` method

**Find this section** (around line 139):
```typescript
private processNotification(notification: ServerNotification, showToast: boolean): void {
```

**Add AFTER the existing event dispatch** (after `window.dispatchEvent(new CustomEvent('server-notification'...`):

```typescript
    // PHASE 2: Bridge backend notifications to frontend event system
    // This triggers digest auto-generation when scheduler completes agents
    if (notification.type === 'agent_complete' && notification.data?.topicId) {
      console.log('[NotificationStream] Bridging agent_complete to agents-complete event');
      window.dispatchEvent(new CustomEvent('agents-complete', {
        detail: {
          topicId: notification.data.topicId,
          findingsCount: notification.data.findingsCount || 0,
          source: 'server-scheduler'
        }
      }));
    }
```

**Verification**:
```bash
npm run build
# Should complete with no errors
```

### Step 2.2: Local Verification (Build Only)

**NOTE**: Functional testing happens AFTER deployment to Debian server.

**Local verification**:
```bash
npm run build
# Must complete with exit code 0 and no TypeScript errors
```

**✅ Phase 2 Local Checklist**:
- [ ] SSE bridge code added to notification-stream.service.ts
- [ ] `npm run build` passes with no errors

---

## Deployment to Debian Server

**After ALL local code changes are complete and builds pass:**

### Deployment Steps

```bash
# 1. Commit all changes locally
git add -A
git commit -m "feat: autonomous agents and digest integration (Phases 0-2)"

# 2. Push to remote repository
git push origin fix/digest-findings-race-condition

# 3. SSH into Debian server
ssh user@your-debian-server

# 4. Navigate to project directory
cd /home/medical-pwa

# 5. Pull latest changes
git pull origin fix/digest-findings-race-condition

# 6. Rebuild Docker containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 7. Check container logs for startup errors
docker-compose logs -f backend
# Look for: "✅ Autonomous agents will run on their configured schedules"
```

---

## Production Testing (On Debian Server)

**ALL of these MUST pass before marking complete:**

### Test 1: Backend Scheduler Running
1. SSH into server
2. Check backend logs: `docker-compose logs -f backend`
3. Wait up to 15 minutes (production interval)
4. Look for:
   ```
   [Scheduler] Found X active topics
   [Scheduler] Topic xxx: Y agents due
   [Scheduler] Queued digest generation for topic...
   ```
5. ✅ Logs show scheduler processing topics
6. ❌ Logs show "No active topics found" = Check database for enabled agents

### Test 2: Dashboard → Findings During Generation
1. Open app in browser on production URL
2. Trigger agent run (manual "Run All" or wait for scheduler)
3. Wait for "agents completed" notification
4. Navigate to Findings IMMEDIATELY
5. ✅ See "Generating AI-Powered Insights"
6. ❌ See "Ready to Generate Insights" = FAIL

### Test 3: Page Refresh During Generation
1. Start digest generation
2. Hard refresh browser (Ctrl+Shift+R)
3. Navigate to Findings
4. ✅ See "Generating AI-Powered Insights"
5. ❌ See "Ready to Generate Insights" = FAIL

### Test 4: Multiple Topic Navigation
1. Topic A: Has completed digest
2. Topic B: Has digest generating
3. Navigate: A → B → A → B
4. ✅ Topic B always shows "Generating..."
5. ❌ Topic B shows "Ready to Generate" = FAIL

### Test 5: Cached Digest Persists
1. Generate digest for a topic
2. Wait for completion
3. Navigate away and back 5 times
4. ✅ Digest shows instantly every time
5. ❌ Shows loading or "Ready to Generate" = FAIL

### Console Debug (Browser DevTools on Production)
Watch for these log messages:
```
[useDigest] Checking queue status for topic xxx...
[useDigest] Active queue found: { status: 'processing', ... }
[NotificationStream] Bridging agent_complete to agents-complete event
```

---

## Files Modified Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/hooks/useDigest.ts` | 0 | Added useEffect for queue check on mount |
| `src/components/research/digest/DigestPanel.tsx` | 0 | Added loading state during queue check |
| `backend/src/models/topic.model.ts` | 1 | Added `getAllActive()` method |
| `backend/src/services/scheduler.service.ts` | 1 | Enabled topic fetching, added timeout, queued digest |
| `src/services/notification-stream.service.ts` | 2 | Added SSE to browser event bridge |

**Total files modified**: 5
**Total new files**: 0
**Total deleted files**: 0

---

## Rollback Plan

If something breaks:

1. **Phase 0 breaks UI**:
   - Remove the `useEffect` block from useDigest.ts
   - Remove the loading state block from DigestPanel.tsx
   - Run `npm run build` to verify

2. **Phase 1 breaks scheduler**:
   - Change line 91 back to `const activeTopics: any[] = [];`
   - Run `cd backend && npm run build`

3. **Phase 2 breaks notifications**:
   - Remove the `if (notification.type === 'agent_complete'...` block
   - Run `npm run build`

---

## Document History

- **Created**: February 5, 2026
- **Author**: Planning Phase
- **Status**: Ready for implementation

---

## Phase Completion Sign-off

### Local Development (Code Changes)
- [ ] **Phase 0**: useDigest.ts + DigestPanel.tsx modified
- [ ] **Phase 1**: topic.model.ts + scheduler.service.ts modified
- [ ] **Phase 2**: notification-stream.service.ts modified
- [ ] **All builds pass**: `npm run build` and `cd backend && npm run build`
- [ ] **Code committed**: Changes committed to git

### Deployment
- [ ] **Pushed to remote**: `git push origin fix/digest-findings-race-condition`
- [ ] **Pulled on Debian**: Latest code on production server
- [ ] **Containers rebuilt**: `docker-compose build --no-cache && docker-compose up -d`
- [ ] **Backend started**: Logs show scheduler running

### Production Testing
- [ ] **Test 1 passes**: Scheduler processing topics
- [ ] **Test 2 passes**: No "Ready to Generate" flash
- [ ] **Test 3 passes**: Refresh preserves generation state
- [ ] **Test 4 passes**: Topic navigation works correctly
- [ ] **Test 5 passes**: Cached digest persists

### Sign-off
- [ ] **All tests pass** (Date: _______)
- [ ] **Document updated** with any issues found (Date: _______)
