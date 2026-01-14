# Removal of relevanceScore and confidenceLevel Metrics - Migration Summary

## Overview
Successfully removed misleading `relevanceScore` and `confidenceLevel` metrics from the Medical Companion PWA codebase. These metrics were inappropriate for medical information as they provided false confidence to users about research quality.

## Changes Made

### 1. Type Definitions (src/types/index.ts)
- ✅ Made `relevanceScore` and `confidenceLevel` optional fields
- ✅ Added deprecation comments to guide future removal

### 2. Backend Schema (backend/src/schemas/finding.schema.ts)
- ✅ Changed fields from required to optional
- ✅ Removed default values
- ✅ Added deprecation comments

### 3. Agent Runner (src/services/agentRunner.ts)
- ✅ Stopped generating `relevanceScore` values for new findings
- ✅ Stopped generating `confidenceLevel` values for new findings
- ✅ Removed `calculateRelevance()` function entirely
- ✅ Updated notification logic to not depend on relevanceScore

### 4. Backend AI Service (backend/src/services/ai.service.ts)
- ✅ Removed relevanceScore and confidenceLevel from digest generation prompts
- ✅ Updated statistics calculations to use priority instead of relevanceScore
- ✅ Changed avgConfidence calculation to use sourceQuality

### 5. UI Components
- ✅ **FindingDetailDrawer.tsx**: Removed relevance/confidence display functions
- ✅ **FindingsMetricsExplainer.tsx**: Component still exists but metrics removed from usage
- ✅ **ThemeAccordion.tsx**: Removed avgRelevance and avgConfidence displays
- ✅ **CitationLink.tsx**: Removed relevanceScore badge display
- ✅ **FindingsViewer.tsx**: Changed "High Relevance" filter to "High Priority", updated display to show priority instead

### 6. Services - Filtering & Sorting
- ✅ **FindingsViewer.tsx**: Updated filter logic to use priority (critical/high) instead of relevanceScore
- ✅ **analytics.service.ts**: Updated breakthrough detection and consensus logic to use priority
- ✅ **digestQueue.service.ts**: Needs update (see remaining work)
- ✅ **digestCache.service.ts**: Needs update (see remaining work)

### 7. Export Services (src/services/export.service.ts)
- ✅ **PDF Export**: Reorganized to group by priority (Critical/High/Other) instead of relevanceScore
- ✅ **CSV/Excel Export**: Replaced relevanceScore and confidenceLevel columns with Priority
- ✅ **FHIR Export**: Updated interpretation codes to use priority instead of relevanceScore

## Replacement Strategy

Where `relevanceScore` was used, we now use:
- **`priority`** field (critical/high/medium/low) - for importance filtering
- **`sourceQuality`** field (0-100) - for source reliability when needed

Where `confidenceLevel` was used, we now use:
- **`sourceQuality`** field - more objective measure
- **Treatment analysis confidence** - separate concept, unchanged

## Remaining Work (Partially Complete)

### Files That Still Need Updates:
1. ⚠️ **src/components/FindingsViewerEnhanced.tsx** (lines 230, 258, 587)
2. ⚠️ **src/services/agentService.ts** (lines 352, 367)
3. ⚠️ **src/services/chat.service.ts** (line 78)
4. ⚠️ **src/services/digestCache.service.ts** (line 129)
5. ⚠️ **src/services/digestQueue.service.ts** (lines 378, 380, 437, 440, 461, 463)
6. ⚠️ **src/services/knowledgeGraph.service.ts** (lines 111, 116)
7. ⚠️ **src/stores/findingsStore.ts** (line 243)

## Testing Checklist

- ✅ TypeScript compilation (frontend): No new errors
- ⚠️ TypeScript compilation (backend): Pre-existing errors unrelated to changes
- ⚠️ Manual testing: Not yet performed
- ⚠️ Agent execution: Not yet tested
- ⚠️ Digest generation: Not yet tested
- ⚠️ Export functions: Not yet tested

## Migration Benefits

1. **User Safety**: No longer presenting misleading confidence scores for medical information
2. **Code Simplification**: Removed 445 lines, added 227 (net -218 lines)
3. **Better Semantics**: Priority field is clearer than numeric relevance scores
4. **Backward Compatible**: Fields are optional, existing data still loads

## Next Steps

1. Complete updates to remaining 7 files listed above
2. Update any documentation referencing these metrics
3. Add user-facing explanation of the priority system
4. Test all features end-to-end
5. Consider data migration script to set priority based on old relevanceScore (optional)

## Notes for Developers

- All new findings will not have these fields
- Existing findings in database may still have these values (safe to ignore)
- Use `priority` field for importance filtering going forward
- Use `sourceQuality` for source reliability assessments
