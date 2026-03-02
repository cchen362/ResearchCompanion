# Medical Companion PWA - Development Guide

## Project Overview

A research-focused medical information companion that helps users explore and track medical conditions through AI-powered research agents, smart digests, and conversational interfaces. Server-first architecture — all features require network connectivity.

---

## Core Principles

### Facts, Not Scores

This is the foundational design principle of the entire application.

- **No Arbitrary Metrics**: Display only factual, verifiable information
- **No Mock Data**: Only real medical research from trusted sources
- **Transparent Attribution**: Every piece of information clearly attributed to its source
- **Factual Metadata Only**: Study type, participant count, publication date — never invented scores
- **Trust Through Transparency**: Users can verify every claim through source links

Any feature that introduces synthetic scores, confidence percentages, or unverifiable rankings violates this principle and must be rejected.

### No Band-Aid Fixes

Address root causes, not symptoms. When you find a bug:
1. Identify the root cause, not just the symptom
2. Check if similar issues exist elsewhere
3. Fix the pattern, not just the instance
4. Document the fix if non-obvious

### Holistic Change Management

Every change must consider its impact across the entire stack:

```
Database Schema → Zod Validation → TypeScript Types → Service Layer → API Routes → UI Components
```

**Checklist for any data model change:**
- [ ] Update TypeScript interfaces in `src/types/index.ts`
- [ ] Modify database schema (PostgreSQL migration)
- [ ] Update Zod schemas in backend route validation
- [ ] Update backend model layer
- [ ] Adjust UI components consuming the data
- [ ] Update API endpoints handling the data
- [ ] Test agent system compatibility

### Don't Destroy Backend Data Structures

When receiving objects from the backend, preserve them using spread operator. Never reconstruct objects with only the fields you think you need — you'll lose fields other layers depend on.

```typescript
// BAD: Reconstructing with subset of fields
const finding = { source: { name: sourceName, url: sourceUrl } }

// GOOD: Preserve everything, override selectively
const finding = { source: { ...result.source, name: result.source.name || fallback } }
```

---

## Architecture

### Storage

- **PostgreSQL**: Primary persistent storage (all user data, findings, digests, chat messages)
- **IndexedDB**: Local cache for performance (DB_VERSION = 8, defined in `src/utils/db/version.ts`)
- **No offline mode**: App is server-first, no service worker, no offline fallbacks
- **Still installable**: manifest.webmanifest allows "Add to Home Screen"

### Authentication

- JWT tokens with 30-day expiry (`backend/src/config/auth.config.ts`)
- bcrypt for password hashing (salt rounds: 10)
- Multi-device session management

### Chat System (Server-First)

- PostgreSQL is sole source of truth for chat messages — no localStorage/IndexedDB
- `chat.service.ts` has ZERO store imports (pure API client) to avoid circular deps
- Zustand `chatStore.ts` is navigation + streaming state only (~65 lines, no persist)
- POST-based SSE streaming via `fetch()` with `ReadableStream` (not EventSource GET)

### AI Services

- **Primary**: Anthropic Claude Sonnet 4.5 for reasoning, analysis, digests, chat
- **Scoring**: Claude Haiku for two-pass digest scoring (Pass 1)
- **Transcription**: OpenAI Whisper for voice-to-text
- **Validation**: All AI responses validated with Zod schemas

### Medical Data Sources

- PubMed API for peer-reviewed research
- ClinicalTrials.gov API for active trials
- FDA API for drug approvals
- Brave Search API for supplementary web research

---

## Technology Stack

### Frontend
- React 19.2.0, TypeScript 5.9.3, Vite 7.2.4
- Zustand 5.0.9 (6 stores: app, research, ui, user, chat, plus helpers)
- IndexedDB via idb 8.0.3 (local cache)
- Tailwind CSS 3.4 with Radix UI components
- Axios with request/response interceptors

### Backend
- Node.js with Express 4.19.2, TypeScript strict mode
- PostgreSQL 15 via pg 8.17 (connection pooling)
- Anthropic SDK 0.71.2, OpenAI SDK 6.15.0
- Zod 4.3.5 for runtime type safety
- JWT (jsonwebtoken 9.0.3) + bcrypt 6.0

### Infrastructure
- Docker with multi-stage builds
- PostgreSQL 15 Alpine in Docker
- Nginx for static assets
- No PM2, no service worker

---

## Implementation Plans

Feature implementation guides are in `/IMPLEMENTATION_PLANS/`. These are strict actionable blueprints.

**Before implementing ANY plan:**
1. Read the entire plan document
2. Follow steps IN ORDER — no skipping, no creative improvements
3. Run build verification after each file change
4. Mark checkboxes as you complete each step
5. Deploy and test on production server

See `/IMPLEMENTATION_PLANS/README.md` for format details.

---

## Key Gotchas

### Digest Pipeline Has 12+ Layers

When adding new fields to the digest pipeline, you must update ALL of these:
1. AI JSON Schema (`digest.schema.ts`)
2. AI Prompt (`ai.service.ts`)
3. AI Return Value (`ai.service.ts`)
4. DB Storage — background processor (`digest-processor.service.ts`)
5. DB Storage — CRUD model (`digest.model.ts`)
6. CRUD Zod validation (`digests.crud.routes.ts`) — **strips unknown fields silently!**
7. Frontend `transformToBackend` (`digest.service.ts`)
8. DB Model TypeScript interface (`digest.model.ts`)
9. API Route SELECT aliases (`digest.routes.ts`)
10. Frontend `transformToFrontend` (`digest.service.ts`)
11. Frontend TypeScript types (`src/types/index.ts`)
12. UI Rendering (`DigestCard.tsx`)

**Two save paths exist** — background processor has its own INSERT; frontend saves go through CRUD POST with Zod validation. Both must have new columns.

### Express Route Ordering

Static routes MUST be defined BEFORE parameterized routes:
```
PUT /findings/mark-all-read   ← FIRST
PUT /findings/:id             ← SECOND
```
Otherwise Express matches `mark-all-read` as the `:id` parameter.

### Frontend/Backend Regex Parity

When frontend and backend both parse the same content (e.g., citations), their regexes MUST match. AI models write `[30, 33]` (comma-separated) AND `[30][33]` (separate brackets) — handle both.

### Source Categorization

`src/utils/sourceCategory.ts` is the single source of truth for source type to category mapping. Always use `getSourceCategory()` instead of creating ad-hoc maps. Backend equivalent: `countSourcesByType()` in `digest-processor.service.ts` — keep in sync.

### Agent Scheduler vs "Run Now"

- Scheduler uses `last_run` + schedule interval (NOT `next_run`)
- To trigger scheduler: `UPDATE agents SET last_run = CURRENT_TIMESTAMP - INTERVAL '25 hours'`
- "Run Now" button routes through backend `POST /api/agents/:id/execute` endpoint
- Both paths must use identical API parameters for external services

### ClinicalTrials.gov API

Use `query.cond` (condition-specific) NOT `query.term` (generic full-text). Using `query.term` returns random unrelated trials.

### Don't Show Same Metric From Two Sources

When two UI elements show the same metric from different data paths, they WILL drift. Pick one authoritative source.

---

## Security Practices

- **Never expose API keys in frontend** — all external API calls go through backend proxy
- **Always use parameterized queries** — never string-interpolate SQL
- **Always validate user input** with Zod schemas at API boundaries
- **Store secrets in environment variables** — never in code

---

## Deployment

- **Server**: `ssh chee@100.94.82.35`, project at `/home/chee/medical-pwa`
- **Domain**: `https://medpwa.zyroi.com`
- **Rebuild**: `docker compose down && docker compose up -d --build`
- **DB migration**: `docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "SQL"`
- **Logs**: `docker logs medical-companion --tail N 2>&1`
- **Note**: `.gitignore` has `*.sql` — migration files can't be git-tracked, run manually via docker exec

### Environment Variables
```bash
PRODUCTION_URL=https://medpwa.zyroi.com
CORS_ALLOWED_ORIGINS=https://medpwa.zyroi.com,http://100.94.82.35:6767,http://localhost:6767
```

### Post-Deployment Validation

After major changes, ALWAYS verify:
1. **Agent output quality**: Query DB for recent findings, verify titles match topic
2. **Chat context**: Send a test chat message, verify cited findings are relevant
3. **Cross-user isolation**: Verify `user_id` filtering in all query paths
4. **Duplicate code paths**: Ensure parallel code paths use identical API parameters

---

## Documentation

- **Issue tracking & fix log**: `SERVER_STORAGE_FIXES.md` (primary log for bugs, fixes, deployments)
- **Refactoring history**: `/REFACTORING/README.md`
- **Type definitions**: `src/types/index.ts`
- **Implementation plans**: `/IMPLEMENTATION_PLANS/`

When fixing bugs or deploying, update `SERVER_STORAGE_FIXES.md` with:
- Problem description and root cause
- Files modified
- Deployment date and commands
- Lessons learned

### Commit Message Format
```
type(scope): description
```
Types: feat, fix, docs, style, refactor, test, chore

---

*Last Updated: March 2, 2026*
