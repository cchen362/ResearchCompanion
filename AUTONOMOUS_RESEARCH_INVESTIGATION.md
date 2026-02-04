# Autonomous Research Architecture Investigation
*Date: February 4, 2026*
*Investigator: Claude Agent*

## Executive Summary

The Medical Companion PWA has **fundamentally deviated** from its core promise of being an "autonomous medical research companion." Through a series of band-aid fixes and technical debt accumulation, the app now requires manual intervention where it should be automatic, defeating its primary value proposition.

## Core Vision vs Current Reality

### Original Vision (What Was Promised)
- **AUTONOMOUS**: Agents run automatically, findings generate automatically, digests create automatically
- **SEAMLESS**: Users get immediate insights without manual intervention
- **INTELLIGENT**: AI-powered analysis happens in the background
- **PROGRESSIVE**: Each feature adds value without adding friction

**Intended Flow:**
```
Create Topic → Agents Auto-Run → Findings Auto-Save → Digest Auto-Generates → User Sees Insights
```

### Current Reality (What Actually Happens)
```
Create Topic → Agents Run (with errors) → Findings Save → User Sees Raw Data → Must Click "Generate Digest" → Wait 60+ seconds → Maybe Get Digest
```

## Critical Architectural Issues Discovered

### 1. Auto-Generation Disabled (CRITICAL DEVIATION)

**Location**: `src/components/FindingsViewerProgressive.tsx` (Lines 557-576)

**What Happened**:
- February 3, 2026: Auto-generation was completely disabled
- 60+ lines of working auto-generation code were commented out
- Users now must manually click "Generate Digest" button

**Why This Happened**:
- Digest-findings race condition caused regeneration issues
- Instead of fixing the root cause, the feature was disabled
- Classic band-aid fix that violates app's own "No Band-Aid Fixes" principle

**Impact**:
- Breaks the "autonomous" promise
- Adds friction to user experience
- Makes the app harder to use, not easier

### 2. Deduplication Logic Backwards (ROOT CAUSE)

**Location**: `backend/src/routes/digests.crud.routes.ts`

**The Problem**:
```
Current Flow (BROKEN):
1. Generate expensive 60+ second AI digest
2. THEN check if digest already exists
3. If exists, throw away new digest and return old one
4. Waste AI resources and user time
```

**Correct Flow Should Be**:
```
1. Check if recent digest exists
2. If yes, return it immediately
3. If no, THEN generate new digest
4. Save and return new digest
```

**Impact**:
- Wastes expensive AI API calls
- Creates race conditions
- Led to disabling auto-generation instead of fixing this

### 3. Technical Debt Accumulation

#### A. Multiple Storage Systems Without Clear Boundaries
- PostgreSQL (primary storage)
- IndexedDB (local cache)
- LocalStorage (Zustand state)
- Service Worker cache (removed but artifacts remain)

**Issues**:
- Sync problems between storage layers
- Race conditions on data access
- Unclear which is source of truth

#### B. Service Layer Confusion
Multiple service patterns co-exist:
- `*.service.ts` - Original services
- `*.api.service.ts` - API services
- `utils/db/*` - Direct database access
- Zustand stores - State management

**Example of Redundancy**:
- `findings.service.ts` → delegates to → `findings.api.service.ts`
- `agents.service.ts` → delegates to → `agents.api.service.ts`
- But also direct DB access in `utils/db/agents.ts`

#### C. Component Complexity
`FindingsViewerProgressive.tsx`: **1,300+ lines** of mixed concerns:
- UI rendering
- Business logic
- API calls
- State management
- Event handling
- Digest generation
- Queue management

### 4. Agent Runner Issues

**Location**: `src/components/agents/agentRunner.ts`

**Problems Found**:
1. Calls `agentsService.updateAgent()` which didn't exist (we just fixed this)
2. Mixed use of services vs direct API calls
3. No proper error recovery
4. Race conditions between parallel agent runs

**Consequences**:
- Console errors that confuse users
- Incomplete agent status updates
- Potential data inconsistency

### 5. The 10 vs 20 Findings Issue (Just Fixed)

**What We Fixed Today**:
- Digest was only getting 10 findings instead of 20
- Added explicit `limit: 100` parameter
- But this was a symptom of deeper architectural issues

**Deeper Issue**:
- Why was there a default limit of 10?
- Where else are limits being applied?
- Are we fetching data efficiently?

## Band-Aid Fixes That Created More Problems

### Timeline of Decay

**January 18, 2026**:
- "Fixed" digest-findings race condition
- Status: Issue persisted

**January 22, 2026**:
- Reduced findings from 100 to 10 to prevent Cloudflare timeouts
- Band-aid: Limiting data instead of optimizing

**February 3, 2026**:
- Disabled auto-generation entirely
- Ultimate band-aid: Remove feature instead of fix it

**February 4, 2026 (Today)**:
- Fixed 10 vs 20 findings issue
- Fixed agent update error
- But auto-generation still disabled

### Documented But Unfixed Issues

From `server_storage_fixes.md`:
1. **Digest Deduplication Still Returning Old Data** (Line 166)
   - Acknowledged but not fixed
   - "Need to completely rethink deduplication strategy"

2. **Frontend State Management** (Line 171)
   - "Still using component state instead of Zustand in many places"
   - Incomplete migration causing inconsistencies

3. **Performance** (Line 175)
   - "Digest generation takes 60+ seconds"
   - No caching strategy implemented

## Architectural Recommendations for Next Agent

### Priority 1: Restore Autonomous Behavior

1. **Fix Deduplication Logic First**
   - Move dedup check BEFORE generation
   - Only generate when needed
   - Save AI costs and time

2. **Re-enable Auto-Generation**
   - Uncomment lines 562-576 in FindingsViewerProgressive.tsx
   - Add proper guards to prevent duplicate generation
   - Test thoroughly

### Priority 2: Simplify Architecture

1. **Clear Storage Boundaries**
   ```
   PostgreSQL: Source of truth
   IndexedDB: Offline cache only
   Zustand: UI state only
   LocalStorage: User preferences only
   ```

2. **Consolidate Service Layer**
   - One service per domain
   - Clear API vs local storage paths
   - Remove redundant delegation

3. **Break Up Mega-Components**
   - Extract FindingsViewerProgressive into:
     - FindingsContainer (logic)
     - FindingsList (display)
     - DigestManager (digest logic)
     - QueueManager (queue handling)

### Priority 3: Fix Root Causes

1. **Race Conditions**
   - Implement proper transaction management
   - Use optimistic locking
   - Add retry logic with exponential backoff

2. **Performance**
   - Implement digest caching strategy
   - Add pagination for large finding sets
   - Optimize AI prompts for speed

3. **Error Handling**
   - Centralized error handling
   - User-friendly error messages
   - Automatic retry for transient failures

## Code Smells to Address

1. **Commented Code Instead of Removal**
   - 60+ lines of commented auto-generation code
   - Old service worker references
   - Deprecated component imports

2. **Console.log Debugging Left in Production**
   - Hundreds of console.log statements
   - Some with sensitive data
   - Should use proper logging service

3. **Mixed Async Patterns**
   - Promises, async/await, callbacks all mixed
   - Creates race conditions
   - Hard to reason about flow

4. **Hardcoded Values**
   - Timeouts hardcoded throughout
   - API limits scattered in code
   - Should be centralized config

## The Path Forward

### Immediate Actions (4-6 hours)
1. Fix deduplication logic (move check before generation)
2. Re-enable auto-generation
3. Add user communication about digest status
4. Test end-to-end flow

### Short Term (2-3 days)
1. Break up mega-components
2. Consolidate service layer
3. Implement proper error handling
4. Add comprehensive logging

### Long Term (1-2 weeks)
1. Complete architecture refactor
2. Implement proper caching strategy
3. Add performance monitoring
4. Create integration tests

## Testing Checklist for Validation

After fixes are applied, verify:

- [ ] New topic → agents run → digest auto-generates
- [ ] Navigate away and back → digest persists
- [ ] No duplicate generation when revisiting
- [ ] Manual refresh works when requested
- [ ] No console errors during flow
- [ ] Performance under 30 seconds for digest
- [ ] All 20 findings included in digest
- [ ] Clear user feedback during generation

## Key Files for Next Investigation

**Critical Files to Review**:
1. `src/components/FindingsViewerProgressive.tsx` - Restore auto-generation
2. `backend/src/routes/digests.crud.routes.ts` - Fix deduplication
3. `src/services/digestQueue.service.ts` - Queue management
4. `src/components/agents/agentRunner.ts` - Agent coordination
5. `server_storage_fixes.md` - History of issues

**Architecture Files**:
1. `CLAUDE.md` - Core principles and guidelines
2. `PHASE_ALIGNMENT_STRATEGY.md` - Product vision
3. `README.md` - Original promises to users

## Conclusion

The Medical Companion PWA has accumulated significant technical debt through band-aid fixes that violated its own principles. The core "autonomous" value proposition has been compromised by disabling auto-generation instead of fixing the root cause.

The next agent should focus on:
1. **Restoring autonomous behavior** by fixing deduplication and re-enabling auto-generation
2. **Simplifying the architecture** to reduce complexity and prevent future issues
3. **Adding proper monitoring** to catch issues before they require band-aid fixes

The app's vision is sound and valuable. It just needs to be realigned with its original autonomous promise.

---
*End of Investigation Report*
*For questions or clarification, refer to the documented issues in server_storage_fixes.md*