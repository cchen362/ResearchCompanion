# Plan 019: Dead Digest Field Cleanup & Button Consolidation

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan addresses **dead digest field cleanup and UX issues** identified during Plan 018 production verification on Feb 9, 2026.

| Issue | Symptom | Root Cause |
|-------|---------|-----------|
| **sourceCount mismatch** | "View All 41 Sources" button at bottom of digest, but SourceDrawer shows "50 findings from 24 sources" | Backend `uniqueStudies` Set counts by DOI/PMID/URL combos (41), SourceDrawer groups by `source.name` (24). Three different numbers for the same concept. |
| **Dead statistics fields** | `highRelevanceCount` and `avgConfidence` in fallback statistics | Remnants of deprecated scoring system. Zero frontend consumers — violates "Facts, Not Scores" principle. |
| **Dead DigestTheme system** | ~150 lines across 14 files for theme categorization | AI service stopped generating themes long ago. All code paths produce `themes: []`. `onThemeClick` prop chains through 4 components but is never invoked. |
| **Dead trends field** | ~40 lines across 6 files for trend tracking | AI service always produces `{ emerging: [], declining: [], stable: [] }`. Zero frontend consumers. |
| **Redundant digest buttons** | Three buttons that all do the same thing: toolbar "Update", bottom "Update Research", bottom "Regenerate" | `refreshDigest()` and `generateDigest(force=true)` both call `queueDigestFromExistingFindings()`. `refreshResearchAndDigest()` is a misleading wrapper that does NOT fetch new research. |

**Plan is split into 2 phases:**
- **Phase 1**: Remove all dead digest fields — `sourceCount`, `highRelevanceCount`, `avgConfidence`, DigestTheme system, and `trends` (~217 lines across 17 files) **[COMPLETE]**
- **Phase 2**: Consolidate digest action buttons — remove toolbar "Update" button and bottom "Update Research" button, keep only "Regenerate Digest" with informative tooltip, remove dead `refreshDigest`/`refreshResearchAndDigest` code path (5 files) **[COMPLETE]**

---

## Strict Rules

### MUST DO
- [x] Follow steps IN ORDER within each phase
- [x] Run `npx tsc --noEmit` in `backend/` after every Phase 1 backend change
- [x] Run `npm run build` in project root after every Phase 2 frontend change
- [ ] Test on production after deployment

### MUST NOT DO
- [x] Do NOT change the SourceDrawer counting logic — it's correct (groups by `source.name`)
- [x] Do NOT remove `totalFindings` or `newFindings` from `statistics` — only dead fields
- [x] Do NOT confuse App Theme (light/dark/system — ALIVE) with DigestTheme (research grouping — DEAD)
- [x] Do NOT remove the "Generate Digest" button (shown when no digest exists) — only consolidate the post-digest buttons
- [x] Do NOT add new buttons or features — this is a cleanup plan

---

## Phase 1: Remove All Dead Digest Fields [COMPLETE]

**Goal**: Remove `sourceCount`, `highRelevanceCount`, `avgConfidence`, the entire DigestTheme system, and the `trends` field across the full stack.

**Completed**: February 9, 2026

### Phase 1 Scope (expanded during implementation)

During initial `sourceCount` removal, two additional dead systems were identified and approved for removal:

| Dead Code | Why Dead | Impact |
|-----------|----------|--------|
| `sourceCount` + `uniqueStudies` Set | Produced confusing number (41) that didn't match SourceDrawer (24) or totalFindings (50). Only consumed by one button label. | 5 files |
| `highRelevanceCount` + `avgConfidence` (in statistics) | Remnants of deprecated scoring system. Zero frontend consumers. Violates "Facts, Not Scores" principle. | 1 file (ai.service.ts fallback) |
| **DigestTheme system** | AI stopped generating themes. All paths produce `themes: []`. `onThemeClick` threaded through 4 components but never invoked. `SourceDrawerContext` existed solely for theme filtering. | 14 files, ~150 lines |
| **`trends` field** | AI always produces `{ emerging: [], declining: [], stable: [] }`. Zero frontend consumers. | 6 files, ~40 lines |

**Important distinction**: "App Theme" (light/dark/system in `appStore.ts` and CSS) is **NOT dead** — only "DigestTheme" (research content grouping) was removed.

### Part A: sourceCount + Dead Statistics Fields (5 files)

| # | File | Change | Status |
|---|------|--------|--------|
| A1 | `src/components/DigestCard.tsx` | `View All {digest.statistics.sourceCount} Sources` → `View All Sources` | [x] Done |
| A2 | `src/types/index.ts` | Removed `sourceCount: number` from `statistics` type | [x] Done |
| A3 | `src/services/digest.service.ts` | Removed `sourceCount: 0` from transform fallback | [x] Done |
| A4 | `backend/src/services/ai.service.ts` | Deleted 17-line `uniqueStudies` Set, removed `sourceCount` from primary stats, removed `sourceCount`+`highRelevanceCount`+`avgConfidence` from fallback stats | [x] Done |
| A5 | `backend/src/services/digest-processor.service.ts` | Removed `sourceCount: 0` from metadata fallback | [x] Done |

### Part B: DigestTheme System (14 files)

| # | File | Change | Status |
|---|------|--------|--------|
| B1 | `src/types/index.ts` | Removed `DigestThemeCategory` type, `themes?: DigestTheme[]` from SmartDigest, entire `DigestTheme` interface (28 lines) | [x] Done |
| B2 | `src/services/digest.service.ts` | Removed `themes` from both `transformToFrontend` and `transformToBackend` | [x] Done |
| B3 | `src/components/DigestCard.tsx` | Removed `onThemeClick` from props interface and destructuring | [x] Done |
| B4 | `src/components/research/digest/DigestPanel.tsx` | Removed `onThemeClick` prop, `handleThemeClick` function, `onThemeClick={handleThemeClick}` from DigestCard | [x] Done |
| B5 | `src/components/research/ResearchContainer.tsx` | Removed `onThemeClick` from props and DigestPanel usage | [x] Done |
| B6 | `src/components/research/ResearchPage.tsx` | Removed `handleThemeClick`, theme-filtering logic, `sourceDrawerContext`, theme props from SourceDrawer | [x] Done |
| B7 | `src/components/research/drawers/SourceDrawer.tsx` | Removed `selectedDigestThemeId` and `digestThemeName` props and rendering | [x] Done |
| B8 | `src/stores/uiStore.ts` | Removed `SourceDrawerContext` interface, `sourceDrawerContext` state, simplified `openSourceDrawer`/`closeSourceDrawer`, removed theme context from `closeAllModals`/`setChatPanelOpen`/`toggleChatPanel`/`reset` | [x] Done |
| B9 | `backend/src/schemas/digest.schema.ts` | Removed `DigestThemeSchema` (15 lines), `themes` from `SmartDigestSchema` | [x] Done |
| B10 | `backend/src/services/ai.service.ts` | Removed `themes: []` and `themes: digestData.themes` from ~7 locations, removed `getCategoryIcon()` (12 lines) and `getCategoryColor()` (11 lines) helper functions | [x] Done |
| B11 | `backend/src/services/digest-processor.service.ts` | Removed `themes` from INSERT column list and parameter binding, renumbered $N placeholders | [x] Done |
| B12 | `backend/src/models/digest.model.ts` | Removed `themes?: any[]` from both interfaces, `create()` INSERT, `allowedFields` in `update()`, JSON stringify array | [x] Done |
| B13 | `backend/src/routes/digests.crud.routes.ts` | Removed `themes: z.array(z.any()).optional()` from `CreateDigestSchema` | [x] Done |
| B14 | `backend/src/routes/digest.routes.ts` | Removed `themes,` from SELECT query, removed theme simplification logic from `/simplify-digest` endpoint | [x] Done |

### Part C: Dead `trends` Field (6 files)

| # | File | Change | Status |
|---|------|--------|--------|
| C1 | `src/types/index.ts` | Removed `trends?` field from `SmartDigest`, removed `TrendItem` interface | [x] Done |
| C2 | `src/services/digest.service.ts` | Removed `trends` from transform fallback and `transformToBackend` | [x] Done |
| C3 | `backend/src/schemas/digest.schema.ts` | Removed `TrendItemSchema`, `trends` from `SmartDigestSchema` | [x] Done |
| C4 | `backend/src/services/ai.service.ts` | Removed all `trends: { emerging: [], declining: [], stable: [] }` references (~6 locations), removed `sampleTrends` from debug logging | [x] Done |
| C5 | `backend/src/services/digest-processor.service.ts` | Removed `trends` from INSERT column list and parameter binding | [x] Done |
| C6 | `backend/src/routes/digest.routes.ts` | Removed `trends,` from SELECT query | [x] Done |

### Part D: Database Schema (1 file + production migration)

| # | File | Change | Status |
|---|------|--------|--------|
| D1 | `backend/src/db/init.sql` | Removed `themes JSONB DEFAULT '[]',` and `trends JSONB DEFAULT '{}'::jsonb,` column definitions | [x] Done |
| D2 | Production DB | `ALTER TABLE digests DROP COLUMN IF EXISTS themes; ALTER TABLE digests DROP COLUMN IF EXISTS trends;` | [ ] Pending deployment |

### Phase 1 Verification Results

All checks passed on February 9, 2026:

1. `cd backend && npx tsc --noEmit` — **PASS**
2. `npm run build` (project root) — **PASS** (bundle: 1,348.31 kB, down from 1,349.40 kB)
3. Grep checks (all returned 0 results):
   - `sourceCount` in `src/` and `backend/src/` — 0 results
   - `highRelevanceCount` — 0 results
   - `DigestTheme` — 0 results
   - `onThemeClick` — 0 results
   - `TrendItem` — 0 results
   - `TrendItemSchema` — 0 results
   - `uniqueStudies` — 0 results
   - `getCategoryIcon` / `getCategoryColor` — 0 results
   - `digestThemeId` / `digestThemeName` / `SourceDrawerContext` — 0 results

### Phase 1 Impact Summary

| Category | Lines Removed | Files Modified |
|----------|--------------|----------------|
| sourceCount + dead stats | ~25 | 5 |
| DigestTheme system | ~150 | 14 |
| trends field | ~40 | 6 |
| DB init.sql | ~2 | 1 |
| **Total** | **~217 lines** | **~17 unique files** |

Lines added: ~0 (pure cleanup)

---

## Phase 2: Consolidate Digest Action Buttons [COMPLETE]

**Goal**: Reduce 3 functionally-identical buttons to 1, add a clarifying tooltip, and remove the dead `refreshDigest`/`refreshResearchAndDigest` code path.

**Completed**: February 10, 2026

### Current State (3 buttons, all do the same thing)

| Button | Location | Code Path | What It Actually Does |
|--------|----------|-----------|----------------------|
| **"Update"** | ResearchToolbar (top) | `refreshDigest()` → `digestService.refreshResearchAndDigest()` → `queueDigestFromExistingFindings()` | Queues digest from existing findings |
| **"Update Research"** | DigestActions (bottom) | `refreshDigest()` → `digestService.refreshResearchAndDigest()` → `queueDigestFromExistingFindings()` | Queues digest from existing findings (same!) |
| **"Regenerate"** | DigestActions (bottom) | `generateDigest(true)` → `digestService.queueDigestFromExistingFindings()` | Queues digest from existing findings (same!) |

All three end up calling `queueDigestFromExistingFindings()`. The name "Update Research" is misleading — it does NOT fetch new research findings.

### Target State (1 button at bottom, with tooltip)

| Button | Location | Code Path | Tooltip |
|--------|----------|-----------|---------|
| **"Regenerate Digest"** | DigestActions (bottom) | `generateDigest(true)` → `queueDigestFromExistingFindings()` | "Re-analyzes your existing findings with AI. New research is fetched automatically by the scheduler." |

**Rationale**:
- New findings are fetched by the **backend scheduler** automatically (Plan 018). Users don't need a manual "fetch new research" button.
- When a user wants to re-analyze their existing findings with AI, "Regenerate Digest" is the clear, honest label.
- The tooltip prevents confusion — users won't think this button fetches new research.
- The toolbar "Update" button is confusing because it's invisible on mobile (`hidden sm:inline` for text) and duplicates the bottom action.
- Having one button instead of three reduces decision fatigue.

**Files to modify (5 total):**

| # | File | Change |
|---|------|--------|
| 2.1 | `src/components/research/digest/DigestActions.tsx` | Remove "Update Research" button, rename "Regenerate" → "Regenerate Digest", add tooltip, remove `onRefresh` prop |
| 2.2 | `src/components/research/digest/DigestPanel.tsx` | Remove `refreshDigest` usage, remove `onRefresh` prop passing |
| 2.3 | `src/components/research/toolbar/ResearchToolbar.tsx` | Remove "Update" button and `refreshDigest`/`useDigest` usage |
| 2.4 | `src/hooks/useDigest.ts` | Remove `refreshDigest` function and from return value |
| 2.5 | `src/services/digest.service.ts` | Remove `refreshResearchAndDigest()` and `processQueue()` dead methods |

---

### Step 2.1: Simplify DigestActions Component

**File**: `src/components/research/digest/DigestActions.tsx`

**Replace the entire file with**:
```typescript
/**
 * DigestActions - Container component for digest action buttons
 *
 * Phase 3 Component Decomposition: Extracted from FindingsViewerProgressive.tsx
 * Plan 019: Consolidated from 3 buttons to 1 (Regenerate Digest) with tooltip
 *
 * This is a PRESENTATIONAL component - receives callbacks via props.
 */

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

// ============================================
// Types
// ============================================

interface DigestActionsProps {
  /** Whether digest can be generated (has findings) */
  canGenerate: boolean;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Whether a digest already exists */
  hasDigest: boolean;
  /** Callback to generate/regenerate digest */
  onGenerate: () => void;
  /** Count of findings for display */
  findingsCount?: number;
}

// ============================================
// Component
// ============================================

export function DigestActions({
  canGenerate,
  isGenerating,
  hasDigest,
  onGenerate,
  findingsCount = 0
}: DigestActionsProps) {
  // Show generate button when no digest exists
  if (!hasDigest && !isGenerating) {
    return (
      <div className="flex justify-center">
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          size="lg"
          className="gap-2"
        >
          <Sparkles className="h-5 w-5" />
          Generate Digest
          {findingsCount > 0 && (
            <span className="text-xs opacity-80">({findingsCount} findings)</span>
          )}
        </Button>
      </div>
    );
  }

  // Show regenerate button with tooltip when digest exists
  if (hasDigest) {
    return (
      <div className="flex justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onGenerate}
                disabled={isGenerating}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
                {isGenerating ? 'Regenerating...' : 'Regenerate Digest'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-center">
              Re-analyzes your existing findings with AI.
              New research is fetched automatically by the scheduler.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return null;
}
```

**Key changes**:
- Removed `onRefresh` prop entirely
- Removed `RefreshCw` import (no longer needed)
- Removed "Update Research" button
- Renamed "Regenerate" → "Regenerate Digest"
- Added Radix UI Tooltip explaining the action
- Added `animate-pulse` to Sparkles icon during generation
- Changed `isGenerating` label to "Regenerating..."

**Build check**: `npm run build`

---

### Step 2.2: Remove `refreshDigest` from DigestPanel

**File**: `src/components/research/digest/DigestPanel.tsx`

**Change A — Remove `refreshDigest` from useDigest destructuring (line 49)**:
```typescript
// BEFORE (lines 41-50):
  const {
    digest,
    timeframe,
    isLoading,
    isGenerating,
    progress,
    message,
    generateDigest,
    refreshDigest
  } = useDigest(topicId);

// AFTER:
  const {
    digest,
    timeframe,
    isLoading,
    isGenerating,
    progress,
    message,
    generateDigest
  } = useDigest(topicId);
```

**Change B — Remove `handleRefresh` function (lines 76-78)**:
```typescript
// DELETE these 3 lines:
  const handleRefresh = () => {
    refreshDigest();
  };
```

**Change C — Remove `onRefresh` prop from both DigestActions usages**:

First usage (line 130-137, when digest exists):
```typescript
// BEFORE:
          <DigestActions
            canGenerate={filteredFindingsCount > 0}
            isGenerating={isGenerating}
            hasDigest={true}
            onGenerate={handleGenerate}
            onRefresh={handleRefresh}
            findingsCount={filteredFindingsCount}
          />

// AFTER:
          <DigestActions
            canGenerate={filteredFindingsCount > 0}
            isGenerating={isGenerating}
            hasDigest={true}
            onGenerate={handleGenerate}
            findingsCount={filteredFindingsCount}
          />
```

Second usage (line 159-166, when no digest exists):
```typescript
// BEFORE:
          <DigestActions
            canGenerate={filteredFindingsCount > 0}
            isGenerating={isGenerating}
            hasDigest={false}
            onGenerate={handleGenerate}
            onRefresh={handleRefresh}
            findingsCount={filteredFindingsCount}
          />

// AFTER:
          <DigestActions
            canGenerate={filteredFindingsCount > 0}
            isGenerating={isGenerating}
            hasDigest={false}
            onGenerate={handleGenerate}
            findingsCount={filteredFindingsCount}
          />
```

**Build check**: `npm run build`

---

### Step 2.3: Remove "Update" Button from ResearchToolbar

**File**: `src/components/research/toolbar/ResearchToolbar.tsx`

**Change A — Remove `useDigest` import and usage (lines 12, 48)**:
```typescript
// DELETE this import (line 12):
import { useDigest } from '@/hooks/useDigest';

// DELETE this line (line 48):
  const { isGenerating, refreshDigest } = useDigest(topicId);
```

**Change B — Remove `handleRefresh` function (lines 58-60)**:
```typescript
// DELETE these 3 lines:
  const handleRefresh = () => {
    refreshDigest();
  };
```

**Change C — Remove the entire "Refresh button" block (lines 87-100)**:
```typescript
// DELETE these 14 lines:
      {/* Refresh button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={isGenerating}
        title={isGenerating ? 'Updating research and digest...' : 'Update Research & Digest'}
        className="gap-1"
      >
        <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline text-xs">
          {isGenerating ? 'Updating...' : 'Update'}
        </span>
      </Button>
```

**Change D — Remove unused imports**:
```typescript
// Remove these imports that are no longer needed:
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
```

Also remove `topicId` from the props interface and function parameters since it was only used for the `useDigest` hook:

```typescript
// BEFORE:
interface ResearchToolbarProps {
  topic?: Topic | null;
  findings: ResearchFinding[];
  digest?: SmartDigest | null;
  topicId: string | null;
}

export function ResearchToolbar({
  topic,
  findings,
  digest,
  topicId
}: ResearchToolbarProps) {

// AFTER:
interface ResearchToolbarProps {
  topic?: Topic | null;
  findings: ResearchFinding[];
  digest?: SmartDigest | null;
}

export function ResearchToolbar({
  topic,
  findings,
  digest
}: ResearchToolbarProps) {
```

**Also update the caller** in `src/components/research/ResearchContainer.tsx` (line 195-200):
```typescript
// BEFORE:
            <ResearchToolbar
              topic={selectedTopic}
              findings={findings}
              digest={digest}
              topicId={selectedTopicId}
            />

// AFTER:
            <ResearchToolbar
              topic={selectedTopic}
              findings={findings}
              digest={digest}
            />
```

**Build check**: `npm run build`

---

### Step 2.4: Remove `refreshDigest` from useDigest Hook

**File**: `src/hooks/useDigest.ts`

**Change A — Remove `refreshDigest` from the return interface (line 60)**:
```typescript
// BEFORE (lines 46-63):
interface UseDigestReturn {
  // Data
  digest: SmartDigest | null;
  timeframe: DigestTimeframe;

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;
  progress: number;
  message: string;

  // Actions
  loadDigest: () => Promise<void>;
  generateDigest: (force?: boolean) => Promise<void>;
  refreshDigest: () => Promise<void>;
  clearDigest: () => void;
  setTimeframe: (timeframe: DigestTimeframe) => void;
}

// AFTER:
interface UseDigestReturn {
  // Data
  digest: SmartDigest | null;
  timeframe: DigestTimeframe;

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;
  progress: number;
  message: string;

  // Actions
  loadDigest: () => Promise<void>;
  generateDigest: (force?: boolean) => Promise<void>;
  clearDigest: () => void;
  setTimeframe: (timeframe: DigestTimeframe) => void;
}
```

**Change B — Delete the entire `refreshDigest` function (lines 178-213, ~36 lines)**:
```typescript
// DELETE this entire block:
  /**
   * Refresh digest - runs new research then generates digest
   * This is the "full refresh" that fetches new findings first.
   */
  const refreshDigest = useCallback(async () => {
    if (!topicId) return;

    setLoading('digest', true);
    setDigestProgress(0, 'Fetching new research...');

    try {
      // Use the integrated refresh method
      const queueItem = await digestService.refreshResearchAndDigest(
        topicId,
        timeframe,
        'high'
      );

      setDigestProgress(50, 'Generating digest...');

      // Load the refreshed digest
      await loadDigestFromStore(topicId, timeframe);

      setDigestProgress(100, 'Refresh complete!');

      setTimeout(() => {
        setDigestProgress(0, '');
        setLoading('digest', false);
      }, 1500);

    } catch (error) {
      logger.error('[useDigest] Error refreshing digest:', error);
      setDigestProgress(0, 'Refresh failed');
      setLoading('digest', false);
    }
  }, [topicId, timeframe, setLoading, setDigestProgress, loadDigestFromStore]);
```

**Change C — Remove `refreshDigest` from return value (line 315)**:
```typescript
// BEFORE:
  return {
    // Data
    digest,
    timeframe,

    // Loading states
    isLoading,
    isGenerating,
    progress: digestProgress,
    message: digestMessage,

    // Actions
    loadDigest,
    generateDigest,
    refreshDigest,
    clearDigest,
    setTimeframe
  };

// AFTER:
  return {
    // Data
    digest,
    timeframe,

    // Loading states
    isLoading,
    isGenerating,
    progress: digestProgress,
    message: digestMessage,

    // Actions
    loadDigest,
    generateDigest,
    clearDigest,
    setTimeframe
  };
```

**Build check**: `npm run build`

---

### Step 2.5: Remove `refreshResearchAndDigest` from Digest Service

**File**: `src/services/digest.service.ts`

**Delete the `refreshResearchAndDigest` method (lines 610-628)**:
```typescript
// DELETE this entire block:
  /**
   * Integrated method to refresh research and regenerate digest
   * NOTE: This no longer directly calls agentRunner - instead components should
   * call agentsService.runAllAgents() first, which will emit 'agents-complete'
   * event that this service listens for.
   */
  async refreshResearchAndDigest(
    topicId: string,
    timeframe: DigestTimeframe = 'all-time',
    priority: DigestPriority = 'high'
  ): Promise<DigestQueueItem> {
    // This method now just queues a digest from existing findings
    // To get new findings, the caller should first call agentsService.runAllAgents()
    // which will trigger 'agents-complete' event -> auto-queue digest
    logger.debug(`[DigestService] refreshResearchAndDigest called for topic ${topicId}`);
    logger.debug('[DigestService] NOTE: To fetch new findings, call agentsService.runAllAgents() first');

    return await this.queueDigestFromExistingFindings(topicId, timeframe);
  }
```

Also delete the `processQueue` no-op method right below it (lines 630-638) if it's still present:
```typescript
// DELETE if still present:
  async processQueue(): Promise<void> {
    // No-op: Backend DigestProcessor handles all queue processing.
    // This method is kept for interface compatibility but does nothing.
    // Both manual (user click) and autonomous (scheduler) paths now use
    // the backend DigestProcessor exclusively.
    logger.debug('[DigestService] processQueue called — backend processor handles this');
  }
```

**Build check**: `npm run build`

---

### Phase 2 Verification

After all 5 steps:
1. `npm run build` — should pass
2. No remaining references to `refreshDigest` or `refreshResearchAndDigest` in source code:
   ```
   grep -r "refreshDigest\|refreshResearchAndDigest" src/
   ```
   Expected: 0 results
3. No remaining references to `onRefresh` in DigestActions or DigestPanel:
   ```
   grep -r "onRefresh" src/components/research/digest/
   ```
   Expected: 0 results

---

## Deployment

### Build Verification (Local)

```bash
cd backend && npx tsc --noEmit
cd .. && npm run build
```

Both must pass with 0 errors.

### Commit

```bash
git add src/components/DigestCard.tsx \
        src/types/index.ts \
        src/services/digest.service.ts \
        src/hooks/useDigest.ts \
        src/components/research/digest/DigestActions.tsx \
        src/components/research/digest/DigestPanel.tsx \
        src/components/research/toolbar/ResearchToolbar.tsx \
        src/components/research/ResearchContainer.tsx \
        backend/src/services/ai.service.ts \
        backend/src/services/digest-processor.service.ts \
        IMPLEMENTATION_PLANS/019_SOURCECOUNT_CLEANUP_AND_BUTTON_CONSOLIDATION.md \
        IMPLEMENTATION_PLANS/README.md

git commit -m "fix(digest): remove dead sourceCount field, consolidate digest buttons (Plan 019)"
```

### Deploy

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build
```

### Post-Deploy Verification

| Check | How | Expected |
|-------|-----|----------|
| "View All Sources" button | Scroll to bottom of digest page | Says "View All Sources" (no number) |
| No toolbar Update button | Look at top toolbar area | Only Export, date filter, and view toggle |
| Bottom has 1 button | Scroll below digest | Only "Regenerate Digest" button |
| Tooltip works | Hover/long-press on "Regenerate Digest" | Shows "Re-analyzes your existing findings with AI. New research is fetched automatically by the scheduler." |
| Generate still works | Delete digest via DB, reload | "Generate Digest" button appears (no tooltip on this one) |
| Regenerate works | Click "Regenerate Digest" | Button changes to "Regenerating..." with pulsing icon → progress bar → new digest generated |
| Console clean | Browser DevTools console | No errors related to sourceCount, refreshDigest, onRefresh |

---

## Rollback Plan

All changes are frontend-only (except `ai.service.ts` and `digest-processor.service.ts` which only remove dead computation). The `sourceCount` field in the database `metadata` JSON column is unchanged — it just won't be computed for NEW digests. Existing digests still have it in their metadata blob.

**If something breaks**: `git revert HEAD && docker compose down && docker compose up -d --build`

---

## Code Removed Summary

### Phase 1 (Complete)

| Category | Lines Removed | Files |
|----------|--------------|-------|
| `uniqueStudies` computation | ~17 lines | `ai.service.ts` |
| `sourceCount` + `highRelevanceCount` + `avgConfidence` | ~10 lines | `ai.service.ts`, `digest-processor.service.ts`, `digest.service.ts`, `types/index.ts` |
| DigestTheme system (`DigestTheme`, `onThemeClick`, `SourceDrawerContext`, schemas, helpers) | ~150 lines | 14 files (see Part B above) |
| `trends` field (`TrendItem`, schema, transforms, defaults) | ~40 lines | 6 files (see Part C above) |
| DB schema columns (`themes`, `trends` in init.sql) | ~2 lines | `init.sql` |
| **Phase 1 Total** | **~217 lines** | **~17 unique files** |

### Phase 2 (Complete)

| Category | Lines Removed | Files |
|----------|--------------|-------|
| `refreshDigest` function | ~36 lines | `useDigest.ts` |
| `refreshResearchAndDigest` method | ~19 lines | `digest.service.ts` |
| `processQueue` no-op | ~8 lines | `digest.service.ts` |
| "Update Research" button | ~10 lines | `DigestActions.tsx` |
| Toolbar "Update" button | ~14 lines | `ResearchToolbar.tsx` |
| `handleRefresh` functions | ~6 lines | `DigestPanel.tsx`, `ResearchToolbar.tsx` |
| **Phase 2 Total** | **~93 lines** | **5 files** |

**Lines Added (Phase 2)**: ~15 (tooltip wrapper in DigestActions.tsx)
**Combined Net reduction**: ~295 lines across ~20 unique files

---

## Sign-Off

- [x] Phase 1 complete (sourceCount, highRelevanceCount, avgConfidence, DigestTheme system, trends removed) — Feb 9, 2026
- [x] Phase 2 complete (buttons consolidated with tooltip) — Feb 10, 2026
- [x] Phase 1 build passes (frontend + backend) — Feb 9, 2026
- [x] Phase 2 build passes (1,347.18 kB, down from 1,348.41 kB) — Feb 10, 2026
- [ ] Production DB migration (`ALTER TABLE digests DROP COLUMN IF EXISTS themes; ALTER TABLE digests DROP COLUMN IF EXISTS trends;`)
- [ ] Deployed to production
- [ ] Post-deploy verification passed
- [ ] Date: ___________
