# 004 - Agent System Fixes & Digest UI Simplification

## ⛔ STOP: Read This Before Writing ANY Code

**This document is the STRICT implementation guide for fixing agent system issues and simplifying the digest UI.**

Agents MUST follow this guide exactly. NO deviations, NO quick fixes, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **Server SSH**: `ssh chee@100.94.82.35`
- **Project path**: `/home/chee/medical-pwa`
- **Backend container**: `0fce2da99deb`
- **Postgres container**: `fa1ef9df476d`

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1-4: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                  │
│ - Run `npm run build` after each file change                    │
│ - Run `cd backend && npm run build` for backend changes         │
│ - Verify NO compile errors before proceeding                    │
│ - Commit changes to git                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: BUILD VERIFICATION                                     │
│ - Frontend: npm run build                                       │
│ - Backend: cd backend && npm run build                          │
│ - Fix any errors before proceeding                              │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: DEPLOYMENT TO DEBIAN SERVER                            │
│ - Push changes to remote repository                             │
│ - SSH into Debian server                                        │
│ - Pull updated repository                                       │
│ - Rebuild Docker containers                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 7: PRODUCTION VERIFICATION                                │
│ - Run ALL test scenarios on production server                   │
│ - Call repair endpoint for missing agent                        │
│ - Document any issues in this file                              │
└─────────────────────────────────────────────────────────────────┘
```

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
- **Created**: February 6, 2026
- **Priority**: HIGH - Production bugs identified
- **Branch**: fix/digest-findings-race-condition

---

## The Critical Problems

The Medical Companion PWA has THREE issues identified in production:

1. **Missing Medical Literature Agent** - Only 2 of 3 agents exist due to no error handling
2. **No agent completion notification** - Toast is useless if user navigates away
3. **Themes UI is confusing** - Duplicates content, doesn't read like curated material

---

## Summary of Changes

| Change | Priority | Files Affected |
|--------|----------|----------------|
| Fix agent creation error handling | CRITICAL | backend/src/models/agent.model.ts |
| Add agent repair endpoint | CRITICAL | backend/src/routes/agents.routes.ts |
| Unify notifications (remove toast, bell only) | HIGH | src/components/agents/AgentMonitor.tsx |
| Add delete/clear to NotificationCenter | HIGH | src/components/NotificationCenter.tsx |
| Remove Research Themes section entirely | HIGH | src/components/DigestCard.tsx |
| Delete ThemeAccordion component | HIGH | src/components/ThemeAccordion.tsx (DELETE) |
| Update export service (remove themes) | MEDIUM | src/services/export.service.ts |
| Clean up unused imports | MEDIUM | Multiple files |

---

## Strict Rules for All Agents

### ✅ MUST DO:
1. **Follow each step IN ORDER** - No skipping ahead
2. **Run `npm run build` after each file change** - Verify no errors
3. **Test after each phase** - Use the exact test scenarios provided
4. **Add console.log for debugging** - Use `logger.debug()` format
5. **Update this document** - Mark steps complete as you go

### ❌ MUST NOT DO:
1. **Add ANY new features** - Only implement what's specified
2. **Create new files** - Edit existing files only (except DELETE ThemeAccordion.tsx)
3. **Refactor surrounding code** - Touch only the lines specified
4. **Add "improvements"** - No type changes, no cleanups, no optimizations
5. **Skip testing** - Every phase must pass tests before proceeding

---

## Agent Architecture Reference

### The Three Agent Types and Their Data Sources

| Agent Type | Data Source | API Key Required? | API Endpoint |
|------------|-------------|-------------------|--------------|
| `treatment_breakthrough` | Brave Search + PubMed + FDA | **Yes** (Brave) + Optional (PubMed) | Multiple |
| `clinical_trial` | ClinicalTrials.gov | **NO - Public API** | `https://clinicaltrials.gov/api/v2/studies` |
| `medical_literature` | NCBI PubMed | **Optional** (increases rate limit) | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/` |

### API Key Requirements Summary

| API | Required? | Environment Variable | Notes |
|-----|-----------|---------------------|-------|
| **ClinicalTrials.gov** | **NO** | N/A | Public API v2, no authentication needed |
| **PubMed (NCBI)** | Optional | `PUBMED_API_KEY` | Without key: 3 req/sec. With key: 10 req/sec |
| **Brave Search** | Yes | `BRAVE_API_KEY` | Required for `treatment_breakthrough` agent |
| **FDA** | No | N/A | Public API |

### Environment Variables (from `backend/.env.example`)

```bash
# Required API Keys
ANTHROPIC_API_KEY=...        # For AI features (digests, chat)
OPENAI_API_KEY=...           # For voice transcription
BRAVE_API_KEY=...            # For web search (treatment_breakthrough agent)

# Optional API Keys
PUBMED_API_KEY=...           # Increases PubMed rate limit (3 → 10 req/sec)

# Feature Flags (MUST be true for agents to work)
ENABLE_REAL_MEDICAL_SEARCH=true  # Master switch for all medical searches
ENABLE_WEB_SEARCH=true           # For Brave web search

# Result Limits
PUBMED_RESULT_LIMIT=20
CLINICAL_TRIALS_LIMIT=20
FDA_RESULT_LIMIT=15
WEB_SEARCH_LIMIT=10
```

### Key Files for Agent System

| File | Purpose |
|------|---------|
| `backend/src/models/agent.model.ts` | Agent CRUD operations, `createDefaultsForTopic()` |
| `backend/src/routes/agents.routes.ts` | Agent API endpoints |
| `backend/src/services/search.service.ts` | All search API implementations (PubMed, ClinicalTrials, FDA) |
| `backend/src/services/agent-execution.service.ts` | Agent type → search function mapping |
| `src/services/agents.service.ts` | Frontend agent runner |

---

## Issue 1: Missing Medical Literature Agent

### Root Cause

The agent creation loop in `createDefaultsForTopic()` has NO error handling. When the 3rd agent creation fails, the error propagates but agents 1 & 2 remain orphaned in the database.

**Important**: This is NOT an API configuration issue. ClinicalTrials.gov needs no key, and PubMed key is optional. The issue is the agent record itself was never created in the database.

### Evidence (Production Database)

```sql
-- Only 2 of 3 agents exist
SELECT name, type FROM agents;
-- Result:
-- Clinical Trial Agent         | clinical_trial
-- Treatment Breakthrough Agent | treatment_breakthrough
-- MISSING: Medical Literature Agent | medical_literature
```

---

## Phase 1: Fix Agent Creation (Backend)

**Goal**: Add error handling so all agents are created even if one fails, plus add idempotency check.

### Step 1.1: Add Error Handling to createDefaultsForTopic

**File**: `backend/src/models/agent.model.ts`
**Location**: Lines 84-103 (replace entire method)

**Current Code (BROKEN):**
```typescript
static async createDefaultsForTopic(userId: string, topicId: string): Promise<Agent[]> {
  const defaultAgents = [
    { name: 'Treatment Breakthrough Agent', type: 'treatment_breakthrough', schedule: 'daily' },
    { name: 'Clinical Trial Agent', type: 'clinical_trial', schedule: 'daily' },
    { name: 'Medical Literature Agent', type: 'medical_literature', schedule: 'daily' }
  ];

  const agents: Agent[] = [];
  for (const agentData of defaultAgents) {
    const agent = await this.create(userId, {
      ...agentData,
      topic_id: topicId,
      enabled: true,
      config: { searchDepth: 10 }
    });
    agents.push(agent);
  }

  return agents;
}
```

**Fixed Code:**
```typescript
static async createDefaultsForTopic(userId: string, topicId: string): Promise<Agent[]> {
  const defaultAgents = [
    { name: 'Treatment Breakthrough Agent', type: 'treatment_breakthrough', schedule: 'daily' },
    { name: 'Clinical Trial Agent', type: 'clinical_trial', schedule: 'daily' },
    { name: 'Medical Literature Agent', type: 'medical_literature', schedule: 'daily' }
  ];

  const agents: Agent[] = [];
  const errors: string[] = [];

  for (const agentData of defaultAgents) {
    try {
      // Check if agent of this type already exists (idempotency)
      const existing = await queryOne<Agent>(
        'SELECT * FROM agents WHERE user_id = $1 AND topic_id = $2 AND type = $3',
        [userId, topicId, agentData.type]
      );

      if (existing) {
        console.log(`[AgentModel] Agent ${agentData.type} already exists for topic ${topicId}`);
        agents.push(existing);
        continue;
      }

      const agent = await this.create(userId, {
        ...agentData,
        topic_id: topicId,
        enabled: true,
        config: { searchDepth: 10 }
      });
      agents.push(agent);
      console.log(`[AgentModel] Created agent: ${agentData.name} for topic ${topicId}`);
    } catch (error) {
      const errorMsg = `Failed to create ${agentData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[AgentModel] ${errorMsg}`);
      errors.push(errorMsg);
      // Continue creating other agents - don't let one failure block all
    }
  }

  // Log summary
  console.log(`[AgentModel] Created ${agents.length}/3 agents for topic ${topicId}`);
  if (errors.length > 0) {
    console.warn(`[AgentModel] Errors during agent creation:`, errors);
  }

  return agents;
}
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

### Step 1.2: Add Agent Repair Endpoint

**File**: `backend/src/routes/agents.routes.ts`

**Step 1.2a: Update Import (Line 2)**

The `Agent` type is needed for the repair endpoint. Update the import:

**Current** (line 2):
```typescript
import { AgentModel } from '../models/agent.model.js';
```

**Change to**:
```typescript
import { AgentModel, Agent } from '../models/agent.model.js';
```

**Step 1.2b: Add Repair Endpoint (After Line 125)**

**Location**: Add after line 125 (after the closing `});` of `/defaults/:topicId` endpoint)

**Add this new endpoint:**
```typescript
// POST /api/agents/repair/:topicId - Create missing default agents for existing topic
router.post('/agents/repair/:topicId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { topicId } = req.params;

    // Get existing agents for this topic
    const existing = await AgentModel.getByTopicId(userId, topicId);
    const existingTypes = new Set(existing.map(a => a.type));

    // Define required agents
    const requiredAgents = [
      { type: 'treatment_breakthrough', name: 'Treatment Breakthrough Agent' },
      { type: 'clinical_trial', name: 'Clinical Trial Agent' },
      { type: 'medical_literature', name: 'Medical Literature Agent' }
    ];

    // Find and create missing agents
    const created: Agent[] = [];
    const errors: string[] = [];

    for (const { type, name } of requiredAgents) {
      if (!existingTypes.has(type)) {
        try {
          const agent = await AgentModel.create(userId, {
            topic_id: topicId,
            name,
            type,
            enabled: true,
            config: { searchDepth: 10 },
            schedule: 'daily'
          });
          created.push(agent);
          console.log(`[AgentRepair] Created missing agent: ${name} for topic ${topicId}`);
        } catch (error) {
          const errorMsg = `Failed to create ${name}: ${error instanceof Error ? error.message : 'Unknown'}`;
          console.error(`[AgentRepair] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    res.json({
      success: true,
      message: `Repair complete: ${created.length} agents created`,
      existing: existing.length,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      agents: [...existing, ...created]
    });
  } catch (error) {
    console.error('Error repairing agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to repair agents'
    });
  }
});
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 1 Local Checklist:**
- [ ] `createDefaultsForTopic()` updated with error handling in `agent.model.ts`
- [ ] Import updated to include `Agent` type in `agents.routes.ts` (line 2)
- [ ] Repair endpoint added to `agents.routes.ts` (after line 125)
- [ ] `cd backend && npm run build` passes with no errors

### Pre-Deployment Environment Check

Before deploying, verify environment configuration on the Debian server:

```bash
# SSH to server and check environment variables
ssh chee@100.94.82.35
docker exec 0fce2da99deb env | grep -E "ENABLE_REAL|BRAVE|ANTHROPIC"

# Expected output:
# ANTHROPIC_API_KEY=sk-ant-...
# BRAVE_API_KEY=...
# ENABLE_REAL_MEDICAL_SEARCH=true
```

**Required checks**:
1. `ENABLE_REAL_MEDICAL_SEARCH=true` - If false, all agents return zero findings
2. `BRAVE_API_KEY` is set - Required for treatment_breakthrough agent
3. `ANTHROPIC_API_KEY` is set - Required for AI features

**Note**: ClinicalTrials.gov API needs NO key (public API). PubMed API key is optional.

---

## Phase 2: Unify Agent Completion Notifications

**Goal**: Remove toast, use bell icon only for ALL agent completions (manual and autonomous).

### Design Decision

**Remove toast, use bell icon only** for ALL agent completions (manual and autonomous).

**Rationale:**
- User may navigate away during agent run - toast would be missed
- Bell icon is persistent - user can check completion status anytime
- Consistent UX regardless of how agent was triggered
- Reduces code complexity (one notification path, not two)

### Step 2.1: Remove Toast from Manual Agent Run

**File**: `src/components/agents/AgentMonitor.tsx`
**Location**: Lines 63-75 (in handleRunAgent function)

**Find and DELETE these toast calls:**
```typescript
// DELETE this "info" toast at start:
showToast({
  type: 'info',
  message: `Running ${agent.name}...`,
  duration: 3000
});

// DELETE this "success" toast after completion:
showToast({
  type: 'success',
  message: `Agent completed successfully! Found ${findings.length} new findings.`,
  duration: 5000
});
```

### Step 2.2: Create Notification for Manual Agent Run

**File**: `src/components/agents/AgentMonitor.tsx`
**Location**: After successful agent run (where toast was)

**Add import at top of file:**
```typescript
import { notificationService } from '@/services/notification.service';
```

**Add after successful run (replacing the deleted toast):**
```typescript
// Create notification (same as autonomous runs)
await notificationService.createNotification({
  type: 'agent_complete',
  title: `${agent.name} Complete`,
  message: `Found ${findings.length} new finding${findings.length !== 1 ? 's' : ''} for ${topics.get(agent.topicId) || 'your topic'}`,
  priority: findings.length > 10 ? 'high' : 'medium',
  data: {
    topicId: agent.topicId,
    agentId: agent.id,
    findingsCount: findings.length
  }
});
```

### Step 2.3: Also Remove Error Toast (Use Notification)

**File**: `src/components/agents/AgentMonitor.tsx`
**Location**: In catch block of handleRunAgent

**Replace error toast with notification:**
```typescript
// DELETE this:
showToast({
  type: 'error',
  message: 'Failed to run agent. Check console for details.',
  duration: 5000
});

// REPLACE with:
await notificationService.createNotification({
  type: 'agent_complete',  // Still agent_complete but with error message
  title: `${agent.name} Failed`,
  message: 'Agent run failed. Please try again or check settings.',
  priority: 'high'
});
```

### Step 2.4: Add Delete/Clear to NotificationCenter

**File**: `src/components/NotificationCenter.tsx`

The service already has `deleteNotification()` and `clearAll()` methods but the UI doesn't expose them.

**Add "Clear All" button in header (after "Mark all as read"):**
```typescript
{notifications.length > 0 && (
  <button
    onClick={handleClearAll}
    className="text-xs text-red-600 hover:text-red-500 ml-2"
  >
    Clear all
  </button>
)}
```

**Add handler function:**
```typescript
const handleClearAll = async () => {
  if (window.confirm('Clear all notifications?')) {
    await notificationService.clearAll();
    await loadNotifications();
  }
};
```

**Add delete button to each notification item (X icon):**
```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    handleDelete(notification.id);
  }}
  className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1"
>
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

**Add delete handler:**
```typescript
const handleDelete = async (id: string) => {
  await notificationService.deleteNotification(id);
  await loadNotifications();
};
```

### Step 2.5: Add Auto-Cleanup of Old Notifications

**File**: `src/components/NotificationCenter.tsx`
**Location**: In useEffect, after loadNotifications()

**Add auto-cleanup on mount (delete notifications older than 7 days):**
```typescript
useEffect(() => {
  loadNotifications();

  // Auto-cleanup old notifications (older than 7 days)
  notificationService.deleteOld(7).then(deleted => {
    if (deleted > 0) {
      logger.debug(`[NotificationCenter] Auto-cleaned ${deleted} old notifications`);
      loadNotifications(); // Refresh after cleanup
    }
  });

  // ... rest of useEffect
}, []);
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 2 Local Checklist:**
- [x] Toast calls removed from AgentMonitor.tsx
- [x] Notification service calls added for agent completion
- [x] Delete/Clear UI added to NotificationCenter.tsx
- [x] Auto-cleanup added to NotificationCenter.tsx
- [x] `npm run build` passes with no errors

---

## Phase 3: Remove Research Themes (Complete Removal)

**Goal**: Remove the confusing Themes section entirely from the digest UI.

### Why Remove Themes?

Based on user feedback and analysis:
1. Themes duplicate information already in Executive Summary and Key Takeaways
2. Creates visual clutter with nested cards, badges, and metadata
3. Confuses rather than clarifies - doesn't read like "curated reading material"
4. The practical value is already captured in other sections

### Step 3.1: Remove Themes Section from DigestCard

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 293-373 (DELETE this entire section)

**DELETE this entire block:**
```typescript
{/* Research Themes */}
{digest.themes && digest.themes.length > 0 && (
  <Card>
    <CardHeader
      className="cursor-pointer"
      onClick={() => toggleSection('themes')}
    >
      {/* ... entire themes card content ... */}
    </CardHeader>
    {expandedSections.has('themes') && (
      <CardContent className="space-y-3">
        {/* ... theme mapping ... */}
      </CardContent>
    )}
  </Card>
)}
```

### Step 3.2: Remove Theme-Related Helper Functions from DigestCard

**File**: `src/components/DigestCard.tsx`

**DELETE the getCategoryIcon function (lines ~101-118):**
```typescript
// DELETE THIS FUNCTION:
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'treatment':
      return <Pill className="h-4 w-4" />;
    // ... rest of function
  }
};
```

**DELETE the getImportanceBadgeColor function (lines ~86-99):**
```typescript
// DELETE THIS FUNCTION:
const getImportanceBadgeColor = (importance: string) => {
  switch (importance) {
    case 'critical':
      return 'destructive';
    // ... rest of function
  }
};
```

### Step 3.3: Remove Unused Imports from DigestCard

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 1-30 (imports section)

**Remove these imports if they're ONLY used for themes:**
- `BarChart3` from lucide-react (used for themes header icon)
- `Pill` from lucide-react (if only used in getCategoryIcon)
- `Building2` from lucide-react (if only used in getCategoryIcon)
- `Info` from lucide-react (if only used in getCategoryIcon)

**Before editing, search each import to verify it's not used elsewhere in the file.**

### Step 3.4: Remove 'themes' from expandedSections Default

**File**: `src/components/DigestCard.tsx`
**Location**: Find where expandedSections is initialized

**Find code like:**
```typescript
const [expandedSections, setExpandedSections] = useState<Set<string>>(
  new Set(['takeaways', 'themes'])
);
```

**Change to:**
```typescript
const [expandedSections, setExpandedSections] = useState<Set<string>>(
  new Set(['takeaways'])
);
```

### Step 3.5: DELETE ThemeAccordion Component

**File**: `src/components/ThemeAccordion.tsx`
**Action**: DELETE THE ENTIRE FILE

This component is 285 lines that will no longer be used.

### Step 3.6: Search and Remove ThemeAccordion Imports

**Run this search to find any files importing ThemeAccordion:**
```bash
grep -r "ThemeAccordion" src/
```

**For each file found, remove the import line:**
```typescript
// DELETE lines like:
import { ThemeAccordion } from './ThemeAccordion';
import { ThemeAccordion } from '../ThemeAccordion';
```

### Step 3.7: Update SmartDigest Type (Keep for Backend Compatibility)

**File**: `src/types/index.ts`
**Location**: Find the SmartDigest interface

**DO NOT delete the themes field** - the backend still generates it. Just keep it optional:
```typescript
// In SmartDigest interface, ensure themes is optional:
themes?: DigestTheme[];  // Keep ? for optional
```

### Step 3.8: Update Export Service

**File**: `src/services/export.service.ts`
**Location**: Find where themes are exported (around line 335)

**Find and DELETE this block:**
```typescript
// Add themes
digest.themes.forEach((theme, index) => {
  summaryData.push({
    'Field': `Theme ${index + 1}`,
    'Value': `${theme.name}: ${theme.description}`
  });
});
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 3 Local Checklist:**
- [x] Themes section removed from DigestCard.tsx
- [x] getCategoryIcon function deleted
- [x] getImportanceBadgeColor function deleted
- [x] Unused imports removed (BarChart3, Info, Pill, Shield, Building2)
- [x] 'themes' removed from expandedSections default (already correct - was ['takeaways'])
- [x] ThemeAccordion.tsx DELETED
- [x] ThemeAccordion imports removed from all files (none existed - component was unused)
- [x] Export service updated (themes export removed)
- [x] `npm run build` passes with no errors

---

## Phase 4: Clean Up Remaining Theme References

**Goal**: Ensure no dead code or broken references remain.

### Step 4.1: Search for Remaining Theme References

**Run these searches and review each file:**

```bash
# Search for theme-related code
grep -rn "themes" src/components/
grep -rn "DigestTheme" src/
grep -rn "getCategoryIcon" src/
grep -rn "getImportanceBadgeColor" src/
```

**For each match found:**
1. If it's displaying themes in UI → Remove the code
2. If it's a type definition → Keep it (backend compatibility)
3. If it's in a service layer → Review if still needed

### Step 4.2: Files to Review (Based on grep results)

| File | Action |
|------|--------|
| `src/services/digest.service.ts` | KEEP - transforms backend data |
| `src/types/index.ts` | KEEP - type definitions for backend |
| `src/components/research/digest/DigestPanel.tsx` | REVIEW - remove if passing themes to components |
| `src/components/research/drawers/SourceDrawer.tsx` | REVIEW - may reference themes |
| `src/components/FindingsMetricsExplainer.tsx` | REVIEW - may explain themes |

### Step 4.3: Verify No Dead Code

After all changes, run:
```bash
npm run build
```

If there are unused variable warnings, remove those variables.

**✅ Phase 4 Local Checklist:**
- [x] All theme references searched and reviewed
- [x] UI theme displays removed (themes entry in FindingsMetricsExplainer.tsx)
- [x] Type definitions kept for backend compatibility (src/types/index.ts)
- [x] No unused variable warnings
- [x] `npm run build` passes with no errors
- [x] Fixed bug: DigestPanel.tsx theme?.name → theme?.title
- [x] Updated text: DigestPanel.tsx removed "themes" from description

---

## Phase 5: Build Verification

### Step 5.1: Frontend Build

```bash
# From project root
npm run build
# Must complete with exit code 0
# Check for any warnings about unused imports
```

### Step 5.2: Backend Build

```bash
cd backend && npm run build
# Must complete with exit code 0
```

**✅ Phase 5 Local Checklist:**
- [ ] Frontend build passes with no errors
- [ ] Backend build passes with no errors
- [ ] No unused import warnings

---

## Phase 6: Deployment

### Step 6.1: Commit Changes

```bash
git add -A
git status
# Review all changed/deleted files

git commit -m "fix: agent creation + unified notifications + remove themes

Agent System Fixes:
- Add error handling to createDefaultsForTopic() - continues if one agent fails
- Add idempotency check - skips if agent type already exists
- Add /api/agents/repair/:topicId endpoint for fixing existing topics

Notification Improvements:
- Remove toast notifications for agent completion
- Use bell icon notifications consistently (manual + autonomous runs)
- Add delete button to individual notifications
- Add 'Clear all' button to notification center
- Add auto-cleanup of notifications older than 7 days

Digest UI Simplification:
- Remove Research Themes section entirely from DigestCard
- Delete ThemeAccordion.tsx component (285 lines removed)
- Remove theme-related helper functions
- Update export service to not include themes

Rationale:
- Themes duplicated info already in Summary/Takeaways
- Toast was missed if user navigated away
- Bell icon provides persistent notification status

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Step 6.2: Push and Deploy

```bash
# Push to remote
git push origin fix/digest-findings-race-condition

# SSH to server
ssh chee@100.94.82.35

# Deploy
cd /home/chee/medical-pwa
git pull origin fix/digest-findings-race-condition
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify containers running
docker ps
```

### Step 6.3: Repair Missing Agent

After deployment, call the repair endpoint:

```bash
# From the server, or via curl:
curl -X POST "http://localhost:3001/api/agents/repair/cb64975c-6f96-4442-b865-03e148ade27f" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Or via the frontend by adding a temporary button, or via browser dev tools.

**✅ Phase 6 Deployment Checklist:**
- [ ] Changes committed with proper message
- [ ] Pushed to remote
- [ ] Pulled on Debian server
- [ ] Containers rebuilt
- [ ] Agent repair endpoint called

---

## Phase 7: Production Verification

### Checklist

- [ ] **Agent Creation**: Create a new topic → should create all 3 agents
- [ ] **Agent Repair**: Call repair endpoint → should create Medical Literature Agent
- [ ] **Agent Completion**: Run an agent → notification appears in bell icon (no toast)
- [ ] **Agent Completion**: Notification shows agent name and findings count
- [ ] **Notifications**: Can delete individual notification (X button)
- [ ] **Notifications**: Can clear all notifications
- [ ] **Notifications**: Old notifications (>7 days) auto-cleaned on load
- [ ] **Digest UI**: No "Research Themes" section visible
- [ ] **Digest UI**: Shows: Key Insight, Takeaways, Breakthroughs, Questions, Warnings, Contradictions
- [ ] **Digest UI**: Empty sections are hidden (e.g., no breakthroughs = no section)
- [ ] **Build**: No TypeScript errors
- [ ] **Build**: No unused import warnings
- [ ] **Export**: PDF/CSV export works without themes

---

## Rollback Plan

If issues occur:

### UI Issues (DigestCard.tsx)
```bash
git checkout HEAD~1 -- src/components/DigestCard.tsx
npm run build
# Redeploy
```

### Backend Issues (agent.model.ts)
```bash
git checkout HEAD~1 -- backend/src/models/agent.model.ts
cd backend && npm run build
# Redeploy
```

### Full Rollback
```bash
git revert HEAD
git push
# Redeploy on server
```

---

## Files Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `backend/src/models/agent.model.ts` | MODIFY | ~30 lines added (error handling) |
| `backend/src/routes/agents.routes.ts` | MODIFY | ~50 lines added (repair endpoint) |
| `src/components/agents/AgentMonitor.tsx` | MODIFY | ~20 lines changed (toast → notification) |
| `src/components/NotificationCenter.tsx` | MODIFY | ~30 lines added (delete/clear UI) |
| `src/components/DigestCard.tsx` | MODIFY | ~100 lines removed (themes section) |
| `src/components/ThemeAccordion.tsx` | DELETE | 285 lines removed |
| `src/services/export.service.ts` | MODIFY | ~10 lines removed (themes export) |

**Net change**: Approximately 200 lines removed (simpler codebase)

---

## Document History

- **Created**: February 6, 2026
- **Author**: Claude Opus 4.5
- **Status**: Ready for implementation

---

## Phase Completion Sign-off

### Local Development
- [ ] Phase 1: Backend agent fixes complete
- [ ] Phase 2: Agent notification improvements complete
- [ ] Phase 3: Theme removal complete
- [ ] Phase 4: Dead code cleanup complete
- [ ] Phase 5: All builds pass

### Deployment
- [ ] Changes committed with proper message
- [ ] Pushed to remote
- [ ] Pulled on Debian server
- [ ] Containers rebuilt
- [ ] Agent repair endpoint called

### Production Testing
- [ ] All verification checklist items pass
- [ ] No console errors
- [ ] No visual regressions

### Sign-off
- [ ] All phases complete (Date: _______)
- [ ] Document archived after completion
