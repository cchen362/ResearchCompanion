# 013 - Dashboard & Research Insights → Unified Home Page

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for merging the Dashboard and Research Insights pages into a single "Home" page. The current Dashboard shows meaningless stat cards, dead code (monthly cost tracker that doesn't exist), and a broken "new findings" banner. Research Insights requires per-topic selection and shows analytics that overlap with digest content. Both pages will be replaced by one unified Home page with topic filtering, template-based hero, findings highlights, digest signposts, contextual CTAs, and Recharts-powered charts.**

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
│ PHASES 1-5: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `cd backend && npm run build` after EACH backend change    │
│ - Run `npm run build` after EACH frontend change                 │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git after each phase                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: FULL BUILD VERIFICATION                                 │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - Fix any errors before proceeding                               │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: DEPLOYMENT TO DEBIAN SERVER                             │
│ - Push changes to remote repository                              │
│ - SSH into Debian server                                         │
│ - Pull updated repository                                        │
│ - Rebuild Docker containers                                      │
│ - Verify home page works end-to-end                              │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 8: PRODUCTION VERIFICATION                                 │
│ - Home page loads with hero section + unread count               │
│ - Topic chip/pill filter works                                   │
│ - Findings highlights show teasers → click navigates             │
│ - Digest signposts display metadata (not full content)           │
│ - Charts render with Recharts                                    │
│ - Mark-as-read on finding detail drawer open                     │
│ - "Research Insights" nav removed, "Dashboard" → "Home"          │
│ - No 5-second polling in network tab                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: Ready
- **Created**: February 8, 2026
- **Priority**: HIGH - Major UX improvement, core page rebuild
- **Branch**: Create new branch `feat/home-redesign` from `feat/chat-rebuild`
- **Predecessor**: Plan 012 (Chat Architecture Rebuild - Complete)

---

## Root Cause Analysis

### Problem 1: Dashboard Shows Meaningless Data

The current `Dashboard.tsx` (302 lines) shows:
- **4 stat cards**: Active Topics, Agents Pending, New Findings, Monthly Cost
- **Monthly Cost**: Calls `agentsService.getMonthlyApiCost()` which **DOES NOT EXIST** — silently returns 0, rendering a fake "$0.00" cost card
- **"New Findings" count**: Uses `calculateIsNew()` with confusing 48hr/7day time-based override that ignores actual read status
- **Quick Actions**: 5 buttons that just navigate to other pages — zero intelligence
- **Recent Findings**: Simple list of latest 5 findings with no insight
- **Redundant topic loading**: Fetches topics independently even though `AppWithAuth.tsx` already loads them

### Problem 2: Research Insights Requires Per-Topic Selection

The `AnalyticsView.tsx` (196 lines) → `ResearchInsightsDashboard.tsx` (615 lines) chain:
- Requires selecting a topic before showing anything
- Per-topic analytics overlaps heavily with digest content (breakthroughs, contradictions, knowledge gaps)
- Source distribution and activity timeline are useful but buried behind topic selection

### Problem 3: Broken `is_read` Flow

| Layer | Issue |
|-------|-------|
| **`calculateIsNew()`** | Lines 92-107 in `findings.service.ts`: Always marks as "new" if < 48hrs old, ignoring `is_read` column |
| **Mark read trigger** | Only triggered by Dashboard "View New Findings" button (bulk marks ALL as read) |
| **Finding detail drawer** | `FindingDetailDrawer.tsx` does NOT mark as read when opened |
| **Bulk mark-read** | `markFindingsAsRead()` in `findings.service.ts` uses N+1 pattern (fetches all, marks each individually) |
| **Backend** | No bulk mark-all-read endpoint — only individual `POST /api/findings/:id/read` |

### Problem 4: Two App Entry Points

| File | Role | View Names |
|------|------|------------|
| `src/AppWithAuth.tsx` (416 lines) | **ACTIVE** entry point (imported in `main.tsx`) | `'dashboard' \| 'topics' \| 'agents' \| 'findings' \| 'research'` |
| `src/App.tsx` (307 lines) | Legacy entry point without auth | `'dashboard' \| 'topics' \| 'agents' \| 'findings' \| 'analytics'` |

Both have:
- 5-second `setInterval(refreshTopics, 5000)` polling (720 API calls/hour each)
- Different view name for Research Insights (`'research'` vs `'analytics'`)
- Separate nav button implementations

### Problem 5: Dead Code Accumulation

| Dead Code | Location | Issue |
|-----------|----------|-------|
| `getMonthlyApiCost()` call | `Dashboard.tsx:77` | Method doesn't exist on agentsService |
| `warmCache()` stub | `digest.service.ts:856-858` | Empty method body, only called by Dashboard |
| `Dashboard.tsx` | 302 lines | Replaced by HomePage |
| `AnalyticsView.tsx` | 196 lines | Replaced by HomePage |
| `ResearchInsightsDashboard.tsx` | 615 lines | Only consumer (AnalyticsView) being deleted |
| 5-second polling | Both entry points | Excessive, event-driven refresh already exists |

---

## Architecture After Rebuild

```
HomePage.tsx (unified Home page, replaces Dashboard + Research Insights)
  ├── HeroSection.tsx (template-based narrative, conditional on unread count)
  ├── TopicFilter.tsx (chip/pill sub-nav: "All Topics" + per-topic pills)
  ├── FindingsHighlights.tsx (teaser cards → link to Findings page)
  ├── DigestSignposts.tsx (reference digest metadata, not content)
  ├── ContextualCTAs.tsx (rule-based feature nudges, max 3)
  ├── ActivityChart.tsx (Recharts area chart + source donut)
  ├── findingsService.getStats() (existing endpoint, already works)
  └── dashboardService (new: aggregated stats from backend)

AppWithAuth.tsx (ACTIVE entry point)
  ├── Nav: "Home" | "Topics" | "Agents" | "Findings" (removed "Research Insights")
  ├── Views: 'home' | 'topics' | 'agents' | 'findings' (removed 'research')
  └── No 5-second polling (event-driven only)

App.tsx (legacy entry point, same changes)
  ├── Nav: "Home" | "Topics" | "Agents" | "Findings" (removed "Research Insights")
  ├── Views: 'home' | 'topics' | 'agents' | 'findings' (removed 'analytics')
  └── No 5-second polling (event-driven only)
```

**Data Flow**:
```
Backend GET /api/dashboard/stats?topic_id=<optional>
  → Aggregates: unread count, total findings, topic count,
     recent findings (last 5), digest metadata, source breakdown,
     activity timeline (last 7 days)
  → Single API call replaces 5+ calls from old Dashboard

Backend PUT /api/findings/mark-all-read?topic_id=<optional>
  → Single SQL UPDATE, replaces N+1 individual mark-read calls

FindingDetailDrawer.tsx
  → useEffect marks finding as read on open (individual endpoint)
```

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `cd backend && npm run build` after EACH backend file change
- [ ] Run `npm run build` after EACH frontend file change
- [ ] Update BOTH `AppWithAuth.tsx` AND `App.tsx` — both entry points must work
- [ ] Preserve `researchInsightsService` — it's used by `export.service.ts` (line 5)
- [ ] Use `is_read === false` as the sole "unread" indicator (no time-based heuristics)
- [ ] Keep topic chip/pill filter as purely frontend state (no URL routing)
- [ ] Template hero messages MUST be conditional on actual data (never show "agents busy" with 0 findings)

## MUST NOT DO Rules

- [ ] Do NOT add LLM calls for hero narrative or weekly story
- [ ] Do NOT add visit tracking (last_visit_at column, etc.)
- [ ] Do NOT duplicate digest content on Home page (signposts only)
- [ ] Do NOT delete `researchInsights.service.ts` (used by export)
- [ ] Do NOT modify the digest system, agent system, or chat system
- [ ] Do NOT add new database tables (use existing `findings`, `digests` tables)
- [ ] Do NOT add offline support or IndexedDB caching for the Home page
- [ ] Do NOT use dynamic `import()` for the HomePage components (static imports only)

---

## Phase 1: Backend — New Endpoints & Bulk Mark-Read ✅ COMPLETE

**Goal**: Add a bulk mark-all-read endpoint and an aggregated dashboard stats endpoint to reduce frontend API calls.

### ⚠️ Deviations from Original Plan (Discovered During Implementation)

These corrections were applied during Phase 1 and apply to ALL subsequent phases:

| # | Plan Says | Actual Codebase | Fix Applied |
|---|-----------|-----------------|-------------|
| 1 | `import { query } from '../db/index.js'` | No `db/index.ts` exists | Use `import { query } from '../db/database.js'` |
| 2 | `import { Router } from 'express'` | Other route files use `import express from 'express'` + `express.Router()` | Used `import express` pattern for consistency |
| 3 | `result.rowCount` from `query()` | `query()` helper returns `result.rows` (array), not full pg Result — no `rowCount` | Import `pool` from `database.js`, use `pool.query()` directly for UPDATE to access `rowCount` |
| 4 | Add endpoint AFTER `POST /findings/:id/read` | Static routes should come BEFORE parameterized `:id` routes | Placed `PUT /findings/mark-all-read` BEFORE `POST /findings/:id/read` |

**Key rule for agents**: When the plan says `query()`, it works for SELECT (returns rows). For UPDATE/INSERT where you need `rowCount`, use `pool.query()` instead.

### Step 1.1: Add bulk mark-all-read endpoint ✅

**File**: `backend/src/routes/findings.routes.ts`

Add this new endpoint BEFORE the existing `POST /api/findings/:id/read`:

```typescript
// PUT /api/findings/mark-all-read - Bulk mark findings as read
router.put('/findings/mark-all-read', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topic_id } = req.query;

    let result;
    if (topic_id) {
      result = await query(
        `UPDATE findings SET is_read = true, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND topic_id = $2 AND is_read = false`,
        [userId, topic_id]
      );
    } else {
      result = await query(
        `UPDATE findings SET is_read = true, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
    }

    res.json({
      success: true,
      markedCount: result.rowCount || 0
    });
  } catch (error) {
    console.error('Error bulk marking findings as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark findings as read'
    });
  }
});
```

**IMPORTANT**: Ensure the `query` function is imported at the top of the file. Check existing imports — it should already be imported since other endpoints use it.

### Step 1.2: Create dashboard stats endpoint ✅

**CREATE** new file: `backend/src/routes/dashboard.routes.ts`

```typescript
import { Router } from 'express';
import { query } from '../db/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/dashboard/stats - Aggregated dashboard statistics
 * Returns everything the Home page needs in a single request.
 * Optional query param: topic_id (filters to specific topic)
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const topicId = req.query.topic_id as string | undefined;

    // 1. Unread count
    const unreadResult = await query(
      topicId
        ? `SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND topic_id = $2 AND is_read = false`
        : `SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND is_read = false`,
      topicId ? [userId, topicId] : [userId]
    );
    const unreadCount = parseInt(unreadResult.rows[0]?.count || '0');

    // 2. Total findings count
    const totalResult = await query(
      topicId
        ? `SELECT COUNT(*) as count FROM findings WHERE user_id = $1 AND topic_id = $2`
        : `SELECT COUNT(*) as count FROM findings WHERE user_id = $1`,
      topicId ? [userId, topicId] : [userId]
    );
    const totalFindings = parseInt(totalResult.rows[0]?.count || '0');

    // 3. Topic count
    const topicResult = await query(
      `SELECT COUNT(*) as count FROM topics WHERE user_id = $1`,
      [userId]
    );
    const topicCount = parseInt(topicResult.rows[0]?.count || '0');

    // 4. Recent unread findings (for highlights, max 5)
    const recentResult = await query(
      topicId
        ? `SELECT id, title, summary, source, category, created_at, is_read, topic_id
           FROM findings WHERE user_id = $1 AND topic_id = $2 AND is_read = false
           ORDER BY created_at DESC LIMIT 5`
        : `SELECT id, title, summary, source, category, created_at, is_read, topic_id
           FROM findings WHERE user_id = $1 AND is_read = false
           ORDER BY created_at DESC LIMIT 5`,
      topicId ? [userId, topicId] : [userId]
    );
    const recentUnread = recentResult.rows;

    // 5. Latest digest metadata per topic (signposts, not full content)
    const digestResult = await query(
      topicId
        ? `SELECT d.id, d.topic_id, t.name as topic_name,
                  d.breakthroughs, d.contradictions, d.knowledge_gaps,
                  d.created_at
           FROM smart_digests d
           JOIN topics t ON t.id = d.topic_id
           WHERE d.user_id = $1 AND d.topic_id = $2
           ORDER BY d.created_at DESC LIMIT 1`
        : `SELECT DISTINCT ON (d.topic_id)
                  d.id, d.topic_id, t.name as topic_name,
                  d.breakthroughs, d.contradictions, d.knowledge_gaps,
                  d.created_at
           FROM smart_digests d
           JOIN topics t ON t.id = d.topic_id
           WHERE d.user_id = $1
           ORDER BY d.topic_id, d.created_at DESC`,
      topicId ? [userId, topicId] : [userId]
    );

    const digestSignposts = digestResult.rows.map((d: any) => {
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

    // 6. Source breakdown
    const sourceResult = await query(
      topicId
        ? `SELECT source->>'type' as source_type, COUNT(*) as count
           FROM findings WHERE user_id = $1 AND topic_id = $2
           GROUP BY source->>'type' ORDER BY count DESC`
        : `SELECT source->>'type' as source_type, COUNT(*) as count
           FROM findings WHERE user_id = $1
           GROUP BY source->>'type' ORDER BY count DESC`,
      topicId ? [userId, topicId] : [userId]
    );
    const sourceBreakdown = sourceResult.rows.map((r: any) => ({
      type: r.source_type || 'unknown',
      count: parseInt(r.count)
    }));

    // 7. Activity timeline (last 7 days)
    const activityResult = await query(
      topicId
        ? `SELECT DATE(created_at) as date, COUNT(*) as count
           FROM findings WHERE user_id = $1 AND topic_id = $2
             AND created_at >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY DATE(created_at) ORDER BY date`
        : `SELECT DATE(created_at) as date, COUNT(*) as count
           FROM findings WHERE user_id = $1
             AND created_at >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY DATE(created_at) ORDER BY date`,
      topicId ? [userId, topicId] : [userId]
    );
    const activityTimeline = activityResult.rows.map((r: any) => ({
      date: r.date,
      count: parseInt(r.count)
    }));

    res.json({
      success: true,
      stats: {
        unreadCount,
        totalFindings,
        topicCount,
        recentUnread,
        digestSignposts,
        sourceBreakdown,
        activityTimeline
      }
    });
  } catch (error) {
    logger.error('[dashboard.routes] Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

export default router;
```

### Step 1.3: Register dashboard routes in server ✅

**File**: `backend/src/index.ts`

Add import near the top with other route imports:
```typescript
import dashboardRoutes from './routes/dashboard.routes.js';
```

Add route registration near other `app.use` calls:
```typescript
app.use('/api', authenticate, dashboardRoutes);
```

### Step 1.4: Build verification ✅

```bash
cd backend && npm run build
```

**Expected**: Clean compilation with no errors.

**Checkpoint**: Commit with message `feat(dashboard): add bulk mark-read endpoint and aggregated dashboard stats API`

---

## Phase 2: Fix is_read — Simplify calculateIsNew & Mark on Drawer Open ✅ COMPLETE

**Goal**: Fix the broken "new findings" system so unread count is reliable.

### Step 2.1: Simplify `calculateIsNew()` in findings service ✅

**File**: `src/services/findings.service.ts`

Find the `calculateIsNew` method (lines 92-107):

```typescript
  private calculateIsNew(apiFinding: any): boolean {
    const createdAt = new Date(apiFinding.created_at).getTime();
    const hoursSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60);

    // Always new if created in last 48 hours
    if (hoursSinceCreation < 48) {
      return true;
    }

    // If unread and less than 7 days old, still consider new
    if (!apiFinding.is_read && hoursSinceCreation < 168) {
      return true;
    }

    return false;
  }
```

Replace the ENTIRE method with:

```typescript
  /**
   * A finding is "new" (unread) if is_read is false.
   * No time-based heuristics — trust the database column.
   */
  private calculateIsNew(apiFinding: any): boolean {
    return apiFinding.is_read === false;
  }
```

### Step 2.2: Add bulk mark-all-read method to findings service ✅

**File**: `src/services/findings.service.ts`

Find the existing `markFindingsAsRead` method (lines 350-363):

```typescript
  async markFindingsAsRead(topicId?: string): Promise<void> {
    try {
      const findings = await this.getFindings(topicId);
      const unreadFindings = findings.filter(f => f.isNew);

      // Mark each unread finding as read
      await Promise.all(
        unreadFindings.map(f => this.markFindingAsRead(f.id))
      );
    } catch (error) {
      logger.error('[FindingsService] Error marking findings as read:', error);
      throw error;
    }
  }
```

Replace with:

```typescript
  /**
   * Mark all unread findings as read (single bulk API call).
   * Optionally filter by topic.
   */
  async markFindingsAsRead(topicId?: string): Promise<number> {
    try {
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.put<{ success: boolean; markedCount: number }>(
        `${this.baseUrl}/mark-all-read${params}`
      );

      if (response.data.success) {
        return response.data.markedCount;
      }

      throw new Error('Failed to bulk mark findings as read');
    } catch (error) {
      logger.error('[FindingsService] Error bulk marking findings as read:', error);
      throw error;
    }
  }
```

### Step 2.3: Mark finding as read when detail drawer opens ✅

**File**: `src/components/research/drawers/FindingDetailDrawer.tsx`

Add import for findingsService at the top (near other imports):
```typescript
import { findingsService } from '@/services/findings.service';
```

Add import for `useEffect`:
```typescript
import React, { useEffect } from 'react';
```

Inside the `FindingDetailDrawer` function, BEFORE the `if (!finding) return null;` early return, add:

```typescript
  // Mark finding as read when drawer opens
  useEffect(() => {
    if (isOpen && finding && finding.isNew) {
      findingsService.markFindingAsRead(finding.id).catch(() => {
        // Silent fail — marking as read is not critical
      });
    }
  }, [isOpen, finding?.id]);
```

**NOTE**: The `Finding` type uses `isNew` property. Check the actual type — if the Finding type used in this component doesn't have `isNew`, use:
```typescript
if (isOpen && finding) {
  findingsService.markFindingAsRead(finding.id).catch(() => {});
}
```

This marks as read unconditionally when the drawer opens, which is safe since the backend is idempotent.

### Step 2.4: Build verification ✅

```bash
npm run build
```

**Expected**: Clean build. The Dashboard.tsx and AnalyticsView.tsx still exist but will be deleted in Phase 4.

**Checkpoint**: Commit with message `fix(findings): simplify isNew to pure is_read check, mark read on drawer open, add bulk mark-read`

---

## Phase 3: Create HomePage & Sub-Components

**Goal**: Build the new unified Home page with all sub-components.

### Step 3.1: Create directory structure

Create the `src/components/home/` directory.

### Step 3.2: Create TopicFilter component

**CREATE** file: `src/components/home/TopicFilter.tsx`

```typescript
import type { Topic } from '@/types';

interface TopicFilterProps {
  topics: Topic[];
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string | null) => void;
}

export function TopicFilter({ topics, selectedTopicId, onSelectTopic }: TopicFilterProps) {
  if (topics.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelectTopic(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          selectedTopicId === null
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All Topics
      </button>
      {topics.map(topic => (
        <button
          key={topic.id}
          onClick={() => onSelectTopic(topic.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedTopicId === topic.id
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {topic.name}
        </button>
      ))}
    </div>
  );
}
```

### Step 3.3: Create HeroSection component

**CREATE** file: `src/components/home/HeroSection.tsx`

```typescript
interface HeroSectionProps {
  unreadCount: number;
  totalFindings: number;
  topicCount: number;
  onViewFindings: () => void;
  onMarkAllRead: () => void;
}

export function HeroSection({
  unreadCount,
  totalFindings,
  topicCount,
  onViewFindings,
  onMarkAllRead
}: HeroSectionProps) {
  // Template-based hero — conditional on actual data, NO LLM
  const getHeroContent = () => {
    if (topicCount === 0) {
      return {
        headline: 'Welcome to Medical Research Companion',
        message: 'Get started by adding your first research topic. Your agents will begin finding relevant studies, trials, and news automatically.',
        showAction: false
      };
    }

    if (totalFindings === 0) {
      return {
        headline: 'Research is underway',
        message: `Your agents are searching across ${topicCount} topic${topicCount > 1 ? 's' : ''}. Findings will appear here as they come in.`,
        showAction: false
      };
    }

    if (unreadCount === 0) {
      return {
        headline: "You're all caught up",
        message: `${totalFindings} finding${totalFindings > 1 ? 's' : ''} across ${topicCount} topic${topicCount > 1 ? 's' : ''} — all reviewed. Your agents will notify you when new research surfaces.`,
        showAction: false
      };
    }

    if (unreadCount <= 3) {
      return {
        headline: `${unreadCount} new finding${unreadCount > 1 ? 's' : ''} to review`,
        message: 'Your agents found some new research worth looking at.',
        showAction: true
      };
    }

    // 4+ unread findings
    return {
      headline: `${unreadCount} new findings since you last checked`,
      message: `Your agents have been gathering research across ${topicCount} topic${topicCount > 1 ? 's' : ''}. Here are the highlights.`,
      showAction: true
    };
  };

  const { headline, message, showAction } = getHeroContent();

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-gray-900">{headline}</h2>
      <p className="mt-2 text-gray-600">{message}</p>
      {showAction && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onViewFindings}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            View New Findings
          </button>
          <button
            onClick={onMarkAllRead}
            className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 3.4: Create FindingsHighlights component

**CREATE** file: `src/components/home/FindingsHighlights.tsx`

```typescript
import { FileText, ArrowRight } from 'lucide-react';
import { getSourceCategory } from '@/utils/sourceCategory';
import { SOURCE_CONFIG } from '@/components/digest/SourceIcon';

interface FindingTeaser {
  id: string;
  title: string;
  summary: string;
  source: any;
  category: string;
  created_at: string;
  topic_id: string;
}

interface FindingsHighlightsProps {
  findings: FindingTeaser[];
  onViewAllFindings: () => void;
}

export function FindingsHighlights({ findings, onViewAllFindings }: FindingsHighlightsProps) {
  if (findings.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Unread Findings</h3>
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
            {findings.length}
          </span>
        </div>
        <button
          onClick={onViewAllFindings}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {findings.map(finding => {
          const source = typeof finding.source === 'string'
            ? JSON.parse(finding.source)
            : finding.source;
          const sourceCategory = getSourceCategory(source?.type);
          const sourceLabel = SOURCE_CONFIG[sourceCategory]?.label || 'Research';

          return (
            <div
              key={finding.id}
              className="px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={onViewAllFindings}
            >
              <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{finding.title}</h4>
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{finding.summary}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span>{sourceLabel}</span>
                <span>{new Date(finding.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 3.5: Create DigestSignposts component

**CREATE** file: `src/components/home/DigestSignposts.tsx`

```typescript
import { BookOpen, AlertTriangle, HelpCircle, ArrowRight } from 'lucide-react';

interface DigestSignpost {
  id: string;
  topicId: string;
  topicName: string;
  breakthroughCount: number;
  contradictionCount: number;
  knowledgeGapCount: number;
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Latest Digest Insights</h3>
        </div>
        <button
          onClick={onViewFindings}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          Open digests <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-5 grid gap-4 sm:grid-cols-2">
        {meaningfulSignposts.map(signpost => (
          <div key={signpost.id} className="border border-gray-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{signpost.topicName}</h4>
            <div className="space-y-2">
              {signpost.breakthroughCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{signpost.breakthroughCount} breakthrough{signpost.breakthroughCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.contradictionCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{signpost.contradictionCount} contradiction{signpost.contradictionCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.knowledgeGapCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>{signpost.knowledgeGapCount} knowledge gap{signpost.knowledgeGapCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Updated {new Date(signpost.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 3.6: Create ContextualCTAs component

**CREATE** file: `src/components/home/ContextualCTAs.tsx`

```typescript
import { Plus, Bot, MessageSquare, FileText } from 'lucide-react';

interface ContextualCTA {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  action: () => void;
}

interface ContextualCTAsProps {
  topicCount: number;
  totalFindings: number;
  hasChatEnabled: boolean;
  hasDigests: boolean;
  onNavigate: (view: string) => void;
  onOpenChat: () => void;
}

export function ContextualCTAs({
  topicCount,
  totalFindings,
  hasChatEnabled,
  hasDigests,
  onNavigate,
  onOpenChat
}: ContextualCTAsProps) {
  // Rule-based CTAs — max 3, ordered by relevance
  const ctas: ContextualCTA[] = [];

  if (topicCount === 0) {
    ctas.push({
      id: 'add-topic',
      icon: <Plus className="h-5 w-5 text-indigo-600" />,
      label: 'Add a research topic',
      description: 'Start tracking a medical condition',
      action: () => onNavigate('topics')
    });
  }

  if (totalFindings > 0 && hasChatEnabled) {
    ctas.push({
      id: 'open-chat',
      icon: <MessageSquare className="h-5 w-5 text-purple-600" />,
      label: 'Ask about your research',
      description: 'Chat with AI about your findings',
      action: onOpenChat
    });
  }

  if (topicCount > 0 && totalFindings === 0) {
    ctas.push({
      id: 'check-agents',
      icon: <Bot className="h-5 w-5 text-blue-600" />,
      label: 'Check your agents',
      description: 'See research agent status and results',
      action: () => onNavigate('agents')
    });
  }

  if (totalFindings > 5) {
    ctas.push({
      id: 'view-findings',
      icon: <FileText className="h-5 w-5 text-green-600" />,
      label: 'Browse all findings',
      description: 'Search, filter, and explore your research',
      action: () => onNavigate('findings')
    });
  }

  // Max 3 CTAs
  const displayCtas = ctas.slice(0, 3);

  if (displayCtas.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {displayCtas.map(cta => (
        <button
          key={cta.id}
          onClick={cta.action}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all text-left"
        >
          <div className="shrink-0">{cta.icon}</div>
          <div>
            <div className="text-sm font-medium text-gray-900">{cta.label}</div>
            <div className="text-xs text-gray-500">{cta.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

### Step 3.7: Create the main HomePage component

**CREATE** file: `src/components/HomePage.tsx`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { HeroSection } from './home/HeroSection';
import { TopicFilter } from './home/TopicFilter';
import { FindingsHighlights } from './home/FindingsHighlights';
import { DigestSignposts } from './home/DigestSignposts';
import { ContextualCTAs } from './home/ContextualCTAs';
import { api } from '@/services/api';
import { findingsService } from '@/services/findings.service';
import { useUIStore } from '@/stores/uiStore';
import { logger } from '@/utils/logger';
import type { Topic } from '@/types';

interface DashboardStats {
  unreadCount: number;
  totalFindings: number;
  topicCount: number;
  recentUnread: any[];
  digestSignposts: any[];
  sourceBreakdown: { type: string; count: number }[];
  activityTimeline: { date: string; count: number }[];
}

interface HomePageProps {
  topics: Topic[];
  setCurrentView: (view: string) => void;
}

export function HomePage({ topics, setCurrentView }: HomePageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const setChatPanelOpen = useUIStore(state => state.setChatPanelOpen);

  const loadStats = useCallback(async (topicId?: string | null) => {
    try {
      setLoading(true);
      const params = topicId ? `?topic_id=${topicId}` : '';
      const response = await api.get(`/dashboard/stats${params}`);

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      logger.error('[HomePage] Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stats on mount and when topic filter changes
  useEffect(() => {
    loadStats(selectedTopicId);
  }, [selectedTopicId, loadStats]);

  // Listen for events that should refresh stats
  useEffect(() => {
    const handleRefresh = () => loadStats(selectedTopicId);

    window.addEventListener('agent-complete', handleRefresh);
    window.addEventListener('digest-completed', handleRefresh);
    window.addEventListener('topic-created', handleRefresh);

    return () => {
      window.removeEventListener('agent-complete', handleRefresh);
      window.removeEventListener('digest-completed', handleRefresh);
      window.removeEventListener('topic-created', handleRefresh);
    };
  }, [selectedTopicId, loadStats]);

  const handleTopicSelect = (topicId: string | null) => {
    setSelectedTopicId(topicId);
  };

  const handleViewFindings = () => {
    setCurrentView('findings');
  };

  const handleMarkAllRead = async () => {
    try {
      await findingsService.markFindingsAsRead(selectedTopicId || undefined);
      // Refresh stats after marking as read
      await loadStats(selectedTopicId);
    } catch (error) {
      logger.error('[HomePage] Failed to mark all as read:', error);
    }
  };

  const handleOpenChat = () => {
    setChatPanelOpen(true);
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!stats) return null;

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

      {/* Charts section — added in Phase 5 */}
      {/* ActivityChart will be inserted here after Recharts is installed */}
    </div>
  );
}
```

### Step 3.8: Create barrel export for home components

**CREATE** file: `src/components/home/index.ts`

```typescript
export { HeroSection } from './HeroSection';
export { TopicFilter } from './TopicFilter';
export { FindingsHighlights } from './FindingsHighlights';
export { DigestSignposts } from './DigestSignposts';
export { ContextualCTAs } from './ContextualCTAs';
```

### Step 3.9: Build verification

```bash
npm run build
```

**Expected**: Build may warn about unused imports in HomePage (ActivityChart placeholder comment), but should compile. Dashboard.tsx and AnalyticsView.tsx still exist as separate pages.

**Checkpoint**: Commit with message `feat(home): create unified HomePage with hero, topic filter, highlights, digest signposts, CTAs`

---

## Phase 4: Wire Into Entry Points & Tech Debt Cleanup

**Goal**: Replace Dashboard and Research Insights nav items with "Home", delete old components, remove 5-second polling.

### Step 4.1: Update AppWithAuth.tsx (ACTIVE entry point)

**File**: `src/AppWithAuth.tsx`

**4.1a**: Update imports — remove old, add new:

Remove:
```typescript
import Dashboard from './components/Dashboard';
import { AnalyticsView } from './components/AnalyticsView';
```

Add:
```typescript
import { HomePage } from './components/HomePage';
```

**4.1b**: Update view type union (line 26):

Change:
```typescript
const [currentView, setCurrentView] = useState<'dashboard' | 'topics' | 'agents' | 'findings' | 'research'>('dashboard');
```
To:
```typescript
const [currentView, setCurrentView] = useState<'home' | 'topics' | 'agents' | 'findings'>('home');
```

**4.1c**: Remove 5-second polling (lines 105-111):

DELETE this entire useEffect block:
```typescript
  // Also refresh topics periodically
  useEffect(() => {
    if (isDbReady) {
      const interval = setInterval(refreshTopics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isDbReady]);
```

**4.1d**: Update desktop nav buttons. Replace the "Dashboard" button (lines 161-170):

Change:
```typescript
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`hidden sm:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'dashboard'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
```
To:
```typescript
              <button
                onClick={() => setCurrentView('home')}
                className={`hidden sm:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'home'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Home
              </button>
```

DELETE the "Research Insights" button entirely (lines 201-210):
```typescript
              <button
                onClick={() => setCurrentView('research')}
                className={`hidden md:block px-2 py-1 rounded-md text-sm font-medium ${
                  currentView === 'research'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Research Insights
              </button>
```

**4.1e**: Update mobile menu buttons similarly:

- Change "Dashboard" mobile button to "Home" with `setCurrentView('home')`
- DELETE the "Research Insights" mobile button entirely

**4.1f**: Update view rendering (main content area, lines 347-380):

Change:
```typescript
          {currentView === 'dashboard' && (
            <Dashboard
              topics={topics}
              selectedTopic={selectedTopic}
              onSelectTopic={setSelectedTopic}
              setCurrentView={setCurrentView}
            />
          )}
```
To:
```typescript
          {currentView === 'home' && (
            <HomePage
              topics={topics}
              setCurrentView={setCurrentView}
            />
          )}
```

DELETE the research/analytics view rendering:
```typescript
          {currentView === 'research' && (
            <AnalyticsView
              topics={topics}
              selectedTopic={selectedTopic}
            />
          )}
```

### Step 4.2: Update App.tsx (legacy entry point)

**File**: `src/App.tsx`

Apply the same pattern as AppWithAuth.tsx:

**4.2a**: Update imports:
- Remove: `import Dashboard from './components/Dashboard';` and `import { AnalyticsView } from './components/AnalyticsView';`
- Add: `import { HomePage } from './components/HomePage';`

**4.2b**: Update view type (line 21):
```typescript
const [currentView, setCurrentView] = useState<'home' | 'topics' | 'agents' | 'findings'>('home');
```

**4.2c**: Remove 5-second polling (lines 78-83 useEffect block)

**4.2d**: Update nav buttons: "Dashboard" → "Home", delete "Research Insights"

**4.2e**: Update view rendering:
```typescript
{currentView === 'home' && <HomePage topics={topics} setCurrentView={setCurrentView} />}
```
Delete the analytics view rendering.

### Step 4.3: Delete old components

**DELETE** these files:
- `src/components/Dashboard.tsx` (302 lines)
- `src/components/AnalyticsView.tsx` (196 lines)
- `src/components/ResearchInsightsDashboard.tsx` (615 lines)

### Step 4.4: Clean up dead code in digest service

**File**: `src/services/digest.service.ts`

DELETE the `warmCache` method (lines 856-858):
```typescript
  async warmCache(topicIds?: string[]): Promise<void> {
    // Cache warming handled by backend
  }
```

This empty stub has no callers after Dashboard.tsx is deleted.

### Step 4.5: Build verification

```bash
npm run build
```

**Expected**: Clean build. All references to deleted components should be gone. If build errors appear, check for any other files importing the deleted components.

**Known possible issue**: If `Dashboard.tsx` was imported by any file other than the entry points, fix those imports. Search for:
```
import Dashboard
import { AnalyticsView }
import { ResearchInsightsDashboard }
```

**Checkpoint**: Commit with message `feat(home): wire HomePage into both entry points, delete Dashboard/AnalyticsView/ResearchInsightsDashboard, remove 5s polling`

---

## Phase 5: Install Recharts & Add Charts

**Goal**: Add Recharts and create the activity timeline and source breakdown charts.

### Step 5.1: Install Recharts

```bash
npm install recharts
```

### Step 5.2: Create ActivityChart component

**CREATE** file: `src/components/home/ActivityChart.tsx`

```typescript
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ActivityChartProps {
  activityTimeline: { date: string; count: number }[];
  sourceBreakdown: { type: string; count: number }[];
}

const SOURCE_COLORS: Record<string, string> = {
  pubmed: '#4f46e5',
  clinical_trials: '#0891b2',
  web: '#059669',
  fda: '#d97706',
  unknown: '#9ca3af'
};

const SOURCE_LABELS: Record<string, string> = {
  pubmed: 'PubMed',
  clinical_trials: 'Clinical Trials',
  web: 'Web Search',
  fda: 'FDA',
  unknown: 'Other'
};

export function ActivityChart({ activityTimeline, sourceBreakdown }: ActivityChartProps) {
  const hasActivity = activityTimeline.some(d => d.count > 0);
  const hasSources = sourceBreakdown.length > 0;

  if (!hasActivity && !hasSources) return null;

  // Format dates for display
  const formattedTimeline = activityTimeline.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }));

  // Add colors to source breakdown
  const sourcesWithColor = sourceBreakdown.map(s => ({
    ...s,
    color: SOURCE_COLORS[s.type] || SOURCE_COLORS.unknown,
    label: SOURCE_LABELS[s.type] || s.type
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Activity Timeline */}
      {hasActivity && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Research Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={formattedTimeline}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number) => [`${value} finding${value !== 1 ? 's' : ''}`, 'Findings']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Source Breakdown */}
      {hasSources && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Research Sources</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={sourcesWithColor}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="count"
                  paddingAngle={2}
                >
                  {sourcesWithColor.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {sourcesWithColor.map(source => (
                <div key={source.type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-sm text-gray-700">{source.label}</span>
                  <span className="text-sm text-gray-400 ml-auto">{source.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 5.3: Update barrel export

**File**: `src/components/home/index.ts`

Add:
```typescript
export { ActivityChart } from './ActivityChart';
```

### Step 5.4: Wire ActivityChart into HomePage

**File**: `src/components/HomePage.tsx`

Add import:
```typescript
import { ActivityChart } from './home/ActivityChart';
```

Replace the placeholder comment at the bottom of the JSX:
```typescript
      {/* Charts section — added in Phase 5 */}
      {/* ActivityChart will be inserted here after Recharts is installed */}
```

With:
```typescript
      {/* Charts — activity timeline & source breakdown */}
      <ActivityChart
        activityTimeline={stats.activityTimeline}
        sourceBreakdown={stats.sourceBreakdown}
      />
```

### Step 5.5: Build verification

```bash
npm run build
```

**Expected**: Clean build with Recharts properly bundled.

**Checkpoint**: Commit with message `feat(home): add Recharts activity timeline and source breakdown charts`

---

## Phase 6: Build Verification, Testing & Deployment

### Step 6.1: Full build

```bash
npm run build && cd backend && npm run build
```

Both must pass with zero errors.

### Step 6.2: Test scenarios

| # | Scenario | Expected Result | Pass? |
|---|----------|----------------|-------|
| 1 | Open app (authenticated) | Home page loads, not old Dashboard | [ ] |
| 2 | Nav shows "Home" | "Dashboard" renamed to "Home", no "Research Insights" link | [ ] |
| 3 | Mobile nav shows "Home" | Same rename in hamburger menu | [ ] |
| 4 | Hero section with 0 topics | Shows "Welcome" template with add-topic guidance | [ ] |
| 5 | Hero section with unread findings | Shows count and "View New Findings" button | [ ] |
| 6 | Hero section all caught up | Shows "You're all caught up" when 0 unread | [ ] |
| 7 | Topic filter chips | "All Topics" pill + per-topic pills, clicking filters content | [ ] |
| 8 | Findings highlights | Shows up to 5 unread finding teasers | [ ] |
| 9 | Click finding teaser | Navigates to Findings page | [ ] |
| 10 | Digest signposts | Shows breakthrough/contradiction/gap counts per topic | [ ] |
| 11 | Contextual CTAs | Shows relevant CTAs (add topic, open chat, etc.) based on state | [ ] |
| 12 | Activity chart | Recharts area chart for last 7 days renders | [ ] |
| 13 | Source breakdown | Recharts donut chart with source distribution renders | [ ] |
| 14 | Mark all as read button | Unread count drops to 0, hero updates | [ ] |
| 15 | Open finding detail drawer | Finding marked as read (is_read=true in DB) | [ ] |
| 16 | Network tab: no 5s polling | No repeated GET /api/topics every 5 seconds | [ ] |
| 17 | Legacy App.tsx route | Home page also works on legacy entry point | [ ] |
| 18 | Export still works | `export.service.ts` → `researchInsightsService` not broken | [ ] |

### Step 6.3: Update documentation

**File**: `IMPLEMENTATION_PLANS/README.md` — Add Plan 013 to the table:
```markdown
| 013 | [Dashboard Home Redesign](./013_DASHBOARD_HOME_REDESIGN.md) | **Ready** | Merge Dashboard + Research Insights into unified Home page |
```

**File**: `CLAUDE.md` — Add Plan 013 to the plans table.

**File**: `server_storage_fixes.md` — Add entry documenting the Home page rebuild.

### Step 6.4: Deploy to production

```bash
# Install recharts dependency on server
# (Will be handled by Docker build since package.json has it)

# Push to remote
git push origin feat/home-redesign

# SSH to server
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull origin feat/home-redesign

# Rebuild
docker compose down && docker compose up -d --build

# Verify
docker logs medical-companion --tail 50 2>&1
```

---

## Rollback Plan

If something breaks after deployment:

1. **Frontend won't build**: The old `Dashboard.tsx`, `AnalyticsView.tsx`, and `ResearchInsightsDashboard.tsx` are in git history. Revert the deletion commits while keeping backend changes.

2. **Dashboard stats endpoint errors**: The Home page can gracefully degrade — the loading spinner will show, and individual sections will hide if their data is empty. Fix the SQL query and redeploy.

3. **Charts don't render**: Recharts is a well-tested library. If rendering fails, the `ActivityChart` component returns `null` when data is empty, so the page will render without charts. Debug Recharts separately.

4. **Bulk mark-read breaks**: The individual `POST /api/findings/:id/read` endpoint is unchanged. Temporarily revert `markFindingsAsRead()` in `findings.service.ts` to the old N+1 pattern while debugging the bulk endpoint.

5. **is_read behavior changed**: The simplified `calculateIsNew` may show different unread counts than before. This is INTENTIONAL — the old 48hr override was misleading. If users report issues, the fix is to run: `UPDATE findings SET is_read = true WHERE created_at < NOW() - INTERVAL '7 days'` to clean up old data.

---

## File Summary

| File | Action | Lines Before → After |
|------|--------|---------------------|
| `src/components/Dashboard.tsx` | DELETE | 302 → 0 |
| `src/components/AnalyticsView.tsx` | DELETE | 196 → 0 |
| `src/components/ResearchInsightsDashboard.tsx` | DELETE | 615 → 0 |
| `src/components/HomePage.tsx` | CREATE | 0 → ~140 |
| `src/components/home/HeroSection.tsx` | CREATE | 0 → ~85 |
| `src/components/home/TopicFilter.tsx` | CREATE | 0 → ~35 |
| `src/components/home/FindingsHighlights.tsx` | CREATE | 0 → ~70 |
| `src/components/home/DigestSignposts.tsx` | CREATE | 0 → ~85 |
| `src/components/home/ContextualCTAs.tsx` | CREATE | 0 → ~85 |
| `src/components/home/ActivityChart.tsx` | CREATE | 0 → ~130 |
| `src/components/home/index.ts` | CREATE | 0 → ~7 |
| `backend/src/routes/dashboard.routes.ts` | CREATE | 0 → ~130 |
| `backend/src/routes/findings.routes.ts` | MODIFY | 361 → ~390 |
| `backend/src/index.ts` | MODIFY | ~150 → ~153 |
| `src/AppWithAuth.tsx` | MODIFY | 416 → ~380 |
| `src/App.tsx` | MODIFY | 307 → ~270 |
| `src/services/findings.service.ts` | MODIFY | ~470 → ~460 |
| `src/services/digest.service.ts` | MODIFY | ~858 → ~855 |
| `src/components/research/drawers/FindingDetailDrawer.tsx` | MODIFY | 230 → ~240 |
| `src/services/researchInsights.service.ts` | KEEP (no changes) | 392 |

**Net**: ~1,113 lines deleted, ~767 lines created = **~346 lines net reduction**

**New dependency**: `recharts` (npm package)

---

## Sign-Off Checklist

| Phase | Task | Completed | Date |
|-------|------|-----------|------|
| 1 | Backend: bulk mark-read + dashboard stats endpoint | [x] | Feb 8, 2026 |
| 2 | Fix is_read: simplify calculateIsNew, mark on drawer open | [x] | Feb 8, 2026 |
| 3 | Create HomePage + sub-components (hero, filter, highlights, signposts, CTAs) | [ ] | |
| 4 | Wire into both entry points, delete old pages, remove polling | [ ] | |
| 5 | Install Recharts, create activity chart + source donut | [ ] | |
| 6 | Full build verification (frontend + backend) | [ ] | |
| 7 | Production deployment | [ ] | |
| 8 | Production verification (all 18 test scenarios) | [ ] | |

---

*Created: February 8, 2026*
*Plan Author: Claude Code Agent*
*Estimated Effort: 5 implementation phases + build/deploy*
