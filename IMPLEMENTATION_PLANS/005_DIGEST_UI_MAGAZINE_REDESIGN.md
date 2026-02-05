# 005 - Digest UI/UX Redesign: Magazine Editorial Style

## ⛔ STOP: Read This Before Writing ANY Code

**This document is the STRICT implementation guide for redesigning the digest UI to feel like curated editorial content.**

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
│ - Generate a new digest                                         │
│ - Verify all sections render correctly                          │
│ - Test Technical/Explained toggle                               │
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
- **Priority**: HIGH - UX improvement
- **Branch**: Create new branch `feature/digest-magazine-redesign`

---

## The Problem

**User Feedback**: "Despite having >30 findings, the digest looks like it's crafted from 1 piece of news"

### Current Issues
1. **Single Key Insight** - Just one paragraph summarizing ALL 44 findings
2. **No source diversity shown** - Can't see that info came from PubMed, Clinical Trials, FDA
3. **Flat hierarchy** - All content at same visual weight
4. **Broken toggle** - "Detailed/Simple" only affects one section, feels broken
5. **No "hero" content** - Everything presented equally, no featured finding

---

## The Solution

Transform the digest into a **curated newsletter** with:

1. **Source Stats Bar** - "📚 12 PubMed | 🔬 8 Trials | 📋 3 FDA | 🌐 21 Web"
2. **Featured Discovery** - Large hero card with the most impactful finding
3. **Also In This Digest** - 5 AI-curated summaries with inline source icons
4. **Technical/Explained Toggle** - Technical = medical terms, Explained = analogies & metaphors

---

## Summary of Changes

| Change | Priority | Files Affected |
|--------|----------|----------------|
| Add Zod schemas for new digest fields | HIGH | backend/src/schemas/digest.schema.ts |
| Update AI prompt for new digest structure | HIGH | backend/src/services/ai.service.ts |
| Add source counting to processor | MEDIUM | backend/src/services/digest-processor.service.ts |
| Add new TypeScript types | HIGH | src/types/index.ts |
| Create SourceStatsBar component | HIGH | src/components/digest/SourceStatsBar.tsx (NEW) |
| Create FeaturedDiscovery component | HIGH | src/components/digest/FeaturedDiscovery.tsx (NEW) |
| Create FindingSummaryCard component | HIGH | src/components/digest/FindingSummaryCard.tsx (NEW) |
| Create SourceIcon component | MEDIUM | src/components/digest/SourceIcon.tsx (NEW) |
| Refactor DigestCard | HIGH | src/components/DigestCard.tsx |
| Rename explanation mode | LOW | src/stores/appStore.ts |

---

## Strict Rules for All Agents

### ✅ MUST DO:
1. **Follow each step IN ORDER** - No skipping ahead
2. **Run `npm run build` after each file change** - Verify no errors
3. **Test after each phase** - Use the exact test scenarios provided
4. **Ground ALL content in real findings** - Every claim must have a finding ID
5. **Update this document** - Mark steps complete as you go

### ❌ MUST NOT DO:
1. **Add ANY new features beyond spec** - Only implement what's specified
2. **Invent statistics or data** - AI must only summarize existing findings
3. **Refactor surrounding code** - Touch only the lines specified
4. **Skip the explained mode** - Both Technical AND Explained must be implemented
5. **Remove existing sections** - Keep Takeaways, Questions, Warnings, Contradictions

---

## Critical Design Principles

### BESPOKE CURATED CONTENT - Not raw data display!

The digest should feel like a professional medical writer reviewed 44 sources and wrote a personalized newsletter. Every piece of text is:
- AI-written specifically for this digest
- Contextualized for the user's condition
- Explains significance, not just states facts

### GROUNDED IN FACTS - Nothing fictional or made up!

Every AI-written summary MUST be:
- **Traceable**: Linked to specific finding IDs in the database
- **Verifiable**: User can click to see the original source
- **Factual**: Only states what the actual research says
- **Attributed**: Shows source type (PubMed, FDA, Trial) and publication info
- **No hallucination**: AI summarizes existing findings, does NOT invent new claims

**Example of GOOD curated content:**
> "A new meta-analysis of 2,847 patients confirms that IGF-1 normalization rates..."
> → Links to actual PubMed finding ID, shows journal name, date, sample size

**Example of BAD content (NEVER do this):**
> "Studies suggest improvement rates of 85%..."
> → No source, no finding ID, potentially made-up statistic

---

## Visual Mockup

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                          ┃
┃  Weekly Research Digest                            ┌───────────────────┐ ┃
┃  Updated 7 minutes ago                             │🎓Technical│💡Explain│ ┃
┃                                                    └───────────────────┘ ┃
┃  ┌────────────────────────────────────────────────────────────────────┐  ┃
┃  │                         44 findings analyzed                        │  ┃
┃  │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │  ┃
┃  │   │  📚 12   │   │  🔬 8    │   │  📋 3    │   │  🌐 21   │       │  ┃
┃  │   │  PubMed  │   │  Trials  │   │   FDA    │   │   Web    │       │  ┃
┃  │   └──────────┘   └──────────┘   └──────────┘   └──────────┘       │  ┃
┃  └────────────────────────────────────────────────────────────────────┘  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ★ FEATURED DISCOVERY                                                    ┃
┃  ┌─ 📋 FDA Approval ─────────────────────────────────────────────────┐  ┃
┃  │   ┌────────────────────────────────────────────────────────────┐  │  ┃
┃  │   │  "The FDA has approved paltusotine (Palsonify), the       │  │  ┃
┃  │   │   first once-daily oral medication for acromegaly..."     │  │  ┃
┃  │   └────────────────────────────────────────────────────────────┘  │  ┃
┃  │   WHY THIS MATTERS FOR YOU                                        │  ┃
┃  │   Based on the PATHFNDR-1 and PATHFNDR-2 Phase 3 trials...       │  ┃
┃  │   ┌──────────────────────────────────────────────────────────┐   │  ┃
┃  │   │  💡 ACTION ITEM: Discuss switching to oral paltusotine   │   │  ┃
┃  │   │     with your endocrinologist.                           │   │  ┃
┃  │   └──────────────────────────────────────────────────────────┘   │  ┃
┃  │   Source: FDA Drug Approval • January 2026 • Finding #a1b2c3     │  ┃
┃  └────────────────────────────────────────────────────────────────────┘  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ALSO IN THIS DIGEST                                            5 of 44 ┃
┃  ┌────────────────────────────────────────────────────────────────────┐  ┃
┃  │  📚 New meta-analysis confirms treatment efficacy                  │  ┃
┃  │  A comprehensive review of 12 studies (n=2,847) found that...     │  ┃
┃  │  PubMed • Journal of Clinical Endocrinology • Jan 2026            │  ┃
┃  └────────────────────────────────────────────────────────────────────┘  ┃
┃  [... 4 more cards ...]                                                 ┃
┃                    ┌─────────────────────────────────┐                   ┃
┃                    │   View all 44 findings    →     │                   ┃
┃                    └─────────────────────────────────┘                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[Key Takeaways - collapsible]
[Questions for Doctor - collapsible]
[Warning Signs - always visible]
[Contradictions - if any]
```

---

## Technical vs Explained Mode

### Technical Mode (🎓)
```
"The FDA has approved paltusotine, an oral somatostatin receptor
 type 2 agonist, for the treatment of acromegaly."

WHY THIS MATTERS
This represents the first oral therapy option for acromegaly,
providing an alternative to injectable somatostatin analogs.
Phase 3 trials demonstrated non-inferior IGF-1 normalization
rates compared to depot injections.
```

### Explained Mode (💡)
```
"For the first time, there's a daily pill that can replace the
 injections used to treat acromegaly - like switching from a
 monthly shot to a simple vitamin you take each morning."

WHY THIS MATTERS
Think of growth hormone like a faucet that's stuck open. Current
treatments (injections) work like a wrench to turn it down, but
you needed a nurse or clinic visit. This new pill does the same
job - studies show it works just as well - but you can take it
at home with breakfast.
```

**CRITICAL**: Both versions must contain the SAME FACTS. Only the presentation changes.

---

## Phase 1: Backend - Add New Schema Types

**Goal**: Add Zod schemas for the new digest data structure.

### Step 1.1: Add FeaturedDiscovery Schema

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Add after existing schemas (around line 60)

**Add this code:**
```typescript
// Featured Discovery schema - the "hero" content of the digest
export const FeaturedDiscoverySchema = z.object({
  findingId: z.string().describe('ID of the source finding - MUST exist in database'),
  sourceType: z.enum(['pubmed', 'clinical_trial', 'fda', 'web']),
  technical: z.object({
    quote: z.string().describe('Pull-quote style key statement in medical terminology'),
    whyItMatters: z.string().describe('2-3 sentences explaining significance'),
    actionItem: z.string().optional().describe('Specific action the patient can take'),
  }),
  explained: z.object({
    quote: z.string().describe('Same facts as technical, but with analogies/metaphors'),
    whyItMatters: z.string().describe('Same info with everyday comparisons'),
    actionItem: z.string().optional().describe('Action item in plain language'),
  }),
  sourceMetadata: z.object({
    name: z.string().describe('Source name (e.g., "FDA Drug Approval")'),
    url: z.string().optional(),
    date: z.string().optional(),
    studyType: z.string().optional(),
  }),
});

export type FeaturedDiscovery = z.infer<typeof FeaturedDiscoverySchema>;
```

### Step 1.2: Add TopFinding Schema

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: After FeaturedDiscoverySchema

**Add this code:**
```typescript
// Top Finding schema - secondary notable findings
export const TopFindingSchema = z.object({
  findingId: z.string().describe('ID of the source finding - MUST exist in database'),
  sourceType: z.enum(['pubmed', 'clinical_trial', 'fda', 'web']),
  technical: z.object({
    title: z.string().describe('Finding title in medical terminology'),
    summary: z.string().describe('2-3 sentence summary'),
  }),
  explained: z.object({
    title: z.string().describe('Finding title with plain language'),
    summary: z.string().describe('Summary with analogies/examples'),
  }),
  metadata: z.string().describe('Display string like "PubMed • Jan 2026 • Meta-analysis (n=2,847)"'),
});

export type TopFinding = z.infer<typeof TopFindingSchema>;
```

### Step 1.3: Add SourceBreakdown Schema

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: After TopFindingSchema

**Add this code:**
```typescript
// Source Breakdown schema - counts by source type
export const SourceBreakdownSchema = z.object({
  pubmed: z.number().describe('Count of PubMed/research findings'),
  clinicalTrials: z.number().describe('Count of clinical trial findings'),
  fda: z.number().describe('Count of FDA findings'),
  web: z.number().describe('Count of web/news findings'),
});

export type SourceBreakdown = z.infer<typeof SourceBreakdownSchema>;
```

### Step 1.4: Update Main Digest Schema

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Find the main DigestSchema and add new fields

**Add these fields to the existing schema:**
```typescript
// Add to DigestSchema
featuredDiscovery: FeaturedDiscoverySchema.optional(),
topFindings: z.array(TopFindingSchema).max(5).optional(),
sourceBreakdown: SourceBreakdownSchema.optional(),
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 1 Checklist:**
- [ ] FeaturedDiscoverySchema added
- [ ] TopFindingSchema added
- [ ] SourceBreakdownSchema added
- [ ] Main DigestSchema updated with new fields
- [ ] `cd backend && npm run build` passes

---

## Phase 2: Backend - Update AI Prompt

**Goal**: Update the digest generation prompt to produce the new structure with Technical/Explained modes.

### Step 2.1: Update AI Service Prompt

**File**: `backend/src/services/ai.service.ts`
**Location**: Find the digest generation prompt (around line 300-500)

**Find the existing prompt and ADD these instructions:**

```typescript
const DIGEST_PROMPT_ADDITIONS = `

## NEW REQUIREMENTS - Magazine Editorial Format

You are creating a curated medical research newsletter. Generate content that feels professionally edited.

### FEATURED DISCOVERY
Select the SINGLE most impactful finding as the "hero" content. Prioritize:
1. FDA approvals or major regulatory news
2. Phase 3 trial results
3. Major meta-analyses
4. Breakthrough treatments

For the featured discovery, generate TWO versions:

TECHNICAL VERSION:
- Use proper medical terminology
- Include specific drug names, mechanisms
- Reference trial names and phases
- Use clinical metrics (IGF-1, etc.)

EXPLAINED VERSION:
- Use analogies and metaphors
- Compare to everyday experiences
- Explain medical terms in parentheses
- Make it accessible to non-medical readers

Example TECHNICAL:
"The FDA has approved paltusotine, an oral somatostatin receptor type 2 agonist..."

Example EXPLAINED:
"For the first time, there's a daily pill that can replace injections - like switching from a monthly shot to a simple vitamin you take each morning..."

### TOP FINDINGS
Select 5 additional notable findings. For EACH:
- Generate both technical and explained versions
- Include the finding ID for traceability
- Create a metadata string: "PubMed • Jan 2026 • Meta-analysis (n=2,847)"

### SOURCE BREAKDOWN
Count findings by type:
- pubmed: Count of academic/research sources
- clinicalTrials: Count of trial registry sources
- fda: Count of FDA sources
- web: Count of news/web sources

### CRITICAL GROUNDING RULES
1. Every claim MUST reference a finding ID from the provided data
2. NEVER invent statistics, percentages, or study results
3. The EXPLAINED version must contain the SAME FACTS as TECHNICAL
4. If no suitable finding exists for featured discovery, use null
5. Include finding IDs in your response for validation
`;
```

### Step 2.2: Update Response Schema

**File**: `backend/src/services/ai.service.ts`
**Location**: Find where the AI response is parsed/validated

**Update the expected response structure to include:**
```typescript
const expectedDigestResponse = {
  // ... existing fields ...
  featuredDiscovery: {
    findingId: 'string',
    sourceType: 'pubmed|clinical_trial|fda|web',
    technical: { quote: 'string', whyItMatters: 'string', actionItem: 'string?' },
    explained: { quote: 'string', whyItMatters: 'string', actionItem: 'string?' },
    sourceMetadata: { name: 'string', url: 'string?', date: 'string?', studyType: 'string?' }
  },
  topFindings: [/* array of 5 items */],
  sourceBreakdown: { pubmed: 0, clinicalTrials: 0, fda: 0, web: 0 }
};
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 2 Checklist:**
- [ ] Digest prompt updated with magazine editorial instructions
- [ ] Technical/Explained mode instructions added
- [ ] Grounding rules explicitly stated
- [ ] Response schema updated
- [ ] `cd backend && npm run build` passes

---

## Phase 3: Backend - Add Source Counting

**Goal**: Add utility function to count findings by source type.

### Step 3.1: Add Source Counter Function

**File**: `backend/src/services/digest-processor.service.ts`
**Location**: Add as a utility function near the top of the file

**Add this function:**
```typescript
/**
 * Count findings by source type for the source stats bar
 */
function countSourcesByType(findings: any[]): {
  pubmed: number;
  clinicalTrials: number;
  fda: number;
  web: number;
} {
  const breakdown = { pubmed: 0, clinicalTrials: 0, fda: 0, web: 0 };

  for (const finding of findings) {
    const sourceType = finding.source?.type?.toLowerCase() || '';

    if (sourceType.includes('pubmed') || sourceType.includes('research') || sourceType === 'academic') {
      breakdown.pubmed++;
    } else if (sourceType.includes('clinical') || sourceType.includes('trial')) {
      breakdown.clinicalTrials++;
    } else if (sourceType.includes('fda')) {
      breakdown.fda++;
    } else {
      breakdown.web++;
    }
  }

  return breakdown;
}
```

### Step 3.2: Use Counter in Digest Generation

**File**: `backend/src/services/digest-processor.service.ts`
**Location**: Find where digest is being prepared for AI

**Add this call before sending to AI:**
```typescript
// Calculate source breakdown from findings
const sourceBreakdown = countSourcesByType(findings);

// Include in the data sent to AI
const digestInput = {
  // ... existing fields ...
  sourceBreakdown,
  findingsWithIds: findings.map(f => ({
    id: f.id,
    content: f.content,
    source: f.source,
    // ... other fields
  }))
};
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 3 Checklist:**
- [ ] countSourcesByType function added
- [ ] Function called during digest generation
- [ ] Source breakdown included in AI input
- [ ] `cd backend && npm run build` passes

---

## Phase 4: Frontend - Add TypeScript Types

**Goal**: Add TypeScript interfaces for the new digest structure.

### Step 4.1: Add New Types

**File**: `src/types/index.ts`
**Location**: Find the SmartDigest interface (around line 475)

**Add these types BEFORE the SmartDigest interface:**
```typescript
// Source type for categorizing findings
export type DigestSourceType = 'pubmed' | 'clinical_trial' | 'fda' | 'web';

// Featured Discovery - the "hero" content of the digest
export interface FeaturedDiscovery {
  findingId: string;
  sourceType: DigestSourceType;
  technical: {
    quote: string;
    whyItMatters: string;
    actionItem?: string;
  };
  explained: {
    quote: string;
    whyItMatters: string;
    actionItem?: string;
  };
  sourceMetadata: {
    name: string;
    url?: string;
    date?: string;
    studyType?: string;
  };
}

// Top Finding - secondary notable findings
export interface TopFinding {
  findingId: string;
  sourceType: DigestSourceType;
  technical: {
    title: string;
    summary: string;
  };
  explained: {
    title: string;
    summary: string;
  };
  metadata: string;
}

// Source Breakdown - counts by type
export interface SourceBreakdown {
  pubmed: number;
  clinicalTrials: number;
  fda: number;
  web: number;
}
```

### Step 4.2: Update SmartDigest Interface

**File**: `src/types/index.ts`
**Location**: Find the SmartDigest interface

**Add these fields to the existing interface:**
```typescript
export interface SmartDigest {
  // ... existing fields ...

  // NEW fields for magazine editorial design
  featuredDiscovery?: FeaturedDiscovery;
  topFindings?: TopFinding[];
  sourceBreakdown?: SourceBreakdown;
}
```

### Step 4.3: Update ExplanationMode Type

**File**: `src/types/index.ts`
**Location**: Find `export type ExplanationMode`

**Change from:**
```typescript
export type ExplanationMode = 'detailed' | 'simple';
```

**To:**
```typescript
export type ExplanationMode = 'technical' | 'explained';
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 4 Checklist:**
- [ ] DigestSourceType added
- [ ] FeaturedDiscovery interface added
- [ ] TopFinding interface added
- [ ] SourceBreakdown interface added
- [ ] SmartDigest updated with new fields
- [ ] ExplanationMode renamed to technical/explained
- [ ] `npm run build` passes

---

## Phase 5: Frontend - Create SourceIcon Component

**Goal**: Create a reusable component for source type icons.

### Step 5.1: Create SourceIcon Component

**File**: `src/components/digest/SourceIcon.tsx` (NEW FILE)

**Create this file with the following content:**
```typescript
import React from 'react';
import { BookOpen, FlaskConical, Shield, Globe } from 'lucide-react';
import type { DigestSourceType } from '@/types';

interface SourceIconProps {
  type: DigestSourceType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SOURCE_CONFIG: Record<DigestSourceType, {
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  label: string;
}> = {
  pubmed: {
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'PubMed',
  },
  clinical_trial: {
    icon: FlaskConical,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Clinical Trial',
  },
  fda: {
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'FDA',
  },
  web: {
    icon: Globe,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Web',
  },
};

const SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function SourceIcon({ type, size = 'md', showLabel = false, className = '' }: SourceIconProps) {
  const config = SOURCE_CONFIG[type];
  const Icon = config.icon;

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`p-1 rounded ${config.bgColor}`}>
          <Icon className={`${SIZE_MAP[size]} ${config.color}`} />
        </span>
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </span>
    );
  }

  return (
    <Icon className={`${SIZE_MAP[size]} ${config.color} ${className}`} />
  );
}

export { SOURCE_CONFIG };
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 5 Checklist:**
- [ ] src/components/digest/ directory created (if needed)
- [ ] SourceIcon.tsx created with full implementation
- [ ] Exports SourceIcon and SOURCE_CONFIG
- [ ] `npm run build` passes

---

## Phase 6: Frontend - Create SourceStatsBar Component

**Goal**: Create the source statistics bar that shows finding counts by type.

### Step 6.1: Create SourceStatsBar Component

**File**: `src/components/digest/SourceStatsBar.tsx` (NEW FILE)

**Create this file with the following content:**
```typescript
import React from 'react';
import { Card } from '@/components/ui/card';
import { SourceIcon, SOURCE_CONFIG } from './SourceIcon';
import type { SourceBreakdown } from '@/types';

interface SourceStatsBarProps {
  breakdown: SourceBreakdown;
  totalFindings: number;
  className?: string;
}

export function SourceStatsBar({ breakdown, totalFindings, className = '' }: SourceStatsBarProps) {
  const stats = [
    { type: 'pubmed' as const, count: breakdown.pubmed },
    { type: 'clinical_trial' as const, count: breakdown.clinicalTrials },
    { type: 'fda' as const, count: breakdown.fda },
    { type: 'web' as const, count: breakdown.web },
  ].filter(stat => stat.count > 0); // Only show sources that have findings

  return (
    <Card className={`p-4 ${className}`}>
      <p className="text-sm text-center text-muted-foreground mb-3">
        {totalFindings} findings analyzed
      </p>
      <div className="flex justify-center gap-4 flex-wrap">
        {stats.map(({ type, count }) => (
          <div
            key={type}
            className="flex flex-col items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800 min-w-[80px]"
          >
            <SourceIcon type={type} size="md" />
            <span className="text-lg font-bold mt-1">{count}</span>
            <span className="text-xs text-muted-foreground">{SOURCE_CONFIG[type].label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 6 Checklist:**
- [ ] SourceStatsBar.tsx created
- [ ] Filters out sources with 0 count
- [ ] Displays total findings count
- [ ] Uses SourceIcon for consistent icons
- [ ] `npm run build` passes

---

## Phase 7: Frontend - Create FeaturedDiscovery Component

**Goal**: Create the hero card for the most impactful finding.

### Step 7.1: Create FeaturedDiscovery Component

**File**: `src/components/digest/FeaturedDiscovery.tsx` (NEW FILE)

**Create this file with the following content:**
```typescript
import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Star, Lightbulb } from 'lucide-react';
import { SourceIcon, SOURCE_CONFIG } from './SourceIcon';
import type { FeaturedDiscovery as FeaturedDiscoveryType, ExplanationMode } from '@/types';

interface FeaturedDiscoveryProps {
  discovery: FeaturedDiscoveryType;
  mode: ExplanationMode;
  onViewSource?: (findingId: string) => void;
}

export function FeaturedDiscovery({ discovery, mode, onViewSource }: FeaturedDiscoveryProps) {
  const content = mode === 'technical' ? discovery.technical : discovery.explained;
  const { sourceMetadata } = discovery;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span className="font-semibold uppercase tracking-wide">Featured Discovery</span>
        </div>
        <div className="flex items-center gap-2">
          <SourceIcon type={discovery.sourceType} showLabel />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pull Quote */}
        <blockquote className="relative pl-4 border-l-4 border-primary/40 py-2">
          <p className="text-lg font-medium leading-relaxed italic">
            "{content.quote}"
          </p>
        </blockquote>

        {/* Why This Matters */}
        <div>
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
            Why This Matters for You
          </h4>
          <p className="text-sm leading-relaxed">
            {content.whyItMatters}
          </p>
        </div>

        {/* Action Item */}
        {content.actionItem && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                  Action Item
                </span>
                <p className="text-sm text-amber-900 dark:text-amber-100 mt-1">
                  {content.actionItem}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Source Attribution */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <span>Source: {sourceMetadata.name}</span>
          {sourceMetadata.date && <span> • {sourceMetadata.date}</span>}
          {sourceMetadata.studyType && <span> • {sourceMetadata.studyType}</span>}
          {onViewSource && (
            <button
              onClick={() => onViewSource(discovery.findingId)}
              className="ml-2 text-primary hover:underline"
            >
              View original →
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 7 Checklist:**
- [ ] FeaturedDiscovery.tsx created
- [ ] Supports technical/explained mode toggle
- [ ] Shows pull quote with border accent
- [ ] Shows "Why This Matters" section
- [ ] Shows action item callout (if present)
- [ ] Shows source attribution
- [ ] `npm run build` passes

---

## Phase 8: Frontend - Create FindingSummaryCard Component

**Goal**: Create compact cards for the "Also In This Digest" section.

### Step 8.1: Create FindingSummaryCard Component

**File**: `src/components/digest/FindingSummaryCard.tsx` (NEW FILE)

**Create this file with the following content:**
```typescript
import React from 'react';
import { Card } from '@/components/ui/card';
import { SourceIcon } from './SourceIcon';
import type { TopFinding, ExplanationMode } from '@/types';

interface FindingSummaryCardProps {
  finding: TopFinding;
  mode: ExplanationMode;
  onViewSource?: (findingId: string) => void;
}

export function FindingSummaryCard({ finding, mode, onViewSource }: FindingSummaryCardProps) {
  const content = mode === 'technical' ? finding.technical : finding.explained;

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onViewSource?.(finding.findingId)}
    >
      <div className="flex items-start gap-3">
        <SourceIcon type={finding.sourceType} size="md" className="flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-tight mb-1">
            {content.title}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            {content.summary}
          </p>
          <p className="text-xs text-muted-foreground">
            {finding.metadata}
          </p>
        </div>
      </div>
    </Card>
  );
}
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 8 Checklist:**
- [ ] FindingSummaryCard.tsx created
- [ ] Supports technical/explained mode
- [ ] Shows source icon
- [ ] Shows title and summary
- [ ] Shows metadata line
- [ ] Clickable for viewing source
- [ ] `npm run build` passes

---

## Phase 9: Frontend - Refactor DigestCard

**Goal**: Integrate all new components into the main DigestCard.

### Step 9.1: Update Imports

**File**: `src/components/DigestCard.tsx`
**Location**: Top of file (imports section)

**Add these imports:**
```typescript
import { SourceStatsBar } from './digest/SourceStatsBar';
import { FeaturedDiscovery } from './digest/FeaturedDiscovery';
import { FindingSummaryCard } from './digest/FindingSummaryCard';
import { GraduationCap, Lightbulb as LightbulbIcon } from 'lucide-react';
```

### Step 9.2: Update Toggle Button

**File**: `src/components/DigestCard.tsx`
**Location**: Find the Detailed/Simple toggle button (around line 189-198)

**Replace the toggle button with:**
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setExplanationMode(
    explanationMode === 'technical' ? 'explained' : 'technical'
  )}
  className="gap-2"
>
  {explanationMode === 'technical' ? (
    <>
      <GraduationCap className="h-4 w-4" />
      Technical
    </>
  ) : (
    <>
      <LightbulbIcon className="h-4 w-4" />
      Explained
    </>
  )}
</Button>
```

### Step 9.3: Add Source Stats Bar

**File**: `src/components/DigestCard.tsx`
**Location**: After the header card, before Key Insight section

**Add this section:**
```typescript
{/* Source Stats Bar */}
{digest.sourceBreakdown && (
  <SourceStatsBar
    breakdown={digest.sourceBreakdown}
    totalFindings={digest.statistics.totalFindings}
  />
)}
```

### Step 9.4: Add Featured Discovery Section

**File**: `src/components/DigestCard.tsx`
**Location**: After Source Stats Bar, replace the Key Insight section

**Replace the Key Insight section with:**
```typescript
{/* Featured Discovery */}
{digest.featuredDiscovery && (
  <FeaturedDiscovery
    discovery={digest.featuredDiscovery}
    mode={explanationMode}
    onViewSource={(id) => {
      // TODO: Navigate to finding detail
      console.log('View finding:', id);
    }}
  />
)}

{/* Fallback to old Key Insight if no featured discovery */}
{!digest.featuredDiscovery && (
  <div className="p-4 bg-background/50 rounded-lg border">
    <h3 className="font-semibold mb-2 flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-yellow-500" />
      Key Insight
    </h3>
    <p className="text-sm leading-relaxed">
      {explanationMode === 'explained' && digest.laymanSummary
        ? digest.laymanSummary
        : digest.executiveSummary}
    </p>
  </div>
)}
```

### Step 9.5: Add "Also In This Digest" Section

**File**: `src/components/DigestCard.tsx`
**Location**: After Featured Discovery, before Key Takeaways

**Add this new section:**
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
            console.log('View finding:', id);
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

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 9 Checklist:**
- [ ] New imports added
- [ ] Toggle button updated to Technical/Explained
- [ ] SourceStatsBar added
- [ ] FeaturedDiscovery section added
- [ ] Fallback Key Insight preserved for backwards compatibility
- [ ] "Also In This Digest" section added
- [ ] `npm run build` passes

---

## Phase 10: Update App Store

**Goal**: Update the explanation mode default value.

### Step 10.1: Update Default Mode

**File**: `src/stores/appStore.ts`
**Location**: Find `explanationMode: 'simple'`

**Change from:**
```typescript
explanationMode: 'simple',
```

**To:**
```typescript
explanationMode: 'technical',
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 10 Checklist:**
- [ ] Default explanation mode changed to 'technical'
- [ ] `npm run build` passes

---

## Phase 11: Build Verification

### Step 11.1: Frontend Build

```bash
npm run build
# Must complete with exit code 0
# Check for any warnings about unused imports
```

### Step 11.2: Backend Build

```bash
cd backend && npm run build
# Must complete with exit code 0
```

**✅ Phase 11 Checklist:**
- [ ] Frontend build passes with no errors
- [ ] Backend build passes with no errors
- [ ] No unused import warnings

---

## Phase 12: Deployment

### Step 12.1: Commit Changes

```bash
git add -A
git status
# Review all changed/new files

git commit -m "feat(digest): magazine editorial redesign with Technical/Explained modes

New Features:
- Source Stats Bar showing findings breakdown by type (PubMed/Trials/FDA/Web)
- Featured Discovery hero card with most impactful finding
- Also In This Digest section with 5 curated summaries
- Technical/Explained toggle (replaces Detailed/Simple)
  - Technical: Medical terminology
  - Explained: Analogies and metaphors for accessibility

New Components:
- SourceIcon - Consistent icons for source types
- SourceStatsBar - Visual breakdown of 44 findings
- FeaturedDiscovery - Hero card with quote, why it matters, action item
- FindingSummaryCard - Compact cards for secondary findings

Backend Changes:
- New Zod schemas for FeaturedDiscovery, TopFinding, SourceBreakdown
- Updated AI prompt for magazine editorial format
- Source counting utility function

Design Principles:
- Every claim grounded in real findings (finding IDs for verification)
- Bespoke AI-curated content, not raw data display
- No hallucinated statistics - only summarizes existing findings

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Step 12.2: Push and Deploy

```bash
# Create feature branch
git checkout -b feature/digest-magazine-redesign
git push -u origin feature/digest-magazine-redesign

# SSH to server
ssh chee@100.94.82.35

# Deploy
cd /home/chee/medical-pwa
git fetch origin
git checkout feature/digest-magazine-redesign
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify containers running
docker ps
```

**✅ Phase 12 Checklist:**
- [ ] Changes committed with proper message
- [ ] Feature branch created and pushed
- [ ] Pulled on Debian server
- [ ] Containers rebuilt
- [ ] All services running

---

## Phase 13: Production Verification

### Test Scenarios

1. **Source Stats Display**
   - [ ] Navigate to a topic with existing digest
   - [ ] Verify source stats bar shows correct counts
   - [ ] Verify total findings count matches

2. **Featured Discovery**
   - [ ] Verify hero card displays with proper styling
   - [ ] Verify source icon matches source type
   - [ ] Verify quote is in blockquote style
   - [ ] Verify "Why This Matters" section visible
   - [ ] Verify action item callout (if present)

3. **Technical/Explained Toggle**
   - [ ] Click toggle button
   - [ ] Verify content changes appropriately
   - [ ] Verify same facts shown in both modes
   - [ ] Verify toggle persists on page reload

4. **Also In This Digest**
   - [ ] Verify 5 finding cards display
   - [ ] Verify each card shows source icon
   - [ ] Verify metadata line shows correctly
   - [ ] Verify "View all X findings" button works

5. **Backwards Compatibility**
   - [ ] Old digests without new fields still render
   - [ ] Fallback Key Insight shows when no featured discovery
   - [ ] No console errors

6. **New Digest Generation**
   - [ ] Generate new digest
   - [ ] Verify new fields populated (featuredDiscovery, topFindings, sourceBreakdown)
   - [ ] Verify finding IDs are real (exist in database)

**✅ Phase 13 Checklist:**
- [ ] All test scenarios pass
- [ ] No console errors
- [ ] No visual regressions in existing sections

---

## Rollback Plan

If issues occur:

### UI Issues (Component files)
```bash
git checkout HEAD~1 -- src/components/DigestCard.tsx
git checkout HEAD~1 -- src/components/digest/
npm run build
# Redeploy
```

### Backend Issues (AI prompt changes)
```bash
git checkout HEAD~1 -- backend/src/services/ai.service.ts
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

| File | Action | Lines Est. |
|------|--------|------------|
| `backend/src/schemas/digest.schema.ts` | MODIFY | +50 |
| `backend/src/services/ai.service.ts` | MODIFY | +100 |
| `backend/src/services/digest-processor.service.ts` | MODIFY | +30 |
| `src/types/index.ts` | MODIFY | +50 |
| `src/components/digest/SourceIcon.tsx` | NEW | ~60 |
| `src/components/digest/SourceStatsBar.tsx` | NEW | ~50 |
| `src/components/digest/FeaturedDiscovery.tsx` | NEW | ~100 |
| `src/components/digest/FindingSummaryCard.tsx` | NEW | ~50 |
| `src/components/DigestCard.tsx` | MODIFY | +80 |
| `src/stores/appStore.ts` | MODIFY | +2 |

**Estimated Total**: ~570 lines of changes/additions

---

## Document History

- **Created**: February 6, 2026
- **Author**: Claude Opus 4.5
- **Status**: Ready for implementation

---

## Phase Completion Sign-off

### Local Development
- [ ] Phase 1: Backend schemas complete
- [ ] Phase 2: AI prompt updated
- [ ] Phase 3: Source counting added
- [ ] Phase 4: TypeScript types added
- [ ] Phase 5: SourceIcon component created
- [ ] Phase 6: SourceStatsBar component created
- [ ] Phase 7: FeaturedDiscovery component created
- [ ] Phase 8: FindingSummaryCard component created
- [ ] Phase 9: DigestCard refactored
- [ ] Phase 10: App store updated
- [ ] Phase 11: All builds pass

### Deployment
- [ ] Changes committed with proper message
- [ ] Feature branch created and pushed
- [ ] Pulled on Debian server
- [ ] Containers rebuilt

### Production Testing
- [ ] All verification checklist items pass
- [ ] No console errors
- [ ] No visual regressions

### Sign-off
- [ ] All phases complete (Date: _______)
- [ ] Document archived after completion
