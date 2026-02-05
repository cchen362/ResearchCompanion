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
| 002 | [Digest Issues Investigation](./002_DIGEST_ISSUES_INVESTIGATION.md) | Complete | Investigation into digest generation issues |
| 003 | [Digest UI Improvements](./003_DIGEST_UI_IMPROVEMENTS.md) | Complete | UI improvements for digest display |
| 004 | [Agent Fixes & Digest UI Simplification](./004_AGENT_FIXES_DIGEST_UI_SIMPLIFICATION.md) | Complete | Fix missing agent, unify notifications, remove themes |
| 005 | [PubMed API Fix & Agent Logging](./005_PUBMED_API_FIX_AND_AGENT_LOGGING.md) | Complete | Fix silent PubMed failures, add agent execution logging |
| 006 | [PubMed Query Construction Fix](./006_PUBMED_QUERY_CONSTRUCTION_FIX.md) | **Ready** | Fix "2026 latest recent" query breaking PubMed searches |

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

*Last Updated: February 6, 2026*
*Latest Plan: 006 - PubMed Query Construction Fix*
