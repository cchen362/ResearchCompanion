# 006 - PubMed Query Construction Fix

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for fixing the PubMed query construction that causes Medical Literature Agent to return 0 results.**

Agents MUST follow this guide exactly. NO deviations, NO quick fixes, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **Server SSH**: `ssh chee@100.94.82.35`
- **Project path**: `/home/chee/medical-pwa`
- **App container**: `medical-companion`
- **Postgres container**: `medcompanion-postgres`

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1-2: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                  │
│ - Run `npm run build` after each file change                    │
│ - Run `cd backend && npm run build` for backend changes         │
│ - Verify NO compile errors before proceeding                    │
│ - Commit changes to git                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: BUILD VERIFICATION                                     │
│ - Frontend: npm run build                                       │
│ - Backend: cd backend && npm run build                          │
│ - Fix any errors before proceeding                              │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: DEPLOYMENT TO DEBIAN SERVER                            │
│ - Push changes to remote repository                             │
│ - SSH into Debian server                                        │
│ - Pull updated repository                                       │
│ - Rebuild Docker containers                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: PRODUCTION VERIFICATION                                │
│ - Run ALL test scenarios on production server                   │
│ - Check logs for PubMed returning results                       │
│ - Verify all 3 agents produce findings                          │
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
- **Priority**: CRITICAL - Production bug causing 0 PubMed results
- **Branch**: fix/digest-findings-race-condition
- **Previous Plan**: 005 (completed logging, identified root cause)

---

## Problem Statement

### Evidence from Production Logs (February 6, 2026)

**PubMed API is being called but returns 0 results:**
```
[PUBMED] Request received: { query: 'Haemophilia research study meta-analysis 2026 latest recent' }
[PUBMED] Calling PubMed esearch API...
[PUBMED] Found 0 article IDs
[PUBMED] No articles found, returning empty array
```

**Same query without "2026 latest recent" returns 36,789 results:**
```bash
curl "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Haemophilia&retmax=20&retmode=json"
# Returns: "count":"36789"
```

### Root Cause Analysis

**TWO ISSUES IDENTIFIED:**

1. **Frontend `buildSearchQuery()` adds "2026 latest recent" to every query**
   - File: `src/services/agents.service.ts` lines 724-725
   - PubMed interprets "2026" literally and finds no papers (none exist yet!)

2. **Backend `/pubmed-search` route has no date filtering**
   - File: `backend/src/routes/search.ts` line 66
   - Unlike `SearchService.searchPubMed()` which has `reldate: 365`

### Query Flow Diagram

```
Frontend agents.service.ts:buildSearchQuery()
    ↓
Returns: "Haemophilia research study meta-analysis 2026 latest recent"
    ↓
api.ts:searchPubMed() → POST /pubmed-search
    ↓
backend/routes/search.ts:53 → Uses query directly (NO date filtering!)
    ↓
PubMed esearch.fcgi?term=...2026... → 0 results (no 2026 papers exist)
```

### Current Results vs Expected

| Agent | Current | Expected |
|-------|---------|----------|
| Treatment Breakthrough | 10 (web only, PubMed=0) | 20 (web + PubMed) |
| Clinical Trial | 10 | 10 |
| Medical Literature | **0** (PubMed only) | **20** |
| **Total** | **20** | **50** |

---

## Summary of Changes

| Change | Priority | File | Description |
|--------|----------|------|-------------|
| Remove year from query | CRITICAL | `src/services/agents.service.ts` | Remove "2026 latest recent" |
| Improve search terms | CRITICAL | `src/services/agents.service.ts` | Use PubMed-optimized terms |
| Add date filtering | HIGH | `backend/src/routes/search.ts` | Add reldate=730 parameter |

---

## Phase 1: Fix Frontend Query Construction

### MUST DO
- [ ] Read this entire section before editing
- [ ] Remove the year addition from buildSearchQuery()
- [ ] Improve search terms for each agent type
- [ ] Run `npm run build` after changes

### File: `src/services/agents.service.ts`

**Find this code (around lines 701-728):**
```typescript
  private buildSearchQuery(topic: Topic, agentType: string): string {
    const baseQuery = topic.diseaseProfile.name;
    const modifiers: string[] = [];

    if (topic.patientContext?.ageGroup === 'pediatric') {
      modifiers.push('pediatric', 'children');
    }

    switch (agentType) {
      case 'treatment_breakthrough':
        modifiers.push('new treatment', 'FDA approval', 'breakthrough therapy');
        break;
      case 'clinical_trial':
        modifiers.push('clinical trial', 'recruiting', 'enrollment');
        break;
      case 'medical_literature':
        modifiers.push('research', 'study', 'meta-analysis');
        break;
      case 'pattern_recognition':
        modifiers.push('systematic review', 'consensus', 'guidelines');
        break;
    }

    const currentYear = new Date().getFullYear();
    modifiers.push(currentYear.toString(), 'latest', 'recent');

    return `${baseQuery} ${modifiers.join(' ')}`;
  }
```

**Replace with:**
```typescript
  private buildSearchQuery(topic: Topic, agentType: string): string {
    const baseQuery = topic.diseaseProfile.name;
    const modifiers: string[] = [];

    if (topic.patientContext?.ageGroup === 'pediatric') {
      modifiers.push('pediatric', 'children');
    }

    switch (agentType) {
      case 'treatment_breakthrough':
        // Terms optimized for finding recent treatments
        modifiers.push('treatment', 'therapy', 'drug');
        break;
      case 'clinical_trial':
        // Terms for finding active trials
        modifiers.push('clinical trial', 'recruiting', 'study');
        break;
      case 'medical_literature':
        // PubMed-optimized terms for finding review articles
        modifiers.push('review', 'meta-analysis');
        break;
      case 'pattern_recognition':
        // Terms for finding guidelines and consensus
        modifiers.push('guidelines', 'consensus', 'recommendations');
        break;
    }

    // DO NOT add year - let backend date filtering handle recency
    // DO NOT add "latest" or "recent" - these break PubMed searches

    return `${baseQuery} ${modifiers.join(' ')}`;
  }
```

### Build Verification
```bash
npm run build
# Must complete with exit code 0
```

---

## Phase 2: Add Date Filtering to Backend Route

### MUST DO
- [ ] Read this entire section before editing
- [ ] Add date filtering parameters to PubMed search URL
- [ ] Run `cd backend && npm run build` after changes

### File: `backend/src/routes/search.ts`

**Find this code (around line 66):**
```typescript
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json${apiKeyParam}`;
```

**Replace with:**
```typescript
    // Add date filtering: last 2 years, sorted by relevance
    const dateParams = '&datetype=pdat&reldate=730&sort=relevance';
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json${dateParams}${apiKeyParam}`;
```

### Explanation of Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `datetype=pdat` | Publication date | Filter by publication date |
| `reldate=730` | 730 days | Last 2 years (730 days) |
| `sort=relevance` | Relevance | Sort by relevance score |

### Build Verification
```bash
cd backend && npm run build
# Must complete with exit code 0
```

---

## Phase 3: Build Verification

### MUST DO
- [ ] Run frontend build
- [ ] Run backend build
- [ ] Verify NO compile errors

### Commands
```bash
# From project root
npm run build
echo "Frontend build: $?"

cd backend && npm run build
echo "Backend build: $?"
```

Both must return exit code 0.

---

## Phase 4: Deployment to Debian Server

### MUST DO
- [ ] Commit all changes
- [ ] Push to remote
- [ ] SSH to server
- [ ] Pull changes
- [ ] Rebuild containers

### Commands

**Step 1: Commit and push (local machine)**
```bash
git add -A
git commit -m "fix: remove year from PubMed queries, add backend date filtering

- Remove '2026 latest recent' from buildSearchQuery()
- Use PubMed-optimized search terms per agent type
- Add reldate=730 to backend /pubmed-search endpoint
- Aligns route with SearchService date filtering approach

Fixes issue where Medical Literature Agent returns 0 results

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin fix/digest-findings-race-condition
```

**Step 2: Deploy on server**
```bash
ssh chee@100.94.82.35

cd /home/chee/medical-pwa
git pull origin fix/digest-findings-race-condition

# Rebuild and restart containers
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify containers are running
docker ps | grep medical

# Check logs for startup
docker logs medical-companion --tail 50
```

---

## Phase 5: Production Verification

### MUST DO
- [ ] Delete existing topic
- [ ] Create new topic
- [ ] Verify all 3 agents appear
- [ ] Run all agents
- [ ] Check logs for PubMed returning results
- [ ] Verify findings count > 30

### Test Steps

**Step 1: Clear existing data**
1. Log into application at `https://cl.zyroi.com` or `http://100.94.82.35:6767`
2. Delete any existing topics
3. Refresh the page

**Step 2: Create new topic**
1. Click "Add Topic"
2. Enter name: "Haemophilia" (or any medical condition)
3. Verify all 3 agents appear:
   - ✅ Treatment Breakthrough Agent
   - ✅ Clinical Trial Agent
   - ✅ Medical Literature Agent

**Step 3: Run agents and check logs**
```bash
# In a terminal, watch the logs
ssh chee@100.94.82.35 "docker logs -f medical-companion 2>&1 | grep -E 'PUBMED|AgentsService|Summarize'"
```

Then in the UI:
1. Click "Run All Agents" button
2. Watch the terminal for log output

**Expected log output (AFTER FIX):**
```
[PUBMED] Request received: { query: 'Haemophilia review meta-analysis', limit: 20 }
[PUBMED] Calling PubMed esearch API...
[PUBMED] Found 20 article IDs
[PUBMED] Returning 20 articles
Summarize request - Query: Haemophilia clinical trial... Results count: 10
Summarize request - Query: Haemophilia treatment... Results count: 20
Summarize request - Query: Haemophilia review... Results count: 20
```

**Step 4: Verify findings count**
1. Navigate to Digest page
2. Check findings count - should be > 30 (ideally 40-50)
3. Verify digest includes information from all 3 sources

### Troubleshooting

**If PubMed still returns 0 articles:**
- Check that the query no longer contains "2026"
- Verify the date parameters are in the URL
- Test directly: `curl "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Haemophilia&retmax=20&datetype=pdat&reldate=730&retmode=json"`

**If build fails:**
- Check for syntax errors in the modified files
- Verify the switch statement is complete
- Ensure all brackets are properly closed

---

## Success Criteria

- [ ] Queries no longer contain "2026 latest recent"
- [ ] PubMed logs show "Found X article IDs" where X > 0
- [ ] All 3 agents execute when "Run All" is clicked
- [ ] Findings count > 30 (vs previous 20)
- [ ] Digest generation includes Medical Literature findings

---

## Rollback Plan

If issues occur after deployment:

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa

# Revert to previous commit
git log --oneline -5  # Find the commit before this change
git checkout <previous-commit-hash> -- src/services/agents.service.ts
git checkout <previous-commit-hash> -- backend/src/routes/search.ts

# Rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Technical Debt Addressed

1. **Inconsistent date handling** - Backend route now uses same approach as SearchService
2. **Hardcoded year** - Removed dynamic year that breaks at year boundaries
3. **Poor search terms** - "latest recent" replaced with PubMed-optimized terms ("review", "meta-analysis")
4. **Query pollution** - Cleaner queries improve search relevance

---

## Sign-off Checklist

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase 1: Frontend query fix | Pending | | |
| Phase 2: Backend date filtering | Pending | | |
| Phase 3: Build verification | Pending | | |
| Phase 4: Deployment | Pending | | |
| Phase 5: Production verification | Pending | | |

---

*Created: February 6, 2026*
*Last Updated: February 6, 2026*
*Relates to: 005_PUBMED_API_FIX_AND_AGENT_LOGGING.md (logging that identified this issue)*
