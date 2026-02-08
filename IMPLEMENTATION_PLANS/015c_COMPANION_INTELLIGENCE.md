# Plan 015c — Companion Intelligence

## STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for Plan 015c — adding Research Pulse and Worth Revisiting features to the digest pipeline and home page. These two AI-powered features transform the home page from a data dashboard into a thoughtful research companion that surfaces intelligence, not just numbers.**

**This plan builds on Plan 015b's home page layout** (DigestSignposts in 3-col bento grid) and touches all 12 layers of the digest pipeline.

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
│ - Commit changes to git after each phase                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: FULL BUILD VERIFICATION & DEPLOYMENT                    │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - DB migration on production                                     │
│ - Trigger digest regeneration to test AI output                  │
│ - Visual verification at all breakpoints + dark mode             │
│ - Deploy to Debian server                                        │
│ - Production visual verification                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Status

- **Phase**: COMPLETE
- **Created**: February 8, 2026
- **Priority**: HIGH — Next feature after UI overhaul
- **Branch**: `feat/ui-overhaul` (continue from Plan 015b)
- **Predecessor**: Plan 015b (Layout & Spatial Design Refinements — Complete)

---

## What This Plan Adds

### Feature 1: Research Pulse
A single AI-generated sentence per topic summarizing the research landscape state, written in a warm companion voice.

**Example**: *"Your Haemophilia research has 3 new breakthroughs this week, including a gene therapy trial showing 94% factor VIII restoration in Phase 2 participants."*

- Generated alongside digest (one extra instruction in Claude prompt, no extra AI calls)
- Stored as `research_pulse TEXT` column on `digests` table
- Displayed on home page, replacing DigestSignposts

### Feature 2: Worth Revisiting
AI-identified connections between older findings and recent breakthroughs, displayed in a dedicated center modal.

**Example**: *"Gene therapy finding (Jan 23) ↔ Factor VIII breakthrough — Shared therapeutic target: Both studies validate AAV vector delivery for hemophilia A, with the newer trial confirming the mechanism proposed earlier."*

- Generated alongside digest — Claude examines all findings and identifies 0-3 meaningful connections
- Stored as `worth_revisiting JSONB` column on `digests` table
- Clickable nudge cards open a center modal showing both findings side-by-side

---

## Workshop Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pulse scope | One pulse per topic | Clear separation, dashboard has space for multiple cards |
| Pulse voice | Warm companion ("Your research has...") | Matches chat companion persona from Plan 012 |
| Pulse card content | Pure narrative only — NO counts/badges | Counts live in digest itself; pulse is intelligence, not data |
| Empty state | Hide section entirely (conditional render) | Same pattern as FindingsHighlights — clean empty state |
| WR connection count | Flexible: 0–3, Claude decides | Only surface genuinely meaningful connections with strong reasoning |
| WR evidence | Explanation + confidence qualifier | connectionBasis: "Shared therapeutic target", etc. — transparency |
| WR interaction | Center modal, side-by-side findings | Showcases powerful capabilities; drawer too constrained |
| WR data model | Both finding IDs + inline titles/summaries | IDs for future navigation, inline data for immediate display |
| WR modal type | Center overlay (max-w-2xl) | Focused "discovery moment" feel, not a right-panel drawer |
| New npm dependencies | NONE | All features use native APIs and existing lucide-react icons |

---

## MUST DO Rules

- [ ] Follow phases IN ORDER — do not skip
- [ ] Run `npm run build` (frontend) or `cd backend && npm run build` (backend) after EACH file change
- [ ] Update ALL 12 layers of the digest pipeline for each new field
- [ ] Update BOTH save paths (background processor + CRUD model)
- [ ] Add new fields to the Zod validation schema (Layer 6) — this strips unknown fields silently!
- [ ] Add new fields to the JSON schema `properties` object (Layer 1) — `additionalProperties: false` means Claude won't return unlisted fields!
- [ ] Update ALL fallback return paths in ai.service.ts (there are 5)
- [ ] Verify dark mode works after each phase
- [ ] Keep all existing functionality — behavior changes limited to home page bottom row

## MUST NOT DO Rules

- [ ] Do NOT add new npm dependencies
- [ ] Do NOT delete `DigestSignposts.tsx` — keep for rollback
- [ ] Do NOT change database schema beyond the 2 ALTER TABLE statements
- [ ] Do NOT change any existing digest fields or their behavior
- [ ] Do NOT add `researchPulse` or `worthRevisiting` to the `required` array in the JSON schema
- [ ] Do NOT make the WR modal a right-panel drawer (it's a center modal)
- [ ] Do NOT break mobile layout (320-768px must work)
- [ ] Do NOT touch the chat panel component (`ChatPanel.tsx`)
- [ ] Do NOT change the Container component (`container.tsx`)

---

## Critical Pipeline Gotchas (Read Before Coding!)

### Gotcha 1: `additionalProperties: false` in JSON Schema (Layer 1)
The `digestJSONSchema` in `digest.schema.ts` has `additionalProperties: false` on line 432. If `researchPulse` and `worthRevisiting` are NOT explicitly listed in the `properties` object, Claude's tool_use will NOT include them in its output — they'll be silently omitted.

### Gotcha 2: Zod Strips Unknown Fields (Layer 6)
`CreateDigestSchema.safeParse()` in `digests.crud.routes.ts` silently drops any fields NOT in the schema. If you forget to add the new fields here, the frontend-initiated save path will lose them even though the backend processor path works fine.

### Gotcha 3: Two Save Paths
- **Background processor path**: `ai.service.ts` → `digest-processor.service.ts` → direct INSERT (23→25 columns)
- **Frontend-initiated path**: `saveDigest()` → POST `/api/digests` → Zod validation → `DigestModel.create()` (15→17 columns)
- BOTH paths must have the new columns!

### Gotcha 4: Five Return Paths in ai.service.ts
The `generateSmartDigest` function has 5 return paths, all of which must include the new fields:
1. Main return (line 670) — successful digest generation
2. Graceful recovery (line 580) — Zod validation failed, partial data recovered
3. Minimal fallback (line 604) — recovery also failed
4. Timeout fallback (line 704) — API call timed out
5. Simple digest fallback (line 741) — tools approach failed entirely

### Gotcha 5: Triple Fallback in transformToFrontend
The frontend `transformToFrontend` uses a triple-fallback pattern for fields that might arrive as camelCase (from SELECT alias), snake_case (from raw CRUD), or inside the metadata blob (from old digests). Follow this pattern for the new fields.

---

## Phase 1: Backend Pipeline (Layers 1–9)

**Goal**: Add `research_pulse` and `worth_revisiting` to all backend layers of the digest pipeline, including the AI prompt, schema, processor, CRUD model, Zod validation, and API routes.

### Step 1.1: Update AI JSON Schema (Layer 1)

**File**: `backend/src/schemas/digest.schema.ts`

**Change 1** — Add to the Zod `SmartDigestSchema` (after `sourceBreakdown` on line 71, before `themes` on line 73):

```typescript
  // Companion Intelligence fields (Plan 015c)
  researchPulse: z.string().optional().default(''),
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
```

**Change 2** — Add to `digestJSONSchema.properties` (after the `warningSigns` block ending on line 429, before the closing `}` on line 430):

```typescript
    researchPulse: {
      type: 'string',
      description: 'A single warm, companion-voice sentence summarizing the state of research for this topic. Address the user directly with "Your". Example: "Your Haemophilia research has 3 new breakthroughs this week, including a promising gene therapy trial that could change treatment approaches." Write in a caring, knowledgeable companion tone — not clinical, not overly casual. 1-2 sentences max.'
    },
    worthRevisiting: {
      type: 'array',
      description: 'Identify 0-3 meaningful connections between OLDER findings and RECENT breakthroughs. Only include genuinely significant connections with strong reasoning. Return empty array [] if no meaningful connections exist. Each connection MUST reference real finding IDs from the data.',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          oldFindingId: {
            type: 'string',
            description: 'UUID of the older finding — MUST be exact ID from the "ID:" field in the finding data'
          },
          oldFindingTitle: {
            type: 'string',
            description: 'Title of the older finding (for immediate display without DB lookup)'
          },
          oldFindingSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the older finding'
          },
          newBreakthroughId: {
            type: 'string',
            description: 'UUID of the recent breakthrough finding — MUST be exact ID from the "ID:" field in the finding data'
          },
          newBreakthroughTitle: {
            type: 'string',
            description: 'Title of the recent breakthrough (for immediate display)'
          },
          newBreakthroughSummary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the recent breakthrough'
          },
          connectionExplanation: {
            type: 'string',
            description: 'WHY these two findings connect. 1-2 sentences explaining the meaningful link. Must be specific — cite the mechanism, pathway, or evidence, not vague associations.'
          },
          connectionBasis: {
            type: 'string',
            description: 'Brief qualifier phrase (2-5 words). Examples: "Shared therapeutic target", "Same gene pathway", "Contradictory dosing evidence", "Complementary mechanisms"'
          }
        },
        required: ['oldFindingId', 'oldFindingTitle', 'oldFindingSummary', 'newBreakthroughId', 'newBreakthroughTitle', 'newBreakthroughSummary', 'connectionExplanation', 'connectionBasis']
      }
    }
```

**Do NOT** add `researchPulse` or `worthRevisiting` to the `required` array on line 431. They must remain optional.

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.2: Update AI Prompt (Layer 2)

**File**: `backend/src/services/ai.service.ts`

**Change 1** — Add to the system prompt, after the WARNING SIGNS section (after line 506 `- explained: Everyday descriptions anyone would recognize...`), before the closing backtick:

```
## COMPANION INTELLIGENCE

### RESEARCH PULSE
Generate a single warm, companion-voice sentence summarizing the current state of this topic's research landscape. This sentence appears on the home page as the user's "research companion" speaking to them.

RULES:
1. Address the user directly with "Your" (e.g., "Your Haemophilia research...")
2. Reference specific counts from the findings (breakthroughs, new studies, contradictions)
3. Highlight the SINGLE most noteworthy development
4. Warm, knowledgeable tone — like a research-savvy friend, not a clinical report
5. Maximum 2 sentences. Aim for 1 when possible.
6. Never use generic phrases like "Things are progressing" or "Research continues"

EXAMPLES:
- "Your Haemophilia research has 3 new breakthroughs this week, including a gene therapy trial showing 94% factor VIII restoration in Phase 2 participants."
- "Two recent PubMed studies on your Acromegaly topic present conflicting findings about pegvisomant dosing — worth reviewing with your endocrinologist."
- "A quiet week for your Cancer research, but one FDA fast-track designation for pembrolizumab in microsatellite-unstable tumors could be significant."

### WORTH REVISITING
Examine ALL findings (old and new) and identify 0-3 meaningful connections between OLDER findings and RECENT breakthroughs. Only surface genuinely significant connections.

RULES:
1. Return EMPTY ARRAY [] if no meaningful connections exist — NEVER force connections
2. The oldFindingId and newBreakthroughId MUST be exact UUIDs from the "ID:" field in the finding data
3. connectionExplanation must be SPECIFIC: cite the mechanism, pathway, or evidence that links them
4. connectionBasis must be a SHORT qualifier (2-5 words): "Shared therapeutic target", "Same gene pathway", etc.
5. Prefer connections where the newer finding VALIDATES, CONTRADICTS, or EXTENDS the older one
6. Do NOT create connections based solely on both mentioning the same disease — that is too vague
7. Include inline titles and summaries so the UI can display without database lookups
```

**Change 2** — Add to the user message, after line 531 (`Focus on practical, actionable information that helps with treatment decisions.`):

```
COMPANION INTELLIGENCE (REQUIRED):
- researchPulse: A single warm companion-voice sentence about this topic's research state. Address the user directly with "Your". Reference specific counts.
- worthRevisiting: 0-3 connections between older findings and recent breakthroughs. Use exact finding UUIDs from the ID fields above. Return empty array [] if no meaningful connections exist.
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.3: Update AI Return Value (Layer 3)

**File**: `backend/src/services/ai.service.ts`

Add the new fields to ALL 5 return paths:

**Return path 1** — Main return (line 691, after `sourceBreakdown: digestData.sourceBreakdown || null,`):
```typescript
      // Companion Intelligence fields
      researchPulse: digestData.researchPulse || '',
      worthRevisiting: digestData.worthRevisiting || [],
```

**Return path 2** — Graceful recovery (line 591, after `sourceBreakdown: digestData.sourceBreakdown || undefined,`):
```typescript
          researchPulse: digestData.researchPulse || '',
          worthRevisiting: Array.isArray(digestData.worthRevisiting) ? digestData.worthRevisiting : [],
```

**Return path 3** — Minimal fallback (line 614, after `sourceBreakdown: null,`):
```typescript
          researchPulse: '',
          worthRevisiting: [],
```

**Return path 4** — Timeout fallback (line 719, after `sourceBreakdown: null`):
```typescript
        researchPulse: '',
        worthRevisiting: [],
```

**Return path 5** — Simple digest fallback (line 766, after `sourceBreakdown: null`):
```typescript
        researchPulse: '',
        worthRevisiting: [],
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.4: Update Background Processor INSERT (Layer 4)

**File**: `backend/src/services/digest-processor.service.ts`

The INSERT on lines 231-279 currently has 23 columns ($1-$23). Add 2 more.

**Change 1** — Add column names (after `source_breakdown` on line 238):
```sql
        featured_discovery, top_findings, source_breakdown,
        research_pulse, worth_revisiting
```

**Change 2** — Update VALUES to add `$24, $25`:
```sql
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23,
        $24, $25
      )
```

**Change 3** — Add to params array (after line 277 `JSON.stringify((digest as any).sourceBreakdown || countSourcesByType(findings))`):
```typescript
        (digest as any).researchPulse || '',
        JSON.stringify((digest as any).worthRevisiting || [])
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.5: Update CRUD Model (Layer 5 + Layer 8)

**File**: `backend/src/models/digest.model.ts`

**Change 1** — Add to `Digest` interface (after `source_breakdown?: any;` on line 19):
```typescript
  research_pulse?: string;
  worth_revisiting?: any[];
```

**Change 2** — Add to `CreateDigestData` interface (after `source_breakdown?: any;` on line 37):
```typescript
  research_pulse?: string;
  worth_revisiting?: any[];
```

**Change 3** — Update `create()` method INSERT (lines 85-109). Currently 15 columns ($1-$15). Add 2 more.

Column list (after `featured_discovery, top_findings, source_breakdown`):
```sql
         featured_discovery, top_findings, source_breakdown,
         research_pulse, worth_revisiting
```

VALUES (change to `$1` through `$17`):
```sql
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
```

Params array (after `JSON.stringify(data.source_breakdown || null)` on line 108):
```typescript
        data.research_pulse || '',
        JSON.stringify(data.worth_revisiting || [])
```

**Change 4** — Update `update()` method `allowedFields` (line 121-123). Add:
```typescript
    const allowedFields = [
      'title', 'executive_summary', 'themes', 'contradictions',
      'breakthroughs', 'knowledge_gaps', 'next_steps', 'metadata',
      'research_pulse', 'worth_revisiting'
    ];
```

**Change 5** — Update `update()` method JSON.stringify check (line 131). Add `'worth_revisiting'`:
```typescript
        if (['themes', 'contradictions', 'breakthroughs', 'knowledge_gaps', 'next_steps', 'metadata', 'worth_revisiting'].includes(key)) {
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.6: Update CRUD Zod Validation (Layer 6 — THE GOTCHA!)

**File**: `backend/src/routes/digests.crud.routes.ts`

Add after `source_breakdown: z.any().optional()` on line 29:

```typescript
  research_pulse: z.string().optional(),
  worth_revisiting: z.array(z.any()).optional(),
```

**WHY THIS IS CRITICAL**: `CreateDigestSchema.safeParse()` silently strips any fields NOT in the schema. Without this change, the frontend `saveDigest()` path will silently drop both new fields even though the background processor path works fine. This is the most commonly missed layer.

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.7: Update API Route SELECT Aliases (Layer 9)

**File**: `backend/src/routes/digest.routes.ts`

Add after `source_breakdown as "sourceBreakdown",` on line 41:

```sql
        research_pulse as "researchPulse",
        worth_revisiting as "worthRevisiting",
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.8: Update Dashboard Stats API (Layer 12)

**File**: `backend/src/routes/dashboard.routes.ts`

**Change 1** — Add columns to the digest SELECT query (lines 57-67). Add `d.research_pulse, d.worth_revisiting` to the SELECT:

For the topic-specific query (line 57):
```sql
        ? `SELECT d.id, d.topic_id, t.name as topic_name,
                  d.breakthroughs, d.contradictions, d.knowledge_gaps,
                  d.research_pulse, d.worth_revisiting,
                  d.created_at
```

For the all-topics query (line 64):
```sql
        : `SELECT DISTINCT ON (d.topic_id)
                  d.id, d.topic_id, t.name as topic_name,
                  d.breakthroughs, d.contradictions, d.knowledge_gaps,
                  d.research_pulse, d.worth_revisiting,
                  d.created_at
```

**Change 2** — Add to the signpost mapping return object (after `topBreakthroughs,` on line 106):

```typescript
        researchPulse: d.research_pulse || '',
        worthRevisiting: typeof d.worth_revisiting === 'string' ? JSON.parse(d.worth_revisiting) : (d.worth_revisiting || []),
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.9: Update init.sql

**File**: `backend/src/db/init.sql`

Add after `source_breakdown JSONB DEFAULT NULL,` on line 110:

```sql
    research_pulse TEXT,                          -- AI companion pulse sentence (Plan 015c)
    worth_revisiting JSONB DEFAULT '[]'::jsonb,   -- AI-identified finding connections (Plan 015c)
```

**Verification**: `cd backend && npm run build` — no errors.

### Step 1.10: Phase 1 Build Verification

```bash
cd backend && npm run build
```

Must produce zero errors. All 8 backend files must compile cleanly.

**Checkpoint**: Commit with message `feat(digest): add Research Pulse and Worth Revisiting to backend pipeline (Plan 015c)`

---

## Phase 2: Frontend Pipeline (Layers 7, 10, 11)

**Goal**: Add `researchPulse` and `worthRevisiting` to the frontend TypeScript types, digest service transforms, and uiStore modal key.

### Step 2.1: Add TypeScript Types (Layer 11)

**File**: `src/types/index.ts`

**Change 1** — Add new interface BEFORE the `SmartDigest` interface (before line 529):

```typescript
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
```

**Change 2** — Add fields to the `SmartDigest` interface (after `sourceBreakdown?: SourceBreakdown;` on line 599):

```typescript
  // Companion Intelligence fields (Plan 015c)
  researchPulse?: string;
  worthRevisiting?: WorthRevisiting[];
```

**Verification**: `npm run build` — no errors.

### Step 2.2: Update transformToFrontend (Layer 10)

**File**: `src/services/digest.service.ts`

Add after the `sourceBreakdown` triple-fallback line on line 189:

```typescript
      // Companion Intelligence fields (triple fallback: camelCase alias → snake_case → metadata blob)
      researchPulse: apiDigest.researchPulse || apiDigest.research_pulse || apiDigest.metadata?.researchPulse || '',
      worthRevisiting: apiDigest.worthRevisiting || apiDigest.worth_revisiting || apiDigest.metadata?.worthRevisiting || [],
```

**Why triple fallback**: Data might arrive from the aliased SELECT (camelCase `researchPulse`), from the raw CRUD endpoint (snake_case `research_pulse`), or from old digests that may have stored it in the metadata blob. This is the established pattern used for `featuredDiscovery`, `topFindings`, and `sourceBreakdown`.

**Verification**: `npm run build` — no errors.

### Step 2.3: Update transformToBackend (Layer 7)

**File**: `src/services/digest.service.ts`

Add after `source_breakdown: digest.sourceBreakdown || null,` on line 226:

```typescript
      research_pulse: digest.researchPulse || '',
      worth_revisiting: digest.worthRevisiting || [],
```

**Verification**: `npm run build` — no errors.

### Step 2.4: Add uiStore Modal Key

**File**: `src/stores/uiStore.ts`

**Change 1** — Update `ModalKey` type (line 24):
```typescript
// FIND:
type ModalKey = 'findingDetail' | 'sourceDrawer' | 'digestSettings' | 'topicEdit' | 'topicCreate' | 'agentMonitor';

// REPLACE WITH:
type ModalKey = 'findingDetail' | 'sourceDrawer' | 'digestSettings' | 'topicEdit' | 'topicCreate' | 'agentMonitor' | 'worthRevisiting';
```

**Change 2** — Update `ModalStates` interface (line 51-58, add after `agentMonitor: boolean;`):
```typescript
  worthRevisiting: boolean;
```

**Change 3** — Update `defaultModals` (line 180-187, add after `agentMonitor: false`):
```typescript
  worthRevisiting: false
```

**Important**: The `worthRevisiting` modal is a CENTER modal, NOT a right-panel drawer. The existing `openModal` action (line 279) checks `isRightPanel` which only matches `findingDetail` and `sourceDrawer`. The `worthRevisiting` modal does NOT need to trigger mutual exclusivity with chat — it coexists with chat just like `digestSettings` does.

**Verification**: `npm run build` — no errors.

### Step 2.5: Phase 2 Build Verification

```bash
npm run build
```

Must produce zero errors.

**Checkpoint**: Commit with message `feat(digest): add Research Pulse and Worth Revisiting to frontend pipeline (Plan 015c)`

---

## Phase 3: Worth Revisiting Modal

**Goal**: Create a center modal component that displays two findings side-by-side with a connection explanation between them.

### Step 3.1: Create WorthRevisitingModal Component

**CREATE new file**: `src/components/home/WorthRevisitingModal.tsx`

```tsx
import { X, Link2, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorthRevisiting } from '@/types';

interface WorthRevisitingModalProps {
  item: WorthRevisiting | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WorthRevisitingModal({ item, isOpen, onClose }: WorthRevisitingModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--color-surface)] rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-muted)]">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Worth Revisiting</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Connection basis badge */}
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {item.connectionBasis}
            </span>
          </div>

          {/* Two finding cards: side-by-side on md+, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Older Finding */}
            <div className="border border-[var(--color-border-muted)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Earlier Finding</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.oldFindingTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.oldFindingSummary}</p>
            </div>

            {/* Recent Breakthrough */}
            <div className="border border-amber-300 dark:border-amber-700 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Recent Breakthrough</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{item.newBreakthroughTitle}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.newBreakthroughSummary}</p>
            </div>
          </div>

          {/* Connection explanation */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--color-surface-sunken)]">
            <Link2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Why this matters: </span>
              <span className="text-sm text-[var(--color-text-secondary)]">{item.connectionExplanation}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border-muted)] p-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
```

**Design notes**:
- Center modal with `max-w-2xl` (672px) — enough for two cards side-by-side
- `grid-cols-1 md:grid-cols-2` — cards stack vertically on mobile, side-by-side on tablet+
- Amber accent for the breakthrough card (matches existing breakthrough color scheme)
- `bg-[var(--color-surface-sunken)]` for the connection explanation panel
- Uses CSS variables throughout for dark mode compatibility
- Backdrop click dismisses (`onClick={onClose}` on backdrop div)
- Icons from lucide-react: `X`, `Link2`, `Clock`, `TrendingUp` — all already available

**Verification**: `npm run build` — no errors.

### Step 3.2: Phase 3 Build Verification

```bash
npm run build
```

Must produce zero errors.

**Checkpoint**: Commit with message `feat(home): add WorthRevisitingModal center overlay (Plan 015c)`

---

## Phase 4: Research Pulse Home Page Card

**Goal**: Create the ResearchPulseCard component that replaces DigestSignposts, and update HomePage to use it.

### Step 4.1: Create ResearchPulseCard Component

**CREATE new file**: `src/components/home/ResearchPulseCard.tsx`

```tsx
import { Brain, ArrowRight, Link2 } from 'lucide-react';
import type { WorthRevisiting } from '@/types';

interface ResearchPulseSignpost {
  id: string;
  topicId: string;
  topicName: string;
  breakthroughCount: number;
  contradictionCount: number;
  knowledgeGapCount: number;
  topBreakthroughs?: string[];
  researchPulse: string;
  worthRevisiting: WorthRevisiting[];
  createdAt: string;
}

interface ResearchPulseCardProps {
  signposts: ResearchPulseSignpost[];
  onOpenDigest: (topicId: string) => void;
  onWorthRevisitingClick: (item: WorthRevisiting) => void;
}

export function ResearchPulseCard({ signposts, onOpenDigest, onWorthRevisitingClick }: ResearchPulseCardProps) {
  // Only show signposts that have a Research Pulse
  const pulseSignposts = signposts.filter(s => s.researchPulse && s.researchPulse.trim().length > 0);

  if (pulseSignposts.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Research Companion</h3>
        </div>
      </div>

      {/* Per-topic pulse cards */}
      <div className="p-5 space-y-4">
        {pulseSignposts.map(signpost => (
          <div key={signpost.id} className="border border-[var(--color-border-muted)] rounded-lg p-4">
            {/* Topic header + Open digest link */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{signpost.topicName}</h4>
              <button
                onClick={() => onOpenDigest(signpost.topicId)}
                className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
              >
                Open digest <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Pulse sentence */}
            <p className="text-sm text-[var(--color-text-secondary)] italic leading-relaxed">
              &ldquo;{signpost.researchPulse}&rdquo;
            </p>

            {/* Worth Revisiting nudges */}
            {signpost.worthRevisiting && signpost.worthRevisiting.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border-muted)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Link2 className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">Worth Revisiting</span>
                </div>
                <div className="space-y-2">
                  {signpost.worthRevisiting.map((wr, idx) => (
                    <button
                      key={idx}
                      onClick={() => onWorthRevisitingClick(wr)}
                      className="w-full text-left p-2.5 rounded-md bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border-muted)] transition-colors group"
                    >
                      <div className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
                        <span>
                          <span className="font-medium text-[var(--color-text-primary)]">{wr.oldFindingTitle}</span>
                          <span className="mx-1.5 text-amber-500">↔</span>
                          <span className="font-medium text-[var(--color-text-primary)]">{wr.newBreakthroughTitle}</span>
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 group-hover:text-[var(--color-text-secondary)] transition-colors">
                        {wr.connectionBasis}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
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

**Design notes**:
- Pure narrative — no breakthrough/contradiction/gap counts (those live in the digest itself)
- Pulse sentence displayed in italic with smart quotes (`&ldquo;`/`&rdquo;`)
- WR nudge cards are clickable buttons that open the WorthRevisitingModal
- Nudge cards show `oldFindingTitle ↔ newBreakthroughTitle` with amber arrow between them
- `connectionBasis` shown as subtle text below (e.g., "Shared therapeutic target")
- `group-hover` pattern for interactive feel
- Returns `null` when no signposts have a non-empty pulse — section hides entirely

**Verification**: `npm run build` — no errors.

### Step 4.2: Update HomePage

**File**: `src/components/HomePage.tsx`

**Change 1** — Replace DigestSignposts import:
```typescript
// FIND:
import { DigestSignposts } from './home/DigestSignposts';

// REPLACE WITH:
import { ResearchPulseCard } from './home/ResearchPulseCard';
import { WorthRevisitingModal } from './home/WorthRevisitingModal';
import type { WorthRevisiting } from '@/types';
```

**Change 2** — Add uiStore imports and handlers. Inside the component function, add:
```typescript
  const modals = useUIStore(state => state.modals);
  const modalData = useUIStore(state => state.modalData);
  const openModal = useUIStore(state => state.openModal);
  const closeModal = useUIStore(state => state.closeModal);

  const handleWorthRevisitingClick = (item: WorthRevisiting) => {
    openModal('worthRevisiting', item);
  };

  const handleOpenDigest = (topicId: string) => {
    setCurrentView('findings');
  };
```

**Note**: Check if `useUIStore` is already imported. If so, just add the new selectors. If not, add the import:
```typescript
import { useUIStore } from '@/stores/uiStore';
```

**Change 3** — Replace the DigestSignposts JSX in the bento grid:

```tsx
// FIND:
        {/* Digest Signposts — only when there are digests with content */}
        {stats.digestSignposts.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <DigestSignposts
              signposts={stats.digestSignposts}
              onViewFindings={handleViewFindings}
            />
          </div>
        )}

// REPLACE WITH:
        {/* Research Pulse — only when there are digests */}
        {stats.digestSignposts.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <ResearchPulseCard
              signposts={stats.digestSignposts}
              onOpenDigest={handleOpenDigest}
              onWorthRevisitingClick={handleWorthRevisitingClick}
            />
          </div>
        )}
```

**Change 4** — Mount WorthRevisitingModal at the end of the component's return JSX (just before the final closing `</div>` or `</>` of the component):

```tsx
      {/* Worth Revisiting Modal */}
      <WorthRevisitingModal
        item={modalData as WorthRevisiting | null}
        isOpen={modals.worthRevisiting}
        onClose={() => closeModal('worthRevisiting')}
      />
```

**Do NOT delete** `src/components/home/DigestSignposts.tsx` — keep the file for rollback.

**Verification**: `npm run build` — no errors.

### Step 4.3: Phase 4 Build Verification and Visual Check

```bash
npm run build
```

**Visual verification** (with existing data — pulse/WR will be empty until digest regeneration):
- [ ] **Home page**: No DigestSignposts visible (replaced by ResearchPulseCard)
- [ ] **Home page**: If no digests have pulse data yet, the Research Companion section is hidden entirely
- [ ] **Bento grid**: Hero + CTAs + FindingsHighlights still render correctly
- [ ] **Hover effects**: Still work on all bento tiles
- [ ] **Dark mode**: No visual regressions
- [ ] **Mobile (375px)**: Layout not broken

**Checkpoint**: Commit with message `feat(home): replace DigestSignposts with ResearchPulseCard and WorthRevisitingModal (Plan 015c)`

---

## Phase 5: Build Verification & Deployment

### Step 5.1: Full Build Verification

```bash
npm run build
cd backend && npm run build
```

Must produce zero errors and zero warnings on both.

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

# Run DB migration
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "ALTER TABLE digests ADD COLUMN IF NOT EXISTS research_pulse TEXT;"
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "ALTER TABLE digests ADD COLUMN IF NOT EXISTS worth_revisiting JSONB DEFAULT '[]'::jsonb;"

# Verify migration
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "\d digests" | grep -E "research_pulse|worth_revisiting"

# Check logs
docker logs medical-companion --tail 50 2>&1
```

### Step 5.3: Trigger Digest Regeneration

Delete existing queue item to force regeneration for a test topic:

```bash
# Find topic IDs
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "SELECT id, name FROM topics LIMIT 10;"

# Delete queue item to allow regeneration
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "DELETE FROM digest_queue WHERE topic_id = '<TOPIC_UUID>';"
```

Then trigger digest generation from the UI (navigate to a topic's digest view and click "Generate Digest").

### Step 5.4: Verify AI Output

```bash
# Check that the new fields were generated and stored
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "SELECT research_pulse, worth_revisiting FROM digests ORDER BY created_at DESC LIMIT 1;"
```

Expected:
- `research_pulse` should contain a warm companion-voice sentence (e.g., "Your Haemophilia research has...")
- `worth_revisiting` should contain a JSON array (possibly empty `[]` if no meaningful connections were found)

### Step 5.5: Check Backend Logs

```bash
docker logs medical-companion --tail 100 2>&1 | grep -i "researchPulse\|worthRevisiting\|pulse\|revisiting"
```

### Step 5.6: Comprehensive Visual Verification

**Home page**:
- [ ] "Research Companion" card appears (not "Latest Digest Insights")
- [ ] Per-topic pulse sentence displays in warm companion voice
- [ ] Pulse sentence is italic with smart quotes
- [ ] "Open digest →" link per topic works
- [ ] Updated timestamp shows correct date

**Worth Revisiting (if connections exist)**:
- [ ] Nudge cards appear below pulse sentence
- [ ] Nudge cards show `oldTitle ↔ newTitle` with amber arrow
- [ ] `connectionBasis` shows below titles
- [ ] Clicking nudge card opens center modal

**WorthRevisitingModal**:
- [ ] Modal overlay appears centered on screen
- [ ] Connection basis badge in amber at top
- [ ] Two finding cards: "Earlier Finding" (left) and "Recent Breakthrough" (right, amber accent)
- [ ] Finding titles and summaries display correctly
- [ ] "Why this matters:" explanation at bottom
- [ ] X button closes modal
- [ ] Backdrop click closes modal
- [ ] **Desktop**: Two cards side-by-side
- [ ] **Mobile (375px)**: Two cards stacked vertically
- [ ] **Dark mode**: Amber accents, surface colors all correct

**Empty states**:
- [ ] No pulse data → Research Companion section hidden entirely
- [ ] Pulse exists but no WR connections → Pulse shows, no "Worth Revisiting" section
- [ ] No topics at all → Same as before (Hero + CTAs only)

**Existing features not broken**:
- [ ] Digest TOC sidebar still works at 1280px+
- [ ] Drawer/chat mutual exclusivity still works
- [ ] Hover effects on bento tiles still work
- [ ] FindingsHighlights still renders for unread findings
- [ ] Chat panel opens/closes correctly
- [ ] WR modal coexists with chat (does NOT trigger mutual exclusivity)
- [ ] No console errors

**Checkpoint**: Commit with message `docs: mark Plan 015c as COMPLETE`

---

## Complete File Inventory

### New Files (2)
| File | Purpose |
|------|---------|
| `src/components/home/ResearchPulseCard.tsx` | Replaces DigestSignposts — pulse sentence + WR nudges |
| `src/components/home/WorthRevisitingModal.tsx` | Center modal showing finding pair + connection explanation |

### Modified Files — Backend (8)
| # | File | Phase | Changes |
|---|------|-------|---------|
| 1 | `backend/src/db/init.sql` | 1 | Add 2 columns to CREATE TABLE digests |
| 2 | `backend/src/schemas/digest.schema.ts` | 1 | Zod schema + JSON schema for Claude tool_use |
| 3 | `backend/src/services/ai.service.ts` | 1 | Prompt instructions + 5 return path defaults |
| 4 | `backend/src/services/digest-processor.service.ts` | 1 | INSERT: 23→25 columns, 2 new params |
| 5 | `backend/src/models/digest.model.ts` | 1 | 2 interfaces + create() INSERT: 15→17 + update() |
| 6 | `backend/src/routes/digests.crud.routes.ts` | 1 | Zod validation (THE GOTCHA — strips unknown fields!) |
| 7 | `backend/src/routes/digest.routes.ts` | 1 | 2 new SELECT aliases |
| 8 | `backend/src/routes/dashboard.routes.ts` | 1 | Dashboard stats query + signpost mapping |

### Modified Files — Frontend (4)
| # | File | Phase | Changes |
|---|------|-------|---------|
| 9 | `src/types/index.ts` | 2 | WorthRevisiting interface + SmartDigest fields |
| 10 | `src/services/digest.service.ts` | 2 | transformToFrontend + transformToBackend |
| 11 | `src/stores/uiStore.ts` | 2 | Add 'worthRevisiting' modal key |
| 12 | `src/components/HomePage.tsx` | 4 | Swap DigestSignposts → ResearchPulseCard, mount modal |

### Kept (not deleted)
| File | Note |
|------|------|
| `src/components/home/DigestSignposts.tsx` | Kept for rollback — import removed from HomePage |
| `src/components/home/ActivityChart.tsx` | Already kept from 015b — untouched |

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `additionalProperties: false` blocks Claude output | HIGH if missed | Explicitly listed both fields in `digestJSONSchema.properties` (Step 1.1 Change 2) |
| Zod strips new fields silently | HIGH if missed | Explicitly added to `CreateDigestSchema` (Step 1.6) |
| One of 5 return paths missing new fields | MEDIUM | All 5 paths documented with exact line numbers (Step 1.3) |
| Background processor path vs CRUD model path mismatch | MEDIUM | Both INSERT statements updated with matching columns (Steps 1.4 + 1.5) |
| Claude generates vague/forced WR connections | MEDIUM | Prompt rules: "NEVER force connections", "return [] if none", "too vague = don't include" |
| Claude uses wrong finding IDs in WR | LOW | Prompt rule: "MUST be exact UUIDs from ID: field". Inline data as fallback. |
| Token budget exceeded | LOW | ~200-400 extra tokens. Current max=8000, typical usage 3000-5000. |
| Old digests break new UI | NONE | ResearchPulseCard filters to non-empty pulses; returns null → section hidden. |
| WR modal breaks mobile layout | LOW | `grid-cols-1 md:grid-cols-2` — cards stack on mobile |
| Dark mode issues in modal | LOW | Uses CSS variables + explicit `dark:` classes for amber accents |

---

## Rollback Plan

If the changes cause issues:

1. **Git revert**: Changes are on `feat/ui-overhaul` branch. Revert commits to Plan 015b state.
2. **Per-phase rollback**: Each phase has a checkpoint commit. Can revert to any phase boundary.
3. **UI rollback**: Re-add `DigestSignposts` import in HomePage.tsx. The component file is not deleted.
4. **Backend rollback**: New columns are optional (TEXT with NULL, JSONB with `[]` default). No breaking changes.
5. **AI prompt rollback**: Remove the COMPANION INTELLIGENCE section from the system and user prompts. Claude will stop generating the fields; they'll default to `''`/`[]`.

---

## Sign-Off Checklist

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 1 | Backend Pipeline (All 12 Layers) | ✅ Complete | Feb 8, 2026 |
| 2 | Frontend Pipeline (Layers 7, 10, 11 + uiStore) | ✅ Complete | Feb 8, 2026 |
| 3 | Worth Revisiting Modal | ✅ Complete | Feb 8, 2026 |
| 4 | Research Pulse Home Page Card | ✅ Complete | Feb 8, 2026 |
| 5 | Build Verification & Deployment | ✅ Complete | Feb 8, 2026 |

---

*Created: February 8, 2026*
*Author: Claude Opus 4.6*
*Predecessor: Plan 015b (Layout & Spatial Design Refinements — Complete)*
