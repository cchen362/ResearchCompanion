# Digest UI Improvements - Implementation Plan

## Stop: Read This Before Writing ANY Code

**This document is the STRICT implementation guide for digest UI improvements.**

Agents MUST follow this guide exactly. NO deviations, NO quick wins, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **No local backend testing** - All functional testing on production server

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
- **Created**: February 5, 2026
- **Estimated Duration**: 4-5 hours (implementation) + 1 hour (deployment/testing)
- **Dependencies**: Requires completion of Plan 001 (Autonomous Agents)

---

## Summary of Changes

| Change | Priority | Files Affected |
|--------|----------|----------------|
| Fix Detailed/Simple toggle | Critical | digest.service.ts |
| Fix keyTakeaways data mapping | Critical | digest.service.ts |
| Remove statistics grid | High | DigestCard.tsx |
| Remove timeframe dropdown | High | ResearchToolbar.tsx, appStore.ts |
| Add Themes section | High | DigestCard.tsx |
| Add Questions for Doctor section | High | DigestCard.tsx |
| Add Warning Signs section | High | DigestCard.tsx |
| Add Findings date filter | Medium | NEW: FindingsDateFilter.tsx, ResearchToolbar.tsx, FindingsGrid.tsx, appStore.ts |
| Add 50-finding safety cap | Medium | digest-processor.service.ts |

---

## UI/UX Design Specifications

### Design Principles (Healthcare App)

Based on UI/UX best practices for healthcare applications:

| Principle | Application |
|-----------|-------------|
| **Typography** | Figtree (headings) + Noto Sans (body) - clean, accessible |
| **Colors** | Medical Blue (#0891B2), Trust White, Calm Green (#059669) |
| **Contrast** | Minimum 4.5:1 for WCAG AA compliance |
| **Touch Targets** | Minimum 44x44px for mobile accessibility |
| **Animation** | Subtle, 150-300ms transitions, respect prefers-reduced-motion |
| **Icons** | Lucide icons only - NO emojis in UI |

### Text Formatting Rules

**CRITICAL: These rules prevent messy, unprofessional digest display**

| Issue | Do | Don't |
|-------|----|----|
| **Long text blocks** | Break into paragraphs with proper spacing | Display as single wall of text |
| **Markdown formatting** | Strip or render markdown properly | Show raw `**bold**` or `*italic*` |
| **Emoji usage** | Icons from Lucide library only | Use emojis in section headers |
| **All caps** | Sentence case for all headings | SHOUT WITH ALL CAPS |
| **Line breaks** | Preserve intentional line breaks | Collapse everything into one line |
| **Lists** | Proper bullet or numbered lists | Run-on comma-separated items |

### Section Design Specifications

#### 1. Themes Section (Collapsible Accordion)

```
┌─ RESEARCH THEMES ────────────────────────────────────┐
│ ▼ Theme Title Here                                    │
│   Category: treatment | Importance: critical          │
│                                                       │
│   Theme summary text goes here. This should be        │
│   broken into readable paragraphs with proper         │
│   line height (leading-relaxed).                      │
│                                                       │
│   Practical Insight                                   │
│   Actionable guidance text displayed in a subtle      │
│   highlighted box with left border accent.            │
│                                                       │
│   Study Strength: RCT - Two Phase 3 pivotal trials   │
│   Related Findings: 8                                 │
├───────────────────────────────────────────────────────┤
│ ▶ Theme 2 Title (collapsed)                           │
├───────────────────────────────────────────────────────┤
│ ▶ Theme 3 Title (collapsed)                           │
└───────────────────────────────────────────────────────┘
```

**Styling:**
- Card background: `bg-background/50`
- Border: `border border-border/50`
- Rounded corners: `rounded-lg`
- Category badge: `<Badge variant="outline">`
- Importance badge: Use color coding (critical=destructive, high=default, medium=secondary)
- Practical insight box: `border-l-4 border-primary/50 bg-primary/5 pl-4 py-2`
- Default state: First theme expanded, rest collapsed
- Transition: `transition-all duration-200`

#### 2. Questions for Doctor Section (Collapsible)

```
┌─ QUESTIONS FOR YOUR DOCTOR ──────────────────────────┐
│ Use these evidence-based questions at your next      │
│ appointment.                                          │
│                                                       │
│ ○ "Based on the new oral medication approval,        │
│    am I a candidate for switching from my            │
│    current injection therapy?"                       │
│                                                       │
│ ○ "The research mentions [specific finding].         │
│    How does this apply to my situation?"             │
│                                                       │
│ ○ "What are the long-term safety considerations     │
│    I should be aware of?"                            │
└───────────────────────────────────────────────────────┘
```

**Styling:**
- Card background: `bg-blue-50/50 dark:bg-blue-950/20`
- Border: `border-blue-200 dark:border-blue-800`
- Icon: `<Stethoscope className="h-5 w-5 text-blue-600" />`
- Questions: Each in a subtle card with `bg-background/80 rounded-md p-3`
- Quote marks: Use proper typography, not straight quotes
- Default state: Collapsed
- Indicator: Count of questions in header

#### 3. Warning Signs Section (Conditional, Always Expanded)

```
┌─ WARNING SIGNS TO MONITOR ───────────────────────────┐
│ Based on the research, be aware of these signs:      │
│                                                       │
│ ● Symptom description here with context about        │
│   when to seek medical attention.                    │
│                                                       │
│ ● Another warning sign with specific guidance        │
│   on urgency and next steps.                         │
│                                                       │
│ If you experience any of these symptoms, contact     │
│ your healthcare provider promptly.                   │
└───────────────────────────────────────────────────────┘
```

**Styling:**
- Card background: `bg-amber-50/50 dark:bg-amber-950/20`
- Border: `border-amber-200 dark:border-amber-800`
- Icon: `<AlertTriangle className="h-5 w-5 text-amber-600" />`
- Warning items: Each with `text-amber-900 dark:text-amber-100`
- Footer note: `text-sm text-muted-foreground italic`
- **ONLY render if array has items** - never show empty section
- Default state: Always expanded (safety-critical)

### Empty State Philosophy

**DO NOT display sections that are empty.**

| Section | Empty Behavior |
|---------|----------------|
| Themes | Hide entire section |
| Questions for Doctor | Hide entire section |
| Warning Signs | Hide entire section |
| Contradictions | Hide entire section |
| Breakthroughs | Hide entire section |

**Never display:**
- "No themes identified"
- "No questions available"
- "No warning signs found" (could be misinterpreted as "everything is safe")

---

## Phase 1: Fix Critical Data Mapping Bugs

### Step 1.1: Fix transformToFrontend() in digest.service.ts

**File**: `src/services/digest.service.ts`
**Location**: Lines 152-192 (`transformToFrontend` method)

**Current Code (WRONG):**
```typescript
private transformToFrontend(apiDigest: any, responseContext?: { deduplicated?: boolean; source?: string }): SmartDigest {
  const digest: SmartDigest = {
    // ...
    laymanSummary: apiDigest.metadata?.laymanSummary || '',          // WRONG
    themes: apiDigest.themes || [],
    keyTakeaways: apiDigest.metadata?.keyTakeaways || [],             // WRONG
    // ...
  };
```

**Fixed Code:**
```typescript
private transformToFrontend(apiDigest: any, responseContext?: { deduplicated?: boolean; source?: string }): SmartDigest {
  const digest: SmartDigest = {
    id: apiDigest.id,
    topicId: apiDigest.topic_id || '',
    timeframe: apiDigest.type || 'weekly',
    generatedAt: new Date(apiDigest.created_at).getTime(),
    executiveSummary: apiDigest.executive_summary || '',
    // FIX: Read from correct columns (backend aliases these in SQL)
    laymanSummary: apiDigest.laymanSummary || apiDigest.layman_summary || '',
    themes: apiDigest.themes || [],
    keyTakeaways: apiDigest.keyTakeaways || apiDigest.key_takeaways || [],
    breakthroughs: apiDigest.breakthroughs || [],
    contradictions: apiDigest.contradictions || [],
    // NEW: Add mappings for additional sections
    questionsForDoctor: apiDigest.questionsForDoctor || apiDigest.questions_for_doctor || [],
    warningSigns: apiDigest.warningSigns || apiDigest.warning_signs || [],
    clinicalImplications: apiDigest.clinicalImplications || apiDigest.clinical_implications || [],
    trends: apiDigest.trends || {
      emerging: [],
      declining: [],
      stable: []
    },
    statistics: apiDigest.metadata?.statistics || {
      totalFindings: apiDigest.finding_ids?.length || 0,
      newFindings: 0,
      highRelevanceCount: 0,
      sourceCount: 0,
      avgConfidence: 0
    },
    topSources: apiDigest.metadata?.topSources || [],
    allFindingIds: apiDigest.finding_ids || [],
    userEngagement: apiDigest.metadata?.userEngagement
  };

  if (responseContext) {
    digest.cacheMetadata = {
      source: responseContext.source as 'postgresql' | 'indexeddb' | 'generated' || 'postgresql',
      isCached: responseContext.deduplicated || false,
      deduplicated: responseContext.deduplicated || false,
      originalGeneratedAt: new Date(apiDigest.created_at).getTime(),
      cacheRetrievedAt: Date.now()
    };
  }

  return digest;
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 1.2: Update SmartDigest Type (if needed)

**File**: `src/types/index.ts`
**Location**: Find `SmartDigest` interface

**Add these optional fields if missing:**
```typescript
export interface SmartDigest {
  // ... existing fields ...

  // Optional sections (may be empty arrays)
  questionsForDoctor?: string[];
  warningSigns?: string[];
  clinicalImplications?: string[];
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**Checklist Phase 1:**
- [ ] transformToFrontend reads laymanSummary from correct property
- [ ] transformToFrontend reads keyTakeaways from correct property
- [ ] New section mappings added (questionsForDoctor, warningSigns)
- [ ] SmartDigest type updated if needed
- [ ] `npm run build` passes

---

## Phase 2: UI Cleanup

### Step 2.1: Remove Statistics Grid from DigestCard

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 252-286 (the statistics grid inside CardContent)

**Delete this entire block:**
```typescript
{/* Statistics Bar - Only show meaningful metrics */}
<div className="grid grid-cols-2 gap-4 text-center">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="p-3 bg-background/50 rounded cursor-help">
          <div className="text-2xl font-bold text-primary">
            {digest.statistics.totalFindings}
          </div>
          <div className="text-xs text-muted-foreground">Total Findings</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Total number of research findings collected for this topic</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="p-3 bg-background/50 rounded cursor-help">
          <div className="text-2xl font-bold">
            {digest.statistics.sourceCount}
          </div>
          <div className="text-xs text-muted-foreground">Unique Sources</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Number of different journals, databases, and research sources</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

</div>
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 2.2: Update Digest Header Text

**File**: `src/components/DigestCard.tsx`
**Location**: Find `getTimeframeLabel` function usage in CardTitle

**Current Code:**
```typescript
<CardTitle className="text-xl">
  {getTimeframeLabel(digest.timeframe)}
</CardTitle>
```

**Replace with:**
```typescript
<CardTitle className="text-xl">
  Weekly Research Digest
</CardTitle>
```

**Also update** the generated timestamp to show date range:

**Current:**
```typescript
<p className="text-sm text-muted-foreground mb-2">
  Generated {formatDistanceToNow(digest.generatedAt, { addSuffix: true })}
```

**Replace with:**
```typescript
<p className="text-sm text-muted-foreground mb-2">
  Updated {formatDistanceToNow(digest.generatedAt, { addSuffix: true })}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 2.3: Remove Timeframe Dropdown from ResearchToolbar

**File**: `src/components/research/toolbar/ResearchToolbar.tsx`

**Remove import:**
```typescript
// DELETE this line:
import { TimeframeSelector } from './TimeframeSelector';
```

**Remove from component:**
```typescript
// DELETE these lines from the component body:
const { digestTimeframe, setDigestTimeframe } = useAppStore();

const handleTimeframeChange = (timeframe: DigestTimeframe) => {
  setDigestTimeframe(timeframe);
};
```

**Remove from JSX:**
```typescript
// DELETE this JSX block:
{/* Timeframe selector */}
<TimeframeSelector
  timeframe={digestTimeframe}
  onTimeframeChange={handleTimeframeChange}
/>
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**Checklist Phase 2:**
- [ ] Statistics grid removed from DigestCard
- [ ] Header text changed to "Weekly Research Digest"
- [ ] Timestamp text changed to "Updated X ago"
- [ ] TimeframeSelector removed from ResearchToolbar
- [ ] `npm run build` passes

---

## Phase 3: Add New Digest Sections

### Step 3.1: Add Themes Section

**File**: `src/components/DigestCard.tsx`
**Location**: Add AFTER the Key Takeaways section (after line ~323)

**Add this code:**
```typescript
{/* Research Themes */}
{digest.themes && digest.themes.length > 0 && (
  <Card>
    <CardHeader
      className="cursor-pointer"
      onClick={() => toggleSection('themes')}
    >
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Research Themes
          <Badge variant="secondary" className="ml-2">
            {digest.themes.length}
          </Badge>
        </CardTitle>
        {expandedSections.has('themes') ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </CardHeader>
    {expandedSections.has('themes') && (
      <CardContent className="space-y-3">
        {digest.themes.map((theme, index) => (
          <div
            key={theme.id || index}
            className="p-4 bg-background/50 rounded-lg border border-border/50"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                {getCategoryIcon(theme.category)}
                {theme.title}
              </h4>
              <div className="flex gap-1">
                {theme.category && (
                  <Badge variant="outline" className="text-xs">
                    {theme.category}
                  </Badge>
                )}
                {theme.importance && (
                  <Badge
                    variant={getImportanceBadgeColor(theme.importance) as any}
                    className="text-xs"
                  >
                    {theme.importance}
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              {theme.summary}
            </p>

            {theme.practicalInsight && (
              <div className="border-l-4 border-primary/50 bg-primary/5 pl-4 py-2 mb-3">
                <p className="text-sm font-medium text-primary/90">
                  Practical Insight
                </p>
                <p className="text-sm text-muted-foreground">
                  {theme.practicalInsight}
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {theme.studyStrength && (
                <span>Study: {theme.studyStrength}</span>
              )}
              {theme.findingCount && (
                <span>Findings: {theme.findingCount}</span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    )}
  </Card>
)}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 3.2: Add Questions for Doctor Section

**File**: `src/components/DigestCard.tsx`
**Location**: Add AFTER Breakthroughs section

**First, add import at the top:**
```typescript
import { Stethoscope } from 'lucide-react';
```

**Then add this code:**
```typescript
{/* Questions for Doctor */}
{digest.questionsForDoctor && digest.questionsForDoctor.length > 0 && (
  <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
    <CardHeader
      className="cursor-pointer"
      onClick={() => toggleSection('questions')}
    >
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-blue-600" />
          Questions for Your Doctor
          <Badge variant="secondary" className="ml-2">
            {digest.questionsForDoctor.length}
          </Badge>
        </CardTitle>
        {expandedSections.has('questions') ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </CardHeader>
    {expandedSections.has('questions') && (
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Use these evidence-based questions at your next appointment.
        </p>
        <div className="space-y-2">
          {digest.questionsForDoctor.map((question, index) => (
            <div
              key={index}
              className="p-3 bg-background/80 rounded-md border border-border/50"
            >
              <p className="text-sm leading-relaxed">
                "{question}"
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    )}
  </Card>
)}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 3.3: Add Warning Signs Section

**File**: `src/components/DigestCard.tsx`
**Location**: Add AFTER Questions for Doctor, BEFORE Contradictions

**Add this code:**
```typescript
{/* Warning Signs */}
{digest.warningSigns && digest.warningSigns.length > 0 && (
  <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        Warning Signs to Monitor
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground mb-4">
        Based on the research, be aware of these signs:
      </p>
      <div className="space-y-2">
        {digest.warningSigns.map((sign, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 bg-background/80 rounded-md"
          >
            <span className="text-amber-600 mt-0.5">●</span>
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
              {sign}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground italic mt-4">
        If you experience any of these symptoms, contact your healthcare provider promptly.
      </p>
    </CardContent>
  </Card>
)}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**Checklist Phase 3:**
- [ ] Themes section added with collapsible accordion
- [ ] Questions for Doctor section added
- [ ] Warning Signs section added (always expanded)
- [ ] Stethoscope icon imported from lucide-react
- [ ] All sections only render when data exists
- [ ] `npm run build` passes

---

## Phase 4: Add Findings Date Filter

### Step 4.1: Add State to appStore

**File**: `src/stores/appStore.ts`

**Add type definition:**
```typescript
export type FindingsDateFilter = 'all' | '7d' | '30d' | '90d';
```

**Add to AppState interface:**
```typescript
interface AppState {
  // ... existing fields ...
  findingsDateFilter: FindingsDateFilter;
  setFindingsDateFilter: (filter: FindingsDateFilter) => void;
}
```

**Add to store state and actions:**
```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ... existing state ...
      findingsDateFilter: 'all',
      setFindingsDateFilter: (filter) => set({ findingsDateFilter: filter }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        // ... existing persisted fields ...
        findingsDateFilter: state.findingsDateFilter,
      }),
    }
  )
);
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 4.2: Create FindingsDateFilter Component

**File**: `src/components/research/toolbar/FindingsDateFilter.tsx` (NEW FILE)

```typescript
/**
 * FindingsDateFilter - Date range filter for findings list view
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import type { FindingsDateFilter as FilterType } from '@/stores/appStore';

interface FindingsDateFilterProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export function FindingsDateFilter({
  filter,
  onFilterChange,
}: FindingsDateFilterProps) {
  return (
    <Select value={filter} onValueChange={onFilterChange}>
      <SelectTrigger className="w-[140px] h-9">
        <Calendar className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        {FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 4.3: Integrate Filter into ResearchToolbar

**File**: `src/components/research/toolbar/ResearchToolbar.tsx`

**Add imports:**
```typescript
import { FindingsDateFilter } from './FindingsDateFilter';
import type { FindingsDateFilter as FilterType } from '@/stores/appStore';
```

**Add to component:**
```typescript
export function ResearchToolbar({
  topic,
  findings,
  digest,
  topicId,
  onSettingsClick
}: ResearchToolbarProps) {
  const { viewMode, setViewMode } = useUIStore();
  const { findingsDateFilter, setFindingsDateFilter } = useAppStore();
  const { isGenerating, refreshDigest } = useDigest(topicId);

  // ... existing handlers ...

  const handleFilterChange = (filter: FilterType) => {
    setFindingsDateFilter(filter);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Export button */}
      {topic && findings.length > 0 && (
        <ExportMenu
          topic={topic}
          findings={findings}
          digest={digest || undefined}
          timeline={[]}
        />
      )}

      {/* Date filter - only show in list view */}
      {viewMode === 'list' && (
        <FindingsDateFilter
          filter={findingsDateFilter}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* View mode toggle */}
      <ViewToggle
        viewMode={viewMode}
        onViewChange={handleViewChange}
      />

      {/* Rest of toolbar... */}
    </div>
  );
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

### Step 4.4: Apply Filter in FindingsGrid

**File**: `src/components/research/findings/FindingsGrid.tsx`

**Add import:**
```typescript
import { useAppStore } from '@/stores/appStore';
```

**Apply filtering:**
```typescript
export function FindingsGrid({ topicId, onFindingClick }: FindingsGridProps) {
  const { findings, isLoading } = useFindings(topicId);
  const { viewMode } = useUIStore();
  const { findingsDateFilter } = useAppStore();

  // Apply date filtering
  const filteredFindings = useMemo(() => {
    if (findingsDateFilter === 'all') return findings;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const cutoffMap = {
      '7d': now - (7 * day),
      '30d': now - (30 * day),
      '90d': now - (90 * day),
    };

    const cutoff = cutoffMap[findingsDateFilter];
    return findings.filter(f => f.timestamp > cutoff);
  }, [findings, findingsDateFilter]);

  // Loading state
  if (isLoading) {
    // ... existing loading UI ...
  }

  // Empty state - check filteredFindings
  if (filteredFindings.length === 0) {
    return <FindingsEmpty hasTopicSelected={!!topicId} />;
  }

  // List view - use filteredFindings
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {filteredFindings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            onClick={onFindingClick}
          />
        ))}
      </div>
    );
  }

  return null;
}
```

**Add useMemo import if not present:**
```typescript
import { useMemo } from 'react';
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**Checklist Phase 4:**
- [ ] FindingsDateFilter type added to appStore
- [ ] findingsDateFilter state added to appStore
- [ ] FindingsDateFilter.tsx component created
- [ ] Filter integrated into ResearchToolbar
- [ ] Filter applied in FindingsGrid
- [ ] useMemo imported in FindingsGrid
- [ ] `npm run build` passes

---

## Phase 5: Backend Safety Cap

### Step 5.1: Add 50-Finding Cap to Digest Processor

**File**: `backend/src/services/digest-processor.service.ts`
**Location**: In `generateAndStoreDigest` method, after fetching findings

**Find this code (around line 141-145):**
```typescript
const findings = await FindingModel.getFiltered(item.user_id, {
  topic_id: item.topic_id,
  limit: 100
});
```

**Replace with:**
```typescript
// Fetch findings for the topic
let findings = await FindingModel.getFiltered(item.user_id, {
  topic_id: item.topic_id,
  limit: 100
});

// SAFETY CAP: Limit to 50 most recent findings to prevent AI timeout
// If more than 50 findings exist, prioritize by recency
const MAX_FINDINGS_FOR_DIGEST = 50;
if (findings.length > MAX_FINDINGS_FOR_DIGEST) {
  console.log(`[DigestProcessor] Capping findings from ${findings.length} to ${MAX_FINDINGS_FOR_DIGEST}`);
  // Sort by timestamp descending (most recent first) and take top 50
  findings = findings
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_FINDINGS_FOR_DIGEST);
}
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**Checklist Phase 5:**
- [ ] 50-finding safety cap added to digest processor
- [ ] Findings sorted by recency before capping
- [ ] Console log added for debugging
- [ ] `cd backend && npm run build` passes

---

## Phase 6: Deployment & Verification

### Step 6.1: Final Local Build

```bash
# Frontend
npm run build

# Backend
cd backend && npm run build
```

Both must complete with exit code 0.

### Step 6.2: Commit Changes

```bash
git add -A
git status
# Verify the files being committed

git commit -m "feat: digest UI improvements and rolling weekly model

- Fix Detailed/Simple toggle (read laymanSummary from correct column)
- Fix keyTakeaways data mapping
- Remove redundant statistics grid from Key Insight section
- Remove timeframe dropdown (use rolling weekly model)
- Add Research Themes section (collapsible accordion)
- Add Questions for Doctor section (collapsible)
- Add Warning Signs section (conditional, always expanded)
- Add Findings date filter for list view
- Add 50-finding safety cap for AI scalability

UI/UX improvements:
- Proper text formatting (no raw markdown, no emojis)
- Accessible color contrast and touch targets
- Empty sections hidden (not shown as 'None found')

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Step 6.3: Deploy to Debian Server

```bash
# Push to remote
git push origin fix/digest-findings-race-condition

# SSH into server
ssh user@debian-server

# Navigate to project
cd /home/medical-pwa

# Pull changes
git pull origin fix/digest-findings-race-condition

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

### Step 6.4: Production Testing Checklist

| Test | Expected Result | Pass? |
|------|-----------------|-------|
| Detailed/Simple toggle | Summary text changes between executive and layman | [ ] |
| No statistics grid | Key Insight section shows only summary text | [ ] |
| Header text | Shows "Weekly Research Digest" | [ ] |
| No timeframe dropdown | Toolbar has no dropdown for digest timeframe | [ ] |
| Themes section | Renders if themes exist, collapsible | [ ] |
| Questions section | Renders if questions exist, collapsible | [ ] |
| Warning Signs | Renders if warnings exist, always expanded | [ ] |
| Empty sections hidden | No "None found" messages for empty sections | [ ] |
| Findings date filter | Appears in List view only, filters work | [ ] |
| View All Sources | Button shows correct count | [ ] |
| Digest generation | Completes within reasonable time (<60s) | [ ] |
| Text formatting | No raw markdown, no emojis, proper paragraphs | [ ] |

---

## Rollback Plan

If issues occur:

### UI Issues (DigestCard.tsx)
1. Revert DigestCard.tsx changes
2. Run `npm run build`
3. Redeploy

### Data Mapping Issues (digest.service.ts)
1. Revert to original transformToFrontend
2. Run `npm run build`
3. Redeploy

### Backend Issues (digest-processor.service.ts)
1. Remove safety cap code
2. Run `cd backend && npm run build`
3. Redeploy

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/services/digest.service.ts` | Fix transformToFrontend data mapping |
| `src/components/DigestCard.tsx` | Remove stats grid, add new sections |
| `src/components/research/toolbar/ResearchToolbar.tsx` | Remove TimeframeSelector, add FindingsDateFilter |
| `src/stores/appStore.ts` | Add findingsDateFilter state |
| `src/components/research/findings/FindingsGrid.tsx` | Apply date filtering |
| `src/types/index.ts` | Add optional fields to SmartDigest |
| `backend/src/services/digest-processor.service.ts` | Add 50-finding safety cap |
| **NEW** `src/components/research/toolbar/FindingsDateFilter.tsx` | Date filter component |

**Total files**: 7 modified + 1 new = 8 files

---

## Document History

- **Created**: February 5, 2026
- **Author**: Claude Opus 4.5
- **Status**: Ready for implementation

---

## Phase Completion Sign-off

### Local Development
- [ ] Phase 1: Data mapping fixes complete
- [ ] Phase 2: UI cleanup complete
- [ ] Phase 3: New sections added
- [ ] Phase 4: Findings date filter added
- [ ] Phase 5: Backend safety cap added
- [ ] All builds pass

### Deployment
- [ ] Changes committed
- [ ] Pushed to remote
- [ ] Pulled on Debian server
- [ ] Containers rebuilt

### Production Testing
- [ ] All tests in checklist pass
- [ ] No console errors
- [ ] Performance acceptable

### Sign-off
- [ ] All phases complete (Date: _______)
- [ ] Document updated with any issues (Date: _______)
