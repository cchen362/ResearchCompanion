# 005 - PubMed API Fix & Agent Execution Logging

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for fixing the PubMed API issue that causes Medical Literature Agent to fail silently.**

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
│ PHASE 1-3: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                  │
│ - Run `npm run build` after each file change                    │
│ - Run `cd backend && npm run build` for backend changes         │
│ - Verify NO compile errors before proceeding                    │
│ - Commit changes to git                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: BUILD VERIFICATION                                     │
│ - Frontend: npm run build                                       │
│ - Backend: cd backend && npm run build                          │
│ - Fix any errors before proceeding                              │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: DEPLOYMENT TO DEBIAN SERVER                            │
│ - Push changes to remote repository                             │
│ - SSH into Debian server                                        │
│ - Pull updated repository                                       │
│ - Rebuild Docker containers                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: PRODUCTION VERIFICATION                                │
│ - Run ALL test scenarios on production server                   │
│ - Check logs for agent execution details                        │
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

- **Phase**: Phases 1-4 Complete, Ready for Deployment
- **Created**: February 6, 2026
- **Priority**: CRITICAL - Production bug causing missing findings
- **Branch**: fix/digest-findings-race-condition
- **Previous Plan**: 004 (completed agent creation fix, but execution still fails)

---

## Problem Statement

### Evidence from Production Logs (February 6, 2026)

**All 3 agents were CREATED successfully:**
```
[AgentModel] Created agent: Treatment Breakthrough Agent
[AgentModel] Created agent: Clinical Trial Agent
[AgentModel] Created agent: Medical Literature Agent
[AgentModel] Created 3/3 agents for topic
```

**BUT only 2 agents actually EXECUTED:**
```
Summarize request - Query: Acromegaly clinical trial recruiting... Results count: 10
Summarize request - Query: Acromegaly new treatment FDA approval... Results count: 10
```
- ✅ Clinical Trial Agent → 10 results
- ✅ Treatment Breakthrough Agent → 10 results
- ❌ Medical Literature Agent → NO LOG ENTRY (never ran!)

**Digest only received 20 findings instead of expected 50+:**
```
📊 Starting digest generation for Acromegaly (20 findings, weekly timeframe)
```

### Root Cause Analysis

The production logs reveal:
1. **PubMed API endpoint** (`/api/pubmed-search`) is registered but NEVER called
2. **Treatment Breakthrough** should call both `searchWeb` (10) AND `searchPubMed` (10) but only returned 10 results
3. **Medical Literature** agent ONLY uses PubMed search - so it produced ZERO findings
4. **PubMed calls are failing silently** - no error logs, no try-catch in frontend

### Why Silent Failures?

The frontend code at `src/services/agents.service.ts` lines 384-387:
```typescript
case 'medical_literature':
  const literature = await searchApi.searchPubMed(query, 20);
  searchResults = literature.articles || [];  // If API fails, undefined.articles = error!
  break;
```

If `searchApi.searchPubMed()` throws or returns undefined, the code fails silently.

---

## Summary of Changes

| Change | Priority | File | Description |
|--------|----------|------|-------------|
| Add PubMed endpoint logging | CRITICAL | `backend/src/routes/search.ts` | Log request/response/errors |
| Add frontend agent try-catch | CRITICAL | `src/services/agents.service.ts` | Wrap each agent type in try-catch |
| Fix PubMed response handling | CRITICAL | `src/services/agents.service.ts` | Handle null/undefined responses |
| Add backend search service logging | HIGH | `backend/src/services/search.service.ts` | Log API calls |

---

## Phase 1: Add Backend PubMed Logging

### MUST DO
- [x] Read this entire section before editing
- [x] Add console.log at START of pubmed-search endpoint
- [x] Add console.log for PubMed API response
- [x] Add detailed console.error in catch block
- [x] Run `cd backend && npm run build` after changes

### File: `backend/src/routes/search.ts`

**Find this code (around line 53):**
```typescript
router.post('/pubmed-search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
```

**Replace with:**
```typescript
router.post('/pubmed-search', async (req, res) => {
  console.log('[PUBMED] Request received:', { query: req.body.query, limit: req.body.limit });

  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      console.log('[PUBMED] Error: Query is required');
      return res.status(400).json({ error: 'Query is required' });
    }
```

**Find this code (around line 66):**
```typescript
    const searchResponse = await axios.get(searchUrl);
    const idList = searchResponse.data.esearchresult?.idlist || [];

    if (idList.length === 0) {
      return res.json({ articles: [] });
    }
```

**Replace with:**
```typescript
    console.log('[PUBMED] Calling PubMed esearch API...');
    const searchResponse = await axios.get(searchUrl);
    const idList = searchResponse.data.esearchresult?.idlist || [];
    console.log('[PUBMED] Found', idList.length, 'article IDs');

    if (idList.length === 0) {
      console.log('[PUBMED] No articles found, returning empty array');
      return res.json({ articles: [] });
    }
```

**Find this code (around line 90-95):**
```typescript
    res.json({ articles });
  } catch (error) {
    console.error('Error in pubmed-search:', error);
    res.status(500).json({ error: 'Failed to search PubMed' });
  }
});
```

**Replace with:**
```typescript
    console.log('[PUBMED] Returning', articles.length, 'articles');
    res.json({ articles });
  } catch (error) {
    console.error('[PUBMED] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      response: (error as any).response?.data
    });
    res.status(500).json({ error: 'Failed to search PubMed' });
  }
});
```

### Build Verification
```bash
cd backend && npm run build
# Must complete with exit code 0
```

---

## Phase 2: Add Frontend Agent Error Handling

### MUST DO
- [x] Read this entire section before editing
- [x] Add try-catch around EACH agent type in switch statement
- [x] Log errors with agent name for easy debugging
- [x] Ensure searchResults defaults to empty array on error
- [x] Run `npm run build` after changes

### File: `src/services/agents.service.ts`

**Find the switch statement starting around line 368:**
```typescript
      switch (agent.type) {
        case 'treatment_breakthrough':
          const webResults = await searchApi.searchWeb(`${query} FDA approval new treatment`, 10);
          const pubmedResults = await searchApi.searchPubMed(`${query} treatment therapy`, 10);
          searchResults = [...(webResults.results || []), ...(pubmedResults.articles || [])];
          break;

        case 'clinical_trial':
          const trials = await searchApi.searchClinicalTrials(
            topic.diseaseProfile.name,
            'RECRUITING',
            topic.patientContext?.location
          );
          searchResults = trials.trials || [];
          break;

        case 'medical_literature':
          const literature = await searchApi.searchPubMed(query, 20);
          searchResults = literature.articles || [];
          break;

        case 'pattern_recognition':
          searchResults = await this.analyzeExistingFindings(topic);
          break;

        default:
          const generalWeb = await searchApi.searchWeb(query, 10);
          const generalPubmed = await searchApi.searchPubMed(query, 10);
          searchResults = [...(generalWeb.results || []), ...(generalPubmed.articles || [])];
      }
```

**Replace the ENTIRE switch statement with:**
```typescript
      switch (agent.type) {
        case 'treatment_breakthrough':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting web search...`);
            const webResults = await searchApi.searchWeb(`${query} FDA approval new treatment`, 10);
            logger.debug(`[AgentsService] ${agent.name}: Web search returned ${webResults?.results?.length || 0} results`);

            logger.debug(`[AgentsService] ${agent.name}: Starting PubMed search...`);
            const pubmedResults = await searchApi.searchPubMed(`${query} treatment therapy`, 10);
            logger.debug(`[AgentsService] ${agent.name}: PubMed search returned ${pubmedResults?.articles?.length || 0} results`);

            searchResults = [...(webResults?.results || []), ...(pubmedResults?.articles || [])];
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Search failed:`, error);
            searchResults = [];
          }
          break;

        case 'clinical_trial':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting clinical trials search...`);
            const trials = await searchApi.searchClinicalTrials(
              topic.diseaseProfile.name,
              'RECRUITING',
              topic.patientContext?.location
            );
            logger.debug(`[AgentsService] ${agent.name}: Clinical trials returned ${trials?.trials?.length || 0} results`);
            searchResults = trials?.trials || [];
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Search failed:`, error);
            searchResults = [];
          }
          break;

        case 'medical_literature':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting PubMed search...`);
            const literature = await searchApi.searchPubMed(query, 20);
            logger.debug(`[AgentsService] ${agent.name}: PubMed returned ${literature?.articles?.length || 0} results`);
            searchResults = literature?.articles || [];
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: PubMed search failed:`, error);
            searchResults = [];
          }
          break;

        case 'pattern_recognition':
          try {
            logger.debug(`[AgentsService] ${agent.name}: Analyzing existing findings...`);
            searchResults = await this.analyzeExistingFindings(topic);
            logger.debug(`[AgentsService] ${agent.name}: Pattern analysis returned ${searchResults?.length || 0} results`);
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Analysis failed:`, error);
            searchResults = [];
          }
          break;

        default:
          try {
            logger.debug(`[AgentsService] ${agent.name}: Starting general search...`);
            const generalWeb = await searchApi.searchWeb(query, 10);
            const generalPubmed = await searchApi.searchPubMed(query, 10);
            searchResults = [...(generalWeb?.results || []), ...(generalPubmed?.articles || [])];
            logger.debug(`[AgentsService] ${agent.name}: General search returned ${searchResults.length} results`);
          } catch (error) {
            logger.error(`[AgentsService] ${agent.name}: Search failed:`, error);
            searchResults = [];
          }
      }
```

### Build Verification
```bash
npm run build
# Must complete with exit code 0
```

---

## Phase 3: Add Backend Search Service Logging

### MUST DO
- [x] Read this entire section before editing
- [x] Add logging to searchPubMed method in search.service.ts
- [x] Run `cd backend && npm run build` after changes

### File: `backend/src/services/search.service.ts`

**Find the searchPubMed method (around line 70):**
```typescript
  async searchPubMed(query: string, limit?: number): Promise<any[]> {
```

**Add logging at the START of the method (after the opening brace):**
```typescript
  async searchPubMed(query: string, limit?: number): Promise<any[]> {
    const actualLimit = limit || this.pubmedLimit;
    console.log(`[SearchService.searchPubMed] Query: "${query}", Limit: ${actualLimit}`);
```

**Find the catch block in searchPubMed method and enhance it:**
```typescript
    } catch (error) {
      console.error('[SearchService.searchPubMed] Error:', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: (error as any).response?.data
      });
      return [];
    }
```

### Build Verification
```bash
cd backend && npm run build
# Must complete with exit code 0
```

---

## Phase 4: Build Verification

### MUST DO
- [x] Run frontend build
- [x] Run backend build
- [x] Verify NO compile errors

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

## Phase 5: Deployment to Debian Server

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
git commit -m "fix: add PubMed API logging and agent error handling

- Add detailed logging to /api/pubmed-search endpoint
- Add try-catch around each agent type in agents.service.ts
- Add logging to SearchService.searchPubMed
- Handle null/undefined API responses gracefully

Fixes issue where Medical Literature Agent fails silently

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

## Phase 6: Production Verification

### MUST DO
- [ ] Delete existing topic (Acromegaly or test topic)
- [ ] Create new topic
- [ ] Verify all 3 agents appear
- [ ] Run all agents
- [ ] Check logs for PubMed activity
- [ ] Verify findings count > 20

### Test Steps

**Step 1: Clear existing data**
1. Log into application at `https://cl.zyroi.com` or `http://100.94.82.35:6767`
2. Delete any existing topics
3. Refresh the page

**Step 2: Create new topic**
1. Click "Add Topic"
2. Enter name: "Acromegaly" (or any medical condition)
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

**Expected log output:**
```
[PUBMED] Request received: { query: 'Acromegaly treatment therapy', limit: 10 }
[PUBMED] Calling PubMed esearch API...
[PUBMED] Found 20 article IDs
[PUBMED] Returning 10 articles
[PUBMED] Request received: { query: 'Acromegaly research study meta-analysis 2026 latest recent', limit: 20 }
[PUBMED] Calling PubMed esearch API...
[PUBMED] Found 20 article IDs
[PUBMED] Returning 20 articles
Summarize request - Query: Acromegaly clinical trial... Results count: 10
Summarize request - Query: Acromegaly new treatment... Results count: 20
Summarize request - Query: Acromegaly research study... Results count: 20
```

**Step 4: Verify findings count**
1. Navigate to Digest page
2. Check findings count - should be > 30 (ideally 40-50)
3. Verify digest includes information from all 3 sources

### Troubleshooting

**If NO PubMed logs appear:**
- PubMed API is not being called
- Check browser console (F12) for frontend errors
- Frontend error handling may be catching before API call

**If PubMed returns 0 articles:**
- Check PubMed API key in environment variables
- Test API directly: `curl "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Acromegaly&retmax=10&retmode=json"`

**If PubMed throws error:**
- Check rate limiting (3 req/sec without API key)
- Verify PUBMED_API_KEY environment variable is set in Docker

---

## Success Criteria

- [ ] All 3 agents created when topic is added
- [ ] All 3 agents execute when "Run All" is clicked
- [ ] PubMed API calls logged in backend
- [ ] Findings count > 30 (vs previous 20)
- [ ] Digest generation includes Medical Literature findings
- [ ] No silent failures - errors are logged

---

## Rollback Plan

If issues occur after deployment:

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa

# Revert to previous commit
git log --oneline -5  # Find the commit before this change
git checkout <previous-commit-hash> -- backend/src/routes/search.ts
git checkout <previous-commit-hash> -- src/services/agents.service.ts
git checkout <previous-commit-hash> -- backend/src/services/search.service.ts

# Rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Sign-off Checklist

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase 1: Backend PubMed logging | Complete | Feb 6, 2026 | Added [PUBMED] logging to search.ts |
| Phase 2: Frontend error handling | Complete | Feb 6, 2026 | Added try-catch to all agent types |
| Phase 3: Search service logging | Complete | Feb 6, 2026 | Added [SearchService] logging |
| Phase 4: Build verification | Complete | Feb 6, 2026 | Frontend + backend build success |
| Phase 5: Deployment | Pending | | Ready for deployment |
| Phase 6: Production verification | Pending | | |

---

*Created: February 6, 2026*
*Last Updated: February 6, 2026*
