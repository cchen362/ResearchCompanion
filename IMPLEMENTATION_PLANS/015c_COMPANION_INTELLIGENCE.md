# Plan 015c — Companion Intelligence (OUTLINE)

## Status: OUTLINE ONLY — Detailed plan to be written in a future workshop

**This document captures the vision and design decisions from the 015b workshop discussion. It is NOT an actionable implementation guide yet. A dedicated workshop session is needed to flesh out the AI prompt engineering, exact field schemas, and step-by-step implementation details.**

---

## Vision

Transform the home page from a data dashboard into a **thoughtful research companion** that surfaces intelligence, not just numbers. Two new AI-powered features replace the enriched DigestSignposts from 015b:

### Feature 1: Research Pulse

**What**: A single AI-generated sentence (1-2 lines) summarizing the state of the user's research landscape.

**Example**: *"Your Haemophilia research has 3 new breakthroughs this week, and a notable contradiction between two PubMed studies worth reviewing."*

**How it works**:
- Generated alongside the digest (one extra instruction in the existing Claude prompt)
- Stored as a new field on the digest: `researchPulse: string`
- Cached — no extra AI calls on page load
- Displayed prominently on home page, replacing DigestSignposts

**Pipeline layers to touch** (7-layer pipeline from MEMORY.md):
1. AI JSON Schema (`digest.schema.ts`) — add `researchPulse` field
2. AI Prompt (`ai.service.ts`) — add instruction to generate pulse
3. AI Return Value (`ai.service.ts`) — extract pulse from response
4. DB Storage - background processor (`digest-processor.service.ts`) — save to DB
5. DB Storage - CRUD model (`digest.model.ts`) — add column
6. CRUD Zod validation (`digests.crud.routes.ts`) — add to schema
7. Frontend `transformToBackend` (`digest.service.ts`) — include field
8. DB Model TypeScript interface (`digest.model.ts`)
9. API Route SELECT aliases (`digest.routes.ts`)
10. Frontend `transformToFrontend` (`digest.service.ts`)
11. Frontend TypeScript types (`src/types/index.ts`)
12. Dashboard stats API (`dashboard.routes.ts`) — return pulse with signpost data

**DB Migration**: `ALTER TABLE digests ADD COLUMN research_pulse TEXT;`

**Effort**: Medium (familiar pipeline, one new text field)

### Feature 2: Worth Revisiting

**What**: 1-2 connections between older findings and recent breakthroughs, surfaced as nudge cards.

**Example**: *"A finding from Jan 23 about gene therapy may relate to this week's breakthrough in factor VIII production."*

**How it works**:
- Generated alongside the digest — Claude already has all findings in context
- Extra prompt instruction: "Identify 1-2 older findings that gain new significance in light of recent breakthroughs"
- Stored as a new JSONB field: `worthRevisiting: WorthRevisiting[]`

**Data structure**:
```typescript
interface WorthRevisiting {
  oldFindingId: string;
  oldFindingTitle: string;
  newBreakthroughTitle: string;
  connectionExplanation: string;  // 1-2 sentences
}
```

**Pipeline**: Same 12 layers as Research Pulse, but with a JSONB array instead of a text field.

**DB Migration**: `ALTER TABLE digests ADD COLUMN worth_revisiting JSONB;`

**Effort**: Medium-High (JSONB field + UI card design + finding linking)

**Key distinction from "pseudo-agentic"**: This is genuinely agentic — Claude does real pattern matching across the full finding corpus during digest generation, not keyword matching or fixed rules.

---

## Home Page Design (After 015c)

```
┌─────────────────┬──────────┐
│  Hero (2col)    │ CTAs     │
│                 │ (1col)   │
├─────────────────┴──────────┤
│  Findings Highlights (3col)│
├────────────────────────────┤
│  Research Pulse (3col)     │
│  "Your Haemophilia..."     │
│  + Worth Revisiting nudges │
│  + "Open digest" link      │
└────────────────────────────┘
```

The bottom row becomes a single rich card with:
1. Research Pulse sentence (prominent)
2. Worth Revisiting nudge(s) (subtle, below pulse)
3. "Open digest" CTA link

This replaces the enriched DigestSignposts from 015b entirely.

---

## Questions for Future Workshop

1. **Prompt engineering**: Exact wording for the Research Pulse instruction. Should it be topic-specific or cross-topic?
2. **Multi-topic handling**: If user has 3 topics, do we show one pulse per topic or one aggregate pulse?
3. **Worth Revisiting**: How many connections should Claude identify? Cap at 2? 3?
4. **Finding linking**: Should the nudge card be clickable to open the old finding? Both findings?
5. **Empty state**: What to show when there's no pulse yet (digest not generated)?
6. **Fallback**: If Claude fails to generate a pulse, what do we show?
7. **Refresh frequency**: Pulse updates with each digest generation. Should it also update on agent completion?

---

## Dependencies

- **015b must be complete** — 015c replaces the DigestSignposts that 015b enhances
- The DigestSignposts slot on the home page (full 3-col width from 015b) is where Research Pulse + Worth Revisiting will live
- The `--spacing-section`/`--spacing-card` tokens from 015a are available for the card design

---

## Estimated Scope

| Component | Effort | Files |
|-----------|--------|-------|
| Research Pulse (backend) | Medium | ~6 files (schema, prompt, processor, model, routes, validation) |
| Research Pulse (frontend) | Low | ~3 files (types, dashboard stats, home page card) |
| Worth Revisiting (backend) | Medium | ~6 files (same pipeline) |
| Worth Revisiting (frontend) | Medium | ~3 files (types, card component, finding linking) |
| DB Migrations | Low | 2 ALTER TABLE statements |
| **Total** | **Medium-High** | **~12-15 files** |

---

*Created: February 8, 2026*
*Author: Claude Opus 4.6*
*Status: OUTLINE — Awaiting dedicated workshop for detailed plan*
*Predecessor: Plan 015b (Layout Refinements)*
