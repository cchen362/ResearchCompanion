# Plan 015d — Worth Revisiting Enhancements

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for Plan 015d — adding tooltip education, Explained Mode, finding navigation links, and layout improvements to the Worth Revisiting feature.**

**This plan builds on Plan 015c's Companion Intelligence features** (ResearchPulseCard + WorthRevisitingModal) and touches the digest pipeline for Explained Mode.

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
│ PHASES 1-3: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `npm run build` after EACH frontend file change            │
│ - Backend: `cd backend && npm run build` after backend changes   │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git after each phase                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: FULL BUILD VERIFICATION & DEPLOYMENT                    │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - NO DB migration needed (JSONB stores new structure)            │
│ - Trigger digest regeneration to test dual-mode AI output        │
│ - Visual verification at all breakpoints + dark mode             │
│ - Deploy to Debian server                                        │
│ - Production visual verification                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: COMPLETE
- **Created**: February 8, 2026
- **Priority**: HIGH — Immediate follow-up to Plan 015c
- **Branch**: `feat/ui-overhaul` (continue from Plan 015c)
- **Predecessor**: Plan 015c (Companion Intelligence — Complete)

---

## What This Plan Adds

### Enhancement 1: Tooltip Education
HelpCircle icon with explanatory tooltip on the Worth Revisiting header — both in the home page nudge section and the modal.

**Tooltip text (modal)**: "When new research appears, your AI companion reviews your entire research history to find earlier findings that now have new significance. Think of it as spotting that a 2023 gene therapy study predicted what a 2026 clinical trial just confirmed."

**Tooltip text (nudge section)**: "Your AI reviews new breakthroughs against your full research history to surface earlier findings that now have new relevance."

### Enhancement 2: Explained Mode
Technical/Explained toggle in the WR modal, matching the existing digest toggle pattern. Three text fields become dual-mode:
- `oldFindingSummary` → `{technical, explained}`
- `newBreakthroughSummary` → `{technical, explained}`
- `connectionExplanation` → `{technical, explained}`

Default mode: **Explained** (for accessibility).

### Enhancement 3: Finding Navigation
"View finding →" links on each finding card in the WR modal. Clicking opens the finding detail drawer (closes WR modal first).

### Enhancement 4: Layout Improvements
Widen modal and increase spacing to accommodate the toggle, links, and potentially longer explained text without feeling cramped.

---

## Workshop Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tooltip style | Radix UI TooltipProvider | Existing pattern (FindingsMetricsExplainer, DigestCard) |
| Tooltip length | ~2 sentences with concrete example | User feedback: explains how it works, showcases AI capability |
| Explained Mode default | `'explained'` | Accessibility: non-medical users see plain language first |
| Toggle style | Segmented button (GraduationCap / Lightbulb) | Matches existing DigestCard toggle |
| Finding navigation | Close WR modal → open findingDetail drawer | Better UX than overlapping modals |
| Modal width | `max-w-3xl` (768px, up from 672px) | Breathing room for dual-mode text + "View finding" links |
| Backward compat | `resolveText()` helper: string → use as-is | Old digests work without regeneration |
| Fields staying plain string | `connectionBasis`, titles, IDs | Short labels don't need dual-mode |
| New npm dependencies | NONE | All features use existing components |

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `npm run build` (frontend) or `cd backend && npm run build` (backend) after EACH file change
- [ ] Handle backward compatibility — old WR data has plain strings, new has `{technical, explained}`
- [ ] Use the `resolveText()` helper for ALL three dual-mode fields
- [ ] Default to `'explained'` mode in the modal
- [ ] Keep all existing functionality working

## MUST NOT DO Rules

- [ ] Do NOT add new npm dependencies
- [ ] Do NOT change database schema (JSONB column handles new structure automatically)
- [ ] Do NOT change `connectionBasis`, titles, or IDs to DualModeText — they stay as plain strings
- [ ] Do NOT delete or rename existing files
- [ ] Do NOT change the WR modal from center to drawer
- [ ] Do NOT add `researchPulse` or `worthRevisiting` to the `required` array in the JSON schema
- [ ] Do NOT break mobile layout (320-768px must work)
- [ ] Do NOT touch ChatPanel.tsx or Container component

---

## Critical Patterns to Reuse

### Tooltip Pattern (from `src/components/FindingsMetricsExplainer.tsx`)
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="inline-block text-muted-foreground cursor-help" size={14} />
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <p>Tooltip text here</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Explained Mode Toggle (from `src/components/DigestCard.tsx` lines 216-236)
```tsx
import { GraduationCap, Lightbulb } from 'lucide-react';
const [mode, setMode] = useState<ExplanationMode>('explained');

<Button variant={mode === 'technical' ? 'default' : 'ghost'} onClick={() => setMode('technical')}>
  <GraduationCap /> Technical
</Button>
<Button variant={mode === 'explained' ? 'default' : 'ghost'} onClick={() => setMode('explained')}>
  <Lightbulb /> Explained
</Button>
```

### DualModeText Resolution (from `src/components/DigestCard.tsx` line 50)
```tsx
function resolveText(item: DualModeText, mode: ExplanationMode): string {
  return mode === 'technical' ? item.technical : item.explained;
}
```

### Finding Navigation (from `src/components/ResearchPage.tsx` line 64)
```tsx
const handleViewFinding = async (findingId: string) => {
  const finding = await findingsService.getFinding(findingId);
  openModal('findingDetail', finding);
};
```

---

## Phase 1: Frontend — Modal Enhancement + Tooltips + Finding Links

**Goal**: Update the WorthRevisitingModal with all UI improvements, add tooltips to ResearchPulseCard, wire up finding navigation in HomePage.

### Step 1.1: Update Frontend Types (Layer 11)

**File**: `src/types/index.ts`

**Change** — Update `WorthRevisiting` interface (line 529-538):

```typescript
// FIND:
export interface WorthRevisiting {
  oldFindingId: string;
  oldFindingTitle: string;
  oldFindingSummary: string;
  newBreakthroughId: string;
  newBreakthroughTitle: string;
  newBreakthroughSummary: string;
  connectionExplanation: string;
  connectionBasis: string;
}

// REPLACE WITH:
export interface WorthRevisiting {
  oldFindingId: string;
  oldFindingTitle: string;
  oldFindingSummary: DualModeText | string;   // backward compat: old digests have plain string
  newBreakthroughId: string;
  newBreakthroughTitle: string;
  newBreakthroughSummary: DualModeText | string;   // backward compat
  connectionExplanation: DualModeText | string;     // backward compat
  connectionBasis: string;                          // stays plain string
}
```

**Note**: `DualModeText` already exists at line 448 in the same file.

**Verification**: `npm run build` — no errors.

### Step 1.2: Rewrite WorthRevisitingModal Component

**File**: `src/components/home/WorthRevisitingModal.tsx`

**Complete rewrite** of this 81-line file. Key changes:

**Imports:**
```tsx
import { useState } from 'react';
import { X, Link2, Clock, TrendingUp, HelpCircle, GraduationCap, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { WorthRevisiting, DualModeText, ExplanationMode } from '@/types';
```

**Props** — add `onViewFinding`:
```tsx
interface WorthRevisitingModalProps {
  item: WorthRevisiting | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFinding?: (findingId: string) => void;
}
```

**Backward-compatible text resolver:**
```tsx
/** Handles both old (string) and new ({technical, explained}) formats */
function resolveText(value: DualModeText | string | undefined, mode: ExplanationMode): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return mode === 'technical' ? value.technical : value.explained;
}
```

**Component state:**
```tsx
const [mode, setMode] = useState<ExplanationMode>('explained');
```

**Layout changes** (compared to current modal):

| Element | Current | New | Why |
|---------|---------|-----|-----|
| Modal width | `max-w-2xl` (672px) | `max-w-3xl` (768px) | Room for toggle + longer explained text |
| Content padding | `p-5` | `p-6` | More breathing room |
| Finding card padding | `p-4` | `p-5` | Roomier with "View finding" link added |
| Card grid gap | `gap-4` | `gap-5` | Visual separation |
| Cards-to-explanation gap | `mb-4` | `mb-5` | Breathing room |
| Explanation section padding | `p-4` | `p-5` | More whitespace for longer text |

**Header structure:**
```tsx
<div className="flex items-center justify-between p-5 border-b border-[var(--color-border-muted)]">
  {/* Left: title + tooltip */}
  <div className="flex items-center gap-2">
    <Link2 className="h-5 w-5 text-amber-500" />
    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Worth Revisiting</h2>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="text-muted-foreground cursor-help" size={16} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>When new research appears, your AI companion reviews your entire research history to find earlier findings that now have new significance. Think of it as spotting that a 2023 gene therapy study predicted what a 2026 clinical trial just confirmed.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>

  {/* Right: toggle + close */}
  <div className="flex items-center gap-2">
    <div className="hidden sm:flex items-center gap-1 bg-[var(--color-surface-sunken)] rounded-lg p-1">
      <button
        onClick={() => setMode('technical')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          mode === 'technical'
            ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
        }`}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        Technical
      </button>
      <button
        onClick={() => setMode('explained')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          mode === 'explained'
            ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
        }`}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Explained
      </button>
    </div>
    <Button size="icon" variant="ghost" onClick={onClose}>
      <X className="w-5 h-5" />
    </Button>
  </div>
</div>

{/* Mobile toggle — below header, above content */}
<div className="flex sm:hidden justify-center p-3 border-b border-[var(--color-border-muted)]">
  <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] rounded-lg p-1">
    <button onClick={() => setMode('technical')} className={`...same styling as desktop toggle...`}>
      <GraduationCap className="h-3.5 w-3.5" /> Technical
    </button>
    <button onClick={() => setMode('explained')} className={`...same styling as desktop toggle...`}>
      <Lightbulb className="h-3.5 w-3.5" /> Explained
    </button>
  </div>
</div>
```

**Mobile toggle**: On small screens (`sm:hidden`), the toggle moves to its own row below the header to avoid cramping the title + tooltip + X button.

**Finding cards** — use `resolveText()` and add "View finding →" link:
```tsx
{/* Earlier Finding card */}
<div className="border border-[var(--color-border-muted)] rounded-lg p-5">
  <div className="flex items-center gap-2 mb-2">
    <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Earlier Finding</span>
  </div>
  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.oldFindingTitle}</h3>
  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
    {resolveText(item.oldFindingSummary, mode)}
  </p>
  {onViewFinding && (
    <button
      onClick={() => onViewFinding(item.oldFindingId)}
      className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
    >
      View finding →
    </button>
  )}
</div>

{/* Recent Breakthrough card — same pattern, amber accent, uses resolveText() */}
```

**Connection explanation** — use `resolveText()`:
```tsx
<span className="text-sm text-[var(--color-text-secondary)]">
  {resolveText(item.connectionExplanation, mode)}
</span>
```

**Verification**: `npm run build` — no errors.

### Step 1.3: Add Tooltip to ResearchPulseCard

**File**: `src/components/home/ResearchPulseCard.tsx`

**Change 1** — Add imports (line 1):
```tsx
import { Brain, ArrowRight, Link2, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

**Change 2** — Add tooltip next to "Worth Revisiting" label (line 62-65):

```tsx
// FIND:
<div className="flex items-center gap-1.5 mb-2">
  <Link2 className="h-3.5 w-3.5 text-amber-500" />
  <span className="text-xs font-medium text-[var(--color-text-muted)]">Worth Revisiting</span>
</div>

// REPLACE WITH:
<div className="flex items-center gap-1.5 mb-2">
  <Link2 className="h-3.5 w-3.5 text-amber-500" />
  <span className="text-xs font-medium text-[var(--color-text-muted)]">Worth Revisiting</span>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="text-muted-foreground cursor-help" size={12} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>Your AI reviews new breakthroughs against your full research history to surface earlier findings that now have new relevance.</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

**Verification**: `npm run build` — no errors.

### Step 1.4: Wire Up Finding Navigation in HomePage

**File**: `src/components/HomePage.tsx`

**Change 1** — Add handler after `handleOpenDigest` (after line 104):
```tsx
const handleViewFindingFromWR = async (findingId: string) => {
  try {
    closeModal('worthRevisiting');
    const finding = await findingsService.getFinding(findingId);
    if (finding) {
      openModal('findingDetail', finding);
    }
  } catch (error) {
    logger.error('[HomePage] Failed to load finding from WR:', error);
  }
};
```

**Note**: `findingsService` is already imported (line 10), `openModal`/`closeModal` already available (lines 37-38), `logger` already imported (line 12).

**Change 2** — Pass `onViewFinding` to WorthRevisitingModal (lines 173-177):
```tsx
// FIND:
<WorthRevisitingModal
  item={modalData as WorthRevisiting | null}
  isOpen={modals.worthRevisiting}
  onClose={() => closeModal('worthRevisiting')}
/>

// REPLACE WITH:
<WorthRevisitingModal
  item={modalData as WorthRevisiting | null}
  isOpen={modals.worthRevisiting}
  onClose={() => closeModal('worthRevisiting')}
  onViewFinding={handleViewFindingFromWR}
/>
```

**Verification**: `npm run build` — no errors.

### Step 1.5: Phase 1 Build Verification

```bash
npm run build
```

Must produce zero errors.

**Checkpoint**: Commit with message `feat(worth-revisiting): add tooltip, explained toggle, finding links, layout improvements (Plan 015d Phase 1)`

---

## Phase 2: Backend Pipeline — DualModeText for WR Fields

**Goal**: Update the AI schema and prompt so Claude generates dual-mode content for WR summaries and explanations. Only 2 backend files need changes.

### Step 2.1: Update Zod Schema (Layer 1)

**File**: `backend/src/schemas/digest.schema.ts`

**Change** — Update `worthRevisiting` array item (lines 74-83):

```typescript
// FIND:
  worthRevisiting: z.array(z.object({
    oldFindingId: z.string(),
    oldFindingTitle: z.string(),
    oldFindingSummary: z.string(),
    newBreakthroughId: z.string(),
    newBreakthroughTitle: z.string(),
    newBreakthroughSummary: z.string(),
    connectionExplanation: z.string(),
    connectionBasis: z.string()
  })).optional().default([]),

// REPLACE WITH:
  worthRevisiting: z.array(z.object({
    oldFindingId: z.string(),
    oldFindingTitle: z.string(),
    oldFindingSummary: z.union([z.string(), DualModeTextSchema]),
    newBreakthroughId: z.string(),
    newBreakthroughTitle: z.string(),
    newBreakthroughSummary: z.union([z.string(), DualModeTextSchema]),
    connectionExplanation: z.union([z.string(), DualModeTextSchema]),
    connectionBasis: z.string()
  })).optional().default([]),
```

**Why `z.union`**: Accepts BOTH old plain-string format and new DualModeText format, so existing digests pass validation.

**Change 2** — Update `digestJSONSchema` WR item properties (lines 461-484):

```typescript
// FIND (3 fields to change):
          oldFindingSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the older finding'
          },
// ...
          newBreakthroughSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the recent breakthrough'
          },
// ...
          connectionExplanation: {
            type: 'string',
            description: 'WHY these two findings connect. 1-2 sentences explaining the meaningful link. Must be specific — cite the mechanism, pathway, or evidence, not vague associations.'
          },

// REPLACE WITH:
          oldFindingSummary: {
            type: 'object',
            properties: {
              technical: { type: 'string', description: '1-2 sentence summary using medical terminology, mechanisms, and specific biomarkers' },
              explained: { type: 'string', description: 'Same summary in plain everyday language anyone could understand, using analogies where helpful' }
            },
            required: ['technical', 'explained'],
            description: 'Brief summary of the older finding in both technical and explained modes'
          },
// ...
          newBreakthroughSummary: {
            type: 'object',
            properties: {
              technical: { type: 'string', description: '1-2 sentence summary using medical terminology, mechanisms, and specific biomarkers' },
              explained: { type: 'string', description: 'Same summary in plain everyday language anyone could understand, using analogies where helpful' }
            },
            required: ['technical', 'explained'],
            description: 'Brief summary of the recent breakthrough in both technical and explained modes'
          },
// ...
          connectionExplanation: {
            type: 'object',
            properties: {
              technical: { type: 'string', description: 'WHY these findings connect, using medical terminology. Cite mechanism, pathway, or evidence.' },
              explained: { type: 'string', description: 'Same explanation in plain language. Use analogies to explain the connection in everyday terms.' }
            },
            required: ['technical', 'explained'],
            description: 'Explanation of why these findings are connected in both technical and explained modes'
          },
```

**Critical note**: `additionalProperties: false` is on the PARENT schema (line 491), NOT on the WR item object. The WR item object does not have `additionalProperties: false`, so the change from string→object is safe — Claude will generate the new format.

**Verification**: `cd backend && npm run build` — no errors.

### Step 2.2: Update AI Prompt (Layer 2)

**File**: `backend/src/services/ai.service.ts`

**Change 1** — Add WR dual-mode instructions after the WARNING SIGNS section (after line 506, before `## COMPANION INTELLIGENCE`):

```
WORTH REVISITING (oldFindingSummary, newBreakthroughSummary, connectionExplanation):
- technical: Medical terminology, mechanisms, specific biomarkers, trial references
- explained: Plain language with analogies anyone could understand
- CRITICAL: Both versions must contain the SAME FACTS
- connectionBasis remains a plain string (not dual-mode)
- Titles remain plain strings (not dual-mode)
```

**Change 2** — Update the COMPANION INTELLIGENCE user message (line 564). Change:

```
// FIND:
- worthRevisiting: 0-3 connections between older findings and recent breakthroughs. Use exact finding UUIDs from the ID fields above. Return empty array [] if no meaningful connections exist.

// REPLACE WITH:
- worthRevisiting: 0-3 connections between older findings and recent breakthroughs. Use exact finding UUIDs from the ID fields above. Return empty array [] if no meaningful connections exist. Each connection's oldFindingSummary, newBreakthroughSummary, and connectionExplanation must be dual-mode objects with {technical, explained} versions.
```

**Verification**: `cd backend && npm run build` — no errors.

### Layers That Need NO Changes

| Layer | File | Why No Change |
|-------|------|---------------|
| 4 | `digest-processor.service.ts` | Stores `worth_revisiting` as JSONB — passes through |
| 5 | `digest.model.ts` | Typed as `any[]` — passes through |
| 6 | `digests.crud.routes.ts` | Already `z.array(z.any()).optional()` — passes through |
| 7 | `digest.service.ts` (transformToBackend) | Passes through as-is |
| 9 | `digest.routes.ts` | SELECT alias passes through |
| 10 | `digest.service.ts` (transformToFrontend) | Passes through as-is |
| 12 | `dashboard.routes.ts` | Passes through as JSONB |

**No DB migration needed** — `worth_revisiting` is already JSONB, which stores the new `{technical, explained}` objects automatically.

### Step 2.3: Phase 2 Build Verification

```bash
cd backend && npm run build
```

Must produce zero errors.

**Checkpoint**: Commit with message `feat(digest): add dual-mode text for Worth Revisiting summaries and explanations (Plan 015d Phase 2)`

---

## Phase 3: Integration Build Verification

```bash
npm run build
cd backend && npm run build
```

Both must produce zero errors.

**Checkpoint**: Commit with message `chore: Plan 015d full build verification`

---

## Phase 4: Deployment & Verification

### Step 4.1: Push to Remote

```bash
git push origin feat/ui-overhaul
```

### Step 4.2: Deploy to Production

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build
```

**No DB migration needed** — JSONB column stores new structure automatically.

### Step 4.3: Verify Container Health

```bash
docker logs medical-companion --tail 50 2>&1
```

### Step 4.4: Trigger Digest Regeneration

```bash
# Delete queue item to allow regeneration
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "DELETE FROM digest_queue WHERE topic_id = '954e8da0-5af3-4012-a4d9-3e6d59e64148';"
```

Then trigger digest generation from the UI.

### Step 4.5: Verify AI Output

```bash
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "SELECT worth_revisiting FROM digests ORDER BY created_at DESC LIMIT 1;"
```

Expected: `oldFindingSummary`, `newBreakthroughSummary`, and `connectionExplanation` should be objects with `{technical, explained}` keys (not plain strings).

### Step 4.6: Visual Verification

**Tooltips:**
- [ ] HelpCircle icon appears next to "Worth Revisiting" header in ResearchPulseCard nudge section
- [ ] Hovering shows tooltip: "Your AI reviews new breakthroughs against your full research history..."
- [ ] HelpCircle icon appears in WorthRevisitingModal header
- [ ] Hovering shows tooltip with the concrete example about gene therapy study
- [ ] Tooltips work in dark mode

**Explained Mode Toggle:**
- [ ] Toggle appears in modal header (desktop: inline with title, mobile: separate row below header)
- [ ] Default mode is "Explained" (Lightbulb icon highlighted)
- [ ] Clicking "Technical" switches to medical terminology
- [ ] Clicking "Explained" switches to plain language
- [ ] Both finding cards update when toggling
- [ ] "Why this matters" explanation updates when toggling
- [ ] Toggle styling matches DigestCard toggle (segmented button with sunken background)

**Finding Navigation:**
- [ ] "View finding →" link appears at bottom of each finding card
- [ ] Earlier Finding link uses primary color
- [ ] Recent Breakthrough link uses amber color
- [ ] Clicking link: WR modal closes → finding detail drawer opens
- [ ] Finding detail drawer shows the correct finding
- [ ] Chat panel mutual exclusivity works (drawer closes chat)

**Layout / Spacing:**
- [ ] Modal is wider than before (768px vs 672px) — more breathing room
- [ ] Finding cards are not cramped despite added "View finding" links
- [ ] Connection explanation section has comfortable spacing
- [ ] **Desktop (1280px+)**: Two cards side-by-side, toggle inline in header
- [ ] **Tablet (768-1280px)**: Two cards side-by-side, toggle inline
- [ ] **Mobile (375px)**: Cards stack vertically, toggle in separate row below header
- [ ] Dark mode: all elements render correctly

**Backward Compatibility:**
- [ ] Load old digest (with plain-string WR data) — no console errors
- [ ] Old WR data shows same text in both Technical and Explained modes
- [ ] Toggle still appears and works (just shows identical text)

**Existing features not broken:**
- [ ] Research Pulse sentence still displays
- [ ] WR nudge cards on home page still clickable
- [ ] Digest page still works
- [ ] Chat panel opens/closes correctly
- [ ] No console errors

**Checkpoint**: Commit with message `docs: mark Plan 015d as COMPLETE`

---

## Complete File Inventory

### Modified Files (6)

| # | File | Phase | Changes |
|---|------|-------|---------|
| 1 | `src/types/index.ts` | 1 | WorthRevisiting fields → `DualModeText \| string` |
| 2 | `src/components/home/WorthRevisitingModal.tsx` | 1 | Tooltip, explained toggle, resolveText, finding links, layout |
| 3 | `src/components/home/ResearchPulseCard.tsx` | 1 | HelpCircle tooltip on WR nudge section |
| 4 | `src/components/HomePage.tsx` | 1 | `handleViewFindingFromWR` handler, pass to modal |
| 5 | `backend/src/schemas/digest.schema.ts` | 2 | Zod union types + JSON schema objects for 3 fields |
| 6 | `backend/src/services/ai.service.ts` | 2 | Dual-mode prompt instructions for WR |

### No New Files

### No Deleted Files

---

## Backward Compatibility Strategy

| Data format | How it's handled |
|-------------|-----------------|
| Old WR with plain strings (`"Some summary text"`) | `resolveText()` detects `typeof value === 'string'` → returns as-is for both modes |
| New WR with DualModeText (`{technical: "...", explained: "..."}`) | `resolveText()` resolves by current mode |
| Zod validation of old format | `z.union([z.string(), DualModeTextSchema])` accepts both |
| Old digests in DB | JSONB passes through unchanged — no migration needed |

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude generates plain strings instead of objects | MEDIUM | Zod union accepts both; resolveText handles both |
| Modal too wide on small tablets | LOW | `max-w-3xl` is 768px; `mx-4` gives 16px margins; `max-h-[90vh]` scrolls |
| Toggle cramped in header on mobile | LOW | `hidden sm:flex` for desktop toggle; separate row for mobile toggle |
| Finding navigation fails (finding deleted) | LOW | try/catch in handler, logs error, does nothing |
| Old WR text identical in both modes | NONE | Expected behavior — users won't know until new digest is generated |

---

## Sign-Off Checklist

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | Frontend — Modal Enhancement + Tooltips + Finding Links | ✅ Complete | 2026-02-08 |
| 2 | Backend Pipeline — DualModeText for WR Fields | ✅ Complete | 2026-02-08 |
| 3 | Integration Build Verification | ✅ Complete | 2026-02-08 |
| 4 | Deployment & Verification | ✅ Complete | 2026-02-08 |

### Post-Deployment Fixes (Phase 4)
- Fixed AI skipping `worthRevisiting` — increased `max_tokens` to 12000, strengthened then softened prompt
- Fixed "View finding" links — changed to "View source" opening external article in new tab
- Formatted Research Pulse from wall-of-text to lead + bullet points with count validation

---

*Created: February 8, 2026*
*Completed: February 8, 2026*
*Author: Claude Opus 4.6*
*Predecessor: Plan 015c (Companion Intelligence — Complete)*
