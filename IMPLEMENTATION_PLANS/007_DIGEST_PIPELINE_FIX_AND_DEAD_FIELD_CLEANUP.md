# 007 - Digest Pipeline Fix & Dead Field Cleanup

## ⛔ STOP: Read This ENTIRE Document Before Writing ANY Code

**This document is the STRICT implementation guide for fixing the 7-layer digest pipeline so magazine editorial fields actually work, AND cleaning up dead fields that waste AI tokens and DB storage.**

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
│ PHASE 1-9: LOCAL DEVELOPMENT                                    │
│ - Implement ALL phases locally                                  │
│ - Run `npm run build` after each file change                    │
│ - Run `cd backend && npm run build` for backend changes         │
│ - Verify NO compile errors before proceeding                    │
│ - Commit changes to git                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 10: BUILD VERIFICATION                                    │
│ - Frontend: npm run build                                       │
│ - Backend: cd backend && npm run build                          │
│ - Fix any errors before proceeding                              │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 11: DEPLOYMENT TO DEBIAN SERVER                           │
│ - Push changes to remote repository                             │
│ - SSH into Debian server                                        │
│ - Pull updated repository                                       │
│ - Run database migration                                        │
│ - Rebuild Docker containers                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 12: PRODUCTION VERIFICATION                               │
│ - Regenerate a digest                                           │
│ - Check container logs for correct AI output fields             │
│ - Verify DB stores new columns                                  │
│ - Verify UI renders magazine layout                             │
│ - Test backward compat with old digests                         │
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
- **Priority**: CRITICAL - Magazine UI deployed but pipeline incomplete
- **Branch**: fix/digest-findings-race-condition
- **Predecessor**: Plan 005 (Digest UI Magazine Redesign) - Frontend UI deployed but backend pipeline broken

---

## The Problem

**Plan 005 deployed the magazine editorial UI** (Featured Discovery hero card, Source Stats Bar, "Also In This Digest" section, Technical/Explained toggle), but **none of the new sections render** because the backend pipeline never generates or delivers the data.

### Root Cause: 7-Layer Pipeline Incomplete

The digest flows through 7 layers. Plan 005 only fixed layers 1 (schema definitions) and 7 (UI rendering). Layers 2-6 are broken:

```
Layer 1: AI JSON Schema (digest.schema.ts)     → ⚠️ New fields NOT in required array
Layer 2: AI Prompt (ai.service.ts)              → ⚠️ max_tokens too small (4000)
Layer 3: AI Return Value (ai.service.ts)        → ✅ Already passes through new fields
Layer 4: DB Storage (digest-processor.service)  → ❌ No columns, buried in metadata blob
Layer 5: DB Model (digest.model.ts)             → ❌ Missing TypeScript fields
Layer 6: API Route (digest.routes.ts)           → ❌ Missing column aliases in SELECT
Layer 7: Frontend Transform (digest.service.ts) → ❌ Never extracts new fields
Layer 8: UI Rendering (DigestCard.tsx)           → ✅ Already deployed in Plan 005
```

### Production Evidence

Container logs show AI generates OLD fields only:
```
Tool input keys: ['executiveSummary', 'laymanSummary', 'keyTakeaways', 'themes', 'trends']
```

Expected (after this fix):
```
Tool input keys: ['executiveSummary', 'laymanSummary', 'keyTakeaways', 'featuredDiscovery', 'topFindings', 'sourceBreakdown']
```

### Dead Field Audit

In addition to the pipeline fix, this plan removes dead fields that are generated by AI and stored in DB but **never rendered in the UI**:

| Dead Field | DB Column | AI Schema | Evidence |
|-----------|-----------|-----------|----------|
| `themes[]` | `themes JSONB` | `required` + complex schema | Removed from UI in Plan 004; DigestCard.tsx line 491 comment |
| `trends{}` | `trends JSONB` | `required` + 3 sub-arrays | DigestCard.tsx: "misleading AI-generated placeholders" |
| `knowledgeGaps[]` | `knowledge_gaps JSONB` | in JSON schema | Never rendered anywhere |
| `nextSteps[]` | `next_steps JSONB` | in JSON schema | Never rendered anywhere |
| `clinicalImplications[]` | `clinical_implications JSONB` | not in AI schema | Never rendered anywhere |
| `lifestyleConsiderations[]` | `lifestyle_considerations JSONB` | not in AI schema | Never rendered anywhere |
| `topSources[]` | via metadata | computed in ai.service.ts | Never rendered anywhere |
| `statistics.highRelevanceCount` | via metadata | computed | Never used |
| `statistics.avgConfidence` | via metadata | computed | Never used |

**Impact of cleanup**: Removing `themes` and `trends` from the AI JSON schema eliminates ~100 lines of schema definition and saves significant AI output tokens per digest generation.

---

## Summary of Changes

| Change | Priority | Files Affected |
|--------|----------|----------------|
| Add 3 DB columns for magazine fields | CRITICAL | backend/src/db/migrations/016_add_magazine_editorial_fields.sql (NEW) |
| Update init.sql for fresh installs | CRITICAL | backend/src/db/init.sql |
| Remove dead fields from AI JSON schema | HIGH | backend/src/schemas/digest.schema.ts |
| Add magazine fields to AI required array | CRITICAL | backend/src/schemas/digest.schema.ts |
| Increase max_tokens + clean AI prompt | HIGH | backend/src/services/ai.service.ts |
| Remove dead computations in AI return | HIGH | backend/src/services/ai.service.ts |
| Fix INSERT to use new DB columns | CRITICAL | backend/src/services/digest-processor.service.ts |
| Add fields to TypeScript Digest interface | MEDIUM | backend/src/models/digest.model.ts |
| Add column aliases to API SELECT query | CRITICAL | backend/src/routes/digest.routes.ts |
| Fix transformToFrontend extraction | CRITICAL | src/services/digest.service.ts |
| Clean SmartDigest TypeScript interface | MEDIUM | src/types/index.ts |

---

## Strict Rules for All Agents

### ✅ MUST DO:
1. **Follow each step IN ORDER** - No skipping ahead
2. **Run build verification after each phase** - `cd backend && npm run build` for backend, `npm run build` for frontend
3. **Mark checkboxes** as you complete each step
4. **Keep dead DB columns in place** - Do NOT drop columns (themes, trends, etc.) from PostgreSQL
5. **Maintain backward compatibility** - Old digests must still render without crashing

### ❌ MUST NOT DO:
1. **Drop any DB columns** - Only ADD new columns. Old columns stay (empty but safe)
2. **Add ANY new features** - Only fix the pipeline and clean dead code
3. **Refactor surrounding code** - Touch only the specified lines
4. **Change the AI system prompt** - Magazine editorial instructions are already correct
5. **Modify UI components** - DigestCard.tsx and digest/ components are already correct from Plan 005

---

## Phase 1: Database Migration

**Goal**: Add 3 new JSONB columns for magazine editorial fields.

### Step 1.1: Create Migration File

**File**: `backend/src/db/migrations/016_add_magazine_editorial_fields.sql` (NEW FILE)

**Create this file:**
```sql
-- Migration: Add magazine editorial columns to digests table
-- Fixes: Plan 007 - Magazine editorial fields stored in metadata blob instead of dedicated columns
-- Date: 2026-02-06
-- Author: Medical Companion PWA Team

-- Add dedicated columns for magazine editorial fields
-- These were previously buried in the metadata JSONB blob
ALTER TABLE digests
ADD COLUMN IF NOT EXISTS featured_discovery JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS top_findings JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_breakdown JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN digests.featured_discovery IS 'Hero content: single most impactful finding with technical/explained versions';
COMMENT ON COLUMN digests.top_findings IS 'Array of up to 5 secondary notable findings with dual versions';
COMMENT ON COLUMN digests.source_breakdown IS 'Count of findings by source type: pubmed, clinicalTrials, fda, web';

-- Rollback instructions (if needed):
-- ALTER TABLE digests DROP COLUMN IF EXISTS featured_discovery;
-- ALTER TABLE digests DROP COLUMN IF EXISTS top_findings;
-- ALTER TABLE digests DROP COLUMN IF EXISTS source_breakdown;
```

### Step 1.2: Update init.sql for Fresh Installs

**File**: `backend/src/db/init.sql`
**Location**: Lines 87-110 (digests table CREATE statement)

**Find this section** (lines 107-110):
```sql
    questions_for_doctor JSONB DEFAULT '[]'::jsonb, -- Questions for healthcare provider
    warning_signs JSONB DEFAULT '[]'::jsonb, -- Warning signs to watch for
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

**Replace with:**
```sql
    questions_for_doctor JSONB DEFAULT '[]'::jsonb, -- Questions for healthcare provider
    warning_signs JSONB DEFAULT '[]'::jsonb, -- Warning signs to watch for
    featured_discovery JSONB DEFAULT NULL, -- Hero content with technical/explained versions
    top_findings JSONB DEFAULT '[]'::jsonb, -- Up to 5 secondary findings with dual versions
    source_breakdown JSONB DEFAULT NULL, -- Finding counts by source type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors (init.sql is not compiled, but verify no syntax issues)
```

**✅ Phase 1 Checklist:**
- [ ] Migration file `016_add_magazine_editorial_fields.sql` created
- [ ] `init.sql` updated with 3 new columns in CREATE TABLE
- [ ] Backend build passes

---

## Phase 2: Clean AI JSON Schema

**Goal**: Remove dead fields (themes, trends) from the AI tool schema and make magazine fields required.

### Step 2.1: Remove `themes` Property from digestJSONSchema

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Lines 133-191 (the `themes` property in `digestJSONSchema`)

**Delete the entire `themes` property** from `digestJSONSchema.properties`:

```typescript
// DELETE THIS ENTIRE BLOCK (lines 133-191):
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: {
            type: 'string',
            description: 'Specific theme (e.g., "Metformin Shows 30% Response Rate")'
          },
          // ... all the way through ...
        },
        required: ['id', 'title', 'summary', 'category', 'importance', 'findingIndices', 'entities', 'practicalInsight', 'studyStrength', 'avgConfidence']
      }
    },
```

### Step 2.2: Remove `trends` Property from digestJSONSchema

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Lines 261-302 (after removing themes, line numbers will shift - find the `trends` property)

**Delete the entire `trends` property** from `digestJSONSchema.properties`:

```typescript
// DELETE THIS ENTIRE BLOCK:
    trends: {
      type: 'object',
      properties: {
        emerging: {
          type: 'array',
          items: {
            // ...
          }
        },
        declining: {
          // ...
        },
        stable: {
          // ...
        }
      },
      required: ['emerging', 'declining', 'stable']
    },
```

### Step 2.3: Update `required` Array

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Line 442 (will shift after above deletions - find `required:` near `additionalProperties: false`)

**Current:**
```typescript
  required: ['executiveSummary', 'laymanSummary', 'themes', 'keyTakeaways', 'trends'],
```

**Replace with:**
```typescript
  required: ['executiveSummary', 'laymanSummary', 'keyTakeaways', 'featuredDiscovery', 'topFindings', 'sourceBreakdown'],
```

### Step 2.4: Update Zod SmartDigestSchema for Backward Compatibility

**File**: `backend/src/schemas/digest.schema.ts`
**Location**: Lines 52-68 (SmartDigestSchema)

**Current:**
```typescript
export const SmartDigestSchema = z.object({
  executiveSummary: z.string(),
  laymanSummary: z.string(),
  themes: z.array(DigestThemeSchema).default([]),
  keyTakeaways: z.array(z.string()).default([]),
  breakthroughs: z.array(BreakthroughSchema).optional().default([]),
  contradictions: z.array(ContradictionSchema).optional().default([]),
  trends: z.object({
    emerging: z.array(TrendItemSchema).default([]),
    declining: z.array(TrendItemSchema).default([]),
    stable: z.array(TrendItemSchema).default([])
  }).default({ emerging: [], declining: [], stable: [] }),
  // NEW fields for magazine editorial design
  featuredDiscovery: z.lazy(() => FeaturedDiscoverySchema).optional(),
  topFindings: z.array(z.lazy(() => TopFindingSchema)).max(5).optional(),
  sourceBreakdown: z.lazy(() => SourceBreakdownSchema).optional()
});
```

**Replace with:**
```typescript
export const SmartDigestSchema = z.object({
  executiveSummary: z.string(),
  laymanSummary: z.string(),
  keyTakeaways: z.array(z.string()).default([]),
  breakthroughs: z.array(BreakthroughSchema).optional().default([]),
  contradictions: z.array(ContradictionSchema).optional().default([]),
  // Magazine editorial fields (REQUIRED for new digests)
  featuredDiscovery: z.lazy(() => FeaturedDiscoverySchema),
  topFindings: z.array(z.lazy(() => TopFindingSchema)).max(5),
  sourceBreakdown: z.lazy(() => SourceBreakdownSchema),
  // Legacy fields (kept optional for backward compat with old digests)
  themes: z.array(DigestThemeSchema).optional().default([]),
  trends: z.object({
    emerging: z.array(TrendItemSchema).default([]),
    declining: z.array(TrendItemSchema).default([]),
    stable: z.array(TrendItemSchema).default([])
  }).optional().default({ emerging: [], declining: [], stable: [] }),
});
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 2 Checklist:**
- [ ] `themes` property removed from `digestJSONSchema`
- [ ] `trends` property removed from `digestJSONSchema`
- [ ] `required` array updated to include magazine fields, exclude themes/trends
- [ ] Zod SmartDigestSchema updated (magazine fields required, legacy fields optional)
- [ ] `cd backend && npm run build` passes

---

## Phase 3: Clean AI Prompt & Increase Token Budget

**Goal**: Increase token budget for structured output and remove dead field requests from user prompt.

### Step 3.1: Increase max_tokens

**File**: `backend/src/services/ai.service.ts`
**Location**: Line 406

**Current:**
```typescript
      max_tokens: 4000,
```

**Replace with:**
```typescript
      max_tokens: 8000,
```

**Why**: The magazine editorial fields (featuredDiscovery with dual technical/explained, 5 topFindings with dual versions, sourceBreakdown) require significantly more output tokens than the old flat schema.

### Step 3.2: Clean User Prompt

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 494-508 (the user message content)

**Current:**
```typescript
          content: `Analyze these ${findings.length} research findings from the ${timeframe} timeframe and generate a comprehensive digest.

Disease Context: ${topic.diseaseProfile.name}
Patient Stage: ${topic.patientContext?.currentStage || 'monitoring'}

Research Findings:
${findingsText}

Create a structured digest with:
- Executive summary highlighting the most critical finding with immediate action items
- Layman summary in plain English
- Group findings into practical themes with specific metrics and actionable insights
- Key takeaways with specific numbers (effect sizes, dosages, patient counts)
- Identify any breakthroughs or paradigm shifts
- Flag any contradictions between findings
- Track emerging, declining, and stable research trends

Focus on practical, actionable information that helps with treatment decisions.

Additionally, generate these NEW magazine-style sections:
- featuredDiscovery: The single most impactful finding with both technical and explained versions (include findingId, sourceType, technical object, explained object, and sourceMetadata)
- topFindings: Up to 5 secondary notable findings with dual versions (each with findingId, sourceType, technical, explained, and metadata string)
- sourceBreakdown: Count of findings by source type (pubmed, clinicalTrials, fda, web numbers)`
```

**Replace with:**
```typescript
          content: `Analyze these ${findings.length} research findings from the ${timeframe} timeframe and generate a comprehensive digest.

Disease Context: ${topic.diseaseProfile.name}
Patient Stage: ${topic.patientContext?.currentStage || 'monitoring'}

Research Findings:
${findingsText}

Create a structured digest with:
- Executive summary highlighting the most critical finding with immediate action items
- Layman summary in plain English
- Key takeaways with specific numbers (effect sizes, dosages, patient counts)
- Identify any breakthroughs or paradigm shifts
- Flag any contradictions between findings

MAGAZINE EDITORIAL SECTIONS (REQUIRED):
- featuredDiscovery: The SINGLE most impactful finding as hero content. Include findingId (from the data above), sourceType, technical version (medical terminology), explained version (analogies/metaphors), and sourceMetadata
- topFindings: Up to 5 additional notable findings. Each with findingId, sourceType, technical version, explained version, and a metadata display string like "PubMed • Jan 2026 • Meta-analysis (n=2,847)"
- sourceBreakdown: Count ALL findings by source type (pubmed, clinicalTrials, fda, web)

Focus on practical, actionable information that helps with treatment decisions.`
```

### Step 3.3: Update Debug Logging

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 528-534 (the `console.log('Raw digest data sample:' ...` block)

**Current:**
```typescript
    console.log('Raw digest data sample:', JSON.stringify({
      hasExecutiveSummary: !!digestData.executiveSummary,
      hasLaymanSummary: !!digestData.laymanSummary,
      themesCount: digestData.themes?.length || 0,
      keyTakeawaysCount: digestData.keyTakeaways?.length || 0,
      hasTrends: !!digestData.trends
    }));
```

**Replace with:**
```typescript
    console.log('Raw digest data sample:', JSON.stringify({
      hasExecutiveSummary: !!digestData.executiveSummary,
      hasLaymanSummary: !!digestData.laymanSummary,
      keyTakeawaysCount: digestData.keyTakeaways?.length || 0,
      hasFeaturedDiscovery: !!digestData.featuredDiscovery,
      topFindingsCount: digestData.topFindings?.length || 0,
      hasSourceBreakdown: !!digestData.sourceBreakdown
    }));
```

### Step 3.4: Clean Zod Recovery Block

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 549-597 (the graceful recovery block inside the Zod catch)

**Current recovery data** (lines 555-573):
```typescript
        const recoveredData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed. See findings for details.',
          laymanSummary: digestData.laymanSummary || 'Medical research findings have been compiled for your review.',
          themes: Array.isArray(digestData.themes) ? digestData.themes : [],
          keyTakeaways: Array.isArray(digestData.keyTakeaways) ? digestData.keyTakeaways : [],
          breakthroughs: Array.isArray(digestData.breakthroughs) ? digestData.breakthroughs : [],
          contradictions: Array.isArray(digestData.contradictions) ? digestData.contradictions : [],
          trends: digestData.trends && typeof digestData.trends === 'object'
            ? {
                emerging: Array.isArray(digestData.trends.emerging) ? digestData.trends.emerging : [],
                declining: Array.isArray(digestData.trends.declining) ? digestData.trends.declining : [],
                stable: Array.isArray(digestData.trends.stable) ? digestData.trends.stable : []
              }
            : { emerging: [], declining: [], stable: [] },
          // NEW magazine editorial fields
          featuredDiscovery: digestData.featuredDiscovery || undefined,
          topFindings: Array.isArray(digestData.topFindings) ? digestData.topFindings : [],
          sourceBreakdown: digestData.sourceBreakdown || undefined
        };
```

**Replace with:**
```typescript
        const recoveredData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed. See findings for details.',
          laymanSummary: digestData.laymanSummary || 'Medical research findings have been compiled for your review.',
          keyTakeaways: Array.isArray(digestData.keyTakeaways) ? digestData.keyTakeaways : [],
          breakthroughs: Array.isArray(digestData.breakthroughs) ? digestData.breakthroughs : [],
          contradictions: Array.isArray(digestData.contradictions) ? digestData.contradictions : [],
          // Magazine editorial fields
          featuredDiscovery: digestData.featuredDiscovery || undefined,
          topFindings: Array.isArray(digestData.topFindings) ? digestData.topFindings : [],
          sourceBreakdown: digestData.sourceBreakdown || undefined,
          // Legacy fields (optional, for backward compat)
          themes: Array.isArray(digestData.themes) ? digestData.themes : [],
          trends: { emerging: [], declining: [], stable: [] }
        };
```

**Also update the minimal fallback** (lines 582-594):

**Current:**
```typescript
        digestData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed.',
          laymanSummary: digestData.laymanSummary || 'Research findings compiled.',
          themes: [],
          keyTakeaways: [],
          breakthroughs: [],
          contradictions: [],
          trends: { emerging: [], declining: [], stable: [] },
          // NEW magazine editorial fields (null for fallback)
          featuredDiscovery: null,
          topFindings: [],
          sourceBreakdown: null
        };
```

**Replace with:**
```typescript
        digestData = {
          executiveSummary: digestData.executiveSummary || 'Analysis completed.',
          laymanSummary: digestData.laymanSummary || 'Research findings compiled.',
          keyTakeaways: [],
          breakthroughs: [],
          contradictions: [],
          featuredDiscovery: null,
          topFindings: [],
          sourceBreakdown: null,
          themes: [],
          trends: { emerging: [], declining: [], stable: [] }
        };
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 3 Checklist:**
- [ ] `max_tokens` changed from 4000 to 8000
- [ ] User prompt cleaned: removed themes/trends mentions, magazine sections marked REQUIRED
- [ ] Debug logging updated to check new fields
- [ ] Zod recovery block cleaned
- [ ] `cd backend && npm run build` passes

---

## Phase 4: Clean AI Return Value

**Goal**: Remove dead computations (topSources, theme transformation) from the generateSmartDigest return value.

### Step 4.1: Remove Dead `topSources` Computation

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 632-663 (the `sourceMap` computation block)

**Delete this entire block:**
```typescript
    // Group sources and count
    const sourceMap = new Map();
    findings.forEach(f => {
      const source = f.source.name;
      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          name: source,
          type: f.source.type,
          count: 0,
          credibilitySum: 0,
          contributions: []
        });
      }
      const entry = sourceMap.get(source);
      entry.count++;
      entry.credibilitySum += f.source.credibilityScore || 0.5;
      if (entry.contributions.length < 3) {
        entry.contributions.push(f.title.substring(0, 50));
      }
    });

    // Convert to top sources array
    const topSources = Array.from(sourceMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        type: s.type,
        findingCount: s.count,
        avgCredibility: s.credibilitySum / s.count,
        topContributions: s.contributions
      }));
```

### Step 4.2: Remove Dead Theme Transformation

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 665-672 (will have shifted after Step 4.1 - find the `themes` transformation block)

**Delete this block:**
```typescript
    // Transform themes to use finding IDs instead of indices
    const themes = digestData.themes.map((theme: any) => ({
      ...theme,
      findingIds: theme.findingIndices.map((idx: number) => findings[idx]?.id).filter(Boolean),
      findingCount: theme.findingIndices.length,
      icon: getCategoryIcon(theme.category),
      color: getCategoryColor(theme.category)
    }));
```

### Step 4.3: Clean Return Value

**File**: `backend/src/services/ai.service.ts`
**Location**: Lines 696-721 (the `return { ... }` block - line numbers will have shifted)

**Current:**
```typescript
    return {
      id: digestId,
      topicId: topic.id,
      generatedAt: Date.now(),
      timeframe,
      executiveSummary: digestData.executiveSummary,
      laymanSummary: digestData.laymanSummary,
      themes,
      keyTakeaways: digestData.keyTakeaways,
      breakthroughs,
      contradictions,
      trends: digestData.trends,
      statistics: {
        totalFindings,
        newFindings,
        highRelevanceCount: highPriorityCount,
        sourceCount: uniqueStudies.size,
        avgConfidence: avgSourceQuality / 100
      },
      topSources,
      allFindingIds,
      // NEW magazine editorial fields
      featuredDiscovery: digestData.featuredDiscovery || null,
      topFindings: digestData.topFindings || [],
      sourceBreakdown: digestData.sourceBreakdown || null
    };
```

**Replace with:**
```typescript
    return {
      id: digestId,
      topicId: topic.id,
      generatedAt: Date.now(),
      timeframe,
      executiveSummary: digestData.executiveSummary,
      laymanSummary: digestData.laymanSummary,
      keyTakeaways: digestData.keyTakeaways,
      breakthroughs,
      contradictions,
      statistics: {
        totalFindings,
        newFindings,
        sourceCount: uniqueStudies.size
      },
      allFindingIds,
      // Magazine editorial fields
      featuredDiscovery: digestData.featuredDiscovery || null,
      topFindings: digestData.topFindings || [],
      sourceBreakdown: digestData.sourceBreakdown || null,
      // Legacy fields (empty - AI no longer generates these)
      themes: digestData.themes || [],
      trends: digestData.trends || { emerging: [], declining: [], stable: [] }
    };
```

**Note**: We still return `themes` and `trends` as empty arrays/objects because `digest-processor.service.ts` writes them to their DB columns. This avoids null reference errors downstream.

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 4 Checklist:**
- [ ] `topSources` computation block deleted (lines 632-663)
- [ ] Theme transformation block deleted (lines 665-672)
- [ ] Return value cleaned: removed `topSources`, `highRelevanceCount`, `avgConfidence`
- [ ] Legacy `themes` and `trends` still returned as empty defaults
- [ ] `cd backend && npm run build` passes

---

## Phase 5: Fix DB Storage (INSERT with New Columns)

**Goal**: Store magazine editorial fields in dedicated DB columns instead of the metadata blob.

### Step 5.1: Update INSERT Query

**File**: `backend/src/services/digest-processor.service.ts`
**Location**: Lines 225-272 (the INSERT INTO digests query)

**Current:**
```typescript
    await query(
      `INSERT INTO digests (
        id, user_id, topic_id, type, title,
        executive_summary, layman_summary, themes, contradictions,
        breakthroughs, knowledge_gaps, next_steps, key_takeaways,
        trends, clinical_implications, lifestyle_considerations,
        questions_for_doctor, warning_signs, finding_ids, metadata
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20
      )`,
      [
        digestId,
        item.user_id,
        item.topic_id,
        item.timeframe || item.digest_type || 'smart_digest',
        (digest as any).title || `${topic.name} Research Digest`,
        (digest as any).executiveSummary,
        (digest as any).laymanSummary,
        JSON.stringify((digest as any).themes || []),
        JSON.stringify((digest as any).contradictions || []),
        JSON.stringify((digest as any).breakthroughs || []),
        JSON.stringify((digest as any).knowledgeGaps || []),
        JSON.stringify((digest as any).nextSteps || []),
        JSON.stringify((digest as any).keyTakeaways || []),
        JSON.stringify((digest as any).trends || {}),
        JSON.stringify((digest as any).clinicalImplications || []),
        JSON.stringify((digest as any).lifestyleConsiderations || []),
        JSON.stringify((digest as any).questionsForDoctor || []),
        JSON.stringify((digest as any).warningSigns || []),
        findingIds,
        JSON.stringify({
          source: 'background-processor',
          queueItemId: item.id,
          findingsCount: findings.length,
          generatedAt: new Date().toISOString(),
          timeframe: item.timeframe || 'all-time',
          // NEW magazine editorial fields
          featuredDiscovery: (digest as any).featuredDiscovery || null,
          topFindings: (digest as any).topFindings || [],
          // Use AI-generated sourceBreakdown, with fallback to calculated
          sourceBreakdown: (digest as any).sourceBreakdown || countSourcesByType(findings)
        })
      ]
    );
```

**Replace with:**
```typescript
    await query(
      `INSERT INTO digests (
        id, user_id, topic_id, type, title,
        executive_summary, layman_summary, themes, contradictions,
        breakthroughs, knowledge_gaps, next_steps, key_takeaways,
        trends, clinical_implications, lifestyle_considerations,
        questions_for_doctor, warning_signs, finding_ids, metadata,
        featured_discovery, top_findings, source_breakdown
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23
      )`,
      [
        digestId,
        item.user_id,
        item.topic_id,
        item.timeframe || item.digest_type || 'smart_digest',
        (digest as any).title || `${topic.name} Research Digest`,
        (digest as any).executiveSummary,
        (digest as any).laymanSummary,
        JSON.stringify((digest as any).themes || []),
        JSON.stringify((digest as any).contradictions || []),
        JSON.stringify((digest as any).breakthroughs || []),
        JSON.stringify((digest as any).knowledgeGaps || []),
        JSON.stringify((digest as any).nextSteps || []),
        JSON.stringify((digest as any).keyTakeaways || []),
        JSON.stringify((digest as any).trends || {}),
        JSON.stringify((digest as any).clinicalImplications || []),
        JSON.stringify((digest as any).lifestyleConsiderations || []),
        JSON.stringify((digest as any).questionsForDoctor || []),
        JSON.stringify((digest as any).warningSigns || []),
        findingIds,
        JSON.stringify({
          source: 'background-processor',
          queueItemId: item.id,
          findingsCount: findings.length,
          generatedAt: new Date().toISOString(),
          timeframe: item.timeframe || 'all-time'
        }),
        JSON.stringify((digest as any).featuredDiscovery || null),
        JSON.stringify((digest as any).topFindings || []),
        JSON.stringify((digest as any).sourceBreakdown || countSourcesByType(findings))
      ]
    );
```

**Key changes:**
1. Added `featured_discovery, top_findings, source_breakdown` to column list
2. Added `$21, $22, $23` placeholders
3. Moved 3 magazine fields from metadata blob → dedicated column params
4. Metadata blob now only has processor metadata (source, queueItemId, etc.)

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 5 Checklist:**
- [ ] INSERT column list has 3 new columns
- [ ] VALUE placeholders include $21, $22, $23
- [ ] Magazine fields moved from metadata blob to dedicated params
- [ ] Metadata blob cleaned (no more featuredDiscovery/topFindings/sourceBreakdown)
- [ ] `cd backend && npm run build` passes

---

## Phase 6: Update DB Model Interface

**Goal**: Add new fields to the TypeScript Digest interface.

### Step 6.1: Update Digest Interface

**File**: `backend/src/models/digest.model.ts`
**Location**: Lines 3-18 (Digest interface)

**Current:**
```typescript
export interface Digest {
  id: string;
  user_id: string;
  topic_id?: string | null;
  type: string;
  title?: string;
  executive_summary?: string;
  themes?: any[];
  contradictions?: any[];
  breakthroughs?: any[];
  knowledge_gaps?: any[];
  next_steps?: any[];
  finding_ids?: string[];
  metadata?: any;
  created_at: Date;
}
```

**Replace with:**
```typescript
export interface Digest {
  id: string;
  user_id: string;
  topic_id?: string | null;
  type: string;
  title?: string;
  executive_summary?: string;
  themes?: any[];
  contradictions?: any[];
  breakthroughs?: any[];
  knowledge_gaps?: any[];
  next_steps?: any[];
  finding_ids?: string[];
  metadata?: any;
  featured_discovery?: any;
  top_findings?: any[];
  source_breakdown?: any;
  created_at: Date;
}
```

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 6 Checklist:**
- [ ] `featured_discovery`, `top_findings`, `source_breakdown` added to Digest interface
- [ ] `cd backend && npm run build` passes

---

## Phase 7: Add Column Aliases to API Route

**Goal**: Ensure the GET endpoint returns new columns with camelCase aliases.

### Step 7.1: Update SELECT in digest.routes.ts

**File**: `backend/src/routes/digest.routes.ts`
**Location**: Lines 21-46 (the SELECT query in GET `/by-topic/:topicId`)

**Find this section** (lines 38-41):
```sql
        metadata,
        created_at as "createdAt",
        updated_at as "updatedAt"
```

**Replace with:**
```sql
        featured_discovery as "featuredDiscovery",
        top_findings as "topFindings",
        source_breakdown as "sourceBreakdown",
        metadata,
        created_at as "createdAt",
        updated_at as "updatedAt"
```

**Note**: The CRUD route (`digests.crud.routes.ts`) uses `SELECT *` via `DigestModel.getLatestByTopicId()` which automatically picks up new columns - no change needed there. The frontend calls both endpoints and `transformToFrontend()` (Phase 8) handles both naming conventions.

**Verification:**
```bash
cd backend && npm run build
# Should complete with no errors
```

**✅ Phase 7 Checklist:**
- [ ] 3 column aliases added to SELECT query in `digest.routes.ts`
- [ ] `cd backend && npm run build` passes

---

## Phase 8: Fix Frontend Transform

**Goal**: Extract magazine editorial fields in `transformToFrontend()` and clean up dead field mappings.

### Step 8.1: Add Magazine Fields to transformToFrontend

**File**: `src/services/digest.service.ts`
**Location**: Lines 152-201 (the `transformToFrontend` method)

**Find this section** (lines 186-189):
```typescript
      topSources: apiDigest.metadata?.topSources || [],
      allFindingIds: apiDigest.finding_ids || [],
      userEngagement: apiDigest.metadata?.userEngagement
    };
```

**Replace with:**
```typescript
      allFindingIds: apiDigest.finding_ids || [],
      userEngagement: apiDigest.metadata?.userEngagement,
      // Magazine editorial fields (triple fallback: camelCase alias → snake_case → metadata blob)
      featuredDiscovery: apiDigest.featuredDiscovery || apiDigest.featured_discovery || apiDigest.metadata?.featuredDiscovery || undefined,
      topFindings: apiDigest.topFindings || apiDigest.top_findings || apiDigest.metadata?.topFindings || [],
      sourceBreakdown: apiDigest.sourceBreakdown || apiDigest.source_breakdown || apiDigest.metadata?.sourceBreakdown || undefined
    };
```

**Note**: The triple fallback handles:
1. `apiDigest.featuredDiscovery` - camelCase from digest.routes.ts alias
2. `apiDigest.featured_discovery` - snake_case from digests.crud.routes.ts (`SELECT *`)
3. `apiDigest.metadata?.featuredDiscovery` - old digests stored in metadata blob (Plan 005 deployment)

### Step 8.2: Clean Dead Field Mapping

In the same `transformToFrontend` method, also clean up dead fields.

**Find this line** (line 166):
```typescript
      themes: apiDigest.themes || [],
```

**Replace with:**
```typescript
      themes: apiDigest.themes || [],  // Legacy - kept for backward compat, no longer generated
```

**Find these lines** (lines 174-185):
```typescript
      trends: apiDigest.metadata?.trends || {
        emerging: [],
        declining: [],
        stable: []
      },
      statistics: apiDigest.metadata?.statistics || {
        totalFindings: apiDigest.finding_ids?.length || 0,
        newFindings: 0,
        highRelevanceCount: 0,
        sourceCount: 0,
        avgConfidence: 0
      },
      topSources: apiDigest.metadata?.topSources || [],
```

**Replace with:**
```typescript
      trends: apiDigest.trends || apiDigest.metadata?.trends || {
        emerging: [],
        declining: [],
        stable: []
      },
      statistics: apiDigest.metadata?.statistics || {
        totalFindings: apiDigest.finding_ids?.length || 0,
        newFindings: 0,
        sourceCount: 0
      },
```

**Verification:**
```bash
npm run build
# Should complete with no errors
```

**✅ Phase 8 Checklist:**
- [ ] Magazine fields extracted with triple fallback in `transformToFrontend()`
- [ ] `topSources` mapping removed
- [ ] `statistics` cleaned (removed `highRelevanceCount`, `avgConfidence`)
- [ ] `npm run build` passes

---

## Phase 9: Clean Frontend Types

**Goal**: Make dead fields optional in the SmartDigest TypeScript interface to match reality.

### Step 9.1: Update SmartDigest Interface

**File**: `src/types/index.ts`
**Location**: Lines 524-596 (SmartDigest interface)

**Make these specific changes:**

**Change 1** - Make `themes` optional. Find:
```typescript
  // Grouped themes
  themes: DigestTheme[];
```
Replace with:
```typescript
  // Legacy - no longer generated by AI, kept for backward compat
  themes?: DigestTheme[];
```

**Change 2** - Make `trends` optional. Find:
```typescript
  // Trend analysis
  trends: {
    emerging: TrendItem[];      // New or increasing research
    declining: TrendItem[];      // Decreasing focus
    stable: TrendItem[];         // Consistent areas
  };
```
Replace with:
```typescript
  // Legacy - no longer generated by AI, kept for backward compat
  trends?: {
    emerging: TrendItem[];
    declining: TrendItem[];
    stable: TrendItem[];
  };
```

**Change 3** - Clean `statistics`. Find:
```typescript
  // Statistical overview
  statistics: {
    totalFindings: number;
    newFindings: number;         // Since last digest
    highRelevanceCount: number;
    sourceCount: number;
    avgConfidence: number;        // 0-1
  };
```
Replace with:
```typescript
  // Statistical overview
  statistics: {
    totalFindings: number;
    newFindings: number;
    sourceCount: number;
  };
```

**Change 4** - Make `topSources` optional. Find:
```typescript
  // Top sources contributing to this digest
  topSources: SourceSummary[];
```
Replace with:
```typescript
  // Legacy - no longer computed, kept for backward compat
  topSources?: SourceSummary[];
```

**Verification:**
```bash
npm run build
# Should complete with no errors
# Fix any type errors that arise from the interface changes
```

**⚠️ IMPORTANT**: If `npm run build` shows type errors (e.g., components accessing `digest.themes` without optional chaining), fix them with optional chaining (`digest.themes?.map(...)` instead of `digest.themes.map(...)`). Check these files:
- `src/services/digest.service.ts` (transformToBackend may reference `digest.themes`)
- `src/services/export.service.ts` (may reference themes/trends for export)
- Any component that accesses `digest.statistics.highRelevanceCount` or `digest.statistics.avgConfidence`

**✅ Phase 9 Checklist:**
- [ ] `themes` made optional in SmartDigest
- [ ] `trends` made optional in SmartDigest
- [ ] `statistics` cleaned (removed `highRelevanceCount`, `avgConfidence`)
- [ ] `topSources` made optional in SmartDigest
- [ ] `npm run build` passes (fix any resulting type errors)

---

## Phase 10: Build Verification

**Goal**: Ensure both frontend and backend compile cleanly.

### Step 10.1: Frontend Build

```bash
npm run build
# Must complete with exit code 0
# Warnings are acceptable, errors are NOT
```

### Step 10.2: Backend Build

```bash
cd backend && npm run build
# Must complete with exit code 0
```

**If either build fails**: Go back and fix the errors before proceeding. Do NOT deploy broken builds.

**✅ Phase 10 Checklist:**
- [ ] `npm run build` passes
- [ ] `cd backend && npm run build` passes

---

## Phase 11: Deployment

**Goal**: Deploy to production server and run database migration.

### Step 11.1: Commit and Push

```bash
git add backend/src/db/migrations/016_add_magazine_editorial_fields.sql backend/src/db/init.sql backend/src/schemas/digest.schema.ts backend/src/services/ai.service.ts backend/src/services/digest-processor.service.ts backend/src/models/digest.model.ts backend/src/routes/digest.routes.ts src/services/digest.service.ts src/types/index.ts
git commit -m "fix: complete digest pipeline for magazine editorial fields + dead field cleanup"
git push
```

### Step 11.2: SSH and Pull

```bash
ssh chee@100.94.82.35
cd /home/chee/medical-pwa
git pull
```

### Step 11.3: Run Database Migration

```bash
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "
ALTER TABLE digests
ADD COLUMN IF NOT EXISTS featured_discovery JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS top_findings JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS source_breakdown JSONB DEFAULT NULL;
"
```

**Expected output:**
```
ALTER TABLE
```

### Step 11.4: Rebuild Docker Containers

```bash
docker compose down && docker compose up -d --build
```

### Step 11.5: Verify Containers Running

```bash
docker ps
# Both medcompanion-backend and medcompanion-postgres should be running
```

**✅ Phase 11 Checklist:**
- [ ] Changes committed and pushed
- [ ] Code pulled on server
- [ ] Migration executed successfully
- [ ] Docker containers rebuilt and running

---

## Phase 12: Production Verification

**Goal**: Verify the complete pipeline works end-to-end.

### Step 12.1: Regenerate a Digest

Navigate to the app in browser, open a topic, and trigger a digest regeneration (click refresh/regenerate button).

### Step 12.2: Check Container Logs

```bash
docker logs medcompanion-backend --tail 100 2>&1 | grep "Tool input keys"
```

**Expected**: Keys should include `featuredDiscovery`, `topFindings`, `sourceBreakdown` and should NOT include `themes` or `trends`.

```
Tool input keys: ['executiveSummary', 'laymanSummary', 'keyTakeaways', 'breakthroughs', 'contradictions', 'featuredDiscovery', 'topFindings', 'sourceBreakdown']
```

### Step 12.3: Check Database Storage

```bash
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "
SELECT
  id,
  featured_discovery IS NOT NULL as has_featured,
  top_findings IS NOT NULL as has_top_findings,
  source_breakdown IS NOT NULL as has_source_breakdown
FROM digests
ORDER BY created_at DESC
LIMIT 1;
"
```

**Expected**: All three `has_*` columns should show `t` (true).

### Step 12.4: Verify UI

1. **Featured Discovery**: Hero card should appear at the top of the digest with pull-quote, "Why It Matters", source metadata, and optional action item
2. **Source Stats Bar**: Should show "N findings analyzed" with breakdown by source type (PubMed, Trials, FDA, Web)
3. **Also In This Digest**: Up to 5 finding summary cards should appear with source icons and metadata strings
4. **Technical/Explained Toggle**: Switching should change text content in Featured Discovery and Top Findings sections
5. **Existing Sections**: Key Takeaways, Breakthroughs, Questions for Doctor, Warning Signs, Contradictions should still render

### Step 12.5: Backward Compatibility

Load a topic that has an OLD digest (generated before this deployment):
1. **Should NOT crash** - Old digest renders with Key Insight fallback
2. **Missing sections gracefully hidden** - No Featured Discovery, no Source Stats Bar (conditionally rendered)
3. **Key Takeaways, etc. still work** - Existing sections render normally

### Step 12.6: Check Token Efficiency

```bash
docker logs medcompanion-backend --tail 200 2>&1 | grep "Anthropic API responded"
```

Compare response time with previous digests. Should be similar or slightly longer (more output tokens), but NOT dramatically different.

**✅ Phase 12 Checklist:**
- [ ] Container logs show new field names in `Tool input keys`
- [ ] Database has non-null `featured_discovery`, `top_findings`, `source_breakdown`
- [ ] Featured Discovery hero card renders
- [ ] Source Stats Bar renders
- [ ] "Also In This Digest" section renders
- [ ] Technical/Explained toggle works on dual-mode sections
- [ ] Old digests render without crashing (backward compat)
- [ ] Key Takeaways, Breakthroughs, Questions, Warnings, Contradictions still render

---

## Troubleshooting

### AI Still Generates themes/trends

**Symptom**: `Tool input keys` still includes `themes` and `trends`

**Cause**: Old backend build cached. Verify:
```bash
docker exec medcompanion-backend ls -la /app/dist/schemas/digest.schema.js
# Check timestamp matches deployment
```

**Fix**: Force rebuild: `docker compose down && docker compose up -d --build --no-cache`

### featured_discovery is NULL in Database

**Symptom**: AI generates the field but DB stores NULL

**Cause**: Migration not run or INSERT query not updated

**Check 1**: Verify column exists:
```bash
docker exec medcompanion-postgres psql -U meduser -d medcompanion -c "\d digests" | grep featured
```

**Check 2**: Check backend logs for INSERT errors:
```bash
docker logs medcompanion-backend --tail 200 2>&1 | grep -i "error\|insert"
```

### Frontend Shows Key Insight Fallback (Not Featured Discovery)

**Symptom**: UI shows old "Key Insight" section instead of Featured Discovery

**Cause**: `transformToFrontend()` not extracting new fields

**Debug**: Open browser DevTools, Network tab, find the digest API response. Check if `featuredDiscovery` is present in the JSON response. If yes, the issue is in `transformToFrontend()`. If no, the issue is in the API route (missing column aliases).

### Type Errors After Phase 9

**Common errors and fixes:**

1. `Property 'highRelevanceCount' does not exist`:
   - Find the reference and remove it or replace with a remaining field

2. `Property 'avgConfidence' does not exist`:
   - Find the reference and remove it

3. `Property 'themes' is possibly undefined`:
   - Add optional chaining: `digest.themes?.map(...)` instead of `digest.themes.map(...)`

4. `Property 'trends' is possibly undefined`:
   - Add optional chaining: `digest.trends?.emerging?.map(...)`

5. `Property 'topSources' is possibly undefined`:
   - Add optional chaining: `digest.topSources?.map(...)`

---

## Files Changed Summary

| # | File | Action | What Changes |
|---|------|--------|-------------|
| 1 | `backend/src/db/migrations/016_add_magazine_editorial_fields.sql` | **NEW** | 3 JSONB columns for magazine fields |
| 2 | `backend/src/db/init.sql` | EDIT | Add 3 columns to digests CREATE TABLE |
| 3 | `backend/src/schemas/digest.schema.ts` | EDIT | Remove themes/trends from JSON schema, add magazine fields to required |
| 4 | `backend/src/services/ai.service.ts` | EDIT | max_tokens 8000, clean prompt, remove dead computations |
| 5 | `backend/src/services/digest-processor.service.ts` | EDIT | INSERT with 3 new columns, clean metadata blob |
| 6 | `backend/src/models/digest.model.ts` | EDIT | Add 3 fields to Digest interface |
| 7 | `backend/src/routes/digest.routes.ts` | EDIT | Add 3 column aliases to SELECT query |
| 8 | `src/services/digest.service.ts` | EDIT | Fix transformToFrontend with triple fallback, remove dead mappings |
| 9 | `src/types/index.ts` | EDIT | Clean SmartDigest interface (make dead fields optional) |

---

## What This Plan Does NOT Touch

These items are explicitly out of scope:

1. **DB column drops** - Dead columns (themes, trends, knowledge_gaps, etc.) stay in PostgreSQL. They'll receive empty arrays going forward but we don't drop them.
2. **DigestCard.tsx** - Already correctly implemented in Plan 005. No changes needed.
3. **digest/ components** - SourceStatsBar, FeaturedDiscovery, FindingSummaryCard, SourceIcon already correct.
4. **AI system prompt** - Magazine editorial instructions are already well-written. Only the user prompt changes.
5. **getCategoryIcon/getCategoryColor helper functions** - These become dead code after removing theme transformation but we leave them in ai.service.ts (they're small and harmless). They can be cleaned up in a future plan if desired.
6. **DigestTheme, TrendItem type definitions** - Kept in types/index.ts for backward compat. They're small and harmless.

---

*Created: February 6, 2026*
*Predecessor: Plan 005 (Digest UI Magazine Redesign)*
*Status: Ready for Implementation*
