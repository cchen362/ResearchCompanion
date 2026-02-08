# 014 - UI/UX Design System Overhaul

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for overhauling the entire UI/UX of the Medical Companion PWA. It establishes a design token system (colors, spacing, shadows, radii), migrates from generic Tailwind indigo to an evolved blue-indigo palette, implements proper system-preference dark mode, adds adaptive page-width containers (Approach C: Adaptive), and refreshes every visual surface across all pages including the chat panel.**

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
│ PHASES 1-7: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `npm run build` after EACH frontend file change            │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git after each phase                         │
│ - NO backend changes in this plan (frontend-only)                │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 8: FULL BUILD VERIFICATION & DEPLOYMENT                    │
│ - Frontend: npm run build                                        │
│ - Grep audit: zero "indigo" or "#4f46e5" in src/                 │
│ - Visual check: all pages in light AND dark mode                 │
│ - Deploy to Debian server                                        │
│ - Production visual verification                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: Ready
- **Created**: February 8, 2026
- **Priority**: HIGH - Major visual overhaul, all pages affected
- **Branch**: Create new branch `feat/ui-overhaul` from `feat/home-redesign`
- **Predecessor**: Plan 013 (Dashboard Home Redesign - Complete)

---

## Key Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout Strategy | Approach C: Adaptive | Different max-widths per page type |
| Primary Device | Laptop (1024-1440px) | User's primary device |
| Side Padding | Breathing room (4-6% via `clamp()`) | Linear/Notion feel |
| Navigation | Keep header nav, polish visually | Works well, just needs color/spacing update |
| Color System | Evolved Indigo (HSL 243 → HSL 222) | Bluer, more medical, less generic SaaS |
| Dark Mode | System-preference only (`prefers-color-scheme: media`) | Soft dark (slate-900 bg), no manual toggle |
| Chat Panel | Keep overlay + add expand-to-fullscreen | User request |
| Findings Grid | 2 columns max at `lg`+ | Clean, scannable, collapses when chat open |
| Auth Pages | EXCLUDED (separate future plan) | User has separate vision |

---

## Critical Discovery: Dark Mode is Currently Broken

**Problem**: `src/stores/appStore.ts` has an `applyTheme()` function that adds/removes `class="dark"` on `<html>`. But `tailwind.config.js` does NOT set `darkMode: 'class'`. Tailwind v3 defaults to `media` strategy. Result: the 61 existing `dark:` class usages across 15 files **never activate**.

**Fix**: Set `darkMode: 'media'` explicitly in Tailwind config. This means `dark:` variants activate via `@media (prefers-color-scheme: dark)` — no JavaScript toggle needed. Remove the broken class-based toggle from `appStore.ts`.

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `npm run build` after EACH file change
- [ ] Keep Tailwind `indigo` key during migration (Step 1.2), only remove after ALL files migrated (Step 3 complete)
- [ ] Test in both light AND dark mode after each phase (use browser devtools: Rendering → prefers-color-scheme)
- [ ] Use CSS custom properties (defined in Step 1.1) for all new color values — do NOT hardcode hex in components
- [ ] Preserve all existing functionality — this is visual-only, no behavior changes
- [ ] Auth pages (LoginPage, RegisterPage) get minimal color migration ONLY — no layout changes

## MUST NOT DO Rules

- [ ] Do NOT add a manual dark mode toggle (system-preference only)
- [ ] Do NOT change any backend code (this plan is 100% frontend)
- [ ] Do NOT modify any service files, API calls, or data fetching logic
- [ ] Do NOT change component props interfaces or data flow
- [ ] Do NOT add new npm dependencies (use existing Tailwind + Radix + Lucide)
- [ ] Do NOT redesign auth pages (excluded — separate plan)
- [ ] Do NOT add CSS-in-JS, CSS modules, or styled-components
- [ ] Do NOT add emoji to UI elements

## Refactoring-While-Touching Rules

**Principle**: Every file we touch for visual changes should also get cleaned up. No new technical debt. Build on a clean foundation.

When modifying ANY file in this plan, also apply these refactoring rules:

1. **Remove dead `dark:` variants that reference non-existent theme classes** — If a `dark:` class references a color not in our design system, replace it with the CSS variable approach.

2. **Standardize border-radius** — If the file uses mixed `rounded-md`, `rounded-lg`, `rounded-xl` inconsistently, align to the convention:
   - Buttons, inputs, dropdowns → `rounded-md`
   - Cards, panels → `rounded-lg`
   - Hero sections, feature cards → `rounded-xl`
   - Badges, pills, avatars → `rounded-full`

3. **Standardize shadow usage** — Replace any `shadow` (bare) with `shadow-sm` for cards. Use `shadow-md` for hover states. `shadow-lg` for drawers/modals. `shadow-xl` for chat panel overlay.

4. **Remove unused imports** — If you're already editing a file and see unused imports at the top, remove them.

5. **Consolidate redundant class strings** — Where the same conditional pattern repeats (e.g., `${active ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'}`), prefer the `cn()` utility for readability.

6. **Replace hardcoded gray-* with CSS variables** — When touching a file, replace:
   - `bg-gray-50` → `bg-[var(--color-surface-sunken)]`
   - `bg-white` → `bg-[var(--color-surface)]`
   - `text-gray-900` → `text-[var(--color-text-primary)]`
   - `text-gray-600`/`text-gray-700` → `text-[var(--color-text-secondary)]`
   - `text-gray-500` → `text-[var(--color-text-muted)]`
   - `border-gray-200` → `border-[var(--color-border)]`
   - `border-gray-100` → `border-[var(--color-border-muted)]`

   This ensures dark mode works on ALL surfaces, not just the ones with explicit `dark:` classes.

7. **Do NOT refactor logic or data flow** — This is visual refactoring only. If you notice a logic bug, document it but don't fix it in this plan.

---

## Phase 1: CSS Design Tokens (Light + Dark)

**Goal**: Establish the single source of truth for all colors, shadows, radii, and animation tokens as CSS custom properties in `src/index.css`.

### Step 1.1: Add design token CSS custom properties

**File**: `src/index.css`

Add the following block AFTER the existing `:root` block (which sets font-family). Place it BEFORE the `@keyframes` declarations.

```css
/* ===== DESIGN TOKENS ===== */

/* Light Theme (default) */
:root {
  /* Primary Palette — Evolved Indigo shifted to HSL 222 */
  --color-primary-50:  #eef3ff;
  --color-primary-100: #dbe4fe;
  --color-primary-200: #bfcffd;
  --color-primary-300: #93b0fb;
  --color-primary-400: #6088f7;
  --color-primary-500: #3b6cf2;
  --color-primary-600: #2054d9;
  --color-primary-700: #1a45b8;
  --color-primary-800: #1b3a95;
  --color-primary-900: #1d3175;
  --color-primary: var(--color-primary-600);

  /* Surfaces */
  --color-surface: #ffffff;
  --color-surface-elevated: #ffffff;
  --color-surface-sunken: #f8f9fb;

  /* Borders */
  --color-border: #e2e5eb;
  --color-border-muted: #eef0f4;

  /* Text */
  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;
  --color-text-on-primary: #ffffff;

  /* Semantic */
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-error: #dc2626;

  /* Shadows (subtle blue tint) */
  --shadow-sm: 0 1px 2px 0 rgba(30, 45, 80, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(30, 45, 80, 0.07), 0 2px 4px -2px rgba(30, 45, 80, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(30, 45, 80, 0.07), 0 4px 6px -4px rgba(30, 45, 80, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(30, 45, 80, 0.08), 0 8px 10px -6px rgba(30, 45, 80, 0.05);

  /* Border Radius Scale */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Animation Durations */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}

/* Dark Theme — Soft dark, slate-900 base, warm and comfortable */
@media (prefers-color-scheme: dark) {
  :root {
    /* Primary Palette — Inverted scale (50=darkest, 900=lightest) */
    --color-primary-50:  #0f1a2e;
    --color-primary-100: #152240;
    --color-primary-200: #1c3160;
    --color-primary-300: #264694;
    --color-primary-400: #3b6cf2;
    --color-primary-500: #5b8af5;
    --color-primary-600: #7ba4f7;
    --color-primary-700: #a3c0fa;
    --color-primary-800: #c8d9fc;
    --color-primary-900: #e8effd;
    --color-primary: var(--color-primary-400);

    /* Surfaces */
    --color-surface: #0f1419;
    --color-surface-elevated: #161d26;
    --color-surface-sunken: #0a0e13;

    /* Borders */
    --color-border: #1e2a3a;
    --color-border-muted: #151e2b;

    /* Text */
    --color-text-primary: #e5e7eb;
    --color-text-secondary: #9ca3af;
    --color-text-muted: #6b7280;
    --color-text-on-primary: #ffffff;

    /* Semantic */
    --color-success: #22c55e;
    --color-warning: #fbbf24;
    --color-error: #ef4444;

    /* Shadows (darker for dark theme) */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
  }
}
```

**IMPORTANT NOTE ON DARK PALETTE**: The number scale is inverted in dark mode. `primary-50` is the darkest shade, `primary-900` is the lightest. This means `bg-primary-50` = "subtle primary background" in BOTH themes. Agents must understand this — do NOT confuse the numbers.

**Verification**: `npm run build` — no errors.

---

## Phase 2: Tailwind Config + Container Component

**Goal**: Wire design tokens into Tailwind, enable system-preference dark mode, and create the adaptive Container component.

### Step 2.1: Update Tailwind configuration

**File**: `tailwind.config.js`

Replace the ENTIRE file contents with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Keep indigo temporarily for migration (remove in Phase 3 cleanup)
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // New primary palette (CSS variables for theme switching)
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          DEFAULT: 'var(--color-primary)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          sunken: 'var(--color-surface-sunken)',
        },
      },
    },
  },
  plugins: [],
}
```

**NOTE**: We keep `indigo` during Phase 3 migration. After ALL files are migrated, we'll remove it in the Phase 3 cleanup step.

**Verification**: `npm run build` — no errors. Both `bg-indigo-600` and `bg-primary-600` should work.

### Step 2.2: Create Container component

**CREATE new file**: `src/components/ui/container.tsx`

```tsx
import { cn } from '@/utils/cn';

const containerVariants = {
  dashboard: 'max-w-[1440px]',
  grid:      'max-w-[1280px]',
  reading:   'max-w-3xl',
} as const;

type ContainerVariant = keyof typeof containerVariants;

interface ContainerProps {
  variant?: ContainerVariant;
  children: React.ReactNode;
  className?: string;
}

export function Container({ variant = 'grid', children, className }: ContainerProps) {
  return (
    <div
      className={cn('mx-auto w-full', containerVariants[variant], className)}
      style={{ paddingInline: 'clamp(1rem, 4vw, 3rem)' }}
    >
      {children}
    </div>
  );
}
```

**Container variants**:
| Variant | Max Width | Usage |
|---------|-----------|-------|
| `dashboard` | 1440px | Home page — widest for bento layout |
| `grid` | 1280px | Findings, Topics, Agents — standard data grids |
| `reading` | max-w-3xl (~768px) | Chat fullscreen — optimized for readability |

**Verification**: `npm run build` — no errors.

### Step 2.3: Build verification

```bash
npm run build
```

**Expected**: Clean compilation. Both `primary` and `indigo` color classes resolve.

**Checkpoint**: Commit with message `feat(design): add CSS design tokens and Container component`

---

## Phase 3: Color Migration (indigo → primary)

**Goal**: Replace every `*-indigo-*` Tailwind class with `*-primary-*` across all 20 files. Then remove the `indigo` key from tailwind config.

### Migration Rules

| Old Pattern | New Pattern |
|-------------|-------------|
| `bg-indigo-{N}` | `bg-primary-{N}` |
| `text-indigo-{N}` | `text-primary-{N}` |
| `border-indigo-{N}` | `border-primary-{N}` |
| `ring-indigo-{N}` | `ring-primary-{N}` |
| `from-indigo-{N}` | `from-primary-{N}` |
| `to-indigo-{N}` | `to-primary-{N}` |
| `hover:bg-indigo-{N}` | `hover:bg-primary-{N}` |
| `hover:text-indigo-{N}` | `hover:text-primary-{N}` |
| `focus:ring-indigo-{N}` | `focus:ring-primary-{N}` |
| `focus:border-indigo-{N}` | `focus:border-primary-{N}` |
| `focus-visible:ring-indigo-{N}` | `focus-visible:ring-primary-{N}` |

### Step 3.1: Migrate UI primitive components

Process each file — find ALL instances of `indigo` and replace with `primary`:

- [ ] `src/components/ui/button.tsx` — default variant background/text/hover/focus
- [ ] `src/components/ui/badge.tsx` — default variant background/text
- [ ] `src/components/ui/input.tsx` — focus ring color

**Verification**: `npm run build` after all three.

### Step 3.2: Migrate layout shell

- [ ] `src/AppWithAuth.tsx` — header active nav state (`bg-indigo-100 text-indigo-700` → `bg-primary-100 text-primary-700`), loading spinner border color, chat icon active dot, all indigo references
- [ ] `src/App.tsx` — same changes if any indigo references exist (check first — may be dead code)

**Verification**: `npm run build`.

### Step 3.3: Migrate Home page components

- [ ] `src/components/HomePage.tsx` — loading spinner
- [ ] `src/components/home/HeroSection.tsx` — gradient: `from-indigo-50 to-purple-50 border-indigo-100` → `from-primary-50 to-primary-100/30 border-primary-200/50`. Button: `bg-indigo-600 hover:bg-indigo-700` → `bg-primary-600 hover:bg-primary-700`
- [ ] `src/components/home/TopicFilter.tsx` — active pill state
- [ ] `src/components/home/FindingsHighlights.tsx` — accent colors
- [ ] `src/components/home/DigestSignposts.tsx` — link colors
- [ ] `src/components/home/ContextualCTAs.tsx` — icon and hover colors

**Verification**: `npm run build`.

### Step 3.4: Migrate Topics, Agents, Notifications

- [ ] `src/components/TopicManager.tsx` — buttons, focus rings, avatar circle
- [ ] `src/components/agents/AgentMonitor.tsx` — buttons, spinner, topic labels
- [ ] `src/components/agents/AgentConfigModal.tsx` — buttons, focus rings
- [ ] `src/components/NotificationCenter.tsx` — accent colors, unread highlight

**Verification**: `npm run build`.

### Step 3.5: Migrate Auth pages (MINIMAL — color only)

Only replace indigo class names. Do NOT change layout, spacing, or structure.

- [ ] `src/components/auth/LoginPage.tsx` — gradient, focus rings, buttons
- [ ] `src/components/auth/RegisterPage.tsx` — gradient, focus rings, buttons
- [ ] `src/components/auth/AuthGuard.tsx` — spinner border color

**Verification**: `npm run build`.

### Step 3.6: Migrate Research/Findings and Digest components

- [ ] `src/components/research/drawers/FindingDetailDrawer.tsx` — accent colors
- [ ] `src/components/DigestCard.tsx` — section header colors
- [ ] `src/components/TranscriptionSummary.tsx` — accent colors

**Verification**: `npm run build`.

### Step 3.7: Update hardcoded hex values

Replace `#4f46e5` (old indigo-600) with `#2054d9` (new primary-600 hex):

| File | Change |
|------|--------|
| `src/components/home/ActivityChart.tsx` | SVG linearGradient stops, stroke color. Recharts needs raw hex — CSS vars don't work in SVG attributes. Also update the dark-mode compatible version: provide both `#2054d9` (light) and add a dark mode note in a comment. |
| `public/manifest.webmanifest` | `"theme_color"` and `"background_color"` |
| `public/icon.svg` | Fill color |
| `public/unregister-sw.html` | Inline CSS style references |

**Verification**: `npm run build`. `grep -r "#4f46e5" src/ public/` should return zero results.

### Step 3.8: Remove indigo from Tailwind config

**File**: `tailwind.config.js`

Remove the entire `indigo` block from `theme.extend.colors`. The `primary` palette is now the sole replacement.

**Verification**: `npm run build`. If any file still uses `*-indigo-*`, the build will succeed but those classes will have no styles (Tailwind purges them). Run: `grep -r "indigo" src/` — must return ZERO results.

### Step 3.9: Audit for stragglers

Run these grep commands and fix any remaining references:

```bash
grep -r "indigo" src/ --include="*.tsx" --include="*.ts" --include="*.css"
grep -r "#4f46e5" . --include="*.tsx" --include="*.ts" --include="*.css" --include="*.html" --include="*.json" --include="*.svg"
grep -r "#4F46E5" . --include="*.tsx" --include="*.ts" --include="*.css" --include="*.html" --include="*.json" --include="*.svg"
```

**Expected**: All three commands return zero results (excluding `node_modules/`).

**Checkpoint**: Commit with message `refactor(design): migrate all indigo to primary color palette`

---

## Phase 4: Dark Mode Fix + Theme Store Cleanup

**Goal**: Fix the broken dark mode system. Remove class-based toggle, rely on CSS `prefers-color-scheme` media query (already set up in Phase 1 tokens and Phase 2 Tailwind config).

### Step 4.1: Simplify theme code in appStore

**File**: `src/stores/appStore.ts`

Find the `applyTheme` function (around line 110-120):

```typescript
const applyTheme = (theme: Theme) => {
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
```

Replace with a no-op:

```typescript
// Dark mode handled by CSS @media (prefers-color-scheme: dark)
// No class toggling needed — Tailwind darkMode: 'media' uses native CSS
const applyTheme = (_theme: Theme) => {
  // Intentionally empty — CSS custom properties in index.css
  // handle light/dark via @media (prefers-color-scheme: dark)
};
```

**WHY**: The `document.documentElement.classList.add('dark')` was for Tailwind's `class` strategy, but we're using `media` strategy. The class toggle is now meaningless.

Also find the `onRehydrate` callback that calls `applyTheme` and leave it as-is (it will call the no-op, which is safe).

**Do NOT remove** `setTheme`, `toggleTheme`, or the `theme` state property — they may be referenced by UI components. Making `applyTheme` a no-op is sufficient.

**Verification**: `npm run build`.

### Step 4.2: Audit and fix all dark: variants

The 15 files with existing `dark:` classes need to be audited. For each file, decide:

**Strategy A — Replace with CSS variable**: Where the pattern is `bg-white dark:bg-gray-800`, replace BOTH with `bg-[var(--color-surface)]` (the CSS variable handles both themes). This is the preferred approach — cleaner code.

**Strategy B — Keep dark: with correct value**: Where fine-grained control is needed (e.g., different hover states per theme), keep the `dark:` prefix but ensure the color value is correct for the soft dark theme.

**Strategy C — Add missing dark: variants**: Some components only have light styles. Add `dark:` variants where needed for dark mode to look correct.

Process each file:

- [ ] **`src/components/ChatMessage.tsx`** (6 dark: occurrences)
  - User message bubble: `bg-primary-600 text-white` works in both themes (no dark: needed)
  - Assistant message: Replace `bg-white dark:bg-gray-800` with `bg-[var(--color-surface)]`
  - Avatar: Replace `bg-gray-100 dark:bg-gray-700` with `bg-[var(--color-surface-sunken)]`
  - Text: Replace `text-gray-600 dark:text-gray-300` with `text-[var(--color-text-secondary)]`
  - Citation buttons: Update `dark:text-blue-400` etc. to `dark:text-primary-400` etc.

- [ ] **`src/components/chat/SuggestedQuestions.tsx`** (11 dark: occurrences)
  - Pills: Replace `bg-white/90 dark:bg-gray-800/90` with `bg-[var(--color-surface)]/90`
  - Border: Replace `border-gray-200/60 dark:border-gray-700/60` with `border-[var(--color-border)]/60`
  - Hover: Replace `hover:bg-blue-50 dark:hover:bg-blue-900/20` with `hover:bg-primary-50`
  - Text: Replace `text-gray-700 dark:text-gray-300` with `text-[var(--color-text-secondary)]`
  - Arrows: Replace `bg-white/80 dark:bg-gray-800/80` with `bg-[var(--color-surface)]/80`
  - Auto-hide text: Replace `text-gray-400 dark:text-gray-600` with `text-[var(--color-text-muted)]`

- [ ] **`src/components/DigestCard.tsx`** (9 dark: occurrences)
  - Section backgrounds and text colors → use CSS variable equivalents
  - Keep semantic colors (green for breakthroughs, amber for contradictions)

- [ ] **`src/components/FindingsMetricsExplainer.tsx`** (9 dark: occurrences)
  - All background/text → CSS variable equivalents

- [ ] **`src/components/CitationLink.tsx`** (8 dark: occurrences)
  - Link colors → `text-primary-600 dark:text-primary-400`
  - Hover → `hover:text-primary-800 dark:hover:text-primary-300`

- [ ] **`src/components/research/drawers/SourceDrawer.tsx`** (4 dark: occurrences)
  - Panel background → `bg-[var(--color-surface)]`
  - Borders → `border-[var(--color-border)]`

- [ ] **`src/components/digest/FeaturedDiscovery.tsx`** (3 dark: occurrences)
  - Card background and text → CSS variable equivalents

- [ ] **`src/components/ChatInput.tsx`** (2 dark: occurrences)
  - Input hover border: Replace `hover:border-gray-400 dark:hover:border-gray-600` with `hover:border-[var(--color-border)]`
  - Typing indicator background: use CSS variables

- [ ] **`src/components/research/ResearchContainer.tsx`** (2 dark: occurrences)
  - Gradient backgrounds → use primary tokens

- [ ] **`src/components/research/findings/FindingsEmpty.tsx`** (2 dark: occurrences)
  - Empty state text and icons → CSS variables

- [ ] **`src/components/research/findings/FindingsGrid.tsx`** (1 dark: occurrence)
  - Grid background → CSS variable

- [ ] **`src/components/ChatPanel.tsx`** (1 dark: occurrence)
  - Container background → `bg-[var(--color-surface)]`

- [ ] **`src/components/digest/SourceStatsBar.tsx`** (1 dark: occurrence)
  - Bar background → CSS variable

- [ ] **`src/components/ui/tooltip.tsx`** (1 dark: occurrence)
  - Tooltip background → appropriate dark value

- [ ] **`src/components/ui/alert.tsx`** (1 dark: occurrence)
  - Alert variant → CSS variable

### Step 4.3: Add dark mode support to components WITHOUT existing dark: classes

These components currently have NO dark mode support and will look wrong in dark mode. Add appropriate dark styles:

- [ ] **`src/AppWithAuth.tsx`** — Page background: add `dark:bg-[var(--color-surface-sunken)]` or use CSS var directly. Header: `dark:bg-[var(--color-surface)]` and `dark:border-[var(--color-border)]`.
- [ ] **`src/components/HomePage.tsx`** — Loading spinner border color
- [ ] **`src/components/home/HeroSection.tsx`** — Hero gradient must work in dark (use primary CSS vars which auto-invert)
- [ ] **`src/components/TopicManager.tsx`** — Card backgrounds, form inputs, modals
- [ ] **`src/components/agents/AgentMonitor.tsx`** — Card backgrounds, status colors
- [ ] **`src/components/research/findings/FindingCard.tsx`** — Card background, text colors, source badges

For each: Use the CSS variable approach where possible (`bg-[var(--color-surface)]` instead of `bg-white dark:bg-gray-800`).

**Verification**: `npm run build`. Toggle dark mode in browser devtools → every page should look correct.

### Step 4.4: Build verification

```bash
npm run build
```

**Checkpoint**: Commit with message `feat(design): implement system-preference dark mode`

---

## Phase 5: Adaptive Layout + Header Polish

**Goal**: Replace the fixed `max-w-7xl` container with the adaptive Container component and polish the header navigation.

### Step 5.1: Apply adaptive Container to main layout

**File**: `src/AppWithAuth.tsx`

**Change 1 — Header inner container**:

Find:
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

Replace with:
```tsx
<div className="mx-auto w-full" style={{ paddingInline: 'clamp(1rem, 4vw, 3rem)' }}>
```

**Change 2 — Main content area**:

Find:
```tsx
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
```

Replace with:
```tsx
<main className="py-8">
  <Container variant={currentView === 'home' ? 'dashboard' : 'grid'}>
```

Close the `Container` after the `ErrorBoundary`:
```tsx
  </Container>
</main>
```

Add import at top:
```tsx
import { Container } from './components/ui/container';
```

**Change 3 — Theme-aware backgrounds**:

- Page: `bg-gray-50` → `bg-[var(--color-surface-sunken)]`
- Header: `bg-white` → `bg-[var(--color-surface)]`
- Header border: `border-gray-200` → `border-[var(--color-border)]`
- Mobile menu: `bg-white` → `bg-[var(--color-surface)]`
- Mobile menu border: `border-gray-200` → `border-[var(--color-border)]`

**Verification**: `npm run build`. Visually verify: header stretches wider, content has breathing room, dark mode backgrounds correct.

### Step 5.2: Polish header navigation

**File**: `src/AppWithAuth.tsx`

Visual-only refinements:

1. **Nav buttons**: Change `px-2 py-1 rounded-md` to `px-3 py-1.5 rounded-lg` for larger hit targets and softer rounding.

2. **Inactive hover**: Change `hover:bg-gray-100` to `hover:bg-[var(--color-surface-sunken)]` for theme-awareness.

3. **Title text**: Change `text-gray-900` to `text-[var(--color-text-primary)]`.

4. **Secondary text**: Change any `text-gray-700` or `text-gray-600` in nav to `text-[var(--color-text-secondary)]`.

5. **Chat active dot**: Change `bg-green-500` to `bg-primary-500`.

6. **Logout button**: Change `border-gray-300` to `border-[var(--color-border)]`.

7. **Mobile menu items**: Same text/bg color updates as desktop nav.

8. **Mobile menu divider**: `border-gray-200` → `border-[var(--color-border)]`.

**Verification**: `npm run build`. Check header in both themes, both desktop and mobile viewport.

### Step 5.3: Build verification

```bash
npm run build
```

**Checkpoint**: Commit with message `feat(design): apply adaptive containers and polish header`

---

## Phase 6: Page Visual Refresh

**Goal**: Apply the new design system to all page components.

### Step 6.1: Home page refresh

**Files**:
- `src/components/home/HeroSection.tsx`
- `src/components/home/TopicFilter.tsx`
- `src/components/home/FindingsHighlights.tsx`
- `src/components/home/DigestSignposts.tsx`
- `src/components/home/ContextualCTAs.tsx`
- `src/components/home/ActivityChart.tsx`

**Changes per file**:

**HeroSection.tsx**:
- Gradient: `from-primary-50 to-primary-100/30 border border-primary-200/50`
- Increase padding: `p-6` → `p-8`
- Round: `rounded-xl` (unchanged, already correct)
- Background in dark: CSS variables handle it automatically
- Text: `text-gray-900` → `text-[var(--color-text-primary)]`, `text-gray-600` → `text-[var(--color-text-secondary)]`

**TopicFilter.tsx**:
- Active pill: `bg-primary-600 text-white shadow-sm`
- Inactive: `bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]`
- Hover: `hover:bg-primary-50`

**FindingsHighlights.tsx**:
- Card wrapper: `border border-[var(--color-border-muted)] hover:shadow-md transition-shadow bg-[var(--color-surface)]`
- Text colors: use CSS variables

**DigestSignposts.tsx**:
- Same border treatment as FindingsHighlights
- Inner cards: `rounded-lg border border-[var(--color-border-muted)]`

**ContextualCTAs.tsx**:
- Cards: `border border-[var(--color-border-muted)] hover:border-primary-200 bg-[var(--color-surface)]`
- Keep `rounded-xl`

**ActivityChart.tsx**:
- Chart wrapper: `rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface)]`
- Hex colors already updated in Phase 3, Step 3.7

**Verification**: `npm run build`. Load home page — verify visual hierarchy in both themes.

### Step 6.2: Findings/Research page refresh

**Files**:
- `src/components/research/findings/FindingsGrid.tsx`
- `src/components/research/findings/FindingCard.tsx`
- `src/components/research/findings/FindingsEmpty.tsx`
- `src/components/research/ResearchContainer.tsx`
- `src/components/research/digest/DigestPanel.tsx`
- `src/components/DigestCard.tsx`
- `src/components/research/drawers/SourceDrawer.tsx`
- `src/components/research/drawers/FindingDetailDrawer.tsx`

**Key change — 2-column findings grid**:

In `FindingsGrid.tsx`, find the container that renders finding cards in list mode. It currently uses `space-y-4` or similar single-column layout. Replace with:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

This gives 2 columns at `lg` (1024px+). When the chat panel is open (eating 500px), the remaining viewport (~940px at 1440px) drops below `lg`, gracefully falling to 1 column.

**FindingCard.tsx**:
- `rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface)]`
- Hover: `hover:shadow-md hover:border-primary-200/50 transition-all`
- Text: use CSS variables for theme awareness

**DigestCard.tsx**:
- Section headers: `text-primary-700` (CSS var auto-adjusts for dark)
- Card borders: `border-[var(--color-border-muted)]`
- Keep semantic badge colors (green breakthroughs, amber contradictions, blue knowledge gaps)

**SourceDrawer.tsx** and **FindingDetailDrawer.tsx**:
- Panel background: `bg-[var(--color-surface)]`
- Add `rounded-l-xl` for left edge rounding (right-slide panel)
- Shadow: `shadow-xl`

**Verification**: `npm run build`. Test 2-column grid at different viewport widths. Open chat panel — verify graceful fallback to 1 column.

### Step 6.3: Topics page refresh

**File**: `src/components/TopicManager.tsx`

Convert from list layout to card grid:

Find the container that renders topics (likely a `<ul>` or `<div>` with `divide-y divide-gray-200`). Replace with:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

Each topic card:
- `rounded-lg border border-[var(--color-border-muted)] shadow-sm bg-[var(--color-surface)]`
- Hover: `hover:shadow-md transition-shadow`
- Topic initial avatar: `bg-primary-100 text-primary-600 rounded-lg` (from `rounded-full` for modern feel)
- Agent count badge: `bg-primary-50 text-primary-700`
- Actions (edit/delete): grouped in subtle footer section

Modal dialogs (if any):
- `rounded-xl` for dialog card
- Backdrop: `bg-black/50`
- Focus rings: `ring-primary-500`

**Verification**: `npm run build`. Topics display as card gallery in both themes.

### Step 6.4: Agents page refresh

**Files**: `src/components/agents/AgentMonitor.tsx`, `src/components/agents/AgentConfigModal.tsx`

**Changes**:
- Agent cards: `border border-[var(--color-border-muted)] bg-[var(--color-surface)] rounded-lg`
- Status indicators: Keep existing semantic colors (blue=running, red=error, yellow=scheduled, gray=idle) — these are functional, not aesthetic
- "Run All Pending" button: primary treatment (already from Phase 3)
- Config modal: `rounded-xl`, backdrop `bg-black/50`

**Verification**: `npm run build`. Agents display correctly in both themes.

### Step 6.5: Build verification

```bash
npm run build
```

**Checkpoint**: Commit with message `feat(design): visual refresh for Home, Findings, Topics, and Agents pages`

---

## Phase 7: Chat Panel Redesign

**Goal**: Add expand-to-fullscreen toggle, redesign message bubbles, improve empty state, refine input and suggested questions.

### Step 7.1: Add chatFullscreen state to uiStore

**File**: `src/stores/uiStore.ts`

Add to the store interface:
```typescript
chatFullscreen: boolean;
setChatFullscreen: (fullscreen: boolean) => void;
toggleChatFullscreen: () => void;
```

Add to the initial state:
```typescript
chatFullscreen: false,
```

Add actions:
```typescript
setChatFullscreen: (fullscreen) => set({ chatFullscreen: fullscreen }),
toggleChatFullscreen: () => set((state) => ({ chatFullscreen: !state.chatFullscreen })),
```

**Verification**: `npm run build`.

### Step 7.2: Implement fullscreen toggle in chat panel container

**File**: `src/AppWithAuth.tsx`

Import the new store state:
```tsx
const { chatPanelOpen, setChatPanelOpen, chatFullscreen, toggleChatFullscreen } = useUIStore();
```

Replace the current chat panel rendering:

```tsx
{/* Current */}
{chatPanelOpen && selectedTopic && (
  <div className="fixed right-0 top-0 h-full z-50 shadow-2xl bg-white" style={{ width: '500px' }}>
```

With:

```tsx
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

**Verification**: `npm run build`.

### Step 7.3: Update ChatPanel component interface

**File**: `src/components/ChatPanel.tsx`

Add new props:
```tsx
interface ChatPanelProps {
  topicId: string;
  topicName: string;
  className?: string;
  onClose?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}
```

Update header to include fullscreen toggle button:

```tsx
<div className="flex items-center gap-2">
  {/* ... existing export and clear buttons ... */}
  {onToggleFullscreen && (
    <Button
      size="icon"
      variant="ghost"
      onClick={onToggleFullscreen}
      title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
    >
      {isFullscreen ? (
        <Minimize2 className="w-4 h-4" />
      ) : (
        <Maximize2 className="w-4 h-4" />
      )}
    </Button>
  )}
  {onClose && (
    <Button size="icon" variant="ghost" onClick={onClose} title="Close chat">
      <X className="w-4 h-4" />
    </Button>
  )}
</div>
```

Add imports: `import { Maximize2, Minimize2 } from 'lucide-react';`

**Theme-aware container**:
- `bg-white` → `bg-[var(--color-surface)]`
- Header border: `border-b` → `border-b border-[var(--color-border)]`
- Messages area: `p-4` → `px-6 py-4` (more breathing room)

**Empty state redesign**:

Replace:
```tsx
<div className="text-center text-gray-500 mt-8">
  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
  <p>Start a conversation about {topicName}</p>
</div>
```

With:
```tsx
<div className="flex flex-col items-center justify-center h-full text-center px-6">
  <div className="bg-primary-50 rounded-2xl p-6 mb-6">
    <MessageSquare className="w-10 h-10 text-primary-600" />
  </div>
  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
    Start a conversation
  </h3>
  <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm">
    Ask questions about {topicName} — your research findings are included as context.
  </p>
</div>
```

**Verification**: `npm run build`. Open chat — verify empty state looks welcoming. Test fullscreen toggle.

### Step 7.4: Redesign ChatMessage bubbles

**File**: `src/components/ChatMessage.tsx`

**User messages**:
- Replace gradient: `bg-gradient-to-br from-primary to-primary/90 text-primary-foreground` → `bg-primary-600 text-white`
- Shape: Add `rounded-2xl rounded-br-sm` for chat bubble shape
- Remove shadow: `shadow-md` → (remove)

**Assistant messages**:
- Replace: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700` → `bg-[var(--color-surface-elevated)] border border-[var(--color-border)]`
- Shape: Add `rounded-2xl rounded-bl-sm`

**Avatar**:
- Only show for assistant messages (hide for user messages by adding a condition)
- Style: `bg-primary-50 text-primary-600` (CSS vars handle dark mode)

**Message header**:
- Remove "User" / "Assistant" role label — the alignment and bubble shape make it clear who is speaking
- Keep timestamp only, right-aligned

**Card wrapper**:
- Simplify: Remove the outer `Card` component wrapper and use plain `div` with the bubble classes directly. This gives a cleaner chat bubble feel instead of formal card.

**Citation buttons inline** (in `formattedContent` useMemo):
- Update inline class strings: `text-blue-600` → `text-primary-600`, `bg-blue-50` → `bg-primary-50`, `border-blue-200` → `border-primary-200`
- Dark variants: `dark:text-blue-400` → use CSS-variable-aware `text-[var(--color-primary)]`
- NOTE: These are inline HTML strings (dangerouslySetInnerHTML). CSS variables work in inline classes only if the classes are generated by Tailwind. For inline HTML, use plain CSS class names that are in the Tailwind content scan. If needed, add the specific utility classes to a safelist or just use the hardcoded hex in the inline HTML.

**Actions bar (Copy)**:
- Border: `border-t` → `border-t border-[var(--color-border-muted)]`

**Verification**: `npm run build`. Send a message in chat — verify bubble shape, colors, dark mode.

### Step 7.5: Refine ChatInput

**File**: `src/components/ChatInput.tsx`

- Textarea border: `border-2 border-input` → `border border-[var(--color-border)]`
- Textarea rounded: `rounded-lg` → `rounded-xl`
- Focus: `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500` → `focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400`
- Background: `bg-background` → `bg-[var(--color-surface)]`
- Hover: `hover:border-gray-400 dark:hover:border-gray-600` → `hover:border-[var(--color-text-muted)]`
- Typing indicator dots: `bg-blue-500` → `bg-primary-500`
- Help text: `text-muted-foreground` → `text-[var(--color-text-muted)]`

**Verification**: `npm run build`.

### Step 7.6: Refine SuggestedQuestions

**File**: `src/components/chat/SuggestedQuestions.tsx`

- Pills: Replace all `bg-white/90 dark:bg-gray-800/90 border-gray-200/60 dark:border-gray-700/60` with `bg-[var(--color-surface)]/90 border-[var(--color-border)]/60`
- Hover: `hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700`
- Text: `text-gray-700 dark:text-gray-300` → `text-[var(--color-text-secondary)]`
- Sparkles icon: `text-blue-500` → `text-primary-500`
- Remove "auto-hide" indicator text (the `<div>` with "auto-hide" — remove the entire block, it's a confusing UI element)
- Arrows: `bg-white/80 dark:bg-gray-800/80` → `bg-[var(--color-surface)]/80`

**Verification**: `npm run build`.

### Step 7.7: Build verification

```bash
npm run build
```

**Checkpoint**: Commit with message `feat(design): redesign chat panel with fullscreen toggle and refined bubbles`

---

## Phase 8: Final Build Verification & Deployment

### Step 8.1: Full build verification

```bash
npm run build
```

Must produce zero errors and zero warnings.

### Step 8.2: Grep audits

Run these commands — ALL must return zero results (excluding node_modules):

```bash
# No stale indigo references
grep -r "indigo" src/ --include="*.tsx" --include="*.ts" --include="*.css"

# No old hex color
grep -r "#4f46e5" src/ public/ --include="*.tsx" --include="*.ts" --include="*.css" --include="*.html" --include="*.json" --include="*.svg"
grep -r "#4F46E5" src/ public/ --include="*.tsx" --include="*.ts" --include="*.css" --include="*.html" --include="*.json" --include="*.svg"
```

### Step 8.3: Visual verification checklist

Test EVERY page in BOTH themes (light and dark). Use browser devtools: Rendering → Emulate CSS media feature `prefers-color-scheme`:

- [ ] **Home page** — Hero gradient, topic pills, findings highlights, digest signposts, CTAs, activity chart
- [ ] **Topics page** — Card gallery grid, create/edit modals
- [ ] **Agents page** — Agent cards, status indicators, run buttons, config modal
- [ ] **Findings page** — 2-column grid, finding cards, digest panel, source drawer, finding detail drawer
- [ ] **Chat panel** — Message bubbles, empty state, input, suggested questions, fullscreen toggle
- [ ] **Header** — Nav buttons active/hover, chat icon, notification center, logout
- [ ] **Login page** — Minimal color migration visible (auth redesign is separate plan)
- [ ] **Loading states** — Spinners use primary color

### Step 8.4: Responsive verification

Test at these viewport widths:

- [ ] **1440px** (laptop) — Primary target. Breathing room visible. 2-column findings grid. 3-column topics.
- [ ] **1024px** (tablet) — Content slightly wider than before. 2-column findings grid at boundary.
- [ ] **768px** (small tablet) — Mobile nav triggers. Single column everywhere.
- [ ] **375px** (mobile) — Hamburger menu. Everything stacked. Touch-friendly targets.

### Step 8.5: Chat panel verification

- [ ] Open chat panel (500px overlay) — content visible behind
- [ ] Click fullscreen toggle → chat expands to full viewport with reading-width container
- [ ] Click minimize toggle → returns to 500px overlay
- [ ] Send message in panel mode → bubble shape correct
- [ ] Send message in fullscreen → bubble shape correct
- [ ] Empty state shows welcoming design
- [ ] Suggested questions pills styled correctly
- [ ] Close chat → panel disappears

### Step 8.6: Deploy to production

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

### Step 8.7: Production visual verification

- [ ] Visit `https://cl.zyroi.com` in light mode
- [ ] Visit `https://cl.zyroi.com` in dark mode (toggle OS/browser setting)
- [ ] Navigate all pages
- [ ] Open and use chat

**Checkpoint**: Commit with message `docs: mark Plan 014 as COMPLETE`

---

## Complete File Inventory

### New Files (1)
| File | Purpose |
|------|---------|
| `src/components/ui/container.tsx` | Adaptive container component |

### Modified Files (~45)

**Config & Assets (5)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 1 | `src/index.css` | 1 | CSS custom properties (light + dark) |
| 2 | `tailwind.config.js` | 2, 3 | Primary palette, darkMode, remove indigo |
| 3 | `public/manifest.webmanifest` | 3 | theme_color hex |
| 4 | `public/icon.svg` | 3 | Fill hex |
| 5 | `public/unregister-sw.html` | 3 | Inline style hex |

**Store (2)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 6 | `src/stores/appStore.ts` | 4 | Remove broken class-based theme toggle |
| 7 | `src/stores/uiStore.ts` | 7 | Add chatFullscreen state |

**Layout (1)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 8 | `src/AppWithAuth.tsx` | 3, 5, 7 | Container, header, chat fullscreen |

**UI Primitives (5)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 9 | `src/components/ui/button.tsx` | 3 | indigo→primary |
| 10 | `src/components/ui/badge.tsx` | 3 | indigo→primary |
| 11 | `src/components/ui/input.tsx` | 3 | indigo→primary |
| 12 | `src/components/ui/tooltip.tsx` | 4 | Dark mode fix |
| 13 | `src/components/ui/alert.tsx` | 4 | Dark mode fix |

**Home (7)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 14 | `src/components/HomePage.tsx` | 3, 6 | Spinner, loading state |
| 15 | `src/components/home/HeroSection.tsx` | 3, 6 | Gradient, padding, text |
| 16 | `src/components/home/TopicFilter.tsx` | 3, 6 | Pill colors |
| 17 | `src/components/home/FindingsHighlights.tsx` | 3, 6 | Card treatment |
| 18 | `src/components/home/DigestSignposts.tsx` | 3, 6 | Card treatment |
| 19 | `src/components/home/ContextualCTAs.tsx` | 3, 6 | Card treatment |
| 20 | `src/components/home/ActivityChart.tsx` | 3, 6 | Hex colors, wrapper |

**Research/Findings (8)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 21 | `src/components/research/ResearchContainer.tsx` | 4 | Dark mode |
| 22 | `src/components/research/findings/FindingsGrid.tsx` | 4, 6 | 2-column grid, dark |
| 23 | `src/components/research/findings/FindingCard.tsx` | 6 | Card treatment |
| 24 | `src/components/research/findings/FindingsEmpty.tsx` | 4 | Dark mode |
| 25 | `src/components/research/digest/DigestPanel.tsx` | 6 | Card treatment |
| 26 | `src/components/DigestCard.tsx` | 3, 4, 6 | Colors, dark, borders |
| 27 | `src/components/research/drawers/SourceDrawer.tsx` | 4, 6 | Dark, rounded |
| 28 | `src/components/research/drawers/FindingDetailDrawer.tsx` | 3, 6 | Colors, rounded |

**Topics (1)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 29 | `src/components/TopicManager.tsx` | 3, 6 | Card gallery grid |

**Agents (2)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 30 | `src/components/agents/AgentMonitor.tsx` | 3, 6 | Colors, card treatment |
| 31 | `src/components/agents/AgentConfigModal.tsx` | 3, 6 | Colors, modal |

**Chat (4)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 32 | `src/components/ChatPanel.tsx` | 4, 7 | Fullscreen, empty state |
| 33 | `src/components/ChatMessage.tsx` | 4, 7 | Bubble redesign |
| 34 | `src/components/ChatInput.tsx` | 4, 7 | Input refinement |
| 35 | `src/components/chat/SuggestedQuestions.tsx` | 4, 7 | Pill refinement |

**Notifications (1)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 36 | `src/components/NotificationCenter.tsx` | 3 | Colors |

**Auth — minimal (3)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 37 | `src/components/auth/LoginPage.tsx` | 3 | Color only |
| 38 | `src/components/auth/RegisterPage.tsx` | 3 | Color only |
| 39 | `src/components/auth/AuthGuard.tsx` | 3 | Spinner color |

**Other (6)**:
| # | File | Phase | Changes |
|---|------|-------|---------|
| 40 | `src/components/digest/FeaturedDiscovery.tsx` | 4 | Dark mode |
| 41 | `src/components/digest/SourceStatsBar.tsx` | 4 | Dark mode |
| 42 | `src/components/FindingsMetricsExplainer.tsx` | 4 | Dark mode |
| 43 | `src/components/CitationLink.tsx` | 4 | Dark mode |
| 44 | `src/components/TranscriptionSummary.tsx` | 3 | Colors |
| 45 | `src/App.tsx` | 3 | Colors (if still has indigo) |

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Removing `indigo` from Tailwind breaks all pages simultaneously | HIGH | Two-pass approach: add `primary` first (Phase 2), migrate all files (Phase 3), THEN remove `indigo` (Phase 3 Step 3.8) |
| CSS custom properties don't resolve in Recharts SVG | MEDIUM | Use hardcoded hex `#2054d9` for Recharts — documented in Step 3.7 |
| Dark palette number inversion confuses agents | MEDIUM | Clearly documented: `primary-50` = subtle background in BOTH themes. The CSS variable handles the actual value. |
| 2-column grid too cramped with chat panel open | LOW | At 1440px - 500px = 940px, below `lg` (1024px), grid auto-falls to 1 column. Works correctly. |
| `appStore.ts` theme removal breaks settings UI | LOW | We make `applyTheme` a no-op, NOT delete it. Any code calling `setTheme` still works, just does nothing. |
| Inline HTML in ChatMessage has hardcoded colors | MEDIUM | Citation button classes in `formattedContent` are string-built. Ensure those class names are in Tailwind's content scan (they are, since they appear in .tsx files scanned by Tailwind). |
| `manifest.webmanifest` theme_color must be hex | LOW | Use `#2054D9`, not a CSS variable. Documented in Step 3.7. |

---

## Rollback Plan

If the overhaul causes issues:

1. **Git revert**: All changes are in a single branch `feat/ui-overhaul`. Revert to previous commit on `feat/home-redesign`.
2. **Selective rollback**: Each phase has a checkpoint commit. Can revert to any phase boundary.
3. **Tailwind fallback**: If `primary` palette has issues, temporarily re-add `indigo` to tailwind.config.js — all old class names still work.
4. **Dark mode disable**: Set `darkMode: false` in tailwind.config.js to disable all `dark:` variants instantly.

---

## Sign-Off Checklist

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | CSS Design Tokens (light + dark) | ⬜ Pending | |
| 2 | Tailwind Config + Container Component | ⬜ Pending | |
| 3 | Color Migration (indigo → primary) | ⬜ Pending | |
| 4 | Dark Mode Fix + Theme Store Cleanup | ⬜ Pending | |
| 5 | Adaptive Layout + Header Polish | ⬜ Pending | |
| 6 | Page Visual Refresh | ⬜ Pending | |
| 7 | Chat Panel Redesign | ⬜ Pending | |
| 8 | Build Verification & Deployment | ⬜ Pending | |

---

*Created: February 8, 2026*
*Author: Claude Opus 4.6*
*Predecessor: Plan 013 (Dashboard Home Redesign - Complete)*
