# 015a - Layout & Spatial Design Overhaul (Core)

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for transforming the Medical Companion PWA's layout from a narrow, centered single-column design into a responsive spatial system. It upgrades the container system, transforms the home page into a bento grid, implements chat panel push/reflow behavior on wide screens, and improves grid density for Findings, Topics, and Agents pages.**

**This plan builds on Plan 014's design token foundation** (CSS custom properties, primary palette, dark mode, Container component). Plan 014 established colors and themes — this plan fixes the layout.

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
│ - Verify NO compile errors before proceeding                     │
│ - Test responsive behavior (375px → 1920px) after each phase     │
│ - Commit changes to git after each phase                         │
│ - NO backend changes in this plan (frontend-only)                │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: FULL BUILD VERIFICATION & DEPLOYMENT                    │
│ - Frontend: npm run build                                        │
│ - Visual check: all pages at 375px, 768px, 1024px, 1440px,      │
│   1920px in BOTH light and dark mode                             │
│ - Chat panel: test push/overlay at different viewport widths     │
│ - Deploy to Debian server                                        │
│ - Production visual verification                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: COMPLETE
- **Created**: February 8, 2026
- **Completed**: February 8, 2026
- **Priority**: HIGH - Major layout transformation
- **Branch**: `feat/ui-overhaul` (continue from Plan 014)
- **Predecessor**: Plan 014 (UI/UX Design System Overhaul - Complete)
- **Successor**: Plan 015b (Layout Refinements — Digest TOC sidebar, drawer/chat exclusivity, home page redesign, bento grid polish)

---

## What Plan 014 Did (Foundation We Build On)

Plan 014 established the **design token foundation**:
- ✅ 60+ CSS custom properties for colors, shadows, radii, animations (`src/index.css`)
- ✅ Primary palette evolution (indigo → evolved blue-indigo HSL 222)
- ✅ System-preference dark mode via `@media (prefers-color-scheme: dark)`
- ✅ Container component with 3 variants (`src/components/ui/container.tsx`)
- ✅ Chat panel fullscreen toggle (`src/stores/uiStore.ts`)
- ✅ All 45+ component files color-migrated

**What Plan 014 DID NOT DO** (what this plan fixes):
- ❌ Content widths barely changed (1440/1280/768px — same feel as before)
- ❌ Home page still a single vertical column stack
- ❌ Chat panel always overlays content, even on wide screens
- ❌ No xl/2xl breakpoint usage (Tailwind defaults: 1280px, 1536px)
- ❌ Findings stuck at 2-column max, Topics/Agents at 3-column max

---

## Key Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Home Layout | Bento grid (CSS Grid, 3-col on desktop) | Better spatial arrangement than vertical stack, equal-weight tiles |
| Container Widths | dashboard→1600px, grid→1400px, reading→4xl, wide→1680px | Wider than current but not stretched. Max 1680px prevents distortion on ultrawide. |
| Chat Panel (≥1440px) | Push/reflow — main content shrinks 500px | Cohesive layout, no content hidden under overlay |
| Chat Panel (<1440px) | Keep overlay (current behavior) | Not enough room to push on narrow screens |
| Findings Grid | 2-col at lg, **3-col at xl** (1280px+) | Better use of wide screens. Falls to 2-col when chat pushes. |
| Topics/Agents Grid | Add **xl:grid-cols-4** | More tiles visible on wide screens |
| Wide Screen Cap | Containers max at 1600-1680px | Beyond that, margins breathe. No distortion on 2560px monitors. |
| Viewport Detection | `matchMedia` hook, not resize listener | Fires only on threshold crossing, not every pixel. Efficient. |
| Chat Mode State | Derived (viewport + chat state), NOT stored | No sync issues on resize. Simpler than store mutation. |
| Auth Pages | EXCLUDED | Separate future plan |

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `npm run build` after EACH file change
- [ ] Test at ALL breakpoints: 375px, 768px, 1024px, 1440px, 1920px
- [ ] Test chat panel open/close at each breakpoint
- [ ] Verify mobile (320-768px) layout is NOT broken
- [ ] Use Tailwind breakpoint classes (`sm`, `md`, `lg`, `xl`, `2xl`) — do NOT add custom breakpoints
- [ ] Keep all existing functionality — this is layout-only, no behavior changes
- [ ] Verify dark mode still works after each phase
- [ ] Preserve all existing CSS variable usage from Plan 014

## MUST NOT DO Rules

- [ ] Do NOT change any backend code (this plan is 100% frontend)
- [ ] Do NOT modify any service files, API calls, or data fetching logic
- [ ] Do NOT change component props interfaces or data flow
- [ ] Do NOT add new npm dependencies
- [ ] Do NOT break mobile layout (320-768px must work)
- [ ] Do NOT remove the chat panel overlay behavior on narrow screens
- [ ] Do NOT add custom breakpoint values to Tailwind config (use built-in sm/md/lg/xl/2xl)
- [ ] Do NOT redesign auth pages (excluded — separate plan)
- [ ] Do NOT store chat layout mode in uiStore (derive from viewport)

---

## Phase 1: Container System Upgrade

**Goal**: Expand container variants with better max-widths for wide screens and variant-aware responsive padding.

### Step 1.1: Upgrade container component

**File**: `src/components/ui/container.tsx`

**Current state** (from Plan 014):
```tsx
const containerVariants = {
  dashboard: 'max-w-[1440px]',
  grid:      'max-w-[1280px]',
  reading:   'max-w-3xl',
} as const;
// All variants use: paddingInline: 'clamp(1rem, 4vw, 3rem)'
```

**Replace the ENTIRE file** with:
```tsx
import { cn } from '@/lib/utils';

const containerVariants = {
  dashboard: 'max-w-[1600px]',
  grid:      'max-w-[1400px]',
  reading:   'max-w-4xl',
  wide:      'max-w-[1680px]',
} as const;

type ContainerVariant = keyof typeof containerVariants;

interface ContainerProps {
  variant?: ContainerVariant;
  children: React.ReactNode;
  className?: string;
}

export function Container({ variant = 'grid', children, className }: ContainerProps) {
  const isWideVariant = variant === 'dashboard' || variant === 'wide';
  return (
    <div
      className={cn('mx-auto w-full', containerVariants[variant], className)}
      style={{
        paddingInline: isWideVariant
          ? 'clamp(1.5rem, 5vw, 4rem)'
          : 'clamp(1rem, 4vw, 3rem)'
      }}
    >
      {children}
    </div>
  );
}
```

**Width changes explained**:
| Variant | Old | New | Purpose |
|---------|-----|-----|---------|
| `dashboard` | 1440px | 1600px | Home page — +160px breathing on 1920px monitors |
| `grid` | 1280px | 1400px | Topics, Agents, Findings — +120px, comfortable for 3-4 column grids |
| `reading` | max-w-3xl (768px) | max-w-4xl (896px) | Chat fullscreen — slightly wider reading column |
| `wide` | (new) | 1680px | Bento grid home — uses most of 1920px screen |

**Padding changes**: Wide variants get more generous padding (`clamp(1.5rem, 5vw, 4rem)`) to avoid content touching edges on very wide screens.

**Verification**: `npm run build` — no errors. All existing pages still render (wider but not broken).

### Step 1.2: Add layout spacing tokens (015b prep)

**File**: `src/index.css`

Find the `:root` block where design tokens are defined. After the `--duration-slow: 300ms;` line, add:

```css
  /* Layout Spacing Scale */
  --spacing-section: 1.5rem;
  --spacing-card: 1rem;
```

These tokens are groundwork for Plan 015b's adaptive density system. They are NOT used in 015a — they're just being established now so the tokens exist.

**Verification**: `npm run build` — no errors.

**Checkpoint**: Commit with message `feat(layout): upgrade container system with wider variants`

---

## Phase 2: Home Page Bento Grid

**Goal**: Transform the Home page from a vertical stack (`space-y-6`) into a responsive bento grid layout.

### Target Layout (Visual Reference)

**Mobile (<640px)**: Single column, everything stacked vertically
```
┌─────────────────────┐
│  TopicFilter        │
├─────────────────────┤
│  Hero               │
├─────────────────────┤
│  CTAs               │
├─────────────────────┤
│  Findings           │
├─────────────────────┤
│  Digest Signposts   │
├─────────────────────┤
│  Activity Chart     │
└─────────────────────┘
```

**Tablet (640-1023px)**: 2 columns
```
┌────────────┬────────────┐
│  TopicFilter (full)     │
├─────────────────────────┤
│  Hero (2col)            │
├─────────────────────────┤
│  CTAs (2col, stacked)   │
├────────────┬────────────┤
│  Findings  │  Digest    │
│  (1col)    │  (1col)    │
├────────────┴────────────┤
│  Activity Chart (2col)  │
└─────────────────────────┘
```

**Desktop (1024px+)**: 3 columns
```
┌─────────────────┬──────────┐
│  Hero (2col)    │ CTAs     │
│                 │ (1col)   │
├─────────────────┴──────────┤
│  Findings Highlights (3col)│
├─────────────────┬──────────┤
│  Digest         │ Activity │
│  Signposts      │ Chart    │
│  (2col)         │ (1col)   │
└─────────────────┴──────────┘
```

### Step 2.1: Update container variant in AppWithAuth

**File**: `src/AppWithAuth.tsx` (line 314)

Find:
```tsx
<Container variant={currentView === 'home' ? 'dashboard' : 'grid'}>
```

Replace with:
```tsx
<Container variant={currentView === 'home' ? 'wide' : 'grid'}>
```

**Rationale**: Home page uses the new `wide` variant (1680px) for bento grid breathing room. All other pages use `grid` (1400px).

**Verification**: `npm run build` — no errors.

### Step 2.2: Transform HomePage layout

**File**: `src/components/HomePage.tsx`

Find the return statement (lines 104-149):
```tsx
  return (
    <div className="space-y-6">
      {/* Topic Filter (chip/pill sub-nav) */}
      <TopicFilter
        topics={topics}
        selectedTopicId={selectedTopicId}
        onSelectTopic={handleTopicSelect}
      />

      {/* Hero Section — template-based narrative */}
      <HeroSection
        unreadCount={stats.unreadCount}
        totalFindings={stats.totalFindings}
        topicCount={stats.topicCount}
        onViewFindings={handleViewFindings}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Contextual CTAs — rule-based feature nudges */}
      <ContextualCTAs
        topicCount={stats.topicCount}
        totalFindings={stats.totalFindings}
        hasChatEnabled={topics.length > 0}
        hasDigests={stats.digestSignposts.length > 0}
        onNavigate={setCurrentView}
        onOpenChat={handleOpenChat}
      />

      {/* Findings Highlights — teasers for unread findings */}
      <FindingsHighlights
        findings={stats.recentUnread}
        onViewAllFindings={handleViewFindings}
      />

      {/* Digest Signposts — metadata references, not full content */}
      <DigestSignposts
        signposts={stats.digestSignposts}
        onViewFindings={handleViewFindings}
      />

      {/* Activity timeline chart */}
      <ActivityChart
        activityTimeline={stats.activityTimeline}
      />
    </div>
  );
```

Replace with:
```tsx
  return (
    <div className="space-y-6">
      {/* Topic Filter — full width, outside bento grid */}
      <TopicFilter
        topics={topics}
        selectedTopicId={selectedTopicId}
        onSelectTopic={handleTopicSelect}
      />

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Hero — spans 2 cols on sm+, 2 of 3 on lg */}
        <div className="sm:col-span-2 lg:col-span-2">
          <HeroSection
            unreadCount={stats.unreadCount}
            totalFindings={stats.totalFindings}
            topicCount={stats.topicCount}
            onViewFindings={handleViewFindings}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>

        {/* CTAs — full width on sm (2col), narrow 1-col on lg */}
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

        {/* Findings Highlights — full width across all 3 cols */}
        <div className="sm:col-span-2 lg:col-span-3">
          <FindingsHighlights
            findings={stats.recentUnread}
            onViewAllFindings={handleViewFindings}
          />
        </div>

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
      </div>
    </div>
  );
```

**Key changes**:
- `space-y-6` vertical stack → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`
- TopicFilter stays outside the grid (full width, above)
- Each section wrapped in a `<div>` with `col-span-*` classes
- `gap-5` (1.25rem) between grid items — slightly tighter than the old `space-y-6` (1.5rem) since items now have width neighbors too

**Verification**: `npm run build` — no errors.

### Step 2.3: Adjust ContextualCTAs for vertical stacking

**File**: `src/components/home/ContextualCTAs.tsx`

**Problem**: Currently uses `grid gap-3 sm:grid-cols-3` which renders 3 horizontal CTAs. In the bento grid, CTAs live in a narrow 1-column tile on desktop — 3 horizontal columns won't fit.

Find (line 77):
```tsx
    <div className="grid gap-3 sm:grid-cols-3">
```

Replace with:
```tsx
    <div className="grid gap-3 grid-cols-1 h-full content-start">
```

**Changes**:
- `sm:grid-cols-3` → `grid-cols-1` — always stack vertically (works in narrow tile)
- `h-full` — fills the grid cell height (aligns with Hero next to it)
- `content-start` — prevents vertical centering of items when cell is taller than content

**Verification**: `npm run build` — no errors.

### Step 2.4: Add h-full to HeroSection

**File**: `src/components/home/HeroSection.tsx`

Find (line 61):
```tsx
    <div className="bg-gradient-to-r from-primary-50 to-primary-100/30 border border-primary-200/50 rounded-xl p-8">
```

Replace with:
```tsx
    <div className="bg-gradient-to-r from-primary-50 to-primary-100/30 border border-primary-200/50 rounded-xl p-8 h-full">
```

**Why**: In the bento grid, Hero (2-col) sits next to CTAs (1-col). Both should fill their row height evenly. `h-full` makes Hero stretch to match.

**Verification**: `npm run build` — no errors.

### Step 2.5: Add h-full to FindingsHighlights

**File**: `src/components/home/FindingsHighlights.tsx`

Find (line 24):
```tsx
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)]">
```

Replace with:
```tsx
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
```

**Verification**: `npm run build` — no errors.

### Step 2.6: Add h-full to DigestSignposts

**File**: `src/components/home/DigestSignposts.tsx`

Find (line 29):
```tsx
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)]">
```

Replace with:
```tsx
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
```

**Verification**: `npm run build` — no errors.

### Step 2.7: Adjust ActivityChart for narrow tile

**File**: `src/components/home/ActivityChart.tsx`

Find (line 19):
```tsx
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] p-5">
```

Replace with:
```tsx
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] p-5 h-full">
```

Also find (line 21):
```tsx
      <ResponsiveContainer width="100%" height={200}>
```

Replace with:
```tsx
      <ResponsiveContainer width="100%" height={220}>
```

**Changes**:
- `h-full` — fills grid cell height (aligns with DigestSignposts next to it)
- Height 200→220px — slightly more room for chart in the narrower tile

**Verification**: `npm run build` — no errors.

### Step 2.8: Build verification and visual check

```bash
npm run build
```

**Visual verification** (use browser devtools to resize viewport):
- [ ] **375px**: Single column vertical stack — same as before, all sections readable
- [ ] **768px**: 2-column grid. Hero spans full width. CTAs span full width. Findings + DigestSignposts side by side. ActivityChart full width.
- [ ] **1024px**: 3-column grid. Hero (2 cols) + CTAs (1 col) side by side. Findings full width. DigestSignposts (2 cols) + ActivityChart (1 col) side by side.
- [ ] **1440px**: Same 3-column but wider container (max 1680px). More breathing room.
- [ ] **1920px**: Same 3-column, container maxes at 1680px. Margins on both sides.
- [ ] **Dark mode**: All tiles render correctly in both themes

**Checkpoint**: Commit with message `feat(layout): transform home page to responsive bento grid`

---

## Phase 3: Chat Panel Push/Reflow

**Goal**: On wide screens (≥1440px), opening the chat panel pushes main content to the left instead of overlaying. On narrow screens (<1440px), keep the current overlay behavior.

### Architecture Decision

**NOT storing `chatLayoutMode` in uiStore**. The layout mode is derived state:
- `usePushLayout = isWideViewport && chatPanelOpen && !chatFullscreen`

Reasons for deriving instead of storing:
1. It's a pure function of viewport width + chat state
2. Storing creates sync issues when user resizes browser
3. Simpler — one hook call, no extra store mutations or effects

### Step 3.1: Create viewport detection hook

**CREATE new file**: `src/hooks/useViewport.ts`

```tsx
import { useState, useEffect } from 'react';

const WIDE_BREAKPOINT = 1440;

export function useIsWideViewport() {
  const [isWide, setIsWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= WIDE_BREAKPOINT : false
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);

    setIsWide(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isWide;
}
```

**Why `matchMedia` instead of `resize` event**:
- `matchMedia` fires ONLY when crossing the threshold (not every pixel)
- Much more efficient — no debouncing needed
- Native browser API, no dependencies

**Verification**: `npm run build` — no errors.

### Step 3.2: Update AppWithAuth for push/overlay layout

**File**: `src/AppWithAuth.tsx`

**Change 1 — Add imports** (after line 19, after the existing imports):

Add:
```tsx
import { cn } from '@/lib/utils';
import { useIsWideViewport } from './hooks/useViewport';
```

**Change 2 — Add viewport detection** (after line 33):

Find:
```tsx
  const { chatPanelOpen, setChatPanelOpen, chatFullscreen, toggleChatFullscreen } = useUIStore();
```

Add after it:
```tsx
  const isWideViewport = useIsWideViewport();
  const usePushLayout = isWideViewport && chatPanelOpen && !chatFullscreen;
```

**Change 3 — Replace main content and chat panel sections** (lines 312-374)

Find the entire block from `{/* Main Content */}` to the closing `</div>` of the chat panel:
```tsx
      {/* Main Content */}
      <main className="py-8">
        <Container variant={currentView === 'home' ? 'dashboard' : 'grid'}>
          <ErrorBoundary>
            {currentView === 'home' && (
              <HomePage
                topics={topics}
                setCurrentView={setCurrentView}
              />
            )}
            {currentView === 'topics' && (
              <TopicManager
                topics={topics}
                setTopics={setTopics}
                selectedTopic={selectedTopic}
                setSelectedTopic={setSelectedTopic}
              />
            )}
            {currentView === 'agents' && (
              <AgentMonitor
                topics={topics}
                selectedTopic={selectedTopic}
              />
            )}
            {currentView === 'findings' && (
              <ResearchPage
                topicId={selectedTopic?.id}
              />
            )}
          </ErrorBoundary>
        </Container>
      </main>

      {/* Chat Panel - Slide in from right or fullscreen */}
      {chatPanelOpen && selectedTopic && (
        <div className={
          chatFullscreen
            ? 'fixed inset-0 z-50 bg-[var(--color-surface)]'
            : 'fixed right-0 top-0 h-full z-50 shadow-xl bg-[var(--color-surface)] rounded-l-xl'
        } style={chatFullscreen ? undefined : { width: '500px' }}>
          {chatFullscreen ? (
            <Container variant="reading" className="h-full">
              <ChatPanel
                topicId={selectedTopic.id}
                topicName={selectedTopic.name}
                onClose={() => { setChatPanelOpen(false); if (chatFullscreen) toggleChatFullscreen(); }}
                onToggleFullscreen={toggleChatFullscreen}
                isFullscreen={chatFullscreen}
                className="h-full w-full"
              />
            </Container>
          ) : (
            <ChatPanel
              topicId={selectedTopic.id}
              topicName={selectedTopic.name}
              onClose={() => setChatPanelOpen(false)}
              onToggleFullscreen={toggleChatFullscreen}
              isFullscreen={chatFullscreen}
              className="h-full w-full"
            />
          )}
        </div>
      )}
```

Replace with:
```tsx
      {/* Main Content + Chat Layout Wrapper */}
      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Main Content — shrinks when chat pushes on wide screens */}
        <main className={cn(
          'py-8 flex-1 min-w-0 transition-all duration-300',
          usePushLayout && 'mr-[500px]'
        )}>
          <Container variant={currentView === 'home' ? 'wide' : 'grid'}>
            <ErrorBoundary>
              {currentView === 'home' && (
                <HomePage
                  topics={topics}
                  setCurrentView={setCurrentView}
                />
              )}
              {currentView === 'topics' && (
                <TopicManager
                  topics={topics}
                  setTopics={setTopics}
                  selectedTopic={selectedTopic}
                  setSelectedTopic={setSelectedTopic}
                />
              )}
              {currentView === 'agents' && (
                <AgentMonitor
                  topics={topics}
                  selectedTopic={selectedTopic}
                />
              )}
              {currentView === 'findings' && (
                <ResearchPage
                  topicId={selectedTopic?.id}
                />
              )}
            </ErrorBoundary>
          </Container>
        </main>

        {/* Chat Panel — Push mode (wide) or Overlay mode (narrow) */}
        {chatPanelOpen && selectedTopic && (
          <>
            {chatFullscreen ? (
              <div className="fixed inset-0 z-50 bg-[var(--color-surface)]">
                <Container variant="reading" className="h-full">
                  <ChatPanel
                    topicId={selectedTopic.id}
                    topicName={selectedTopic.name}
                    onClose={() => { setChatPanelOpen(false); toggleChatFullscreen(); }}
                    onToggleFullscreen={toggleChatFullscreen}
                    isFullscreen={chatFullscreen}
                    className="h-full w-full"
                  />
                </Container>
              </div>
            ) : (
              <div
                className={cn(
                  'fixed right-0 bg-[var(--color-surface)] border-l border-[var(--color-border)]',
                  usePushLayout
                    ? 'top-16 h-[calc(100vh-64px)] z-40 shadow-sm'
                    : 'top-0 h-full z-50 shadow-xl rounded-l-xl'
                )}
                style={{ width: '500px' }}
              >
                <ChatPanel
                  topicId={selectedTopic.id}
                  topicName={selectedTopic.name}
                  onClose={() => setChatPanelOpen(false)}
                  onToggleFullscreen={toggleChatFullscreen}
                  isFullscreen={chatFullscreen}
                  className="h-full w-full"
                />
              </div>
            )}
          </>
        )}
      </div>
```

**How this works**:

1. **Flex wrapper** (`<div className="flex min-h-[calc(100vh-64px)]">`): The main content and chat panel live inside a flex container. The 64px is the header height (h-16).

2. **Push mode** (wide screens ≥1440px):
   - Main content gets `mr-[500px]` → right margin creates space for the 500px chat panel
   - Chat panel: `top-16 h-[calc(100vh-64px)]` → sits below header, doesn't overlap it
   - `z-40` and `shadow-sm` → subtle appearance, feels like part of the layout
   - `transition-all duration-300` → smooth animation when chat opens/closes

3. **Overlay mode** (narrow screens <1440px):
   - Main content stays at full width (no `mr-[500px]`)
   - Chat panel: `top-0 h-full z-50` → covers full height including header
   - `shadow-xl rounded-l-xl` → strong shadow and rounded edge, feels like an overlay
   - Same as current behavior

4. **Fullscreen mode** (all screens):
   - Unchanged from Plan 014 — covers entire viewport

5. **`min-w-0`** on main: Prevents flex child from overflowing when content is wider than available space.

**Verification**: `npm run build` — no errors.

### Step 3.3: Build verification and chat behavior check

```bash
npm run build
```

**Chat behavior verification** (use browser devtools to resize):

- [ ] **At 1920px**: Open chat → main content shrinks smoothly (300ms transition), chat appears on right below header
- [ ] **At 1920px**: Close chat → main content expands smoothly back to full width
- [ ] **At 1920px**: Toggle fullscreen → chat covers viewport. Minimize → returns to push mode.
- [ ] **At 1024px**: Open chat → overlay appears on top of content (full height, rounded edge, strong shadow)
- [ ] **At 1024px**: Close chat → overlay disappears
- [ ] **Resize 1920→1024px with chat open**: Chat transitions from push (below header) to overlay (full height)
- [ ] **Resize 1024→1920px with chat open**: Chat transitions from overlay to push
- [ ] **No horizontal scrollbar** at any viewport width
- [ ] **Bento grid reflows** when main content shrinks on wide screen with chat open
- [ ] **Dark mode**: Chat panel background and borders correct in both themes

**Checkpoint**: Commit with message `feat(layout): implement chat push/reflow on wide screens`

---

## Phase 4: Findings, Topics, Agents Grid Improvements

**Goal**: Better column usage on wide screens. Add `xl` breakpoint (1280px) for denser grids.

### Step 4.1: Update FindingsGrid for 3-column at xl

**File**: `src/components/research/findings/FindingsGrid.tsx`

Find (line 86):
```tsx
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

Replace with:
```tsx
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
```

**Why 3 columns works**:
- At 1440px (xl): 3 columns of ~450px each — comfortable for FindingCard
- When chat is in push mode: main content is ~940px, below xl (1280px), so grid gracefully falls to 2 columns
- At 1024px (lg): 2 columns — same as before

**Verification**: `npm run build` — no errors.

### Step 4.2: Update TopicManager for 4-column at xl

**File**: `src/components/TopicManager.tsx`

Find (line 106):
```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

Replace with:
```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

**Verification**: `npm run build` — no errors.

### Step 4.3: Update AgentMonitor for 4-column at xl

**File**: `src/components/agents/AgentMonitor.tsx`

Find (line 260):
```tsx
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
```

Replace with:
```tsx
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
```

**Verification**: `npm run build` — no errors.

### Step 4.4: Build verification and grid check

```bash
npm run build
```

**Grid verification matrix**:

| Page | 375px | 768px | 1024px | 1440px | 1920px | 1440px + chat |
|------|-------|-------|--------|--------|--------|---------------|
| Findings | 1-col | 1-col | 2-col | 3-col | 3-col | 2-col (push shrinks below xl) |
| Topics | 1-col | 2-col | 3-col | 4-col | 4-col | 3-col (push shrinks below xl) |
| Agents | 1-col | 2-col | 3-col | 4-col | 4-col | 3-col (push shrinks below xl) |

- [ ] Findings at 1440px: 3 columns visible
- [ ] Findings with chat open (push mode): Falls to 2 columns
- [ ] Topics at 1440px: 4 columns visible
- [ ] Agents at 1440px: 4 columns visible
- [ ] All grids at 768px: 2 columns (unchanged from before)
- [ ] All grids at 375px: 1 column (unchanged)
- [ ] Dark mode: All grid cards render correctly

**Checkpoint**: Commit with message `feat(layout): improve grid density for findings, topics, agents`

---

## Phase 5: Final Build Verification & Deployment

### Step 5.1: Full build verification

```bash
npm run build
```

Must produce zero errors and zero warnings.

### Step 5.2: Comprehensive visual verification

Test EVERY page at EVERY breakpoint in BOTH themes.

**Breakpoint matrix**:

| Page | 375px | 768px | 1024px | 1440px | 1920px |
|------|-------|-------|--------|--------|--------|
| Home | 1-col stack | 2-col bento | 3-col bento | 3-col wider | 3-col (max 1680px) |
| Findings (list) | 1-col | 1-col | 2-col | 3-col | 3-col |
| Topics | 1-col | 2-col | 3-col | 4-col | 4-col |
| Agents | 1-col | 2-col | 3-col | 4-col | 4-col |

**Chat interaction matrix**:

| Viewport | Chat open | Chat fullscreen |
|----------|-----------|-----------------|
| <1440px | Overlay (z-50, full height, rounded) | Full viewport |
| ≥1440px | Push (main shrinks, chat below header) | Full viewport |

**Checklist**:
- [ ] **Home page** — Bento grid layout correct at all breakpoints
- [ ] **Home page** — Hero + CTAs side by side on desktop
- [ ] **Home page** — Findings full width, DigestSignposts + ActivityChart side by side
- [ ] **Home page** — All tiles fill their grid cells evenly (no awkward height gaps)
- [ ] **Topics page** — 4 columns at 1440px
- [ ] **Agents page** — 4 columns at 1440px
- [ ] **Findings page** — 3 columns at 1440px
- [ ] **Chat push mode** — Main content shrinks smoothly at 1440px+
- [ ] **Chat overlay mode** — Overlay appears at <1440px (unchanged behavior)
- [ ] **Chat fullscreen** — Works at all sizes
- [ ] **Header** — Stretches full width, nav functional at all sizes
- [ ] **Mobile** — Everything works at 375px, no horizontal scrollbar
- [ ] **Dark mode** — All pages correct in dark theme
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
- [ ] Open and use chat (test push/overlay at different widths)
- [ ] Verify bento grid on home page
- [ ] Verify wider grids on topics, agents, findings

**Checkpoint**: Commit with message `docs: mark Plan 015a as COMPLETE`

---

## Complete File Inventory

### New Files (1)
| File | Purpose |
|------|---------|
| `src/hooks/useViewport.ts` | `useIsWideViewport()` hook — detects ≥1440px via matchMedia |

### Modified Files (11)
| # | File | Phase | Changes |
|---|------|-------|---------|
| 1 | `src/components/ui/container.tsx` | 1 | 4 variants (dashboard, grid, reading, wide), variant-aware padding |
| 2 | `src/index.css` | 1 | Add spacing tokens `--spacing-section`, `--spacing-card` |
| 3 | `src/AppWithAuth.tsx` | 2, 3 | Container variant `wide` for home, flex wrapper, push/overlay chat, `cn` + `useIsWideViewport` imports |
| 4 | `src/components/HomePage.tsx` | 2 | Vertical stack → bento grid with col-span wrappers |
| 5 | `src/components/home/ContextualCTAs.tsx` | 2 | `sm:grid-cols-3` → `grid-cols-1`, add `h-full content-start` |
| 6 | `src/components/home/HeroSection.tsx` | 2 | Add `h-full` to outer div |
| 7 | `src/components/home/FindingsHighlights.tsx` | 2 | Add `h-full` to outer div |
| 8 | `src/components/home/DigestSignposts.tsx` | 2 | Add `h-full` to outer div |
| 9 | `src/components/home/ActivityChart.tsx` | 2 | Add `h-full` to outer div, height 200→220px |
| 10 | `src/components/research/findings/FindingsGrid.tsx` | 4 | Add `xl:grid-cols-3` |
| 11 | `src/components/TopicManager.tsx` | 4 | Add `xl:grid-cols-4` |
| 12 | `src/components/agents/AgentMonitor.tsx` | 4 | Add `xl:grid-cols-4` |

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bento grid tiles have uneven heights | LOW | `h-full` on all tile wrapper divs + CSS Grid auto row sizing |
| Chat push causes horizontal scrollbar | MEDIUM | `min-w-0` on flex child prevents overflow. Test at every breakpoint. |
| `mr-[500px]` may not trigger container query on inner grid | LOW | Tailwind responsive classes use viewport width, not container width. Chat push reduces effective viewport for grids. The `xl:grid-cols-3` on findings gracefully degrades. |
| `matchMedia` not supported in old browsers | VERY LOW | Supported in all modern browsers (IE11 not a concern for this app) |
| Home page sections return `null` (no findings, no digests, etc.) | LOW | CSS Grid handles missing items gracefully — remaining items fill available space |
| Chat panel transition flicker on viewport resize crossing 1440px | LOW | `transition-all duration-300` smooths the change. matchMedia only fires on threshold. |

---

## What This Plan Does NOT Cover (Plan 015b — Future)

1. **Digest TOC sidebar** — Sticky sidebar navigation for long digest content scrolling
2. **Responsive density** — Spacing/padding that adapts to viewport width (using `--spacing-*` tokens)
3. **Drawer improvements** — Better sizing for FindingDetailDrawer and SourceDrawer
4. **Bento grid polish** — Card height equalization edge cases, tile hover effects
5. **Edge cases** — Issues discovered during 015a implementation

---

## Rollback Plan

If the overhaul causes issues:

1. **Git revert**: Changes are on `feat/ui-overhaul` branch. Revert commits to Plan 014 state.
2. **Per-phase rollback**: Each phase has a checkpoint commit. Can revert to any phase boundary.
3. **Container fallback**: Revert `container.tsx` to Plan 014 values (1440/1280/3xl) — all pages return to old widths instantly.
4. **Chat fallback**: Remove flex wrapper and `usePushLayout` logic from AppWithAuth — chat returns to overlay-only.

All changes are pure frontend — no DB migrations, no backend changes, no dependency additions.

---

## Sign-Off Checklist

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | Container System Upgrade | ✅ Complete | Feb 8, 2026 |
| 2 | Home Page Bento Grid | ✅ Complete | Feb 8, 2026 |
| 3 | Chat Panel Push/Reflow | ✅ Complete | Feb 8, 2026 |
| 4 | Findings/Topics/Agents Grid Improvements | ✅ Complete | Feb 8, 2026 |
| 5 | Build Verification & Deployment | ✅ Complete | Feb 8, 2026 |

---

*Created: February 8, 2026*
*Author: Claude Opus 4.6*
*Predecessor: Plan 014 (UI/UX Design System Overhaul - Complete)*
