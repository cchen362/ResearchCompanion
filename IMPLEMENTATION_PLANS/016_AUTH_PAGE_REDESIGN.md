# Plan 016 — Auth Page UI Redesign

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for Plan 016 — redesigning the authentication page from two plain form pages into a single polished split-layout page with a pill toggle tab switcher, abstract gradient branding panel, and ghosted app preview.**

**This is a UI/UX-only change. ZERO functionality changes to authentication logic.**

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

### Workflow
```
+---------------------------------------------------------------+
| PHASES 1-4: LOCAL DEVELOPMENT                                 |
| - Implement ALL phases locally                                |
| - Run `npm run build` after EACH frontend file change         |
| - Verify NO compile errors before proceeding                  |
| - Commit changes to git after each phase                      |
+---------------------------+-----------------------------------+
                            |
+---------------------------------------------------------------+
| PHASE 5: BUILD VERIFICATION & DEPLOYMENT                      |
| - Frontend: npm run build                                     |
| - Visual verification at all breakpoints + dark mode          |
| - Deploy to Debian server                                     |
| - Production visual verification                              |
+---------------------------------------------------------------+
```

---

## Current Status

- **Phase**: NOT STARTED
- **Created**: February 8, 2026
- **Priority**: HIGH
- **Branch**: `feat/ui-overhaul`
- **Predecessor**: Plan 015b (Layout & Spatial Design Refinements -- Complete)

---

## What This Plan Changes

### Before (Current State)
- **Two separate pages**: `LoginPage.tsx` and `RegisterPage.tsx`
- Simple centered white card on `bg-gradient-to-br from-blue-50 to-primary-100`
- Heart icon + heading + form + link to other page + privacy notice
- Hardcoded Tailwind colors (gray-300, blue-500) instead of design tokens
- Browser tab shows "medical-companion-pwa" with Vite logo favicon

### After (Target State)
- **Single unified `AuthPage.tsx`** with pill toggle between Sign In / Create Account
- **Desktop (lg+)**: Clean split layout -- left branding panel (45%) + right form panel (55%)
- **Left panel**: Animated indigo gradient + ghosted stylized digest card wireframe + branding + feature callouts
- **Right panel**: Pill toggle + form + privacy notice
- **Mobile**: Single column -- compact header (icon + tagline) above the form
- **Design tokens**: All styling uses `var(--color-*)` for proper dark mode support
- Browser tab shows "MedCompanion" with the app's blue medical cross favicon

---

## Workshop Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout style | Clean split (SaaS-style) | Professional, modern -- like Linear, Notion, Vercel |
| Page structure | Single page with pill toggle | Less friction, more polished feel |
| Copy weight | Subtle & minimal | Users already know the app; clean entry point |
| Left panel content | Gradient art + ghosted digest card + feature callouts | Visual interest without being noisy |
| Tab switcher | iOS-style pill/segment control | Modern, compact, smooth animation |
| Mobile behavior | Collapse to single column | Hide left panel, show compact header above form |
| Headline | "AI agents research while you rest." | Feature-forward, action-oriented |
| Feature callouts | 3 concise icon+text pairs | Highlights killer features without being salesy |
| Ghosted preview | Stylized digest card wireframe | Recognizable as content without being readable |
| Tab title | "MedCompanion" | Short, brandable |
| Favicon | `/icon.svg` (app's blue medical cross) | Replace Vite logo |
| New npm deps | NONE | All features use existing utilities |

---

## Finalized Copy

### Left Panel (Desktop)

**Top**: App icon (`/icon.svg`) + "MedCompanion"

**Center**:
- **Headline**: "AI agents research while you rest."
- **Subtitle**: "Smart digests delivered on your schedule."
- **Feature callouts** (3 icon+text pairs, small):
  1. BookOpen icon -- "PubMed, trials & FDA scanned daily"
  2. Brain icon -- "Smart digests with explained mode"
  3. MessageSquare icon -- "Chat companion with cited answers"

**Bottom**: "Medical Research Companion" (subtle attribution, `text-white/30`)

### Mobile Header

App icon + "MedCompanion" + "Autonomous medical research for caregivers"

---

## MUST DO Rules

- [ ] Follow phases IN ORDER -- do not skip
- [ ] Run `npm run build` after EACH file change
- [ ] Use design tokens (`var(--color-*)`) for ALL colors -- no hardcoded Tailwind colors
- [ ] Test dark mode after each phase
- [ ] Test mobile layout (375px) after each phase
- [ ] Preserve ALL existing auth logic verbatim (handlers, validation, authService calls)
- [ ] Keep email + password state shared between tabs (user-friendly on tab switch)
- [ ] Use `window.history.replaceState()` for URL sync (not `navigate()`)

## MUST NOT DO Rules

- [ ] Do NOT change `AuthGuard.tsx`
- [ ] Do NOT change `auth.service.ts`
- [ ] Do NOT change any backend code
- [ ] Do NOT modify form validation logic
- [ ] Do NOT add new npm dependencies
- [ ] Do NOT use emojis in the component code (use Lucide icons instead)
- [ ] Do NOT add features beyond what's specified (no "forgot password", no social login, etc.)
- [ ] Do NOT use gradient buttons (use solid `var(--color-primary)` for modern SaaS feel)

---

## Files to Change

| File | Action | Phase |
|------|--------|-------|
| `index.html` | **MODIFY** -- fix title + favicon | 1 |
| `src/index.css` | **MODIFY** -- append gradient animation | 1 |
| `src/components/auth/AuthPage.tsx` | **CREATE** -- unified auth page (~240 lines) | 2 |
| `src/AppWithAuth.tsx` | **MODIFY** -- swap imports + routes | 3 |
| `src/components/auth/LoginPage.tsx` | **DELETE** | 3 |
| `src/components/auth/RegisterPage.tsx` | **DELETE** | 3 |

**NOT changed**: `AuthGuard.tsx`, `auth.service.ts`, any backend code.

---

## Phase 1: Browser Tab Fix + CSS Foundation

**Goal**: Fix the browser tab title/favicon and add the gradient animation CSS needed for the left panel.

### Step 1.1: Fix Browser Tab Title and Favicon

**File**: `index.html`

**Change 1** -- Line 5, replace favicon:
```html
<!-- FIND: -->
<link rel="icon" type="image/svg+xml" href="/vite.svg" />

<!-- REPLACE WITH: -->
<link rel="icon" type="image/svg+xml" href="/icon.svg" />
```

**Change 2** -- Line 7, replace title:
```html
<!-- FIND: -->
<title>medical-companion-pwa</title>

<!-- REPLACE WITH: -->
<title>MedCompanion</title>
```

**Verification**: Open the app in browser -- tab should show "MedCompanion" with the blue medical cross icon.

### Step 1.2: Add Gradient Animation CSS

**File**: `src/index.css`

Append at the END of the file (after the existing `.scrollbar-hide` block):

```css
/* Auth page gradient animation (Plan 016) */
@keyframes auth-gradient-shift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.auth-gradient-bg {
  background: linear-gradient(
    135deg,
    var(--color-primary-800) 0%,
    var(--color-primary-600) 30%,
    var(--color-primary-700) 60%,
    var(--color-primary-900) 100%
  );
  background-size: 200% 200%;
  animation: auth-gradient-shift 15s ease-in-out infinite;
}

@media (prefers-color-scheme: dark) {
  .auth-gradient-bg {
    background: linear-gradient(
      135deg,
      #0f1a2e 0%,
      #1c3160 30%,
      #152240 60%,
      #0a0e13 100%
    );
    background-size: 200% 200%;
  }
}
```

**Why hardcode dark mode?** The design tokens invert in dark mode (primary-800 becomes light blue `#c8d9fc`), which would make the gradient panel bright. We explicitly keep it dark.

**Verification**: `npm run build` -- no errors.

**Checkpoint**: Commit with message `fix: update browser tab title and favicon, add auth gradient CSS (Plan 016)`

---

## Phase 2: Create AuthPage Component

**Goal**: Build the unified AuthPage.tsx component with split layout, pill toggle, and both forms.

### Step 2.1: Create `src/components/auth/AuthPage.tsx`

**CREATE new file**: `src/components/auth/AuthPage.tsx`

#### Component Structure

```
AuthPage
|-- Left branding panel (hidden below lg)
|   |-- Animated gradient background (.auth-gradient-bg)
|   |-- Dot grid pattern overlay (radial-gradient, opacity-[0.04])
|   |-- Ghosted digest card wireframe (CSS-only, opacity-[0.1])
|   |-- Branding overlay (z-10):
|       |-- Top: icon.svg + "MedCompanion"
|       |-- Center: headline + subtitle + 3 feature callouts
|       |-- Bottom: "Medical Research Companion" attribution
|
|-- Right form panel (flex-1)
    |-- Mobile header (lg:hidden -- icon + name + tagline)
    |-- Pill toggle (Sign In | Create Account)
    |-- Error alert (conditional)
    |-- Login form OR Register form (conditional on activeTab)
    |-- Privacy notice text
```

#### Key Implementation Details

**Imports**:
```tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { AlertCircle, Loader2, LogIn, UserPlus, CheckCircle, BookOpen, Brain, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
```

**State management**:
```tsx
type AuthTab = 'login' | 'register';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab: AuthTab = location.pathname === '/register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Shared form state (email + password carry over between tabs)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
```

**Tab switching** -- clears error + confirmPassword, preserves email + password, updates URL cosmetically:
```tsx
  const handleTabSwitch = (tab: AuthTab) => {
    setActiveTab(tab);
    setError('');
    setConfirmPassword('');
    window.history.replaceState(null, '', tab === 'login' ? '/login' : '/register');
  };
```

**Why `replaceState` not `navigate`**: React Router's `navigate()` would trigger a route rematch and potentially reset component state. `replaceState` updates the URL bar cosmetically since both `/login` and `/register` render the same `<AuthPage />`.

**Auth handlers** -- copied VERBATIM from current LoginPage/RegisterPage:
```tsx
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await authService.register({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { met: password.length >= 6, text: 'At least 6 characters' },
    { met: password === confirmPassword && password.length > 0, text: 'Passwords match' },
  ];
```

#### Top-Level JSX Layout

```tsx
  return (
    <div className="min-h-screen flex bg-[var(--color-surface)]">
      {/* LEFT: Branding Panel -- hidden below lg */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* ... (see Left Panel section below) */}
      </div>

      {/* RIGHT: Form Panel -- full width on mobile, 55% on lg+ */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile header (lg:hidden) */}
          {/* Pill toggle */}
          {/* Error display */}
          {/* Active form (login or register) */}
          {/* Privacy notice */}
        </div>
      </div>
    </div>
  );
```

#### Left Branding Panel (Desktop Only)

```tsx
<div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
  {/* 1. Animated gradient base */}
  <div className="absolute inset-0 auth-gradient-bg" aria-hidden="true" />

  {/* 2. Dot grid pattern for texture */}
  <div
    className="absolute inset-0 opacity-[0.04]"
    style={{
      backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
      backgroundSize: '24px 24px',
    }}
    aria-hidden="true"
  />

  {/* 3. Ghosted stylized digest card wireframe */}
  <div className="absolute inset-0 flex items-center justify-center p-12" aria-hidden="true">
    <div className="w-full max-w-xs opacity-[0.1]">
      {/* Card chrome */}
      <div className="rounded-t-xl border border-white/30 bg-white/5 px-4 py-3">
        <div className="h-4 w-32 rounded bg-white/20 mb-3" />
        <div className="h-2 w-full rounded bg-white/10" />
      </div>
      {/* Card body with digest-like sections */}
      <div className="border border-t-0 border-white/30 bg-white/5 rounded-b-xl p-4 space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-400/40" />
          <div className="h-2.5 w-24 rounded bg-white/15" />
        </div>
        {/* Bullet points */}
        <div className="space-y-2 pl-5">
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-4/5 rounded bg-white/10" />
          <div className="h-2 w-11/12 rounded bg-white/10" />
        </div>
        {/* Section divider */}
        <div className="border-t border-white/10" />
        {/* Another section */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400/40" />
          <div className="h-2.5 w-28 rounded bg-white/15" />
        </div>
        <div className="space-y-2 pl-5">
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-3/4 rounded bg-white/10" />
        </div>
        {/* Source pills row */}
        <div className="flex gap-2 pt-2">
          <div className="h-5 w-16 rounded-full bg-blue-400/20 border border-blue-300/20" />
          <div className="h-5 w-14 rounded-full bg-green-400/20 border border-green-300/20" />
          <div className="h-5 w-12 rounded-full bg-purple-400/20 border border-purple-300/20" />
        </div>
      </div>
    </div>
  </div>

  {/* 4. Branding content overlay */}
  <div className="relative z-10 flex flex-col justify-between p-10 h-full">
    {/* Top: Logo + Name */}
    <div className="flex items-center gap-3">
      <img src="/icon.svg" alt="" className="w-10 h-10 rounded-xl" />
      <span className="text-white/90 font-semibold text-lg tracking-tight">MedCompanion</span>
    </div>

    {/* Center: Headline + Subtitle + Feature callouts */}
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-white text-3xl font-bold leading-tight">
          AI agents research<br />while you rest.
        </h2>
        <p className="text-white/50 text-base">
          Smart digests delivered on your schedule.
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-white/70 text-sm">
          <BookOpen className="w-4 h-4 text-white/50 shrink-0" />
          <span>PubMed, trials & FDA scanned daily</span>
        </div>
        <div className="flex items-center gap-3 text-white/70 text-sm">
          <Brain className="w-4 h-4 text-white/50 shrink-0" />
          <span>Smart digests with explained mode</span>
        </div>
        <div className="flex items-center gap-3 text-white/70 text-sm">
          <MessageSquare className="w-4 h-4 text-white/50 shrink-0" />
          <span>Chat companion with cited answers</span>
        </div>
      </div>
    </div>

    {/* Bottom: Attribution */}
    <p className="text-white/30 text-xs">Medical Research Companion</p>
  </div>
</div>
```

#### Mobile Header (Below lg)

```tsx
<div className="lg:hidden flex flex-col items-center mb-8">
  <img src="/icon.svg" alt="" className="w-12 h-12 rounded-2xl mb-3" />
  <h1 className="text-xl font-bold text-[var(--color-text-primary)]">MedCompanion</h1>
  <p className="text-sm text-[var(--color-text-muted)] mt-1 text-center">
    Autonomous medical research for caregivers
  </p>
</div>
```

#### Pill Toggle (Segmented Control)

```tsx
<div className="relative flex bg-[var(--color-surface-sunken)] rounded-full p-1 mb-6">
  {/* Sliding background indicator */}
  <div
    className={cn(
      'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-out',
      'bg-[var(--color-surface)] shadow-sm',
      activeTab === 'register' && 'translate-x-[calc(100%+4px)]'
    )}
    aria-hidden="true"
  />
  <button
    type="button"
    onClick={() => handleTabSwitch('login')}
    className={cn(
      'relative z-10 flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-200',
      activeTab === 'login'
        ? 'text-[var(--color-text-primary)]'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
    )}
  >
    Sign In
  </button>
  <button
    type="button"
    onClick={() => handleTabSwitch('register')}
    className={cn(
      'relative z-10 flex-1 py-2 text-sm font-medium rounded-full transition-colors duration-200',
      activeTab === 'register'
        ? 'text-[var(--color-text-primary)]'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
    )}
  >
    Create Account
  </button>
</div>
```

**How the sliding indicator works**: Parent is `relative` with `p-1` padding. Indicator is `absolute` at `top-1 bottom-1`, width `calc(50% - 4px)` (half minus padding). Default position: left (login). On register: `translate-x-[calc(100%+4px)]` slides it right. `transition-transform duration-300 ease-out` creates the smooth slide.

#### Input Styling (Design Tokens)

Define a shared class string for all input fields:

```tsx
const inputClasses = cn(
  'w-full px-4 py-2.5 rounded-[var(--radius-md)]',
  'bg-[var(--color-surface)]',
  'border border-[var(--color-border)]',
  'text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:border-[var(--color-primary-400)]',
  'transition-colors duration-[var(--duration-fast)]',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);
```

#### Submit Button Styling (Solid Primary)

```tsx
const submitButtonClasses = cn(
  'w-full py-3 px-4 rounded-[var(--radius-md)]',
  'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]',
  'font-semibold text-sm',
  'hover:opacity-90',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)] focus:ring-offset-2',
  'transition-all duration-[var(--duration-fast)]',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);
```

**No gradient** -- solid `var(--color-primary)` is cleaner, more modern SaaS feel.

#### Login Form

```tsx
{activeTab === 'login' && (
  <form onSubmit={handleLogin} className="space-y-5 animate-fadeIn" key="login">
    <div>
      <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        Email Address
      </label>
      <input
        id="email" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)}
        required className={inputClasses}
        placeholder="you@example.com" disabled={loading}
      />
    </div>
    <div>
      <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        Password
      </label>
      <input
        id="password" type="password" value={password}
        onChange={(e) => setPassword(e.target.value)}
        required className={inputClasses}
        placeholder="--------" disabled={loading}
      />
    </div>
    <button type="submit" disabled={loading} className={submitButtonClasses}>
      {loading ? (
        <span className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Signing in...
        </span>
      ) : (
        <span className="flex items-center justify-center">
          <LogIn className="w-5 h-5 mr-2" />
          Sign In
        </span>
      )}
    </button>
  </form>
)}
```

#### Register Form

```tsx
{activeTab === 'register' && (
  <form onSubmit={handleRegister} className="space-y-5 animate-fadeIn" key="register">
    <div>
      <label htmlFor="reg-email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        Email Address
      </label>
      <input
        id="reg-email" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)}
        required className={inputClasses}
        placeholder="you@example.com" disabled={loading}
      />
    </div>
    <div>
      <label htmlFor="reg-password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        Password
      </label>
      <input
        id="reg-password" type="password" value={password}
        onChange={(e) => setPassword(e.target.value)}
        required className={inputClasses}
        placeholder="--------" disabled={loading}
      />
    </div>
    <div>
      <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        Confirm Password
      </label>
      <input
        id="confirmPassword" type="password" value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required className={inputClasses}
        placeholder="--------" disabled={loading}
      />
    </div>
    {/* Password requirements -- identical logic from RegisterPage */}
    {password.length > 0 && (
      <div className="space-y-1.5">
        {passwordRequirements.map((req, index) => (
          <div key={index} className="flex items-center gap-2">
            <CheckCircle
              className={cn(
                'w-4 h-4 transition-colors',
                req.met ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
              )}
            />
            <span
              className={cn(
                'text-sm',
                req.met ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
              )}
            >
              {req.text}
            </span>
          </div>
        ))}
      </div>
    )}
    <button
      type="submit"
      disabled={loading || !passwordRequirements.every(req => req.met)}
      className={submitButtonClasses}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Creating account...
        </span>
      ) : (
        <span className="flex items-center justify-center">
          <UserPlus className="w-5 h-5 mr-2" />
          Create Account
        </span>
      )}
    </button>
  </form>
)}
```

**Note**: Register form uses `id="reg-email"` and `id="reg-password"` to avoid ID collisions with the login form's `id="email"` and `id="password"`. Even though only one form renders at a time, unique IDs are better practice for accessibility.

#### Error Display

```tsx
{error && (
  <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start gap-2.5 animate-fadeIn">
    <AlertCircle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
    <p className="text-sm text-[var(--color-error)]">{error}</p>
  </div>
)}
```

#### Privacy Notice

```tsx
<div className="mt-8 text-center">
  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
    Your data is encrypted and stored securely.<br />
    We never share your health information.
  </p>
</div>
```

Clean text block, no colored background box.

**Verification**: `npm run build` -- no errors.

**Checkpoint**: Commit with message `feat(auth): create unified AuthPage with split layout and pill toggle (Plan 016)`

---

## Phase 3: Routing Update & Cleanup

**Goal**: Update AppWithAuth.tsx routing and delete old auth page files.

### Step 3.1: Update Routing in AppWithAuth.tsx

**File**: `src/AppWithAuth.tsx`

**Change 1** -- Replace imports (lines 13-14):
```tsx
// DELETE these lines:
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';

// ADD this line:
import { AuthPage } from './components/auth/AuthPage';
```

**Change 2** -- Replace route elements (lines 401-402):
```tsx
// FIND:
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />

// REPLACE WITH:
<Route path="/login" element={<AuthPage />} />
<Route path="/register" element={<AuthPage />} />
```

Both routes render the same component. `AuthPage` reads `location.pathname` to determine the initial active tab.

### Step 3.2: Delete Old Auth Files

- **DELETE**: `src/components/auth/LoginPage.tsx`
- **DELETE**: `src/components/auth/RegisterPage.tsx`

### Step 3.3: Phase 3 Build Verification

```bash
npm run build
```

Must produce zero errors.

**Checkpoint**: Commit with message `refactor(auth): replace LoginPage/RegisterPage with unified AuthPage (Plan 016)`

---

## Phase 4: Visual Verification & Polish

**Goal**: Comprehensive visual testing at all breakpoints and modes.

### Step 4.1: Desktop Layout (lg+, 1024px+)

- [ ] Split layout visible: left panel ~45%, right panel ~55%
- [ ] Left panel: animated gradient background shifts slowly
- [ ] Left panel: dot grid texture visible at subtle opacity
- [ ] Left panel: ghosted digest card wireframe visible behind text
- [ ] Left panel: app icon + "MedCompanion" at top
- [ ] Left panel: headline "AI agents research while you rest." centered
- [ ] Left panel: subtitle below headline in softer white
- [ ] Left panel: 3 feature callouts with icons below subtitle
- [ ] Left panel: "Medical Research Companion" at bottom in very faint text
- [ ] Right panel: pill toggle centered at top
- [ ] Right panel: "Sign In" tab active by default on `/login`
- [ ] Right panel: "Create Account" tab active by default on `/register`

### Step 4.2: Pill Toggle

- [ ] Clicking "Create Account" slides indicator smoothly to the right
- [ ] Clicking "Sign In" slides indicator smoothly to the left
- [ ] URL bar updates when switching tabs (`/login` <-> `/register`)
- [ ] Email and password fields persist when switching tabs
- [ ] Confirm password clears when switching to Sign In tab
- [ ] Error message clears when switching tabs

### Step 4.3: Login Form

- [ ] Email + password fields with design token styling
- [ ] "Sign In" button with solid primary color (no gradient)
- [ ] Loading state shows spinner + "Signing in..."
- [ ] Error display works (try wrong credentials)
- [ ] Successful login navigates to home page

### Step 4.4: Register Form

- [ ] Email + password + confirm password fields
- [ ] Password requirements appear when password has content
- [ ] CheckCircle turns green when requirement is met
- [ ] Button disabled until all requirements met
- [ ] Loading state shows spinner + "Creating account..."
- [ ] Error display works
- [ ] Successful registration navigates to home page

### Step 4.5: Mobile Layout (< 1024px)

- [ ] Left panel hidden completely
- [ ] Mobile header visible: icon + "MedCompanion" + tagline
- [ ] Form centered with `max-w-md`
- [ ] Pill toggle works on mobile
- [ ] Forms render cleanly at 375px width

### Step 4.6: Dark Mode

- [ ] Right panel: surface color, text colors, border colors all correct
- [ ] Right panel: input fields readable with proper contrast
- [ ] Right panel: submit button visible with correct colors
- [ ] Left panel: gradient stays dark (not inverted to light blue)
- [ ] Left panel: ghosted wireframe visible against dark gradient
- [ ] Left panel: white text readable
- [ ] Error display: red tones appropriate for dark mode
- [ ] Password requirements: green tones appropriate for dark mode

### Step 4.7: Edge Cases

- [ ] Browser refresh on `/register` stays on register tab
- [ ] Typing `/login` in URL bar goes to Sign In tab
- [ ] Typing `/register` in URL bar goes to Create Account tab
- [ ] Logout (from app) redirects to `/login` correctly
- [ ] AuthGuard redirect (expired token) goes to `/login` correctly
- [ ] Browser tab shows "MedCompanion" with blue medical cross icon

---

## Phase 5: Deployment

### Step 5.1: Final Build

```bash
npm run build
```

Zero errors, zero warnings.

### Step 5.2: Deploy to Production

```bash
# Push changes
git push origin feat/ui-overhaul

# SSH to server
ssh chee@100.94.82.35

# Pull and rebuild
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build

# Check logs
docker logs medical-companion --tail 20 2>&1
```

### Step 5.3: Production Verification

- [ ] Navigate to production URL -- see auth page with split layout
- [ ] Login works
- [ ] Register works
- [ ] Dark mode works
- [ ] Mobile layout works
- [ ] Browser tab shows "MedCompanion"

**Checkpoint**: Commit with message `docs: mark Plan 016 as COMPLETE`

---

## Pitfalls & Mitigations

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| `navigate()` resets state on tab switch | Tab switch would lose form data | Use `window.history.replaceState()` instead |
| Form `id` collisions between tabs | Accessibility issues | Use `reg-email`/`reg-password` for register form |
| Dark mode gradient inversion | Left panel becomes bright blue | Hardcoded dark override in `.auth-gradient-bg` |
| Logout redirect breaks | User stuck after logout | `/login` still valid route, renders `AuthPage` |
| AuthGuard redirect breaks | Infinite redirect loop | AuthGuard redirects to `/login`, still renders `AuthPage` |
| `cn` utility not found | Build failure | Already exists at `src/lib/utils.ts`, already used in app |

---

## Responsive Behavior Summary

| Breakpoint | Layout | Left Panel | Mobile Header |
|------------|--------|------------|---------------|
| < 1024px (below lg) | Single column, `max-w-md` centered | Hidden | Visible |
| >= 1024px (lg+) | Side-by-side 45%/55% split | Visible | Hidden |

---

## Rollback Plan

If issues arise:
1. **Git revert**: Revert to the commit before Plan 016
2. **Quick fix**: Restore `LoginPage.tsx` and `RegisterPage.tsx` from git history, revert `AppWithAuth.tsx` imports
3. **Tab title**: Revert `index.html` changes independently if needed
4. The CSS additions in `index.css` are harmless (unused classes) and can be left or removed

---

## Sign-Off Checklist

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | Browser Tab Fix + CSS Foundation | Not Started | |
| 2 | Create AuthPage Component | Not Started | |
| 3 | Routing Update & Cleanup | Not Started | |
| 4 | Visual Verification & Polish | Not Started | |
| 5 | Deployment | Not Started | |

---

*Created: February 8, 2026*
*Author: Claude Opus 4.6*
*Predecessor: Plan 015b (Layout & Spatial Design Refinements -- Complete)*
