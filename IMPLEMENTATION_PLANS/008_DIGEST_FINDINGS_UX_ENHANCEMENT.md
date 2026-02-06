# 008 - Digest & Findings UX Enhancement

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for enhancing the digest magazine layout and SourceDrawer findings panel. It fixes broken click interactions, adds PubMed abstract fetching, generates uniform AI summaries for all findings, and improves visual hierarchy.**

Agents MUST follow this guide exactly. NO deviations, NO quick fixes, NO creative improvements.

---

## Development & Deployment Workflow

### Environment Setup
- **Development**: Local machine (Windows) - Code changes only
- **Testing**: Debian server with Docker (PostgreSQL + Node.js backend)
- **Server SSH**: `ssh chee@100.94.82.35`
- **Project path**: `/home/chee/medical-pwa`
- **Backend container**: `medcompanion-backend`
- **Postgres container**: `medcompanion-postgres`
- **DB credentials**: User `meduser`, Database `medcompanion`

### Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│ PHASES 1-9: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                   │
│ - Run `npm run build` after each file change                     │
│ - Run `cd backend && npm run build` for backend changes          │
│ - Verify NO compile errors before proceeding                     │
│ - Commit changes to git                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 10: BUILD VERIFICATION                                     │
│ - Frontend: npm run build                                        │
│ - Backend: cd backend && npm run build                           │
│ - Fix any errors before proceeding                               │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 11: DEPLOYMENT TO DEBIAN SERVER                            │
│ - Push changes to remote repository                              │
│ - SSH into Debian server                                         │
│ - Pull updated repository                                        │
│ - Rebuild Docker containers                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 12: PRODUCTION VERIFICATION                                │
│ - Run agents to create new findings                              │
│ - Verify structured summaries in SourceDrawer                    │
│ - Verify click interactions on digest cards                      │
│ - Wait for autonomous scheduler (15min) to verify same behavior  │
│ - Run backfill endpoint for existing findings                    │
│ - Regenerate a digest to verify 12 top findings                  │
│ - Document any issues in this file                               │
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
- **Priority**: HIGH - Broken click handlers, empty abstracts, overwhelming findings list
- **Branch**: `feat/digest-findings-ux-008`
- **Predecessor**: Plan 007 (Digest Pipeline Fix) - Magazine editorial fields working

---

## The Problems

### Problem 1: Broken Click Handlers
- **"View original"** button in FeaturedDiscovery hero card does `console.log('View finding:', id)` (DigestCard.tsx lines 222-224)
- **FindingSummaryCard** clicks also do `console.log('View finding:', id)` (DigestCard.tsx lines 272-274)
- **Expected**: Should open FindingDetailDrawer (already exists and works for List View)

### Problem 2: "No Abstract Available" Root Cause
- PubMed's `esummary` API (used in both `search.ts:81` and `search.service.ts:106`) **never returns abstracts** - only metadata
- `search.ts:94` hardcodes `abstract: article.abstract || 'No abstract available'`
- `agents.service.ts:455` property mismatch: checks `result.snippet || result.abstract || result.briefSummary` but backend provides `result.summary`
- Result: ~50% of findings show "No abstract available" in both summary and details areas

### Problem 3: Inconsistent Finding Content
- Card previews mix: dense PubMed abstracts, truncated snippets, "No abstract available", clinical trial briefs
- Expanded details show raw text dumps with `whitespace-pre-wrap` - walls of unformatted text
- With 30-50 findings, users need to scan quickly - varying formats make this impossible

### Problem 4: SourceStatsBar Feels Disconnected
- Renders as a standalone `<Card>` floating between hero and findings list
- Visually disconnected from the digest header

### Problem 5: Only 5 Top Findings Surfaced
- Only 5 of 50 findings shown in "Also In This Digest" feels thin

### Problem 6: SourceDrawer Cards All Look Identical
- No visual distinction between source types (PubMed, Clinical Trial, FDA, Web)
- No indication which findings are featured in the digest

---

## Summary of Changes

| Phase | Change | Files Affected |
|-------|--------|----------------|
| 1 | Wire "View original" + FindingSummaryCard clicks | ResearchPage.tsx, ResearchContainer.tsx, DigestPanel.tsx, DigestCard.tsx |
| 2 | Add ExternalLink icon + ChevronRight affordance | FeaturedDiscovery.tsx, FindingSummaryCard.tsx |
| 3 | Add PubMed efetch for real abstracts | backend/src/routes/search.ts, backend/src/services/search.service.ts |
| 4 | Fix frontend property name mismatch | src/services/agents.service.ts |
| 5 | Structured Haiku summaries (agent execution) | backend/src/services/agent-execution.service.ts |
| 6 | ~~Backfill endpoint~~ **SKIPPED** — delete topic & re-run agents instead | N/A |
| 7 | Render structured details in SourceDrawer | src/components/research/drawers/SourceDrawer.tsx |
| 8 | Inline source stats into digest header | src/components/DigestCard.tsx, src/components/digest/SourceStatsBar.tsx |
| 9 | Expand top findings to 12 + source tabs | backend/src/schemas/digest.schema.ts, backend/src/services/ai.service.ts, src/components/DigestCard.tsx |
| 10 | Source-type color coding + digest badges | src/components/research/drawers/SourceDrawer.tsx, src/components/research/ResearchPage.tsx |

### Autonomous Agent Compatibility

All changes work identically for both manual and autonomous (scheduled) agent runs:

| Change | Manual Run | Autonomous Run | Same Path? |
|--------|-----------|----------------|------------|
| PubMed efetch | search.ts + search.service.ts | search.service.ts | Yes - both updated |
| Structured summaries | agent-execution.service.ts `analyzeWithAI()` | Same `analyzeWithAI()` | Yes - single code path |
| Property mismatch | agents.service.ts (frontend only) | N/A (backend uses search.service.ts) | N/A |

The autonomous flow: `scheduler.service.ts` → `agent-execution.service.ts.executeAgent()` → `createFinding()` → `analyzeWithAI()` — **same** `analyzeWithAI()` that manual runs use.

---

## Strict Rules for All Agents

### ✅ MUST DO:
1. **Follow each phase IN ORDER** - No skipping ahead
2. **Run build verification after each phase** - `cd backend && npm run build` for backend, `npm run build` for frontend
3. **Mark checkboxes** as you complete each step
4. **Test click handlers** after Phase 1 by inspecting the prop chain
5. **Preserve backward compatibility** - Old findings without structured JSON must still render

### ❌ MUST NOT DO:
1. **Add features not in this plan** - Only implement what's specified
2. **Refactor surrounding code** - Touch only the specified lines
3. **Remove existing SourceDrawer functionality** - Search, filters, export, grouped view stay as-is
4. **Drop existing DB columns** - Only add, never remove
5. **Change digest generation logic** - AI prompt for digests stays the same (except topFindings count)

---

## Phase 1: Wire Click Handlers for Digest Cards

**Goal**: Make "View original" and FindingSummaryCard clicks open the FindingDetailDrawer.

### Step 1.1: Add `onViewFinding` prop to DigestCard

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 34-41 (DigestCardProps interface)

**Find:**
```typescript
interface DigestCardProps {
  digest: SmartDigest;
  onThemeClick: (themeId: string) => void;
  onViewSources: () => void;
  onAskQuestion?: (question: string) => void;
  explanationMode: ExplanationMode;
  setExplanationMode: (mode: ExplanationMode) => void;
}
```

**Replace with:**
```typescript
interface DigestCardProps {
  digest: SmartDigest;
  onThemeClick: (themeId: string) => void;
  onViewSources: () => void;
  onViewFinding?: (findingId: string) => void;
  onAskQuestion?: (question: string) => void;
  explanationMode: ExplanationMode;
  setExplanationMode: (mode: ExplanationMode) => void;
}
```

### Step 1.2: Destructure `onViewFinding` in component

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 43-50 (function signature)

**Find:**
```typescript
export function DigestCard({
  digest,
  onThemeClick,
  onViewSources,
  onAskQuestion,
  explanationMode,
  setExplanationMode
}: DigestCardProps) {
```

**Replace with:**
```typescript
export function DigestCard({
  digest,
  onThemeClick,
  onViewSources,
  onViewFinding,
  onAskQuestion,
  explanationMode,
  setExplanationMode
}: DigestCardProps) {
```

### Step 1.3: Wire FeaturedDiscovery click handler

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 222-224 (onViewSource for FeaturedDiscovery)

**Find:**
```typescript
                onViewSource={(id) => {
                  console.log('View finding:', id);
                }}
```

**Replace with:**
```typescript
                onViewSource={(id) => {
                  onViewFinding?.(id);
                }}
```

### Step 1.4: Wire FindingSummaryCard click handler

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 272-274 (onViewSource for FindingSummaryCard)

**Find:**
```typescript
                onViewSource={(id) => {
                  console.log('View finding:', id);
                }}
```

**Replace with:**
```typescript
                onViewSource={(id) => {
                  onViewFinding?.(id);
                }}
```

### Step 1.5: Add `onViewFinding` prop to DigestPanel

**File**: `src/components/research/digest/DigestPanel.tsx`
**Location**: Lines 24-31 (DigestPanelProps interface)

**Find:**
```typescript
interface DigestPanelProps {
  /** Topic ID to load digest for */
  topicId: string | null;
  /** Callback when "View Sources" is clicked */
  onViewSources: () => void;
  /** Callback when a theme is clicked */
  onThemeClick: (themeId: string, themeName: string) => void;
}
```

**Replace with:**
```typescript
interface DigestPanelProps {
  /** Topic ID to load digest for */
  topicId: string | null;
  /** Callback when "View Sources" is clicked */
  onViewSources: () => void;
  /** Callback when a theme is clicked */
  onThemeClick: (themeId: string, themeName: string) => void;
  /** Callback when a finding is clicked in digest */
  onViewFinding?: (findingId: string) => void;
}
```

### Step 1.6: Pass `onViewFinding` through DigestPanel

**File**: `src/components/research/digest/DigestPanel.tsx`
**Location**: Line 37 (function signature)

**Find:**
```typescript
export function DigestPanel({ topicId, onViewSources, onThemeClick }: DigestPanelProps) {
```

**Replace with:**
```typescript
export function DigestPanel({ topicId, onViewSources, onThemeClick, onViewFinding }: DigestPanelProps) {
```

**Location**: Lines 112-118 (DigestCard rendering)

**Find:**
```typescript
        <DigestCard
          digest={digest}
          explanationMode={explanationMode}
          setExplanationMode={setExplanationMode}
          onThemeClick={handleThemeClick}
          onViewSources={onViewSources}
        />
```

**Replace with:**
```typescript
        <DigestCard
          digest={digest}
          explanationMode={explanationMode}
          setExplanationMode={setExplanationMode}
          onThemeClick={handleThemeClick}
          onViewSources={onViewSources}
          onViewFinding={onViewFinding}
        />
```

### Step 1.7: Add `onViewFinding` prop to ResearchContainer

**File**: `src/components/research/ResearchContainer.tsx`
**Location**: Lines 35-46 (ResearchContainerProps interface)

**Find:**
```typescript
interface ResearchContainerProps {
  /** Optional topic ID from URL/props */
  topicId?: string;
  /** Callback when a finding is clicked */
  onFindingClick: (finding: ResearchFinding) => void;
  /** Callback when settings clicked */
  onSettingsClick: () => void;
  /** Callback to open source drawer */
  onViewSources: () => void;
  /** Callback when theme clicked in digest */
  onThemeClick: (themeId: string, themeName: string) => void;
}
```

**Replace with:**
```typescript
interface ResearchContainerProps {
  /** Optional topic ID from URL/props */
  topicId?: string;
  /** Callback when a finding is clicked */
  onFindingClick: (finding: ResearchFinding) => void;
  /** Callback when settings clicked */
  onSettingsClick: () => void;
  /** Callback to open source drawer */
  onViewSources: () => void;
  /** Callback when theme clicked in digest */
  onThemeClick: (themeId: string, themeName: string) => void;
  /** Callback when a finding is clicked in digest */
  onViewFinding?: (findingId: string) => void;
}
```

### Step 1.8: Destructure and pass `onViewFinding` in ResearchContainer

**File**: `src/components/research/ResearchContainer.tsx`
**Location**: Lines 52-58 (destructuring)

**Find:**
```typescript
export function ResearchContainer({
  topicId: propTopicId,
  onFindingClick,
  onSettingsClick,
  onViewSources,
  onThemeClick
}: ResearchContainerProps) {
```

**Replace with:**
```typescript
export function ResearchContainer({
  topicId: propTopicId,
  onFindingClick,
  onSettingsClick,
  onViewSources,
  onThemeClick,
  onViewFinding
}: ResearchContainerProps) {
```

**Location**: Lines 224-228 (DigestPanel rendering)

**Find:**
```typescript
        <DigestPanel
          topicId={selectedTopicId}
          onViewSources={onViewSources}
          onThemeClick={onThemeClick}
        />
```

**Replace with:**
```typescript
        <DigestPanel
          topicId={selectedTopicId}
          onViewSources={onViewSources}
          onThemeClick={onThemeClick}
          onViewFinding={onViewFinding}
        />
```

### Step 1.9: Create handler and pass from ResearchPage

**File**: `src/components/research/ResearchPage.tsx`
**Location**: Lines 75-77 (after handleThemeClick handler)

**Find:**
```typescript
  const handleThemeClick = (themeId: string, themeName: string) => {
    openSourceDrawer(themeId, themeName);
  };
```

**Replace with:**
```typescript
  const handleThemeClick = (themeId: string, themeName: string) => {
    openSourceDrawer(themeId, themeName);
  };

  const handleViewFinding = (findingId: string) => {
    const finding = findings.find(f => f.id === findingId);
    if (finding) {
      selectFinding(finding.id);
      openModal('findingDetail', finding);
    }
  };
```

**Location**: Lines 97-103 (ResearchContainer rendering)

**Find:**
```typescript
      <ResearchContainer
        topicId={propTopicId}
        onFindingClick={handleFindingClick}
        onSettingsClick={handleSettingsClick}
        onViewSources={handleViewSources}
        onThemeClick={handleThemeClick}
      />
```

**Replace with:**
```typescript
      <ResearchContainer
        topicId={propTopicId}
        onFindingClick={handleFindingClick}
        onSettingsClick={handleSettingsClick}
        onViewSources={handleViewSources}
        onThemeClick={handleThemeClick}
        onViewFinding={handleViewFinding}
      />
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 1 Checklist:**
- [ ] DigestCard accepts and passes `onViewFinding` prop
- [ ] FeaturedDiscovery "View original" calls `onViewFinding` instead of console.log
- [ ] FindingSummaryCard click calls `onViewFinding` instead of console.log
- [ ] DigestPanel passes `onViewFinding` through to DigestCard
- [ ] ResearchContainer passes `onViewFinding` through to DigestPanel
- [ ] ResearchPage creates `handleViewFinding` and passes it to ResearchContainer
- [ ] Frontend build passes

---

## Phase 2: Add Visual Click Affordances

**Goal**: Add ExternalLink icon to FeaturedDiscovery and ChevronRight to FindingSummaryCard.

### Step 2.1: Add ExternalLink icon to FeaturedDiscovery

**File**: `src/components/digest/FeaturedDiscovery.tsx`
**Location**: Lines 3 (imports)

**Find:**
```typescript
import { Star, Lightbulb } from 'lucide-react';
```

**Replace with:**
```typescript
import { Star, Lightbulb, ExternalLink } from 'lucide-react';
```

**Location**: Lines 69-76 (source attribution section)

**Find:**
```typescript
          {onViewSource && (
            <button
              onClick={() => onViewSource(discovery.findingId)}
              className="ml-2 text-primary hover:underline"
            >
              View original &rarr;
            </button>
          )}
```

**Replace with:**
```typescript
          {onViewSource && (
            <button
              onClick={() => onViewSource(discovery.findingId)}
              className="ml-2 text-primary hover:underline"
            >
              View original &rarr;
            </button>
          )}
          {sourceMetadata.url && (
            <a
              href={sourceMetadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
```

### Step 2.2: Add ChevronRight to FindingSummaryCard

**File**: `src/components/digest/FindingSummaryCard.tsx`
**Location**: Line 2 (imports)

**Find:**
```typescript
import { SourceIcon } from './SourceIcon';
```

**Replace with:**
```typescript
import { SourceIcon } from './SourceIcon';
import { ChevronRight } from 'lucide-react';
```

**Location**: Lines 30-31 (after metadata, before closing div)

**Find:**
```typescript
          <p className="text-xs text-muted-foreground">
            {finding.metadata}
          </p>
        </div>
      </div>
```

**Replace with:**
```typescript
          <p className="text-xs text-muted-foreground">
            {finding.metadata}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 self-center" />
      </div>
```

**Verification:**
```bash
npm run build
```

**✅ Phase 2 Checklist:**
- [ ] FeaturedDiscovery shows ExternalLink icon next to "View original" for source URL
- [ ] FindingSummaryCard shows ChevronRight icon as click affordance
- [ ] Frontend build passes

---

## Phase 3: Fix PubMed Abstract Fetching (Root Cause)

**Goal**: Add `efetch` API call to get real abstracts from PubMed.

**Root cause**: Both `search.ts` and `search.service.ts` use PubMed's `esummary` which returns metadata only (title, authors, journal, date). Real abstracts require the `efetch` API.

### Step 3.1: Add efetch to search.ts (route used by frontend agents)

**File**: `backend/src/routes/search.ts`
**Location**: Lines 80-98 (after esummary call, before returning articles)

**Find (lines 80-98):**
```typescript
    // Fetch article summaries (with API key if available)
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json${apiKeyParam}`;
    const summaryResponse = await axios.get(summaryUrl);

    const articles = idList.map((id: string) => {
      const article = summaryResponse.data.result?.[id];
      if (!article) return null;

      return {
        id,
        title: article.title || 'No title',
        authors: article.authors?.map((a: any) => a.name).join(', ') || '',
        journal: article.source || '',
        publishDate: article.pubdate || '',
        abstract: article.abstract || 'No abstract available',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        doi: article.elocationid || ''
      };
    }).filter(Boolean);
```

**Replace with:**
```typescript
    // Fetch article summaries (with API key if available)
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json${apiKeyParam}`;
    const summaryResponse = await axios.get(summaryUrl);

    // Fetch real abstracts via efetch (esummary never returns abstracts)
    let abstractMap: Record<string, string> = {};
    try {
      const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${idList.join(',')}&rettype=abstract&retmode=xml${apiKeyParam}`;
      const efetchResponse = await axios.get(efetchUrl);
      const xmlData = efetchResponse.data as string;

      // Parse abstracts from XML - extract <AbstractText> for each PMID
      const articleBlocks = xmlData.split('<PubmedArticle>');
      for (const block of articleBlocks) {
        const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
        const abstractMatch = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
        if (pmidMatch && abstractMatch) {
          const pmid = pmidMatch[1];
          const abstractText = abstractMatch
            .map(m => m.replace(/<\/?[^>]+(>|$)/g, '').trim())
            .join(' ');
          abstractMap[pmid] = abstractText;
        }
      }
      console.log(`[PUBMED] Fetched abstracts for ${Object.keys(abstractMap).length} of ${idList.length} articles`);
    } catch (efetchError) {
      console.warn('[PUBMED] efetch failed, continuing without abstracts:', efetchError instanceof Error ? efetchError.message : 'Unknown');
    }

    const articles = idList.map((id: string) => {
      const article = summaryResponse.data.result?.[id];
      if (!article) return null;

      const abstract = abstractMap[id] || '';

      return {
        id,
        title: article.title || 'No title',
        authors: article.authors?.map((a: any) => a.name).join(', ') || '',
        journal: article.source || '',
        publishDate: article.pubdate || '',
        abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        doi: article.elocationid || ''
      };
    }).filter(Boolean);
```

### Step 3.2: Add efetch to search.service.ts (used by autonomous agents)

**File**: `backend/src/services/search.service.ts`
**Location**: Lines 94-143 (after esummary call, before returning articles)

**Find (starting after the esummary call around line 106-108):**
```typescript
      const summaryResponse = await axios.get(`${this.pubmedBaseUrl}/esummary.fcgi`, {
        params: summaryParams
      });

      const articles = [];
      const results = summaryResponse.data?.result || {};
```

**Add BETWEEN the summaryResponse and the articles loop:**
```typescript
      const summaryResponse = await axios.get(`${this.pubmedBaseUrl}/esummary.fcgi`, {
        params: summaryParams
      });

      // Fetch real abstracts via efetch (esummary never returns abstracts)
      let abstractMap: Record<string, string> = {};
      try {
        const efetchParams: any = {
          db: 'pubmed',
          id: pmids.join(','),
          rettype: 'abstract',
          retmode: 'xml'
        };
        if (process.env.PUBMED_API_KEY) {
          efetchParams.api_key = process.env.PUBMED_API_KEY;
        }
        const efetchResponse = await axios.get(`${this.pubmedBaseUrl}/efetch.fcgi`, {
          params: efetchParams
        });
        const xmlData = efetchResponse.data as string;

        const articleBlocks = xmlData.split('<PubmedArticle>');
        for (const block of articleBlocks) {
          const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
          const abstractMatch = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
          if (pmidMatch && abstractMatch) {
            const pmid = pmidMatch[1];
            const abstractText = abstractMatch
              .map((m: string) => m.replace(/<\/?[^>]+(>|$)/g, '').trim())
              .join(' ');
            abstractMap[pmid] = abstractText;
          }
        }
        console.log(`[SearchService] Fetched abstracts for ${Object.keys(abstractMap).length} of ${pmids.length} articles`);
      } catch (efetchError) {
        console.warn('[SearchService] efetch failed, continuing without abstracts:', efetchError instanceof Error ? efetchError.message : 'Unknown');
      }

      const articles = [];
      const results = summaryResponse.data?.result || {};
```

**Then update the article object construction** (around line 120-127) to include the abstract:

**Find:**
```typescript
          const articleSummary = article.title || 'Untitled';
          const publicationInfo = `Published in ${article.source || 'Unknown Journal'} on ${article.sortpubdate || 'Unknown Date'}`;

          // Add unique identifier to details to prevent duplication
          const uniqueDetails = `${articleSummary}\n\n${publicationInfo}\n\nAuthors: ${article.authors?.map((a: any) => a.name).join(', ') || 'Not specified'}\n\n───────────\nPubMed ID: ${article.uid}`;
```

**Replace with:**
```typescript
          const realAbstract = abstractMap[pmid] || '';
          const articleSummary = realAbstract || article.title || 'Untitled';
          const publicationInfo = `Published in ${article.source || 'Unknown Journal'} on ${article.sortpubdate || 'Unknown Date'}`;

          // Add unique identifier to details to prevent duplication
          const uniqueDetails = realAbstract
            ? `${realAbstract}\n\n${publicationInfo}\n\nAuthors: ${article.authors?.map((a: any) => a.name).join(', ') || 'Not specified'}\n\n───────────\nPubMed ID: ${article.uid}`
            : `${article.title || 'Untitled'}\n\n${publicationInfo}\n\nAuthors: ${article.authors?.map((a: any) => a.name).join(', ') || 'Not specified'}\n\n───────────\nPubMed ID: ${article.uid}`;
```

**Verification:**
```bash
cd backend && npm run build
```

**✅ Phase 3 Checklist:**
- [ ] `search.ts` fetches abstracts via efetch after esummary
- [ ] `search.service.ts` fetches abstracts via efetch after esummary
- [ ] efetch failure is caught gracefully (doesn't block search)
- [ ] Abstract is empty string (not "No abstract available") when unavailable
- [ ] Backend build passes

---

## Phase 4: Fix Frontend Property Name Mismatch

**Goal**: Fix the fallback chain in `agents.service.ts` so `result.summary` is checked, and filter out "No abstract available" literals.

### Step 4.1: Fix property fallback chain

**File**: `src/services/agents.service.ts`
**Location**: Lines 455-456

**Find:**
```typescript
            summary: result.snippet || result.abstract || result.briefSummary || '',
            details: result.details || result.summary || result.briefSummary || '',
```

**Replace with:**
```typescript
            summary: (() => {
              const raw = result.snippet || result.summary || result.abstract || result.briefSummary || '';
              return raw === 'No abstract available' ? '' : raw;
            })(),
            details: (() => {
              const raw = result.details || result.summary || result.briefSummary || '';
              return raw === 'No abstract available' ? '' : raw;
            })(),
```

**Verification:**
```bash
npm run build
```

**✅ Phase 4 Checklist:**
- [ ] `result.summary` is in the summary fallback chain
- [ ] "No abstract available" literal is filtered out
- [ ] Frontend build passes

---

## Phase 5: Structured Haiku Summaries in Agent Execution

**Goal**: Update `analyzeWithAI()` in agent-execution.service.ts to produce structured JSON output instead of free-text paragraphs. This runs for EVERY finding during both autonomous and manual agent runs.

### Step 5.1: Update `analyzeWithAI()` return type and implementation

**File**: `backend/src/services/agent-execution.service.ts`
**Location**: Lines 447-477 (analyzeWithAI method)

**Find:**
```typescript
  private async analyzeWithAI(result: any, agentType: string): Promise<{ summary: string; insights: string[] }> {
    const prompt = this.buildAIPrompt(result, agentType);

    try {
      const response = await aiService.client.messages.create({
        model: 'claude-haiku-4-5-20251001', // Use Haiku 4.5 for cost-efficient background processing
        system: 'You are a medical research analyst. Extract key information and insights from research findings. Be concise and factual.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500
      });

      // Parse AI response
      const contentBlock = response.content[0];
      const content = contentBlock && 'text' in contentBlock ? contentBlock.text : '';
      const lines = content.split('\n').filter((l: string) => l.trim());

      return {
        summary: lines[0] || this.extractBasicContent(result, agentType),
        insights: lines.slice(1, 4).map((l: string) => l.replace(/^[-*]\s*/, ''))
      };

    } catch (error) {
      console.error('[AgentExecution] AI analysis failed:', error);
      throw error;
    }
  }
```

**Replace with:**
```typescript
  private async analyzeWithAI(result: any, agentType: string): Promise<{ summary: string; insights: string[]; structuredDetails: string }> {
    const prompt = this.buildAIPrompt(result, agentType);

    try {
      const response = await aiService.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        system: `You are a medical research analyst. Generate a structured summary of research findings.
Always respond with valid JSON in this exact format:
{
  "summary": "1-2 sentence plain text summary of the main finding",
  "keyFinding": "One sentence: what was specifically found or demonstrated",
  "method": "One sentence: study type, sample size, duration if available. Omit if not available.",
  "implications": "One sentence: why this matters for patients or clinical practice",
  "source": "Journal/Source Name, Year, Study Type"
}
Be concise. Each field must be ONE sentence maximum. If information for a field is not available, use an empty string.`,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500
      });

      const contentBlock = response.content[0];
      const content = contentBlock && 'text' in contentBlock ? contentBlock.text : '';

      // Try to parse structured JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const details: Record<string, string> = {};
          if (parsed.keyFinding) details.keyFinding = parsed.keyFinding;
          if (parsed.method) details.method = parsed.method;
          if (parsed.implications) details.implications = parsed.implications;
          if (parsed.source) details.source = parsed.source;

          return {
            summary: parsed.summary || this.extractBasicContent(result, agentType),
            insights: [parsed.keyFinding, parsed.implications].filter(Boolean),
            structuredDetails: JSON.stringify(details)
          };
        }
      } catch (parseError) {
        console.warn('[AgentExecution] Failed to parse structured JSON, falling back to text parsing');
      }

      // Fallback: parse as plain text (backward compat)
      const lines = content.split('\n').filter((l: string) => l.trim());
      return {
        summary: lines[0] || this.extractBasicContent(result, agentType),
        insights: lines.slice(1, 4).map((l: string) => l.replace(/^[-*]\s*/, '')),
        structuredDetails: ''
      };

    } catch (error) {
      console.error('[AgentExecution] AI analysis failed:', error);
      throw error;
    }
  }
```

### Step 5.2: Update `buildAIPrompt()` to filter junk content

**File**: `backend/src/services/agent-execution.service.ts`
**Location**: Lines 482-516 (buildAIPrompt method)

**Find:**
```typescript
  private buildAIPrompt(result: any, agentType: string): string {
    switch (agentType) {
      case 'pubmed':
        return `Analyze this medical research article:
Title: ${result.title || 'Unknown'}
Abstract: ${result.abstract || 'Not available'}

Provide:
1. A one-sentence summary of the main finding
2. Three key insights or implications (one per line, starting with -)`;

      case 'clinical_trials':
        return `Analyze this clinical trial:
Title: ${result.protocolSection?.identificationModule?.briefTitle || 'Unknown'}
Description: ${result.protocolSection?.descriptionModule?.briefSummary || 'Not available'}
Phase: ${result.protocolSection?.designModule?.phases?.[0] || 'Unknown'}
Status: ${result.protocolSection?.statusModule?.overallStatus || 'Unknown'}

Provide:
1. A one-sentence summary of the trial's purpose
2. Three key insights about the trial (one per line, starting with -)`;

      case 'web':
        return `Analyze this medical article:
Title: ${result.title || 'Unknown'}
Description: ${result.description || 'Not available'}

Provide:
1. A one-sentence summary of the main point
2. Three key takeaways (one per line, starting with -)`;

      default:
        return 'Summarize this finding in one sentence.';
    }
  }
```

**Replace with:**
```typescript
  private buildAIPrompt(result: any, agentType: string): string {
    // Filter out junk content
    const clean = (val: string | undefined) => {
      if (!val) return '';
      if (val === 'No abstract available' || val === 'Not available') return '';
      return val;
    };

    switch (agentType) {
      case 'pubmed': {
        const abstract = clean(result.abstract);
        const title = result.title || 'Unknown';
        const journal = result.journal || result.source || '';
        const date = result.publishDate || result.pubdate || '';
        return `Analyze this PubMed research article and respond with structured JSON:
Title: ${title}
${abstract ? `Abstract: ${abstract}` : '(No abstract available - analyze based on title and metadata)'}
Journal: ${journal}
Date: ${date}`;
      }

      case 'clinical_trials': {
        const briefTitle = result.protocolSection?.identificationModule?.briefTitle || 'Unknown';
        const description = clean(result.protocolSection?.descriptionModule?.briefSummary);
        const phase = result.protocolSection?.designModule?.phases?.[0] || 'Unknown';
        const status = result.protocolSection?.statusModule?.overallStatus || 'Unknown';
        return `Analyze this clinical trial and respond with structured JSON:
Title: ${briefTitle}
${description ? `Description: ${description}` : '(No description available)'}
Phase: ${phase}
Status: ${status}`;
      }

      case 'web': {
        const title = result.title || 'Unknown';
        const description = clean(result.description);
        return `Analyze this medical article and respond with structured JSON:
Title: ${title}
${description ? `Description: ${description}` : '(No description available)'}`;
      }

      default:
        return 'Analyze this finding and respond with structured JSON.';
    }
  }
```

### Step 5.3: Update `createFinding()` to use structured output

**File**: `backend/src/services/agent-execution.service.ts`
**Location**: Lines 355-391 (createFinding method, specifically where it uses aiAnalysis)

**Find:**
```typescript
    try {
      const aiAnalysis = await this.analyzeWithAI(result, agent.type);
      content = aiAnalysis.summary;
      keyInsights = aiAnalysis.insights;
    } catch (error) {
      // Fallback to basic extraction if AI fails
      content = this.extractBasicContent(result, agent.type);
    }

    const finding: Finding = {
      id: uuidv4(),
      topic_id: topicId,
      user_id: userId,
      title: source.displayName || source.name || 'Research Finding',
      source,
      content,
      summary: content.substring(0, 200),
      metadata: {
        keyInsights,
        agentId: agent.id,
        agentName: agent.name,
        searchQuery: agent.config?.query,
        originalResult: result
      },
```

**Replace with:**
```typescript
    let structuredDetails = '';
    try {
      const aiAnalysis = await this.analyzeWithAI(result, agent.type);
      content = aiAnalysis.summary;
      keyInsights = aiAnalysis.insights;
      structuredDetails = aiAnalysis.structuredDetails;
    } catch (error) {
      // Fallback to basic extraction if AI fails
      content = this.extractBasicContent(result, agent.type);
    }

    const finding: Finding = {
      id: uuidv4(),
      topic_id: topicId,
      user_id: userId,
      title: source.displayName || source.name || 'Research Finding',
      source,
      content,
      summary: content,
      metadata: {
        keyInsights,
        agentId: agent.id,
        agentName: agent.name,
        searchQuery: agent.config?.query,
        originalResult: result,
        structuredDetails: structuredDetails || undefined
      },
```

> **Note**: There is no `details` column in the `findings` table. Structured details are stored in `metadata.structuredDetails` (JSONB). The frontend `transformToFrontend()` in `findings.service.ts` spreads `...apiFinding.metadata` onto the finding object, making `structuredDetails` available at runtime.

**Verification:**
```bash
cd backend && npm run build
```

**✅ Phase 5 Checklist:**
- [ ] `analyzeWithAI()` returns structured JSON with summary + details fields
- [ ] `buildAIPrompt()` filters "No abstract available" junk from input
- [ ] `createFinding()` uses AI summary directly (not truncated content)
- [ ] `createFinding()` stores structured details JSON
- [ ] Fallback to plain text parsing if JSON parsing fails
- [ ] Backend build passes

---

## Phase 6: ~~Backfill Endpoint~~ — SKIPPED

> **SKIPPED**: No real users yet — delete the test topic and re-run agents fresh instead.
> New findings created after Phase 5 will automatically have `metadata.structuredDetails`.
> Phase 7's SourceDrawer rendering falls back to raw text for any old findings without structured data.

---

## Phase 7: Render Structured Details in SourceDrawer

**Goal**: Update SourceDrawer to parse and render structured JSON details with labeled fields instead of raw text dump.

### Step 7.1: Replace raw text rendering with structured layout

**File**: `src/components/research/drawers/SourceDrawer.tsx`
**Location**: Lines 313-324 (expanded content section showing "Full Details")

**Find:**
```typescript
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="pt-3 border-t space-y-3">
                            {finding.details && (
                              <div>
                                <h4 className="text-sm font-medium mb-1">Full Details</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {/* Remove markdown formatting for now */}
                                  {finding.details.replace(/[#*`_]/g, '').trim()}
                                </p>
                              </div>
                            )}
```

**Replace with:**
```typescript
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="pt-3 border-t space-y-3">
                            {finding.details && (() => {
                              // Try to parse as structured JSON
                              try {
                                const parsed = JSON.parse(finding.details);
                                if (parsed && typeof parsed === 'object' && (parsed.keyFinding || parsed.method || parsed.implications)) {
                                  return (
                                    <div className="space-y-2">
                                      {parsed.keyFinding && (
                                        <div>
                                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Finding</h4>
                                          <p className="text-sm">{parsed.keyFinding}</p>
                                        </div>
                                      )}
                                      {parsed.method && (
                                        <div>
                                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Method</h4>
                                          <p className="text-sm">{parsed.method}</p>
                                        </div>
                                      )}
                                      {parsed.implications && (
                                        <div>
                                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why It Matters</h4>
                                          <p className="text-sm">{parsed.implications}</p>
                                        </div>
                                      )}
                                      {parsed.source && (
                                        <p className="text-xs text-muted-foreground italic">{parsed.source}</p>
                                      )}
                                    </div>
                                  );
                                }
                              } catch {
                                // Not JSON - fall through to raw text rendering
                              }
                              // Fallback: render raw text (old findings not yet backfilled)
                              return (
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Full Details</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {finding.details.replace(/[#*`_]/g, '').trim()}
                                  </p>
                                </div>
                              );
                            })()}
```

**Verification:**
```bash
npm run build
```

**✅ Phase 7 Checklist:**
- [ ] SourceDrawer tries to parse `finding.details` as structured JSON
- [ ] Structured JSON renders with labeled fields: Key Finding, Method, Why It Matters
- [ ] Non-JSON details fall back to existing raw text rendering
- [ ] Frontend build passes

---

## Phase 8: Inline Source Stats Into Digest Header

**Goal**: Move SourceStatsBar from a standalone card to inline pills inside the digest header.

### Step 8.1: Replace standalone SourceStatsBar with inline pills

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 247-253 (standalone SourceStatsBar rendering)

**Find:**
```typescript
      {/* Source Stats Bar */}
      {digest.sourceBreakdown && (
        <SourceStatsBar
          breakdown={digest.sourceBreakdown}
          totalFindings={digest.statistics.totalFindings}
        />
      )}
```

**Replace with:**
```typescript
      {/* Source Stats - Inline pills (was standalone SourceStatsBar) */}
```

Now add the inline pills inside the header card.

**Location**: Lines 214-215 (inside CardContent, after the space-y-4 div opens)

**Find:**
```typescript
        <CardContent>
          <div className="space-y-4">
```

**Replace with:**
```typescript
        <CardContent>
          <div className="space-y-4">
            {/* Source Stats Inline */}
            {digest.sourceBreakdown && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-muted-foreground font-medium">{digest.statistics.totalFindings} findings:</span>
                {digest.sourceBreakdown.pubmed > 0 && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full px-2.5 py-0.5">
                    <BookOpen className="h-3 w-3" />
                    {digest.sourceBreakdown.pubmed} PubMed
                  </span>
                )}
                {digest.sourceBreakdown.clinicalTrials > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded-full px-2.5 py-0.5">
                    <FlaskConical className="h-3 w-3" />
                    {digest.sourceBreakdown.clinicalTrials} Clinical
                  </span>
                )}
                {digest.sourceBreakdown.fda > 0 && (
                  <span className="inline-flex items-center gap-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 rounded-full px-2.5 py-0.5">
                    <Shield className="h-3 w-3" />
                    {digest.sourceBreakdown.fda} FDA
                  </span>
                )}
                {digest.sourceBreakdown.web > 0 && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full px-2.5 py-0.5">
                    <Globe className="h-3 w-3" />
                    {digest.sourceBreakdown.web} Web
                  </span>
                )}
              </div>
            )}
```

> **Note**: `BookOpen`, `FlaskConical`, `Shield`, `Globe` icons need to be imported from lucide-react. Check existing imports and add any missing ones. The file already imports from lucide-react (lines 5-21), add these to the existing import list.

### Step 8.2: Add missing icon imports

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 5-21 (lucide-react imports)

Check if `BookOpen`, `FlaskConical`, `Shield`, `Globe` are already imported. If not, add them to the existing import block:

**Add to existing import (only ones not already present):**
```typescript
import { BookOpen, FlaskConical, Shield, Globe } from 'lucide-react';
```

> **Note**: Some of these may already be imported. Only add the missing ones.

**Verification:**
```bash
npm run build
```

**✅ Phase 8 Checklist:**
- [ ] Standalone `<SourceStatsBar>` removed from between hero and findings
- [ ] Source breakdown rendered as inline pills inside digest header CardContent
- [ ] Pills use source-type colors (blue/green/purple/gray)
- [ ] Pills only render for source types with count > 0
- [ ] Missing icon imports added
- [ ] Frontend build passes

---

## Phase 9: Expand Top Findings to 12 + Source Tabs

**Goal**: Increase "Also In This Digest" from 5 to 12 findings and add source-type filter tabs.

### Step 9.1: Update backend schema maxItems

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Find the `topFindings` array definition with `maxItems: 5`

**Find:**
```
maxItems: 5
```
(inside the topFindings schema property)

**Replace with:**
```
maxItems: 12
```

### Step 9.2: Update AI prompt for 12 findings

**File**: `backend/src/services/ai.service.ts`
**Location**: Find the prompt text that mentions "top 5" or "up to 5" findings

Search for text like "5 additional" or "top 5" in the digest generation prompt and update to 12.

**Find** (approximate - search for the relevant prompt text):
```
up to 5
```

**Replace with:**
```
up to 12
```

> **Note**: The exact text depends on the current prompt. Search for "5" near "topFindings" or "additional findings" in the ai.service.ts digest prompt.

### Step 9.3: Add source-type tabs to "Also In This Digest" section

**File**: `src/components/DigestCard.tsx`
**Location**: Lines 255-284 ("Also In This Digest" section)

**Find:**
```typescript
      {/* Also In This Digest */}
      {digest.topFindings && digest.topFindings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Also In This Digest</CardTitle>
              <span className="text-sm text-muted-foreground">
                {digest.topFindings.length} of {digest.statistics.totalFindings}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.topFindings.map((finding) => (
              <FindingSummaryCard
                key={finding.findingId}
                finding={finding}
                mode={explanationMode}
                onViewSource={(id) => {
                  onViewFinding?.(id);
                }}
              />
            ))}
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={onViewSources}>
                View all {digest.statistics.totalFindings} findings →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
```

**Replace with:**
```typescript
      {/* Also In This Digest */}
      {digest.topFindings && digest.topFindings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Also In This Digest</CardTitle>
              <span className="text-sm text-muted-foreground">
                {digest.topFindings.length} of {digest.statistics.totalFindings}
              </span>
            </div>
            {/* Source type filter tabs */}
            <div className="flex gap-1 flex-wrap mt-2">
              <Button
                variant={topFindingsFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTopFindingsFilter('all')}
              >
                All ({digest.topFindings.length})
              </Button>
              {['pubmed', 'clinical_trial', 'fda', 'web'].map((sourceType) => {
                const count = digest.topFindings.filter(f => f.sourceType === sourceType).length;
                if (count === 0) return null;
                const labels: Record<string, string> = { pubmed: 'PubMed', clinical_trial: 'Clinical', fda: 'FDA', web: 'Web' };
                return (
                  <Button
                    key={sourceType}
                    variant={topFindingsFilter === sourceType ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTopFindingsFilter(sourceType)}
                  >
                    {labels[sourceType]} ({count})
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {digest.topFindings
              .filter(f => topFindingsFilter === 'all' || f.sourceType === topFindingsFilter)
              .map((finding) => (
              <FindingSummaryCard
                key={finding.findingId}
                finding={finding}
                mode={explanationMode}
                onViewSource={(id) => {
                  onViewFinding?.(id);
                }}
              />
            ))}
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={onViewSources}>
                View all {digest.statistics.totalFindings} findings →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
```

### Step 9.4: Add `topFindingsFilter` state

**File**: `src/components/DigestCard.tsx`
**Location**: Near the top of the component function (after existing useState calls)

Add this state declaration:
```typescript
const [topFindingsFilter, setTopFindingsFilter] = useState<string>('all');
```

> **Note**: Make sure `useState` is imported (it should already be from line 1).

**Verification:**
```bash
npm run build
cd backend && npm run build
```

**✅ Phase 9 Checklist:**
- [ ] Backend schema allows up to 12 topFindings
- [ ] AI prompt updated to generate up to 12 additional findings
- [ ] "Also In This Digest" section shows source-type filter tabs
- [ ] Filter tabs only show for source types with count > 0
- [ ] Filter correctly filters the FindingSummaryCard list
- [ ] Both builds pass

---

## Phase 10: SourceDrawer Visual Improvements

**Goal**: Add source-type color coding to finding cards and digest-featured badges.

### Step 10.1: Add source-type left border color to finding cards

**File**: `src/components/research/drawers/SourceDrawer.tsx`
**Location**: Find the Card rendering for each finding in the List View (around lines 260-270)

Add a helper function near the top of the component:
```typescript
  // Source type to border color mapping
  const getSourceBorderColor = (finding: any): string => {
    const type = finding.source?.type?.toLowerCase() || '';
    if (type.includes('pubmed')) return 'border-l-4 border-blue-500';
    if (type.includes('clinical')) return 'border-l-4 border-green-500';
    if (type.includes('fda')) return 'border-l-4 border-purple-500';
    return 'border-l-4 border-gray-300';
  };
```

Then add this class to the finding Card component:
**Find** (the Card className for each finding):
```typescript
<Card className={cn(
```
or similar Card element for each finding.

Add `getSourceBorderColor(finding)` to the Card's className.

### Step 10.2: Pass digest finding IDs to SourceDrawer

**File**: `src/components/research/ResearchPage.tsx`
**Location**: Lines 106-112 (SourceDrawer rendering)

**Find:**
```typescript
      <SourceDrawer
        isOpen={modals.sourceDrawer}
        onClose={closeSourceDrawer}
        findings={sourceDrawerFindings}
        selectedDigestThemeId={sourceDrawerContext.digestThemeId || undefined}
        digestThemeName={sourceDrawerContext.digestThemeName || undefined}
      />
```

**Replace with:**
```typescript
      <SourceDrawer
        isOpen={modals.sourceDrawer}
        onClose={closeSourceDrawer}
        findings={sourceDrawerFindings}
        selectedDigestThemeId={sourceDrawerContext.digestThemeId || undefined}
        digestThemeName={sourceDrawerContext.digestThemeName || undefined}
        featuredFindingId={digest?.featuredDiscovery?.findingId}
        digestFindingIds={digest?.topFindings?.map(f => f.findingId) || []}
      />
```

### Step 10.3: Accept and render digest badges in SourceDrawer

**File**: `src/components/research/drawers/SourceDrawer.tsx`
**Location**: Component props interface

Add to the props:
```typescript
  featuredFindingId?: string;
  digestFindingIds?: string[];
```

Then in the finding card rendering, add badges:
```typescript
{featuredFindingId === finding.id && (
  <Badge className="bg-amber-100 text-amber-800 text-xs">Featured</Badge>
)}
{digestFindingIds?.includes(finding.id) && featuredFindingId !== finding.id && (
  <Badge variant="outline" className="text-xs text-muted-foreground">In Digest</Badge>
)}
```

### Step 10.4: Add summaries to "Grouped by Source" tab

**File**: `src/components/research/drawers/SourceDrawer.tsx`
**Location**: Find the Grouped by Source tab content where it renders just titles

Add `finding.summary` as a 1-line clamp below each title:
```typescript
<p className="text-xs text-muted-foreground line-clamp-1">
  {finding.summary}
</p>
```

**Verification:**
```bash
npm run build
```

**✅ Phase 10 Checklist:**
- [ ] Finding cards have colored left borders by source type
- [ ] Featured finding shows amber "Featured" badge
- [ ] Top findings show "In Digest" outline badge
- [ ] Grouped by Source tab shows 1-line summaries
- [ ] Frontend build passes

---

## Phase 11: Build Verification & Deployment

### Step 11.1: Full build verification
```bash
# Frontend
npm run build

# Backend
cd backend && npm run build
```

### Step 11.2: Deploy to server
```bash
# Push changes
git push

# SSH and deploy
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
docker compose down && docker compose up -d --build
```

### Step 11.3: Delete test topic and re-run agents
Since Phase 6 (backfill) was skipped, delete the existing test topic from the app and create a fresh one. Run agents to generate new findings with structured summaries.

**✅ Phase 11 Checklist:**
- [ ] Frontend build passes
- [ ] Backend build passes
- [ ] Changes pushed to git
- [ ] Server deployment successful
- [ ] Test topic deleted and re-created with fresh agent run

---

## Phase 12: Production Verification

### Test Cases

**Digest Click Interactions:**
- [ ] Click "View original" in FeaturedDiscovery → FindingDetailDrawer opens with correct finding
- [ ] Click ExternalLink icon → source URL opens in new tab
- [ ] Click any FindingSummaryCard → FindingDetailDrawer opens
- [ ] ChevronRight icon visible on FindingSummaryCard as click affordance

**PubMed Abstracts:**
- [ ] Run agents manually → check new PubMed findings have real abstracts
- [ ] Verify no findings have "No abstract available" text
- [ ] Check backend logs for efetch success messages

**Structured Summaries:**
- [ ] Open SourceDrawer → new findings show labeled fields (Key Finding, Method, Why It Matters)
- [ ] Old findings without structured data show raw text fallback gracefully
- [ ] No text walls or raw markdown in any finding

**Autonomous Agent Validation:**
- [ ] Wait 15 minutes for scheduler to trigger
- [ ] Check new findings from autonomous run have structured summaries
- [ ] Verify same format as manually-triggered findings

**Digest Layout:**
- [ ] Source stats appear as inline pills (not standalone card)
- [ ] "Also In This Digest" shows up to 12 findings
- [ ] Source-type filter tabs work correctly
- [ ] Filter tab counts match actual findings

**SourceDrawer Visual:**
- [ ] Cards have colored left borders (blue=PubMed, green=Clinical, purple=FDA, gray=Web)
- [ ] Featured finding shows "Featured" amber badge
- [ ] Top findings show "In Digest" outline badge
- [ ] Grouped by Source tab shows summaries

---

## Rollback Plan

If issues arise after deployment:

1. **Revert code changes**: `git revert HEAD~1` and redeploy
2. **Structured JSON in `metadata.structuredDetails`** is backward-compatible — the frontend falls back to raw text rendering if structured data is missing or JSON parse fails
3. **No database migrations**: This plan doesn't add/remove DB columns (structured details stored in existing `metadata` JSONB)
4. **PubMed efetch failure**: Wrapped in try/catch - falls back to empty string, never blocks search

---

## Sign-off

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase 1: Wire click handlers | | | |
| Phase 2: Visual affordances | | | |
| Phase 3: PubMed efetch | | | |
| Phase 4: Property mismatch | | | |
| Phase 5: Structured Haiku summaries | DONE | Feb 6 | structuredDetails stored in metadata JSONB (no details column) |
| Phase 6: ~~Backfill endpoint~~ | SKIPPED | Feb 6 | No users yet — delete topic & re-run agents |
| Phase 7: Structured details UI | DONE | Feb 6 | Reads (finding as any).structuredDetails from metadata spread |
| Phase 8: Inline source stats | DONE | Feb 6 | Standalone SourceStatsBar replaced with inline colored pills in digest header CardContent |
| Phase 9: 12 findings + tabs | DONE | Feb 6 | Schema+prompt updated to 12; source-type filter tabs added to "Also In This Digest" |
| Phase 10: SourceDrawer visuals | DONE | Feb 6 | Left border colors, Featured/In Digest badges, grouped-view summaries |
| Phase 11: Deployment | | | |
| Phase 12: Verification | | | |
