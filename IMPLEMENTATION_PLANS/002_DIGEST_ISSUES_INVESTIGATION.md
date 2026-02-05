# Digest Issues Investigation Report

**Created**: February 5, 2026
**Status**: Investigation Complete - Awaiting Implementation
**Priority**: HIGH

---

## ⛔ STOP - READ THIS BEFORE IMPLEMENTING

This document contains thorough investigation findings for three critical digest issues. Each issue has a root cause identified and proposed fixes. **Do not implement fixes until this document is fully reviewed and approved.**

---

## Executive Summary

After production testing of the autonomous agent + digest system, three issues were identified:

| Issue | Symptom | Root Cause | Severity |
|-------|---------|------------|----------|
| **1. 0 Unique Sources** | Shows "0 Unique Sources" despite 20 findings | Statistics not stored in metadata; frontend fallback uses hardcoded 0 | HIGH |
| **2. Simple Digest** | Digest feels incomplete/simple | AI generates 6 themes but DigestCard only shows 5 sections; other fields not fetched correctly | MEDIUM |
| **3. Timeframe Confusion** | Unclear purpose of timeframe dropdown | Conceptual confusion between agent schedules and digest timeframes; potential architectural redesign needed | LOW-MEDIUM |

---

## Issue 1: "0 Unique Sources" Bug

### Symptom
- Digest shows "0 Unique Sources" in the statistics bar
- "View All 0 Sources" button displays 0 count
- Yet 20 findings exist with 18 distinct sources

### Screenshots
- Statistics bar shows: `20 Total Findings | 0 Unique Sources`
- "View All 0 Sources" button at bottom of digest

### Root Cause Chain

```
1. AI Service generates statistics correctly
   └─ ai.service.ts:654 → sourceCount: uniqueStudies.size ✅

2. Digest Processor does NOT store statistics in metadata
   └─ digest-processor.service.ts:219-225 → metadata only contains:
      - source: 'background-processor'
      - queueItemId
      - findingsCount
      - generatedAt
      - timeframe
      ❌ Missing: statistics object

3. Frontend transformation falls back to hardcoded 0
   └─ digest.service.ts:169-175 →
      statistics: apiDigest.metadata?.statistics || {
        totalFindings: apiDigest.finding_ids?.length || 0,
        sourceCount: 0,  // ❌ HARDCODED FALLBACK
        ...
      }

4. DigestCard displays the broken value
   └─ DigestCard.tsx:275 → {digest.statistics.sourceCount}
```

### Database Evidence

```sql
-- Actual metadata stored in digests table:
SELECT metadata::text FROM digests WHERE id = '5e6a4d33-...';

-- Result:
{
  "source": "background-processor",
  "timeframe": "weekly",
  "generatedAt": "2026-02-04T22:50:04.829Z",
  "queueItemId": "536292fd-...",
  "findingsCount": 20
}
-- ❌ No "statistics" field!
```

### Fix Required

**File**: `backend/src/services/digest-processor.service.ts`
**Location**: Lines 219-225

**Current Code**:
```typescript
JSON.stringify({
  source: 'background-processor',
  queueItemId: item.id,
  findingsCount: findings.length,
  generatedAt: new Date().toISOString(),
  timeframe: item.timeframe || 'all-time'
})
```

**Fixed Code**:
```typescript
JSON.stringify({
  source: 'background-processor',
  queueItemId: item.id,
  findingsCount: findings.length,
  generatedAt: new Date().toISOString(),
  timeframe: item.timeframe || 'all-time',
  statistics: (digest as any).statistics || {
    totalFindings: findings.length,
    newFindings: 0,
    highRelevanceCount: 0,
    sourceCount: new Set(findings.map(f => f.source?.name).filter(Boolean)).size,
    avgConfidence: 0.5
  }
})
```

### Verification
- After fix: Check `metadata` column contains `statistics.sourceCount` > 0
- Frontend should display correct count without fallback

---

## Issue 2: Digest Feels "Too Simple"

### Symptom
- Digest displays only basic information despite 20 rich findings
- Missing themes, clinical implications, lifestyle considerations
- Only shows: Executive Summary, Statistics, Key Takeaways, Breakthroughs, Contradictions

### What AI Actually Generates (Confirmed in DB)

```
✅ executive_summary: Full FDA approval summary with action items
✅ layman_summary: Plain English explanation for family members
✅ themes: 6 detailed themes with 9 properties each
✅ key_takeaways: 8 specific takeaways with metrics
✅ breakthroughs: 1 paradigm-shift breakthrough
❌ contradictions: [] (empty - no conflicting findings)
❌ clinical_implications: [] (empty - AI didn't generate)
❌ lifestyle_considerations: [] (empty - AI didn't generate)
❌ questions_for_doctor: [] (empty - AI didn't generate)
❌ warning_signs: [] (empty - AI didn't generate)
❌ knowledge_gaps: [] (empty - AI didn't generate)
```

### Root Cause: Multiple Data Mapping Issues

#### Issue 2A: Frontend fetches from wrong locations

**File**: `src/services/digest.service.ts` - `transformToFrontend()`

| Field | Current Fetch Location | Actual DB Location | Status |
|-------|------------------------|-------------------|--------|
| laymanSummary | `metadata?.laymanSummary` | `layman_summary` column | ❌ WRONG |
| keyTakeaways | `metadata?.keyTakeaways` | `key_takeaways` column | ❌ WRONG |
| statistics | `metadata?.statistics` | Not stored | ❌ MISSING |
| trends | `metadata?.trends` | `trends` column | ❌ WRONG |
| topSources | `metadata?.topSources` | Not stored | ❌ MISSING |

**Current Code (Lines 158-176)**:
```typescript
laymanSummary: apiDigest.metadata?.laymanSummary || '',  // ❌ Wrong
keyTakeaways: apiDigest.metadata?.keyTakeaways || [],   // ❌ Wrong
trends: apiDigest.metadata?.trends || { ... },          // ❌ Wrong
statistics: apiDigest.metadata?.statistics || { ... },  // ❌ Not stored
```

**Fixed Code**:
```typescript
laymanSummary: apiDigest.layman_summary || '',          // ✅ Correct column
keyTakeaways: apiDigest.key_takeaways || [],            // ✅ Correct column
trends: apiDigest.trends || { ... },                    // ✅ Correct column
statistics: apiDigest.metadata?.statistics || {         // Still needs Issue 1 fix
  totalFindings: apiDigest.finding_ids?.length || 0,
  sourceCount: calculateSourceCount(apiDigest),         // Compute from findings
  ...
},
```

#### Issue 2B: DigestCard doesn't display Themes

**File**: `src/components/DigestCard.tsx`

The component receives `digest.themes` (6 themes with rich data) but **never renders them**.

**Missing Section**: A themes section that displays:
- Theme title and category
- Key findings grouped under each theme
- Practical insights for the patient
- Study strength indicators

**Evidence**: Themes exist in database with full structure:
```json
{
  "id": "theme_1",
  "title": "FDA Approval of First Oral Daily Treatment",
  "summary": "Paltusotine represents the first once-daily oral medication...",
  "category": "treatment",
  "importance": "critical",
  "practicalInsight": "If currently on injectable somatostatin analogs...",
  "studyStrength": "RCT - Two Phase 3 pivotal trials",
  "findingCount": 8
}
```

#### Issue 2C: Additional sections not displayed

These sections exist in the SmartDigest type and database schema but are not rendered:

| Section | In Type | In DB | In DigestCard | Action |
|---------|---------|-------|---------------|--------|
| themes | ✅ | ✅ | ❌ | ADD UI |
| clinicalImplications | ✅ | ✅ | ❌ | ADD UI |
| lifestyleConsiderations | ✅ | ✅ | ❌ | ADD UI |
| questionsForDoctor | ✅ | ✅ | ❌ | ADD UI |
| warningSigns | ✅ | ✅ | ❌ | ADD UI |
| knowledgeGaps | ✅ | ✅ | ❌ | ADD UI |
| trends | ✅ | ✅ | ❌ (removed) | EVALUATE |

**Note**: The `trends` section was intentionally removed with comment:
```typescript
// Research Trends Removed - These were misleading AI-generated placeholders
// Will be replaced with real temporal analysis when we have actual historical data
```

### Fix Required

1. **Fix data mapping in `digest.service.ts`**:
   - Fetch `layman_summary`, `key_takeaways`, `trends` from correct columns
   - Add fallback statistics calculation if not in metadata

2. **Add Themes section to DigestCard**:
   - Create collapsible themes section
   - Display theme title, summary, practical insight
   - Show study strength and finding count

3. **Evaluate which additional sections to display**:
   - Clinical implications (if AI generates them)
   - Questions for doctor (valuable for patients)
   - Warning signs (important for safety)

---

## Issue 3: Timeframe System Confusion

### Symptom
- Dropdown shows: Today, This Week, This Month, All Time
- Unclear how this interacts with agent schedules
- User confusion about purpose

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT SCHEDULES (When agents run)                               │
├─────────────────────────────────────────────────────────────────┤
│ • hourly: Run every 1 hour                                      │
│ • daily: Run every 24 hours                                     │
│ • weekly: Run every 7 days                                      │
│ • monthly: Run every 30 days                                    │
│ • manual: Only when user clicks "Run"                           │
│                                                                 │
│ Purpose: How often to search for NEW research findings          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DIGEST TIMEFRAMES (Which findings to include)                   │
├─────────────────────────────────────────────────────────────────┤
│ • daily: Include findings from last 24 hours only               │
│ • weekly: Include findings from last 7 days only                │
│ • monthly: Include findings from last 30 days only              │
│ • all-time: Include ALL findings regardless of date             │
│                                                                 │
│ Purpose: Filter findings by date when generating digest         │
└─────────────────────────────────────────────────────────────────┘
```

### The Conflict Scenario

**User Question**: "If agents are set to run daily, and timeframe is 'This Month', how does it work?"

**Current Behavior**:
1. Agent runs daily, finds 5-10 new findings each day
2. After 30 days: ~150-300 findings accumulated
3. User selects "This Month" timeframe
4. Digest is generated from ALL 150-300 findings
5. This is correct behavior but confusing UX

**Problem**: Same vocabulary (`daily`, `weekly`, `monthly`) used for different concepts.

### Data Flow Analysis

```
Frontend Dropdown
    ↓
appStore.digestTimeframe = 'weekly' (stored in localStorage)
    ↓
useDigest() hook reads timeframe
    ↓
researchStore.getDigestForTopic(topicId, timeframe)
    ↓
Key: `${topicId}-weekly` → looks up cached digest
    ↓
If not cached: API call /digests/latest/:topicId?timeframe=weekly
    ↓
Backend filters: WHERE type = 'weekly' OR metadata->>'timeframe' = 'weekly'
    ↓
Returns matching digest or 404
    ↓
If generating: digestService.queueDigestFromExistingFindings(topicId, 'weekly')
    ↓
Filters findings: timestamp > now - (7 * 24 * 60 * 60 * 1000)
    ↓
AI generates digest from filtered findings only
```

### ⚠️ NEEDS DEEPER BRAINSTORMING - DO NOT IMPLEMENT YET

**Status**: Deferred for architectural discussion

**Critical Concern**: Can the AI API handle large finding volumes?
- Current: 20 findings = ~52 seconds API call
- Projected: 50 findings = ? (may hit token limits or timeouts)
- Long-term: 100+ findings = likely problematic

**Scalability Questions**:
1. What is Claude's practical limit for digest generation?
2. Should we implement progressive summarization (summarize in batches)?
3. Should findings be "archived" after digest generation?
4. How do we handle findings accumulation over months/years?

**Options Being Considered**:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A | Keep current timeframe filtering | Controls volume per digest | Confusing UX, same vocabulary |
| B | Always use all findings | Better AI context | May hit API limits at scale |
| C | Display filter only | Rich digest + flexible view | Still has volume problem |
| D | Smart batching | Summarize in chunks, then meta-summarize | Complex implementation |
| E | Rolling window | Keep only most recent N findings | Loses historical context |

**Next Steps**:
1. Test API with 50 findings to measure performance
2. Research Claude's token limits for structured output
3. Explore chunked/progressive summarization patterns
4. Schedule brainstorming session before deciding

**Current scheduler behavior**:
- Scheduler hardcodes `timeframe: 'weekly'` in queue
- This means autonomous digests always filter to 7 days
- This may actually be a reasonable default to control volume

### Files Involved

| File | Role | Key Lines |
|------|------|-----------|
| `src/stores/appStore.ts` | Stores `digestTimeframe` preference | 120, 178-179 |
| `src/hooks/useDigest.ts` | Reads timeframe, passes to services | 99, 102, 116 |
| `src/services/digest.service.ts` | Filters findings by timeframe | 715-735 |
| `backend/src/services/scheduler.service.ts` | Queues with hardcoded 'weekly' | 226 |
| `backend/src/routes/digests.crud.routes.ts` | Filters digests by type/timeframe | 65-89 |

---

## Recommended Fix Priority

### Phase 1: Critical Bugs (Do First) ⬅️ READY TO IMPLEMENT
1. Fix statistics not stored in metadata (Issue 1)
2. Fix frontend data mapping (laymanSummary, keyTakeaways, trends)

### Phase 2: UI Completeness (Medium Priority)
3. Add Themes section to DigestCard
4. Evaluate and add other useful sections (questionsForDoctor, warningSigns)

### Phase 3: Architecture Review (DEFERRED - Needs Brainstorming)
5. ⚠️ **DO NOT IMPLEMENT** - Timeframe architecture needs deeper discussion
   - Concern: API scalability with large finding volumes
   - Need to test with 50+ findings before deciding
   - Schedule brainstorming session
6. Keep scheduler at `weekly` for now (reasonable volume control)

---

## Verification Checklist

After implementing fixes:

- [ ] Statistics bar shows correct unique sources count
- [ ] laymanSummary displays when toggled to "Simple" mode
- [ ] keyTakeaways array is populated (not empty)
- [ ] Themes section is visible with 6 themes
- [ ] Switching timeframe generates new digest for that timeframe
- [ ] Scheduler-generated digests have correct timeframe

---

## Appendix A: Database Schema Reference

```sql
-- Digest table columns (all populated by AI service)
CREATE TABLE digests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  topic_id UUID,
  type VARCHAR(50),              -- 'weekly', 'monthly', etc.
  title VARCHAR(255),
  executive_summary TEXT,
  layman_summary TEXT,           -- ✅ Populated
  themes JSONB,                  -- ✅ 6 themes stored
  contradictions JSONB,          -- [] empty array
  breakthroughs JSONB,           -- ✅ 1 breakthrough
  knowledge_gaps JSONB,          -- [] empty
  next_steps JSONB,              -- [] empty
  key_takeaways JSONB,           -- ✅ 8 takeaways stored
  trends JSONB,                  -- ✅ Object stored
  clinical_implications JSONB,   -- [] empty
  lifestyle_considerations JSONB,-- [] empty
  questions_for_doctor JSONB,    -- [] empty
  warning_signs JSONB,           -- [] empty
  finding_ids UUID[],            -- ✅ 20 UUIDs
  metadata JSONB,                -- ❌ Missing statistics
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Appendix B: SmartDigest Type Definition

```typescript
// src/types/index.ts
export interface SmartDigest {
  id: string;
  topicId: string;
  timeframe: DigestTimeframe;
  generatedAt: number;
  executiveSummary: string;
  laymanSummary: string;
  themes: Theme[];
  keyTakeaways: string[];
  breakthroughs: Breakthrough[];
  contradictions: Contradiction[];
  trends: Trends;
  statistics: DigestStatistics;
  topSources: TopSource[];
  allFindingIds: string[];
  // Optional sections
  clinicalImplications?: string[];
  lifestyleConsiderations?: string[];
  questionsForDoctor?: string[];
  warningSigns?: string[];
  knowledgeGaps?: string[];
}
```

---

*Document generated from production testing on February 5, 2026*
