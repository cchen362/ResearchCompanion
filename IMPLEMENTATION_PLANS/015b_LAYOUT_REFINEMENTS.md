# Plan 015b — Layout & Spatial Design Refinements

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for Plan 015b — the refinement layer atop Plan 015a's spatial foundation. It adds a Digest TOC sidebar with scroll-spy, drawer/chat mutual exclusivity, home page bottom row redesign (remove ActivityChart, expand DigestSignposts with breakthrough titles), and bento grid polish (hover effects, empty state handling).**

**This plan builds on Plan 015a's layout foundation** (bento grid, chat push/reflow, wider containers, xl breakpoint grids) and Plan 014's design token foundation (CSS custom properties, dark mode).

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
│ PHASES 1-4: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `npm run build` after EACH frontend file change            │
│ - Backend: `cd backend && npm run build` after backend changes   │
│ - Verify NO compile errors before proceeding                     │
│ - Test responsive behavior (375px → 1920px) after each phase     │
│ - Commit changes to git after each phase                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: FULL BUILD VERIFICATION & DEPLOYMENT                    │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - Visual check: all pages at 375px, 768px, 1024px, 1280px,      │
│   1440px, 1920px in BOTH light and dark mode                     │
│ - Drawer/Chat exclusivity: test all combinations                 │
│ - Deploy to Debian server                                        │
│ - Production visual verification                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: Pending
- **Created**: February 8, 2026
- **Priority**: MEDIUM — Refinement layer after core layout (015a)
- **Branch**: `feat/ui-overhaul` (continue from Plan 015a)
- **Predecessor**: Plan 015a (Layout & Spatial Design Core — Complete)
- **Successor**: Plan 015c (Companion Intelligence — Research Pulse + Worth Revisiting)

---

## What Plan 015a Did (Foundation We Build On)

Plan 015a established the **spatial layout foundation**:
- ✅ Bento grid home page (3-column on desktop, responsive down to 1-column)
- ✅ Chat push/reflow on wide screens (≥1440px) via `useIsWideViewport` hook
- ✅ Wider containers: `wide` (1680px), `grid` (1400px), `dashboard` (1600px), `reading` (max-w-4xl)
- ✅ xl breakpoint grids: Findings 3-col at xl, Topics/Agents 4-col at xl
- ✅ `--spacing-section` and `--spacing-card` CSS tokens prepared for future use

**What Plan 015a DID NOT DO** (what this plan fixes):
- ❌ No Digest TOC sidebar for navigating long digest content
- ❌ Drawers and chat can both be open simultaneously, blocking each other
- ❌ ActivityChart taking 1-col in bento grid bottom row (often empty/sparse)
- ❌ DigestSignposts only 2-col, missing breakthrough titles
- ❌ No hover effects on bento grid tiles
- ❌ Empty state handling when tiles return null leaves grid looking sparse

---

## Key Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| TOC Sidebar Breakpoint | ≥1280px (xl Tailwind) | Enough room for TOC (208px) + digest content. Below xl, TOC is hidden. |
| TOC Position | Left sidebar inside DigestPanel | Natural reading flow — TOC on left, content scrolls on right. Sticky position. |
| Scroll-spy | IntersectionObserver with rootMargin | Native browser API, no dependencies, fires only on threshold crossing |
| Drawer/Chat Exclusivity | uiStore action side-effects | When setChatPanelOpen(true), auto-close drawers. When openModal(findingDetail/sourceDrawer), auto-close chat. |
| ActivityChart | REMOVE from home page (keep file) | 7-day rolling window is often sparse/empty; file kept for potential 015c reuse |
| DigestSignposts Width | Full 3-col span on lg+ | With ActivityChart removed, signposts can breathe across the full width |
| Breakthrough Titles | Backend returns top 2-3 titles per signpost | Small query expansion in dashboard.routes.ts, no DB migration |
| Tile Hover Effects | Tailwind classes, no JS | `hover:shadow-md hover:-translate-y-0.5 transition-all duration-200` |
| Empty State Grid | Conditional wrapper rendering | Don't render wrapper divs for components that return null |
| New npm Dependencies | NONE | Intersection Observer is a native API |

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `npm run build` after EACH file change
- [ ] Test at ALL breakpoints: 375px, 768px, 1024px, 1280px, 1440px, 1920px
- [ ] Test chat panel open/close at each breakpoint
- [ ] Verify mobile (320-768px) layout is NOT broken
- [ ] Use Tailwind breakpoint classes (`sm`, `md`, `lg`, `xl`, `2xl`) — do NOT add custom breakpoints
- [ ] Keep all existing functionality — behavior changes limited to drawer/chat exclusivity
- [ ] Verify dark mode still works after each phase
- [ ] Preserve all existing CSS variable usage from Plan 014
- [ ] Backend changes must be backward-compatible (new field is optional)

## MUST NOT DO Rules

- [ ] Do NOT add new npm dependencies
- [ ] Do NOT change component props interfaces except where specified
- [ ] Do NOT break mobile layout (320-768px must work)
- [ ] Do NOT remove the chat panel overlay behavior on narrow screens
- [ ] Do NOT modify any AI prompt, schema, or validation code
- [ ] Do NOT change database schema — backend change is query-only (reading existing JSONB differently)
- [ ] Do NOT redesign auth pages (excluded — separate plan)
- [ ] Do NOT touch the chat panel component itself (`ChatPanel.tsx`)
- [ ] Do NOT change the Container component (`container.tsx`)
- [ ] Do NOT delete `src/components/home/ActivityChart.tsx` — keep the file for 015c

---

## Phase 1: Digest TOC Sidebar

**Goal**: Add a persistent table-of-contents sidebar to the digest view. On wide screens (≥1280px), it appears as a sticky left sidebar. On narrower screens, it is hidden. The TOC dynamically lists only sections that have content, and highlights the currently visible section via scroll-spy.

### Step 1.1: Create the useScrollSpy hook

**CREATE new file**: `src/hooks/useScrollSpy.ts`

```tsx
import { useState, useEffect, useRef } from 'react';

interface UseScrollSpyOptions {
  /** IDs of the elements to observe */
  sectionIds: string[];
  /** Offset from the top of the viewport to trigger activation */
  rootMargin?: string;
}

export function useScrollSpy({ sectionIds, rootMargin = '-100px 0px -60% 0px' }: UseScrollSpyOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the first intersecting entry by DOM order
      const intersecting = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => {
          const aIndex = sectionIds.indexOf(a.target.id);
          const bIndex = sectionIds.indexOf(b.target.id);
          return aIndex - bIndex;
        });

      if (intersecting.length > 0) {
        setActiveId(intersecting[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin,
      threshold: 0,
    });

    sectionIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sectionIds.join(','), rootMargin]);

  return activeId;
}
```

**Rationale for rootMargin `-100px 0px -60% 0px`**: Top offset accounts for sticky header (64px) + buffer. Bottom `-60%` means a section is "active" when its top edge enters the upper 40% of the viewport — early activation as user scrolls into a section.

**Verification**: `npm run build` — no errors.

### Step 1.2: Add section IDs to DigestCard

**File**: `src/components/DigestCard.tsx`

**Add this export** after the imports, before the component function:

```tsx
/** Section IDs for scroll-spy and TOC navigation */
export const DIGEST_SECTION_IDS = {
  header: 'digest-header',
  topFindings: 'digest-top-findings',
  takeaways: 'digest-takeaways',
  breakthroughs: 'digest-breakthroughs',
  questions: 'digest-questions',
  warningSigns: 'digest-warning-signs',
  contradictions: 'digest-contradictions',
  sources: 'digest-sources',
} as const;
```

**Add `id` attributes to each section** (8 edits — just adding `id` to existing elements):

**Change 1** — Header Card (line 161):
```tsx
// FIND:
<Card className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
// REPLACE WITH:
<Card id={DIGEST_SECTION_IDS.header} className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
```

**Change 2** — Also In This Digest (line 295):
```tsx
// FIND (inside the conditional on line 294):
        <Card>
// REPLACE WITH:
        <Card id={DIGEST_SECTION_IDS.topFindings}>
```

**Change 3** — Key Takeaways (line 355):
```tsx
// FIND (inside the conditional on line 354):
        <Card>
// REPLACE WITH:
        <Card id={DIGEST_SECTION_IDS.takeaways}>
```

**Change 4** — Breakthroughs (line 389):
```tsx
// FIND:
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
// REPLACE WITH:
        <Card id={DIGEST_SECTION_IDS.breakthroughs} className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
```

**Change 5** — Questions for Doctor (line 433):
```tsx
// FIND:
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
// REPLACE WITH:
        <Card id={DIGEST_SECTION_IDS.questions} className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
```

**Change 6** — Warning Signs (line 477):
```tsx
// FIND:
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
// REPLACE WITH:
        <Card id={DIGEST_SECTION_IDS.warningSigns} className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
```

**Change 7** — Contradictions (line 510):
```tsx
// FIND:
        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
// REPLACE WITH:
        <Card id={DIGEST_SECTION_IDS.contradictions} className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
```

**Change 8** — View All Sources button (find the final `<div className="flex justify-center">` near end of file):
```tsx
// FIND:
      <div className="flex justify-center">
// REPLACE WITH:
      <div id={DIGEST_SECTION_IDS.sources} className="flex justify-center">
```

**Verification**: `npm run build` — no errors. DigestCard renders identically. Only invisible `id` attributes added.

### Step 1.3: Create the DigestTOC component

**CREATE new file**: `src/components/research/digest/DigestTOC.tsx`

```tsx
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { DIGEST_SECTION_IDS } from '@/components/DigestCard';
import type { SmartDigest } from '@/types';
import {
  Brain,
  FileText,
  Lightbulb,
  TrendingUp,
  Stethoscope,
  AlertTriangle,
  BookOpen
} from 'lucide-react';

interface DigestTOCProps {
  digest: SmartDigest;
}

interface TOCEntry {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DigestTOC({ digest }: DigestTOCProps) {
  // Build TOC entries dynamically — only sections with content
  const entries: TOCEntry[] = useMemo(() => {
    const result: TOCEntry[] = [];

    // Header/Featured is always present
    result.push({ id: DIGEST_SECTION_IDS.header, label: 'Overview', icon: Brain });

    if (digest.topFindings && digest.topFindings.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.topFindings, label: 'Top Findings', icon: FileText });
    }

    if (digest.keyTakeaways.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.takeaways, label: 'Key Takeaways', icon: Lightbulb });
    }

    if (digest.breakthroughs && digest.breakthroughs.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.breakthroughs, label: 'Breakthroughs', icon: TrendingUp });
    }

    if (digest.questionsForDoctor && digest.questionsForDoctor.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.questions, label: 'Questions for Doctor', icon: Stethoscope });
    }

    if (digest.warningSigns && digest.warningSigns.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.warningSigns, label: 'Warning Signs', icon: AlertTriangle });
    }

    if (digest.contradictions && digest.contradictions.length > 0) {
      result.push({ id: DIGEST_SECTION_IDS.contradictions, label: 'Conflicting Info', icon: AlertTriangle });
    }

    result.push({ id: DIGEST_SECTION_IDS.sources, label: 'View Sources', icon: BookOpen });

    return result;
  }, [digest]);

  const sectionIds = useMemo(() => entries.map(e => e.id), [entries]);
  const activeId = useScrollSpy({ sectionIds });

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="sticky top-24 space-y-1" aria-label="Digest table of contents">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 px-3">
        Contents
      </h4>
      {entries.map(entry => {
        const Icon = entry.icon;
        const isActive = activeId === entry.id;

        return (
          <button
            key={entry.id}
            onClick={() => handleClick(entry.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left',
              isActive
                ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-950/30 dark:text-primary-300'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <Icon className={cn(
              'h-4 w-4 shrink-0',
              isActive ? 'text-primary-600 dark:text-primary-400' : 'text-[var(--color-text-muted)]'
            )} />
            <span className="truncate">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

**Design notes**:
- `sticky top-24` — Sticks 6rem from top (header 64px + 32px buffer = 96px)
- Dynamic entries — only populated sections appear
- Active state: `primary-50/700` (light), `primary-950/300` (dark) — matches app palette
- `truncate` on labels handles narrow sidebar
- `aria-label` for accessibility

**Verification**: `npm run build` — no errors.

### Step 1.4: Update DigestPanel to include TOC sidebar layout

**File**: `src/components/research/digest/DigestPanel.tsx`

**Change 1** — Add import (after existing imports, line 18):
```tsx
import { DigestTOC } from './DigestTOC';
```

**Change 2** — Replace the "Show digest if available" block (lines 110-131):

```tsx
// FIND:
  // Show digest if available
  if (digest && !isLoading) {
    return (
      <div className="space-y-4">
        <DigestCard
          digest={digest}
          explanationMode={explanationMode}
          setExplanationMode={setExplanationMode}
          onThemeClick={handleThemeClick}
          onViewSources={onViewSources}
          onViewFinding={onViewFinding}
        />
        <DigestActions
          canGenerate={filteredFindingsCount > 0}
          isGenerating={isGenerating}
          hasDigest={true}
          onGenerate={handleGenerate}
          onRefresh={handleRefresh}
          findingsCount={filteredFindingsCount}
        />
      </div>
    );
  }

// REPLACE WITH:
  // Show digest if available
  if (digest && !isLoading) {
    return (
      <div className="flex gap-6">
        {/* TOC Sidebar — visible only on xl (1280px+) */}
        <aside className="hidden xl:block w-52 shrink-0">
          <DigestTOC digest={digest} />
        </aside>

        {/* Digest Content */}
        <div className="flex-1 min-w-0 space-y-4">
          <DigestCard
            digest={digest}
            explanationMode={explanationMode}
            setExplanationMode={setExplanationMode}
            onThemeClick={handleThemeClick}
            onViewSources={onViewSources}
            onViewFinding={onViewFinding}
          />
          <DigestActions
            canGenerate={filteredFindingsCount > 0}
            isGenerating={isGenerating}
            hasDigest={true}
            onGenerate={handleGenerate}
            onRefresh={handleRefresh}
            findingsCount={filteredFindingsCount}
          />
        </div>
      </div>
    );
  }
```

**How this works**:
- `flex gap-6` — side-by-side layout
- `hidden xl:block` — TOC only visible at ≥1280px (Tailwind's `xl` breakpoint)
- `w-52 shrink-0` — Fixed 208px wide sidebar, doesn't shrink
- `flex-1 min-w-0` — Digest content takes remaining space, `min-w-0` prevents overflow
- **Chat push interaction**: At 1440px with chat open (main shrinks by 500px → 940px effective), below xl threshold, TOC auto-hides. At 1920px with chat (1420px effective), TOC stays visible.

### Step 1.5: Update barrel export

**File**: `src/components/research/digest/index.ts`

Add after line 8:
```tsx
export { DigestTOC } from './DigestTOC';
```

**Verification**: `npm run build` — no errors.

### Step 1.6: Build verification and visual check

```bash
npm run build
```

**Visual verification** (browser devtools resize):
- [ ] **375px**: No TOC visible. Digest single column. All sections stack vertically.
- [ ] **768px**: No TOC. Same single column.
- [ ] **1024px**: No TOC. Content in full width within the `grid` container (1400px).
- [ ] **1280px**: TOC sidebar appears on left (208px). Digest content fills remaining space. Scroll-spy highlights active section.
- [ ] **1440px**: TOC visible. **Chat push mode**: at 1440px with 500px chat, effective width is 940px — TOC should hide.
- [ ] **1920px**: TOC visible. **Chat push mode**: effective width is 1420px — TOC still visible.
- [ ] **Click TOC entries**: Smooth scrolls to correct section.
- [ ] **Scroll through digest**: Active TOC entry updates as sections come into view.
- [ ] **Dark mode**: TOC active state uses dark palette correctly.
- [ ] **No sections present**: If a digest has no breakthroughs/contradictions/etc., those entries do not appear in TOC.

**Checkpoint**: Commit with message `feat(digest): add TOC sidebar with scroll-spy navigation`

---

## Phase 2: Drawer + Chat Mutual Exclusivity

**Goal**: Ensure only one right-side panel is visible at a time. When the user opens chat, any open drawer closes. When a drawer opens, chat closes.

### Step 2.1: Update uiStore with mutual exclusivity logic

**File**: `src/stores/uiStore.ts`

**Change 1** — `setChatPanelOpen` (line 344):

```tsx
// FIND:
      setChatPanelOpen: (open: boolean) => set({ chatPanelOpen: open }),

// REPLACE WITH:
      setChatPanelOpen: (open: boolean) => set(state => ({
        chatPanelOpen: open,
        // Mutual exclusivity: close right-panel drawers when chat opens
        ...(open ? {
          modals: {
            ...state.modals,
            findingDetail: false,
            sourceDrawer: false,
          },
          sourceDrawerContext: {
            digestThemeId: null,
            digestThemeName: null,
          },
          modalData: null,
        } : {})
      })),
```

**Change 2** — `toggleChatPanel` (line 345):

```tsx
// FIND:
      toggleChatPanel: () => set(state => ({ chatPanelOpen: !state.chatPanelOpen })),

// REPLACE WITH:
      toggleChatPanel: () => set(state => {
        const willOpen = !state.chatPanelOpen;
        return {
          chatPanelOpen: willOpen,
          ...(willOpen ? {
            modals: {
              ...state.modals,
              findingDetail: false,
              sourceDrawer: false,
            },
            sourceDrawerContext: {
              digestThemeId: null,
              digestThemeName: null,
            },
            modalData: null,
          } : {})
        };
      }),
```

**Change 3** — `openModal` (line 278):

```tsx
// FIND:
      openModal: (modal: ModalKey, data?: any) => {
        set(state => ({
          modals: { ...state.modals, [modal]: true },
          modalData: data !== undefined ? data : state.modalData
        }));
      },

// REPLACE WITH:
      openModal: (modal: ModalKey, data?: any) => {
        const isRightPanel = modal === 'findingDetail' || modal === 'sourceDrawer';
        set(state => ({
          modals: { ...state.modals, [modal]: true },
          modalData: data !== undefined ? data : state.modalData,
          // Mutual exclusivity: close chat when a right-panel drawer opens
          ...(isRightPanel ? { chatPanelOpen: false } : {})
        }));
      },
```

**Change 4** — `openSourceDrawer` (line 312):

```tsx
// FIND:
      openSourceDrawer: (digestThemeId?: string, digestThemeName?: string) => {
        set(state => ({
          modals: { ...state.modals, sourceDrawer: true },
          sourceDrawerContext: {
            digestThemeId: digestThemeId || null,
            digestThemeName: digestThemeName || null
          }
        }));
      },

// REPLACE WITH:
      openSourceDrawer: (digestThemeId?: string, digestThemeName?: string) => {
        set(state => ({
          modals: { ...state.modals, sourceDrawer: true },
          sourceDrawerContext: {
            digestThemeId: digestThemeId || null,
            digestThemeName: digestThemeName || null
          },
          // Mutual exclusivity: close chat when source drawer opens
          chatPanelOpen: false,
        }));
      },
```

**NOT affected**: `digestSettings`, `topicEdit`, `topicCreate`, `agentMonitor` — these are center modals, not right-panel drawers. They can coexist with chat.

**Verification**: `npm run build` — no errors.

### Step 2.2: Build verification and interaction testing

```bash
npm run build
```

**Interaction verification**:
- [ ] **Open chat, then click a finding**: Chat closes, FindingDetailDrawer opens.
- [ ] **Open FindingDetailDrawer, then click chat icon**: Drawer closes, chat opens.
- [ ] **Open SourceDrawer ("View Sources"), then click chat icon**: SourceDrawer closes, chat opens.
- [ ] **Open chat, then click "View Sources" in digest**: Chat closes, SourceDrawer opens.
- [ ] **Open DigestSettings modal, then click chat**: DigestSettings stays (NOT a right-panel drawer). Chat opens.
- [ ] **Mobile**: Same exclusivity behavior at all viewport widths.
- [ ] **Dark mode**: No visual changes — behavior only.

**Checkpoint**: Commit with message `feat(layout): add drawer/chat mutual exclusivity`

---

## Phase 3: Home Page Bottom Row Redesign

**Goal**: Remove ActivityChart from the home page, expand DigestSignposts to full 3-column width, and enrich signpost cards with top breakthrough titles from the backend.

### Step 3.1: Expand backend dashboard stats with breakthrough titles

**File**: `backend/src/routes/dashboard.routes.ts`

Find the signpost mapping (lines 75-90):
```tsx
    const digestSignposts = digestRows.map((d: any) => {
      // Parse JSONB fields — they might be strings or already objects
      const breakthroughs = typeof d.breakthroughs === 'string' ? JSON.parse(d.breakthroughs) : d.breakthroughs;
      const contradictions = typeof d.contradictions === 'string' ? JSON.parse(d.contradictions) : d.contradictions;
      const knowledgeGaps = typeof d.knowledge_gaps === 'string' ? JSON.parse(d.knowledge_gaps) : d.knowledge_gaps;

      return {
        id: d.id,
        topicId: d.topic_id,
        topicName: d.topic_name,
        breakthroughCount: Array.isArray(breakthroughs) ? breakthroughs.length : 0,
        contradictionCount: Array.isArray(contradictions) ? contradictions.length : 0,
        knowledgeGapCount: Array.isArray(knowledgeGaps) ? knowledgeGaps.length : 0,
        createdAt: d.created_at
      };
    });
```

Replace with:
```tsx
    const digestSignposts = digestRows.map((d: any) => {
      // Parse JSONB fields — they might be strings or already objects
      const breakthroughs = typeof d.breakthroughs === 'string' ? JSON.parse(d.breakthroughs) : d.breakthroughs;
      const contradictions = typeof d.contradictions === 'string' ? JSON.parse(d.contradictions) : d.contradictions;
      const knowledgeGaps = typeof d.knowledge_gaps === 'string' ? JSON.parse(d.knowledge_gaps) : d.knowledge_gaps;

      // Extract top 3 breakthrough titles for home page signpost enrichment
      // Breakthrough.title is DualModeText: { technical: string, explained: string }
      const topBreakthroughs: string[] = [];
      if (Array.isArray(breakthroughs)) {
        for (const bt of breakthroughs.slice(0, 3)) {
          if (typeof bt === 'object' && bt !== null) {
            const title = bt.title;
            if (typeof title === 'string') {
              topBreakthroughs.push(title);
            } else if (typeof title === 'object' && title !== null && title.technical) {
              topBreakthroughs.push(title.technical);
            }
          } else if (typeof bt === 'string') {
            topBreakthroughs.push(bt);
          }
        }
      }

      return {
        id: d.id,
        topicId: d.topic_id,
        topicName: d.topic_name,
        breakthroughCount: Array.isArray(breakthroughs) ? breakthroughs.length : 0,
        contradictionCount: Array.isArray(contradictions) ? contradictions.length : 0,
        knowledgeGapCount: Array.isArray(knowledgeGaps) ? knowledgeGaps.length : 0,
        topBreakthroughs,
        createdAt: d.created_at
      };
    });
```

**Key details**:
- `Breakthrough.title` is `DualModeText` (`{technical: string, explained: string}`) — extract `.technical`
- Handle edge cases: plain string title, null/undefined
- Additive field — backward-compatible, existing clients ignore `topBreakthroughs`
- No DB migration needed — reading existing JSONB data differently

**Verification**: `cd backend && npm run build` — no errors.

### Step 3.2: Update DigestSignposts component

**File**: `src/components/home/DigestSignposts.tsx`

Replace the **ENTIRE file** with:

```tsx
import { BookOpen, AlertTriangle, HelpCircle, ArrowRight, TrendingUp } from 'lucide-react';

interface DigestSignpost {
  id: string;
  topicId: string;
  topicName: string;
  breakthroughCount: number;
  contradictionCount: number;
  knowledgeGapCount: number;
  topBreakthroughs?: string[];
  createdAt: string;
}

interface DigestSignpostsProps {
  signposts: DigestSignpost[];
  onViewFindings: () => void;
}

export function DigestSignposts({ signposts, onViewFindings }: DigestSignpostsProps) {
  if (signposts.length === 0) return null;

  // Only show signposts that have meaningful content
  const meaningfulSignposts = signposts.filter(
    s => s.breakthroughCount > 0 || s.contradictionCount > 0 || s.knowledgeGapCount > 0
  );

  if (meaningfulSignposts.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
      <div className="px-5 py-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Latest Digest Insights</h3>
        </div>
        <button
          onClick={onViewFindings}
          className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
        >
          Open digests <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meaningfulSignposts.map(signpost => (
          <div key={signpost.id} className="border border-[var(--color-border-muted)] rounded-lg p-4">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{signpost.topicName}</h4>
            <div className="space-y-2">
              {signpost.breakthroughCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <BookOpen className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{signpost.breakthroughCount} breakthrough{signpost.breakthroughCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.contradictionCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{signpost.contradictionCount} contradiction{signpost.contradictionCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.knowledgeGapCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>{signpost.knowledgeGapCount} knowledge gap{signpost.knowledgeGapCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            {/* Top breakthrough titles — enrichment from backend */}
            {signpost.topBreakthroughs && signpost.topBreakthroughs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border-muted)]">
                <div className="space-y-1.5">
                  {signpost.topBreakthroughs.map((title, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                      <TrendingUp className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              Updated {new Date(signpost.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Changes from original**:
1. Added `topBreakthroughs?: string[]` to interface
2. Added `TrendingUp` to lucide imports
3. Inner grid: `sm:grid-cols-2` → `sm:grid-cols-2 lg:grid-cols-3` (3 columns on desktop for full-width tile)
4. Added breakthrough titles section below counts with `line-clamp-1` truncation
5. Titles separated by `border-t` divider, only shown when present

**Verification**: `npm run build` — no errors.

### Step 3.3: Remove ActivityChart and expand DigestSignposts in HomePage

**File**: `src/components/HomePage.tsx`

**Change 1** — Remove ActivityChart import (line 7):
```tsx
// DELETE this line:
import { ActivityChart } from './home/ActivityChart';
```

**Change 2** — Remove `activityTimeline` from DashboardStats interface (line 21):
```tsx
// DELETE this line:
  activityTimeline: { date: string; count: number }[];
```

The interface becomes:
```tsx
interface DashboardStats {
  unreadCount: number;
  totalFindings: number;
  topicCount: number;
  recentUnread: any[];
  digestSignposts: any[];
  sourceBreakdown: { type: string; count: number }[];
}
```

**Change 3** — Replace the bottom row of the bento grid (lines 146-159):

```tsx
// FIND:
        {/* Digest Signposts — 2 of 3 cols on lg */}
        <div className="sm:col-span-2 lg:col-span-2">
          <DigestSignposts
            signposts={stats.digestSignposts}
            onViewFindings={handleViewFindings}
          />
        </div>

        {/* Activity Chart — 1 of 3 cols on lg */}
        <div className="sm:col-span-2 lg:col-span-1">
          <ActivityChart
            activityTimeline={stats.activityTimeline}
          />
        </div>

// REPLACE WITH:
        {/* Digest Signposts — full width, 3 of 3 cols on lg */}
        <div className="sm:col-span-2 lg:col-span-3">
          <DigestSignposts
            signposts={stats.digestSignposts}
            onViewFindings={handleViewFindings}
          />
        </div>
```

**Note**: Do NOT delete `src/components/home/ActivityChart.tsx` — keep the file for potential 015c reuse.

**Verification**: `npm run build` — no errors.

### Step 3.4: Build verification and visual check

```bash
npm run build
cd backend && npm run build
```

**Visual verification**:
- [ ] **Home page bottom row**: DigestSignposts spans full width (3 columns on desktop).
- [ ] **Signpost cards**: Inner grid shows up to 3 cards side by side on lg+.
- [ ] **Breakthrough titles**: Each signpost card shows up to 3 breakthrough titles below the counts.
- [ ] **No ActivityChart**: The activity chart no longer appears on the home page.
- [ ] **Mobile (375px)**: Signpost cards stack vertically. Breakthrough titles visible.
- [ ] **Tablet (768px)**: Signpost cards 2-column.
- [ ] **Desktop (1024px+)**: Signpost cards 3-column within the full-width tile.
- [ ] **Dark mode**: Breakthrough titles readable. Border colors correct.
- [ ] **Empty state**: If no signposts have content, the entire section returns null.

**Checkpoint**: Commit with message `feat(home): remove ActivityChart, expand DigestSignposts with breakthroughs`

---

## Phase 4: Bento Grid Polish

**Goal**: Add hover effects to bento grid tiles and improve empty state handling when components return null.

### Step 4.1: Add hover effects and conditional wrappers to HomePage

**File**: `src/components/HomePage.tsx`

Replace the **entire bento grid section** (from `{/* Bento Grid */}` to the closing grid `</div>`, lines 113-160 after Phase 3 changes) with:

```tsx
      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Hero — always present, spans 2 cols on sm+, 2 of 3 on lg */}
        <div className="sm:col-span-2 lg:col-span-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
          <HeroSection
            unreadCount={stats.unreadCount}
            totalFindings={stats.totalFindings}
            topicCount={stats.topicCount}
            onViewFindings={handleViewFindings}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>

        {/* CTAs — no wrapper hover (individual CTA buttons have their own hover) */}
        <div className="sm:col-span-2 lg:col-span-1">
          <ContextualCTAs
            topicCount={stats.topicCount}
            totalFindings={stats.totalFindings}
            hasChatEnabled={topics.length > 0}
            hasDigests={stats.digestSignposts.length > 0}
            onNavigate={setCurrentView}
            onOpenChat={handleOpenChat}
          />
        </div>

        {/* Findings Highlights — only when there are unread findings */}
        {stats.recentUnread.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <FindingsHighlights
              findings={stats.recentUnread}
              onViewAllFindings={handleViewFindings}
            />
          </div>
        )}

        {/* Digest Signposts — only when there are digests with content */}
        {stats.digestSignposts.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <DigestSignposts
              signposts={stats.digestSignposts}
              onViewFindings={handleViewFindings}
            />
          </div>
        )}
      </div>
```

**Key changes**:
1. **Hover effects** on Hero, FindingsHighlights, DigestSignposts: `transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl`
2. **No hover on CTAs wrapper** — individual CTA buttons have their own `hover:border-primary-200 hover:shadow-md` effect
3. **Conditional wrappers**: FindingsHighlights only renders when `stats.recentUnread.length > 0`. DigestSignposts only renders when `stats.digestSignposts.length > 0`. This prevents empty grid cells.
4. **Empty state result**: No findings + no digests = Hero (2-col) + CTAs (1-col) only — clean minimal layout

**Verification**: `npm run build` — no errors.

### Step 4.2: Build verification and visual check

```bash
npm run build
```

**Visual verification**:
- [ ] **Hover effects**: Hero, FindingsHighlights, and DigestSignposts tiles lift slightly on hover (shadow-md + -translate-y-0.5).
- [ ] **CTA buttons**: Individual CTA buttons have their own hover (no double-hover on wrapper).
- [ ] **Empty state (no findings, 1 topic)**: Hero + CTAs only. Grid looks clean with no empty space below.
- [ ] **Empty state (no topics)**: Hero shows "Welcome" message + CTAs shows "Add a topic". No FindingsHighlights or DigestSignposts.
- [ ] **Full state (unread findings + digests)**: All tiles present, hover effects on each.
- [ ] **Mobile (375px)**: Hover effects do not interfere with touch interaction.
- [ ] **Dark mode**: Shadow colors work correctly.

**Checkpoint**: Commit with message `feat(home): add hover effects and empty state handling for bento grid`

---

## Phase 5: Final Build Verification & Deployment

### Step 5.1: Full build verification

```bash
npm run build
cd backend && npm run build
```

Must produce zero errors and zero warnings.

### Step 5.2: Comprehensive visual verification

**Breakpoint matrix**:

| Page | 375px | 768px | 1024px | 1280px | 1440px | 1920px |
|------|-------|-------|--------|--------|--------|--------|
| Home | 1-col stack, hover effects | 2-col bento | 3-col, no ActivityChart | Same | Same, wider | Same (max 1680px) |
| Findings (digest view) | No TOC, single col | No TOC | No TOC | TOC sidebar + digest | TOC + digest | TOC + digest |
| Findings (list view) | 1-col | 1-col | 2-col | 3-col | 3-col | 3-col |

**Drawer/Chat interaction tests**:

| Action | Expected Result |
|--------|-----------------|
| Chat open → click finding | Chat closes, FindingDetailDrawer opens |
| FindingDetailDrawer open → click chat icon | Drawer closes, chat opens |
| Chat open → "View Sources" | Chat closes, SourceDrawer opens |
| SourceDrawer open → click chat icon | SourceDrawer closes, chat opens |
| Chat open → open DigestSettings | Both stay (DigestSettings is center modal) |

**Full checklist**:
- [ ] **Home page** — No ActivityChart visible
- [ ] **Home page** — DigestSignposts full width with breakthrough titles
- [ ] **Home page** — Hover effects on Hero, FindingsHighlights, DigestSignposts
- [ ] **Home page** — Empty states: no findings, no digests, no topics — all handled
- [ ] **Digest view** — TOC sidebar appears at 1280px+
- [ ] **Digest view** — TOC scroll-spy highlights active section
- [ ] **Digest view** — TOC click scrolls smoothly to section
- [ ] **Digest view** — TOC hides when chat opens in push mode at 1440px
- [ ] **Digest view** — TOC stays when chat opens in push mode at 1920px
- [ ] **Drawer/Chat** — Mutual exclusivity works for all combinations
- [ ] **Mobile** — Everything works at 375px, no horizontal scrollbar
- [ ] **Dark mode** — All changes render correctly in dark theme
- [ ] **No console errors** — Clean console at all breakpoints

### Step 5.3: Deploy to production

```bash
# Push changes
git push

# SSH to server
ssh chee@100.94.82.35

# Pull and rebuild
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build

# Verify
docker logs medical-companion --tail 50 2>&1
```

### Step 5.4: Production visual verification

- [ ] Visit production URL in light mode
- [ ] Visit production URL in dark mode
- [ ] Navigate all pages
- [ ] Test digest TOC sidebar at wide viewport
- [ ] Test drawer/chat mutual exclusivity
- [ ] Verify home page bottom row redesign
- [ ] Check hover effects on bento tiles

**Checkpoint**: Commit with message `docs: mark Plan 015b as COMPLETE`

---

## Complete File Inventory

### New Files (2)
| File | Purpose |
|------|---------|
| `src/hooks/useScrollSpy.ts` | IntersectionObserver hook for active section tracking |
| `src/components/research/digest/DigestTOC.tsx` | TOC sidebar with dynamic entries + scroll-spy |

### Modified Files (7)
| # | File | Phase | Changes |
|---|------|-------|---------|
| 1 | `src/components/DigestCard.tsx` | 1 | Export `DIGEST_SECTION_IDS`, add `id` to 8 sections |
| 2 | `src/components/research/digest/DigestPanel.tsx` | 1 | Flex wrapper + TOC aside (hidden below xl) |
| 3 | `src/components/research/digest/index.ts` | 1 | Export DigestTOC |
| 4 | `src/stores/uiStore.ts` | 2 | Mutual exclusivity in 4 action methods |
| 5 | `backend/src/routes/dashboard.routes.ts` | 3 | Add `topBreakthroughs` to signpost mapping |
| 6 | `src/components/home/DigestSignposts.tsx` | 3 | Full-width 3-col grid, breakthrough titles display |
| 7 | `src/components/HomePage.tsx` | 3, 4 | Remove ActivityChart, expand signposts, hover effects, conditional wrappers |

### Untouched (kept for 015c)
| File | Note |
|------|------|
| `src/components/home/ActivityChart.tsx` | Import removed from HomePage but file kept for potential 015c reuse |

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scroll-spy flickers between sections | LOW | rootMargin biases toward upper viewport. Sorting by DOM order in callback. |
| TOC sidebar squeezes digest content too narrow | LOW | TOC is only 208px (w-52). At 1280px minus 208px = 1072px for content — comfortable. |
| Mutual exclusivity breaks existing drawer flow | MEDIUM | Only affects findingDetail and sourceDrawer (right-panel drawers). Center modals excluded. |
| Backend topBreakthroughs field breaks existing clients | LOW | New field is additive. Old clients simply ignore it. No breaking change. |
| Breakthrough title extraction fails for edge-case JSONB shapes | LOW | Multiple fallback paths: DualModeText object → plain string → skip. |
| Hover effects on mobile cause "stuck hover" | LOW | CSS hover on touch devices shows briefly then clears. No persistent visual artifact. |
| Empty bento grid (no topics, no findings, no digests) | LOW | Only Hero + CTAs render. Hero spans 2 cols, CTAs 1 col. Clean 2-item grid. |

---

## What This Plan Does NOT Cover (Plan 015c)

1. **Research Pulse** — AI-generated one-liner summarizing research state (replaces signposts)
2. **Worth Revisiting** — Pattern-matching older findings to new breakthroughs
3. **Responsive density system** — `--spacing-section`/`--spacing-card` adaptive tokens
4. **Digest TOC mobile drawer** — Collapsible TOC for mobile (currently just hidden)
5. **Drawer sizing improvements** — Adaptive widths based on viewport

---

## Rollback Plan

If the changes cause issues:

1. **Git revert**: Changes are on `feat/ui-overhaul` branch. Revert commits to Plan 015a state.
2. **Per-phase rollback**: Each phase has a checkpoint commit. Can revert to any phase boundary.
3. **TOC rollback**: Remove DigestTOC import from DigestPanel, revert flex wrapper. Section IDs are harmless and can remain.
4. **Mutual exclusivity rollback**: Revert the 4 action changes in uiStore.ts.
5. **ActivityChart restore**: Re-add the import in HomePage.tsx. The component file is not deleted.
6. **Backend rollback**: Remove `topBreakthroughs` from signpost mapping. Old response restored.

---

## Sign-Off Checklist

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | Digest TOC Sidebar | ⬜ Pending | |
| 2 | Drawer + Chat Mutual Exclusivity | ⬜ Pending | |
| 3 | Home Page Bottom Row Redesign | ⬜ Pending | |
| 4 | Bento Grid Polish | ⬜ Pending | |
| 5 | Build Verification & Deployment | ⬜ Pending | |

---

*Created: February 8, 2026*
*Author: Claude Opus 4.6*
*Predecessor: Plan 015a (Layout & Spatial Design Core — Complete)*
*Successor: Plan 015c (Companion Intelligence — Outline)*
