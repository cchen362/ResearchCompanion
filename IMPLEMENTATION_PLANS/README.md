# Implementation Plans

This folder contains strict implementation guides for feature development after the foundation refactoring.

## Purpose

These documents serve as **actionable blueprints** that agents must follow exactly - similar to the `/REFACTORING/` guides that successfully completed the 4-phase architectural cleanup.

## Document Format

Each implementation plan includes:
- ⛔ **Stop warning** - Forces agents to read before coding
- **Strict rules** - MUST DO / MUST NOT DO lists
- **Step-by-step instructions** - Exact file paths, line numbers, code to add
- **Build verification** - Commands to run after each change
- **Deployment steps** - How to deploy to production server
- **Testing scenarios** - Specific pass/fail criteria
- **Rollback plan** - How to undo if something breaks
- **Sign-off checklist** - Dates and completion tracking

## Current Plans

| # | Name | Status | Description |
|---|------|--------|-------------|
| 001 | [Autonomous Agents & Digest](./001_AUTONOMOUS_AGENTS_DIGEST.md) | Ready | Enable autonomous agent scheduling and seamless digest integration |
| 005 | [Digest UI Magazine Redesign](./005_DIGEST_UI_MAGAZINE_REDESIGN.md) | Complete | Magazine editorial UI for digests (kept as context for Plan 007) |
| 006 | [PubMed Query Construction Fix](./006_PUBMED_QUERY_CONSTRUCTION_FIX.md) | **Ready** | Fix "2026 latest recent" query breaking PubMed searches |
| 007 | [Digest Pipeline Fix & Dead Field Cleanup](./007_DIGEST_PIPELINE_FIX_AND_DEAD_FIELD_CLEANUP.md) | **Ready** | Fix 7-layer pipeline for magazine editorial fields, clean dead fields |
| 008 | [Digest & Findings UX Enhancement](./008_DIGEST_FINDINGS_UX_ENHANCEMENT.md) | **Ready** | Fix broken clicks, PubMed abstracts, structured AI summaries, visual hierarchy |
| 017 | [Codebase Cleanup](./017_CODEBASE_CLEANUP.md) | **In Progress** | Dead code removal and stale documentation cleanup |
| 018 | [Agent Scheduler, Dedup, Digest Fix](./018_AGENT_SCHEDULER_DEDUP_DIGEST_FIX.md) | **Complete** | Fix agent type mapping, scheduler timestamps, finding dedup, digest throttle, remove dead DigestSettings |
| 019 | [Dead Digest Field Cleanup & Button Consolidation](./019_SOURCECOUNT_CLEANUP_AND_BUTTON_CONSOLIDATION.md) | **Complete** | Phase 1: Remove dead sourceCount, highRelevanceCount, avgConfidence, DigestTheme system, trends (~217 lines). Phase 2: Consolidate 3 redundant digest buttons into 1 with tooltip |

## How to Use

1. **Read the entire document** before starting
2. **Follow steps IN ORDER** - No skipping
3. **Run build verification** after each file change
4. **Mark checkboxes** as you complete each step
5. **Deploy and test** on production server
6. **Update the document** with any issues found

## Adding New Plans

When creating a new implementation plan:
1. Use sequential numbering: `002_FEATURE_NAME.md`
2. Follow the existing format from `001_AUTONOMOUS_AGENTS_DIGEST.md`
3. Update this README with the new plan
4. Keep plans focused on ONE feature/fix

---

*Last Updated: February 9, 2026*
*Latest Plan: 019 - SourceCount Cleanup & Button Consolidation*
