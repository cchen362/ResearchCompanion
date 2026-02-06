# 010 - Unify Finding Labels to Source-Based Categories

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for unifying finding labels across the UI. Currently, the digest shows "PubMed / Clinical / Web" but the findings list shows "study / trial / treatment" — confusing and inconsistent. This plan aligns everything to source-based labels.**

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
│ - Run `npm run build` after each file change                     │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: BUILD VERIFICATION                                      │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build (sanity check only)       │
│ - Fix any errors before proceeding                               │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: DEPLOYMENT TO DEBIAN SERVER                             │
│ - Push changes to remote repository                              │
│ - SSH into Debian server                                         │
│ - Pull updated repository                                        │
│ - Rebuild Docker containers                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: PRODUCTION VERIFICATION                                 │
│ - Hard refresh browser                                           │
│ - Verify labels, colors, filtering, and sorting all work         │
│ - Document any issues in this file                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: Ready for Implementation
- **Created**: February 7, 2026
- **Priority**: LOW - UX polish, no functionality impact
- **Branch**: `fix/digest-findings-race-condition` (existing)
- **Predecessor**: Plan 009 (Digest Generation Timeout Fix) - Deployed

---

## Problem Analysis

### The Two Taxonomy Problem

The system has two independent labeling systems that don't align:

| Location | Current Labels | Derived From |
|----------|----------------|--------------|
| Digest source breakdown | **PubMed** (blue), **Clinical** (green), **Web** (gray) | `source.type` |
| Finding list badges | "study", "trial", "treatment", "guideline", "news" | `finding.type` |
| Filter dropdown | Studies, Clinical Trials, Treatments, Guidelines, News | `finding.type` |
| Left border color | Blue, Green, Purple, Gray | `source.type` ✅ |

### Source Type Values Actually Created by Backend

From `backend/src/services/agent-execution.service.ts` (lines 399-445):

| Agent Type | `source.type` Set | `source.name` Set |
|------------|-------------------|-------------------|
| `pubmed` | `'research_article'` | `'PubMed'` |
| `clinical_trials` | `'clinical_trial'` | `'ClinicalTrials.gov'` |
| `web` | `'web_article'` | `'Web'` |
| default | `'unknown'` | `'Unknown Source'` |

### Existing Canonical Config: `SourceIcon.tsx`

`src/components/digest/SourceIcon.tsx` (lines 12-42) already has the **canonical config** we will reuse:

```typescript
const SOURCE_CONFIG: Record<DigestSourceType, {
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  label: string;
}> = {
  pubmed:         { icon: BookOpen,      color: 'text-blue-600',   bgColor: 'bg-blue-100',   label: 'PubMed' },
  clinical_trial: { icon: FlaskConical,  color: 'text-green-600',  bgColor: 'bg-green-100',  label: 'Clinical Trial' },
  fda:            { icon: Shield,        color: 'text-purple-600', bgColor: 'bg-purple-100',  label: 'FDA' },
  web:            { icon: Globe,         color: 'text-gray-600',   bgColor: 'bg-gray-100',    label: 'Web' },
};
```

This is **already exported** on line 70: `export { SOURCE_CONFIG };`

### Mapping Logic (Must Be Consistent Everywhere)

The substring-based mapping from `source.type` → `DigestSourceType`:

| `source.type` contains... | Maps to | Display Label |
|---------------------------|---------|---------------|
| `'pubmed'`, `'research'`, `'journal'`, `'academic'` | `'pubmed'` | PubMed |
| `'clinical'`, `'trial'` | `'clinical_trial'` | Clinical Trial |
| `'fda'` | `'fda'` | FDA |
| anything else (including undefined) | `'web'` | Web |

This logic already exists in:
- `SourceDrawer.tsx` lines 162-168 (border colors)
- `digest-processor.service.ts` lines 36-46 (backend source breakdown)

We will centralize it into ONE utility function.

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `npm run build` after EACH phase
- [ ] Reuse `SOURCE_CONFIG` from `SourceIcon.tsx` — do NOT duplicate colors/icons
- [ ] Use the centralized `getSourceCategory()` function for ALL mappings
- [ ] Preserve the exact substring-matching logic from the existing `getSourceBorderColor()` function

## MUST NOT DO Rules

- [ ] Do NOT modify any backend files
- [ ] Do NOT change the database schema
- [ ] Do NOT modify `finding.type` values
- [ ] Do NOT change `SourceIcon.tsx` (it's already correct, just import from it)
- [ ] Do NOT add new npm dependencies
- [ ] Do NOT modify the AI prompt or digest generation

---

## Phase 1: Create Centralized Mapping Utility

**File**: `src/utils/sourceCategory.ts` (NEW FILE)

### Step 1.1: Create the utility file

Create `src/utils/sourceCategory.ts` with this EXACT content:

```typescript
import type { DigestSourceType } from '@/types';

/**
 * Normalize a finding's source.type string into one of the four canonical
 * source categories used throughout the UI.
 *
 * Mapping logic (must stay consistent with digest-processor.service.ts):
 *   'research_article', 'pubmed', 'journal', 'research_paper' → 'pubmed'
 *   'clinical_trial'                                           → 'clinical_trial'
 *   'fda'                                                      → 'fda'
 *   everything else (including 'web_article', undefined)       → 'web'
 */
export function getSourceCategory(sourceType?: string): DigestSourceType {
  const s = (sourceType || '').toLowerCase();

  if (s.includes('pubmed') || s.includes('research') || s.includes('journal') || s === 'academic') {
    return 'pubmed';
  }

  if (s.includes('clinical') || s.includes('trial')) {
    return 'clinical_trial';
  }

  if (s.includes('fda')) {
    return 'fda';
  }

  return 'web';
}
```

### Verification

This function must correctly map all known `source.type` values:

| Input `source.type` | Expected Output | Why |
|---------------------|-----------------|-----|
| `'research_article'` | `'pubmed'` | contains "research" |
| `'pubmed'` | `'pubmed'` | contains "pubmed" |
| `'journal'` | `'pubmed'` | contains "journal" |
| `'research_paper'` | `'pubmed'` | contains "research" |
| `'clinical_trial'` | `'clinical_trial'` | contains "clinical" and "trial" |
| `'fda'` | `'fda'` | contains "fda" |
| `'web_article'` | `'web'` | no match → default |
| `'web'` | `'web'` | no match → default |
| `'medical_site'` | `'web'` | no match → default |
| `'community'` | `'web'` | no match → default |
| `'guidelines'` | `'web'` | no match → default |
| `'unknown'` | `'web'` | no match → default |
| `undefined` | `'web'` | empty string → default |

### Build Verification
```bash
npm run build
# Must exit with code 0
```

- [ ] Phase 1 complete

---

## Phase 2: Update SourceDrawer.tsx

**File**: `src/components/research/drawers/SourceDrawer.tsx`

This is the largest change — 7 precise edits in one file.

### Step 2.1: Add imports

Find this code (lines 8-27):
```typescript
import {
  Search,
  ExternalLink,
  Calendar,
  Users,
  FileText,
  Filter,
  X,
  ChevronRight,
  Building2,
  Pill,
  AlertTriangle,
  BookOpen,
  Copy,
  Download,
  Star
} from 'lucide-react';
import type { ResearchFinding, ResearchSource } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
```

Change to:
```typescript
import {
  Search,
  ExternalLink,
  Calendar,
  Users,
  FileText,
  Filter,
  X,
  ChevronRight,
  Building2,
  Pill,
  AlertTriangle,
  BookOpen,
  FlaskConical,
  Globe,
  Shield,
  Copy,
  Download,
  Star
} from 'lucide-react';
import type { ResearchFinding, ResearchSource } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { getSourceCategory } from '@/utils/sourceCategory';
import { SOURCE_CONFIG } from '@/components/digest/SourceIcon';
```

**Changes**: Added `FlaskConical`, `Globe`, `Shield` to lucide imports. Added `getSourceCategory` and `SOURCE_CONFIG` imports.

### Step 2.2: Update filter logic (line 76)

Find:
```typescript
    const matchesType = selectedType === 'all' || finding.type === selectedType;
```

Change to:
```typescript
    const matchesType = selectedType === 'all' || getSourceCategory(finding.source?.type) === selectedType;
```

### Step 2.3: Update sort-by-type logic (line 87)

Find:
```typescript
      case 'type':
        return a.type.localeCompare(b.type);
```

Change to:
```typescript
      case 'type':
        return getSourceCategory(a.source?.type).localeCompare(getSourceCategory(b.source?.type));
```

### Step 2.4: Replace `getTypeIcon()` function (lines 133-146)

Find:
```typescript
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'treatment':
        return <Pill className="h-4 w-4" />;
      case 'trial':
        return <Building2 className="h-4 w-4" />;
      case 'study':
        return <BookOpen className="h-4 w-4" />;
      case 'guideline':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };
```

Replace with:
```typescript
  const getSourceIcon = (finding: ResearchFinding) => {
    const category = getSourceCategory(finding.source?.type);
    const config = SOURCE_CONFIG[category];
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };
```

### Step 2.5: Simplify `getSourceBorderColor()` (lines 162-168)

Find:
```typescript
  // Source type to border color mapping
  const getSourceBorderColor = (finding: ResearchFinding): string => {
    const type = finding.source?.type?.toLowerCase() || '';
    if (type.includes('pubmed') || type === 'journal' || type === 'research_paper') return 'border-l-4 border-l-blue-500';
    if (type.includes('clinical')) return 'border-l-4 border-l-green-500';
    if (type.includes('fda')) return 'border-l-4 border-l-purple-500';
    return 'border-l-4 border-l-gray-300';
  };
```

Replace with:
```typescript
  // Source type to border color mapping (uses centralized category)
  const getSourceBorderColor = (finding: ResearchFinding): string => {
    const borderColors: Record<string, string> = {
      pubmed: 'border-l-4 border-l-blue-500',
      clinical_trial: 'border-l-4 border-l-green-500',
      fda: 'border-l-4 border-l-purple-500',
      web: 'border-l-4 border-l-gray-300',
    };
    return borderColors[getSourceCategory(finding.source?.type)];
  };
```

### Step 2.6: Update filter dropdown (lines 211-231)

Find:
```html
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="all">All Types</option>
                <option value="treatment">Treatments</option>
                <option value="trial">Clinical Trials</option>
                <option value="study">Studies</option>
                <option value="guideline">Guidelines</option>
                <option value="news">News</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="date">Sort by Date</option>
                <option value="type">Sort by Type</option>
              </select>
```

Replace with:
```html
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="all">All Sources</option>
                <option value="pubmed">PubMed</option>
                <option value="clinical_trial">Clinical Trials</option>
                <option value="fda">FDA</option>
                <option value="web">Web</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 text-sm border rounded-md bg-background"
              >
                <option value="date">Sort by Date</option>
                <option value="type">Sort by Source</option>
              </select>
```

**Changes**: Filter options now use source categories. Sort label changed to "Sort by Source".

### Step 2.7: Update list view badge (lines 258-262)

Find:
```tsx
                              {getTypeIcon(finding.type)}
                              <Badge variant="outline" className="text-xs">
                                {finding.type}
                              </Badge>
```

Replace with:
```tsx
                              {getSourceIcon(finding)}
                              <Badge variant="outline" className="text-xs">
                                {SOURCE_CONFIG[getSourceCategory(finding.source?.type)].label}
                              </Badge>
```

### Step 2.8: Update grouped view badge (lines 472-475)

Find:
```tsx
                                <div className="flex items-center gap-3 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {finding.type}
                                  </Badge>
```

Replace with:
```tsx
                                <div className="flex items-center gap-3 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {SOURCE_CONFIG[getSourceCategory(finding.source?.type)].label}
                                  </Badge>
```

### Build Verification
```bash
npm run build
# Must exit with code 0
```

- [ ] Phase 2 complete

---

## Phase 3: Update FindingCard.tsx

**File**: `src/components/research/findings/FindingCard.tsx`

### Step 3.1: Add imports

Find (lines 10-12):
```typescript
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import type { ResearchFinding } from '@/types';
```

Change to:
```typescript
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import type { ResearchFinding } from '@/types';
import { getSourceCategory } from '@/utils/sourceCategory';
import { SOURCE_CONFIG } from '@/components/digest/SourceIcon';
```

### Step 3.2: Update badge label (line 42)

Find:
```tsx
          <span>{finding.type}</span>
```

Replace with:
```tsx
          <span>{SOURCE_CONFIG[getSourceCategory(finding.source?.type)].label}</span>
```

### Build Verification
```bash
npm run build
# Must exit with code 0
```

- [ ] Phase 3 complete

---

## Phase 4: Update Dashboard.tsx

**File**: `src/components/Dashboard.tsx`

### Step 4.1: Add imports

Find the import section at the top of the file. After the existing imports, add:

```typescript
import { getSourceCategory } from '@/utils/sourceCategory';
import { SOURCE_CONFIG } from '@/components/digest/SourceIcon';
```

### Step 4.2: Update finding label (line 281)

Find:
```tsx
                        <span>{finding.type}</span>
```

Replace with:
```tsx
                        <span>{SOURCE_CONFIG[getSourceCategory(finding.source?.type)].label}</span>
```

### Build Verification
```bash
npm run build
# Must exit with code 0
```

- [ ] Phase 4 complete

---

## Phase 5: Build Verification

Run both builds:

```bash
# Frontend (from project root)
npm run build
# Must exit with code 0

# Backend (from backend directory) — sanity check only, no backend changes
cd backend && npm run build
# Must exit with code 0
```

- [ ] Frontend builds successfully
- [ ] Backend builds successfully

---

## Phase 6: Deployment

### Step 6.1: Commit and push

```bash
git add src/utils/sourceCategory.ts \
       src/components/research/drawers/SourceDrawer.tsx \
       src/components/research/findings/FindingCard.tsx \
       src/components/Dashboard.tsx \
       IMPLEMENTATION_PLANS/010_FINDING_LABEL_UNIFICATION.md

git commit -m "feat: unify finding labels to source-based categories (PubMed/Clinical/Web)

- Create centralized getSourceCategory() mapping utility
- Replace finding.type labels ('study','trial','treatment') with source-based labels
- Update SourceDrawer filter dropdown to source categories (PubMed, Clinical, FDA, Web)
- Update SourceDrawer list/grouped view badges and icons
- Update FindingCard and Dashboard to show source-based labels
- Reuse existing SOURCE_CONFIG from SourceIcon.tsx for consistency"

git push
```

### Step 6.2: Deploy to server

```bash
ssh chee@100.94.82.35 "cd /home/chee/medical-pwa && git pull && docker compose down && docker compose up -d --build"
```

- [ ] Phase 6 complete

---

## Phase 7: Production Verification

### Test 1: SourceDrawer List View
1. Open a topic with findings
2. Click "View all N findings"
3. **Expected**: Each finding shows a colored icon and badge label:
   - PubMed findings: Blue BookOpen icon + "PubMed" badge
   - Clinical findings: Green FlaskConical icon + "Clinical Trial" badge
   - Web findings: Gray Globe icon + "Web" badge
4. **Expected**: Left border colors match badge colors (blue/green/gray)
5. **Must NOT see**: "study", "trial", "treatment", "guideline", "news" labels

### Test 2: Filter Dropdown
1. In SourceDrawer, open the filter dropdown
2. **Expected options**: "All Sources", "PubMed", "Clinical Trials", "FDA", "Web"
3. **Must NOT see**: "All Types", "Treatments", "Studies", "Guidelines", "News"
4. Select "PubMed" → **Expected**: Only PubMed-sourced findings shown
5. Select "Clinical Trials" → **Expected**: Only clinical trial findings shown
6. Select "All Sources" → **Expected**: All findings shown

### Test 3: Sort by Source
1. In SourceDrawer, change sort to "Sort by Source"
2. **Expected**: Findings grouped by source category (all PubMed together, etc.)
3. **Must NOT see**: "Sort by Type" label

### Test 4: Grouped View
1. Switch to "Grouped by Source" tab
2. **Expected**: Badges within each group show source-based labels

### Test 5: FindingCard (Main Grid)
1. Go back to the main findings grid
2. **Expected**: Each card metadata line shows "PubMed" or "Clinical Trial" or "Web" instead of "study" or "trial"

### Test 6: Dashboard
1. Navigate to Dashboard
2. **Expected**: Recent findings show source-based labels

### Test 7: Digest Source Breakdown (Regression Check)
1. View an existing digest
2. **Expected**: Source breakdown pills still show "N PubMed", "N Clinical", "N Web" — UNCHANGED
3. **Expected**: Featured discovery and top findings still have correct source icons — UNCHANGED

- [ ] Test 1 passed: SourceDrawer list view labels correct
- [ ] Test 2 passed: Filter dropdown options correct and filtering works
- [ ] Test 3 passed: Sort by source works
- [ ] Test 4 passed: Grouped view labels correct
- [ ] Test 5 passed: FindingCard labels correct
- [ ] Test 6 passed: Dashboard labels correct
- [ ] Test 7 passed: Digest unchanged (regression check)

---

## Files Modified

| File | Change | Risk |
|------|--------|------|
| `src/utils/sourceCategory.ts` | NEW — centralized mapping function | None (new file) |
| `src/components/research/drawers/SourceDrawer.tsx` | Icons, badges, filter, sort | Medium — most changes |
| `src/components/research/findings/FindingCard.tsx` | Badge label | Low |
| `src/components/Dashboard.tsx` | Finding type label | Low |

## Files NOT Modified (Already Correct)

| File | Why No Change Needed |
|------|---------------------|
| `src/components/digest/SourceIcon.tsx` | Already has canonical config, exported |
| `src/components/DigestCard.tsx` | Already uses PubMed/Clinical/Web |
| `src/components/digest/FeaturedDiscovery.tsx` | Already uses SourceIcon component |
| `src/components/digest/FindingSummaryCard.tsx` | Already uses SourceIcon component |
| Backend files | Frontend-only change |

---

## Rollback Plan

If something breaks after deployment:

1. **Revert the commit**: `git revert HEAD`
2. **Push and redeploy**: `git push && ssh chee@100.94.82.35 "cd /home/chee/medical-pwa && git pull && docker compose down && docker compose up -d --build"`

The previous behavior (finding.type labels) will be restored.

---

## Sign-off

| Phase | Description | Date | Status |
|-------|-------------|------|--------|
| 1 | Create centralized mapping utility | | |
| 2 | Update SourceDrawer.tsx (7 edits) | | |
| 3 | Update FindingCard.tsx | | |
| 4 | Update Dashboard.tsx | | |
| 5 | Build verification | | |
| 6 | Deployment | | |
| 7 | Production verification | | |

---

*Created: February 7, 2026*
*Author: Claude (Plan 010)*
