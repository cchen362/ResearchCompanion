# Plan 017: Codebase Cleanup — Dead Code & Stale Documentation Removal

## ⛔ STOP: Read This Entire Document Before Making Any Changes

This plan removes ~10,000 lines of dead code, stale documentation, and orphaned files across the project. It is split into two phases:

- **Phase A**: Documentation & file cleanup (zero risk to functionality)
- **Phase B**: Dead source code removal (requires build verification after each step)

**Estimated removal**: ~40 files deleted, ~10,000 lines removed from remaining files.

---

## Strict Rules

### MUST DO
- [ ] Follow steps IN ORDER within each phase
- [ ] Run `npm run build` in the frontend after every Phase B step
- [ ] Run `npx tsc --noEmit` in `backend/` after every Phase B backend step
- [ ] Verify the app loads and navigates correctly after Phase B is complete
- [ ] Git commit after each phase (not after each step)

### MUST NOT DO
- [ ] Do NOT delete any file marked "KEEP" in this plan
- [ ] Do NOT modify any logic — only delete dead code and update references
- [ ] Do NOT rename or move files (only delete)
- [ ] Do NOT change the IndexedDB `DB_VERSION` — removing stores from the schema definition is safe because IndexedDB `upgrade()` uses `if (!contains)` guards, not destructive operations
- [ ] Do NOT touch any active implementation plans (001, 006, 007, 008)

---

## Phase A: Documentation & File Cleanup

**Risk level**: Zero — no source code changes, only .md/.sh/.html/.js documentation files.

---

### Step A1: Delete Security-Critical File

**Reason**: `docs/PUBMED-OPTIMIZATION-SUMMARY.md` contains a plaintext API key on lines 12 and 113.

**Action**: Delete this file:
```
docs/PUBMED-OPTIMIZATION-SUMMARY.md
```

**Post-step**: Consider rotating the exposed PubMed API key (`9efce4439478e21849435aaf14f0f39eb408`) if this repo has ever been public or shared.

- [ ] Completed

---

### Step A2: Delete 10 Stale Root-Level Documentation Files

These files reference deleted components (ChatPanelMinimal, FindingsViewerProgressive, FindingsViewerEnhanced), removed features (voice/timeline), resolved issues, or superseded deployment procedures. None are referenced by active code or plans.

**Action**: Delete all of these files:
```
VOICE_TIMELINE_MIGRATION_GUIDE.md
CHAT_RESTORATION_GUIDE.md
ISSUE_45_CHAT_HYDRATION_FIX.md
CITATION_FIX.md
test-citation-fix.md
test-citation-deployment.md
DEPLOYMENT_INSTRUCTIONS.md
DIGEST_CACHING_FIX.md
MIGRATION_INVESTIGATION_2026.md
server_storage_fixes_jan22.md
```

- [ ] Completed

---

### Step A3: Delete 5 Stale Root-Level Documentation Files (Archivable Category)

These have historical value but are no longer referenced by any active code or plan, and their key lessons are already captured in CLAUDE.md.

**Action**: Delete all of these files:
```
CIRCULAR_DEPENDENCY_ANALYSIS.md
DEPLOYMENT_JAN22.md
AUTONOMOUS_RESEARCH_INVESTIGATION.md
DEPLOYMENT.md
API.md
```

**Note on `DEPLOYMENT.md`**: Contains outdated claims about IndexedDB-only architecture. The current deployment workflow is documented in CLAUDE.md under "Deployment Workflow" and in docker-compose.yml.

**Note on `API.md`**: Contains documented dead endpoints (timeline, audio) and deprecated fields. If an API reference is needed in the future, regenerate it from the actual route files.

- [ ] Completed

---

### Step A4: Delete 4 Stale docs/ Files

**Action**: Delete these files from `docs/`:
```
docs/DATABASE_VERSION_MANAGEMENT.md
docs/TEST_SMART_DIGEST.md
docs/MIGRATION_SUMMARY.md
docs/ANALYTICS_PIVOT_RATIONALE.md
```

**KEEP**: `docs/VOICE-RECORDING-FIX-CASE-STUDY.md` — referenced by CLAUDE.md line ~1072. However, since the voice feature is being removed in Phase B, also delete this file and update CLAUDE.md in Step A8.

**Action**: Also delete:
```
docs/VOICE-RECORDING-FIX-CASE-STUDY.md
```

- [ ] Completed

---

### Step A5: Delete 15 Completed Implementation Plans

All of these plans are marked "Complete". Their work has been implemented and merged. Active Plan 007 references `005_DIGEST_UI_MAGAZINE_REDESIGN.md` extensively, so that file is KEPT.

**Action**: Delete these files from `IMPLEMENTATION_PLANS/`:
```
002_DIGEST_ISSUES_INVESTIGATION.md
003_DIGEST_UI_IMPROVEMENTS.md
004_AGENT_FIXES_DIGEST_UI_SIMPLIFICATION.md
005_PUBMED_API_FIX_AND_AGENT_LOGGING.md
009_DIGEST_GENERATION_TIMEOUT_FIX.md
010_FINDING_LABEL_UNIFICATION.md
011_DIGEST_EXPLAINED_MODE_EXPANSION.md
012_CHAT_ARCHITECTURE_REBUILD.md
013_DASHBOARD_HOME_REDESIGN.md
014_UI_UX_DESIGN_SYSTEM_OVERHAUL.md
015a_LAYOUT_SPATIAL_DESIGN.md
015b_LAYOUT_REFINEMENTS.md
015c_COMPANION_INTELLIGENCE.md
015d_WORTH_REVISITING_ENHANCEMENTS.md
016_AUTH_PAGE_REDESIGN.md
```

**KEEP**: `005_DIGEST_UI_MAGAZINE_REDESIGN.md` — Active Plan 007 has 9 references to what Plan 005 deployed. Required context for executing Plan 007.

- [ ] Completed

---

### Step A6: Delete 5 Completed Refactoring Phase Files

The `REFACTORING/README.md` is self-contained with full completion summaries for all 4 phases. The individual phase documents contain step-by-step instructions that are no longer actionable (all work is done).

**Action**: Delete these files from `REFACTORING/`:
```
REFACTORING/PHASE_1_SERVICE_LAYER.md
REFACTORING/PHASE_2_STATE_MANAGEMENT.md
REFACTORING/PHASE_3_COMPONENTS.md
REFACTORING/PHASE_4_STORAGE.md
REFACTORING/CODE_TO_DELETE.md
```

**KEEP**: `REFACTORING/README.md` — Referenced by CLAUDE.md, contains architectural summary.

- [ ] Completed

---

### Step A7: Delete Stale Scripts and Utility Files

**Action**: Delete these root-level scripts:
```
deploy.sh
deploy-cache-fix.sh
deploy-citation-fix.sh
deploy-clean.sh
test-local-fixes.js
```

**KEEP**: `start-with-postgres.sh`, `start-with-postgres.bat`, `deploy-safeguards.sh` — still useful for development/deployment.

**Action**: Delete these redundant service worker HTML pages from `public/`:
```
public/clear-service-workers.html
public/clear-sw.html
public/force-refresh.html
public/clear-cache.html
```

**KEEP**: `public/unregister-sw.html` — Referenced in CLAUDE.md as the recommended utility for existing users to clear legacy service workers.
**KEEP**: `public/clear-digest-store.html` — Useful debugging tool for digest issues.

- [ ] Completed

---

### Step A8: Update References in Active Documentation

After deleting the above files, update the documents that reference them.

#### A8a: Update `IMPLEMENTATION_PLANS/README.md`

Replace the current table (lines 23-42) with only the active plans:

```markdown
| # | Name | Status | Description |
|---|------|--------|-------------|
| 001 | [Autonomous Agents & Digest](./001_AUTONOMOUS_AGENTS_DIGEST.md) | Ready | Enable autonomous agent scheduling and seamless digest integration |
| 005 | [Digest UI Magazine Redesign](./005_DIGEST_UI_MAGAZINE_REDESIGN.md) | Complete | Magazine editorial UI for digests (kept as context for Plan 007) |
| 006 | [PubMed Query Construction Fix](./006_PUBMED_QUERY_CONSTRUCTION_FIX.md) | **Ready** | Fix "2026 latest recent" query breaking PubMed searches |
| 007 | [Digest Pipeline Fix & Dead Field Cleanup](./007_DIGEST_PIPELINE_FIX_AND_DEAD_FIELD_CLEANUP.md) | **Ready** | Fix 7-layer pipeline for magazine editorial fields, clean dead fields |
| 008 | [Digest & Findings UX Enhancement](./008_DIGEST_FINDINGS_UX_ENHANCEMENT.md) | **Ready** | Fix broken clicks, PubMed abstracts, structured AI summaries, visual hierarchy |
| 017 | [Codebase Cleanup](./017_CODEBASE_CLEANUP.md) | **In Progress** | Dead code removal and stale documentation cleanup |
```

Update the footer:
```markdown
*Last Updated: February 8, 2026*
*Latest Plan: 017 - Codebase Cleanup*
```

#### A8b: Update `REFACTORING/README.md`

On lines that reference the deleted phase documents, change the markdown links to plain text:

- Line 42: Change `[PHASE_1_SERVICE_LAYER.md](./PHASE_1_SERVICE_LAYER.md)` → `PHASE_1_SERVICE_LAYER.md (removed — see summary above)`
- Line 50: Change `[PHASE_2_STATE_MANAGEMENT.md](./PHASE_2_STATE_MANAGEMENT.md)` → `PHASE_2_STATE_MANAGEMENT.md (removed — see summary above)`
- Line 58: Change `[PHASE_3_COMPONENTS.md](./PHASE_3_COMPONENTS.md)` → `PHASE_3_COMPONENTS.md (removed — see summary above)`
- Line 67: Change `[PHASE_4_STORAGE.md](./PHASE_4_STORAGE.md)` → `PHASE_4_STORAGE.md (removed — see summary above)`
- Line 157: Change `See [CODE_TO_DELETE.md](./CODE_TO_DELETE.md)` → `See CODE_TO_DELETE.md (removed — cleanup completed)`
- Lines 188-189: Change `Read the current phase document` and `Check CODE_TO_DELETE.md` to past tense noting files were removed after completion.

#### A8c: Update `CLAUDE.md`

1. **Implementation plans table** (lines ~31-51): Replace the full table with only active/kept plans (same content as A8a above, without the markdown links).

2. **Line ~1238** (`See IMPLEMENTATION_PLANS/012_CHAT_ARCHITECTURE_REBUILD.md`): Remove this line or replace with: `Plan 012 implemented and completed.`

3. **Line ~1072** (reference to `docs/VOICE-RECORDING-FIX-CASE-STUDY.md`): Remove the sentence "For detailed case study, see docs/VOICE-RECORDING-FIX-CASE-STUDY.md" — the key lesson (version mismatch debugging) is already documented inline in the same section.

- [ ] Completed

---

## Phase B: Dead Source Code Removal

**Risk level**: Medium — modifying source files. **Build verification required after each step.**

**Build commands**:
- Frontend: `npm run build` (from project root)
- Backend: `cd backend && npx tsc --noEmit`

---

### Step B1: Delete Dead Backend Route and Model Files

These are complete files serving removed features (voice recording, audio, timeline). The routes are actively registered in Express, serving endpoints that no frontend calls.

**Action**: Delete these 5 files:
```
backend/src/routes/audio.routes.ts
backend/src/routes/transcribe.ts
backend/src/routes/timeline.routes.ts
backend/src/models/audio.model.ts
backend/src/models/timeline.model.ts
```

- [ ] Completed

---

### Step B2: Remove Dead Route Imports and Registration from `backend/src/index.ts`

**Action**: Remove these lines from `backend/src/index.ts`:

1. **Line 9** — Remove the import:
   ```typescript
   import transcribeRoute from './routes/transcribe.js';
   ```

2. **Lines 20-22** — Remove the import block:
   ```typescript
   // Voice recording and timeline routes
   import timelineRoutes from './routes/timeline.routes.js';
   import audioRoutes from './routes/audio.routes.js';
   ```

3. **Line 126** — Remove the route registration:
   ```typescript
   app.use('/api', authenticate, transcribeRoute);
   ```

4. **Lines 136-138** — Remove the route registration block:
   ```typescript
   // Voice recording and timeline routes
   app.use('/api', authenticate, timelineRoutes);
   app.use('/api', authenticate, audioRoutes);
   ```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step B3: Remove Dead AI Service Functions from `backend/src/services/ai.service.ts`

**Action**: Remove two functions and their export references:

1. **Lines 140-288** — Delete the `transcribeAudio()` function (lines 140-176) and the `summarizeTranscription()` function (lines 178-288), including their doc comments.

2. **Lines 859-860** (in the `aiService` export object) — Remove:
   ```typescript
   transcribeAudio,
   summarizeTranscription,
   ```

**Note**: After removing these functions, check if the `openai` import at the top of the file is still used by other code. If `transcribeAudio` was the only consumer, the `openai` import can stay (it's used in the export object for other potential consumers).

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step B4: Remove Dead Timeline Query from `backend/src/models/topic.model.ts`

**Action**: In the `getWithStats()` method (around lines 134-160):

1. Remove the `timelineCount` from the Promise.all destructuring and the timeline_events query (lines 148-151).

   **Before**:
   ```typescript
   const [findingsCount, digestsCount, timelineCount] = await Promise.all([
     queryOne<{ count: number }>(
       'SELECT COUNT(*) as count FROM findings WHERE topic_id = $1 AND user_id = $2',
       [id, userId]
     ),
     queryOne<{ count: number }>(
       'SELECT COUNT(*) as count FROM digests WHERE topic_id = $1 AND user_id = $2',
       [id, userId]
     ),
     queryOne<{ count: number }>(
       'SELECT COUNT(*) as count FROM timeline_events WHERE topic_id = $1 AND user_id = $2',
       [id, userId]
     )
   ]);
   ```

   **After**:
   ```typescript
   const [findingsCount, digestsCount] = await Promise.all([
     queryOne<{ count: number }>(
       'SELECT COUNT(*) as count FROM findings WHERE topic_id = $1 AND user_id = $2',
       [id, userId]
     ),
     queryOne<{ count: number }>(
       'SELECT COUNT(*) as count FROM digests WHERE topic_id = $1 AND user_id = $2',
       [id, userId]
     )
   ]);
   ```

2. Remove line 158:
   ```typescript
   timeline_count: timelineCount?.count || 0
   ```

**Verify**: `cd backend && npx tsc --noEmit`

- [ ] Completed

---

### Step B5: Delete Dead Frontend Components

These components are never imported by any other file.

**Action**: Delete these 2 files:
```
src/components/TranscriptionSummary.tsx
src/components/FindingsMetricsExplainer.tsx
```

**Verify**: `npm run build`

- [ ] Completed

---

### Step B6: Delete Dead Service Worker and Sync Utilities

These files are never imported by any active code. The service worker was permanently removed.

**Action**: Delete these 3 files:
```
src/utils/serviceWorker.ts
src/services/sync/SyncService.ts
src/services/sync/index.ts
```

After deleting the two files in `src/services/sync/`, delete the now-empty directory:
```
src/services/sync/    (directory)
```

**Verify**: `npm run build`

- [ ] Completed

---

### Step B7: Remove Dead `transcribeAudio` from `src/services/api.ts`

**Action**:

1. **Line 3** — Remove `VoiceTranscriptionResult` from the type import:
   ```typescript
   import type { VoiceTranscriptionResult } from '@/types';
   ```
   If this is the only type imported on that line, delete the entire line.
   If other types are on the same line, just remove `VoiceTranscriptionResult` from the list.

2. **Lines 163-201** — Delete the entire `transcribeAudio` function, including its doc comment:
   ```typescript
   /**
    * Transcribe audio and generate summary
    * Now also supports server storage of timeline and audio
    */
   export async function transcribeAudio(
   ...
   ```

**Verify**: `npm run build`

- [ ] Completed

---

### Step B8: Remove Dead `timeline={[]}` Prop from `ResearchToolbar.tsx`

**File**: `src/components/research/toolbar/ResearchToolbar.tsx`

**Action**: Remove line 73:
```typescript
          timeline={[]}
```

The ExportMenu component doesn't accept a `timeline` prop — this is silently ignored by React.

**Verify**: `npm run build`

- [ ] Completed

---

### Step B9: Clean Dead Types from `src/types/index.ts`

**Action**: Remove the following type definition blocks. Each block includes a section header comment and all interfaces/types within it.

1. **Lines ~218-233** — Remove `TopicInsight` and `TopicConnection` interfaces.

   Also remove the references to them in the `Topic` interface (lines ~209-210):
   ```typescript
   insights?: TopicInsight[];
   connections?: TopicConnection[];
   ```

2. **Lines ~237-263** — Remove the entire `// ============= PATIENT CARE =============` section:
   - `MedicationInfo`
   - `LabResult`
   - `VitalSigns`

3. **Lines ~265-320** — Remove the entire `// ============= AUDIO & TRANSCRIPTION =============` section:
   - `AudioRecording`
   - `Transcription`
   - `TranscriptionSummary`
   - `AppointmentExtraction`
   - `VoiceTranscriptionResult`

4. **Lines ~322-349** — Remove the entire `// ============= FAMILY & COLLABORATION =============` section:
   - `FamilyRole`
   - `FamilyMember`
   - `FamilyPermissions`
   - `FamilyAccess`

   Also remove the reference in the `Topic` interface (line ~215):
   ```typescript
   familyAccess?: FamilyAccess[];
   ```

5. **Lines ~405-426** — Remove the entire `// ============= API & COST TRACKING =============` section:
   - `ApiUsage`
   - `MonthlyCostSummary`

6. **Lines ~428-439** — Remove the entire `// ============= DATABASE SCHEMA =============` section:
   - `DatabaseSchema` (contains references to `audio`, `apiUsage`, `family`)

**Verify**: `npm run build` — Expect errors from files that import these types. Fix those in the next steps.

- [ ] Completed

---

### Step B10: Clean Dead Code from `src/stores/userStore.ts`

This is the most complex edit in the plan. Work carefully.

**Action**:

1. **Line 3** — Remove `FamilyMember` from the import:
   ```typescript
   import type { UserPreferences, FamilyMember } from '../types';
   ```
   Change to:
   ```typescript
   import type { UserPreferences } from '../types';
   ```

2. **Lines 97-102** — Remove the Family Members interface section:
   ```typescript
   // Family Members
   familyMembers: FamilyMember[];
   loadFamilyMembers: () => Promise<void>;
   addFamilyMember: (member: Omit<FamilyMember, 'id'>) => Promise<void>;
   updateFamilyMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
   removeFamilyMember: (id: string) => Promise<void>;
   ```

3. **Lines 104-114** — Remove the API Usage interface section:
   ```typescript
   // API Usage
   apiUsage: {
     totalCost: number;
     monthlyLimit: number;
     currentMonth: string;
     breakdown: Map<string, number>;
   };
   loadApiUsage: () => Promise<void>;
   updateApiUsage: (service: string, cost: number) => Promise<void>;
   setMonthlyLimit: (limit: number) => void;
   resetMonthlyUsage: () => Promise<void>;
   ```

4. **Lines 315-371** — Remove the entire Family Members implementation block:
   ```typescript
   // Family Members
   familyMembers: [],
   loadFamilyMembers: async () => { ... },
   addFamilyMember: async (member) => { ... },
   updateFamilyMember: async (id, updates) => { ... },
   removeFamilyMember: async (id) => { ... },
   ```

5. **Lines 373-457** — Remove the entire API Usage implementation block:
   ```typescript
   // API Usage
   apiUsage: { ... },
   loadApiUsage: async () => { ... },
   updateApiUsage: async (service, cost) => { ... },
   setMonthlyLimit: (limit) => { ... },
   resetMonthlyUsage: async () => { ... },
   ```

6. **Lines 460-465** — Remove 4 dead feature flags from the `featureFlags` Map, keeping only the active ones:
   ```typescript
   // Before:
   featureFlags: new Map([
     ['conversationalInterface', true],
     ['knowledgeGraph', false],
     ['advancedExport', false],
     ['voiceCommands', false],
     ['collaborationTools', false],
     ['aiInsights', true],
     ['customAgents', false]
   ]),

   // After:
   featureFlags: new Map([
     ['conversationalInterface', true],
     ['aiInsights', true],
     ['customAgents', false]
   ]),
   ```

7. **Lines 501-504** — Remove apiUsage from `partialize`:
   ```typescript
   // Remove:
   apiUsage: {
     monthlyLimit: state.apiUsage.monthlyLimit,
     currentMonth: state.apiUsage.currentMonth
   },
   ```

8. **Lines 511-513** — Remove apiUsage rehydration:
   ```typescript
   // Remove:
   if (state && !state.apiUsage.breakdown) {
     state.apiUsage.breakdown = new Map();
   }
   ```

9. **Lines 526-538** — Remove the `useApiBudget` helper hook entirely.

10. **Update `src/stores/index.ts`** — Line 37, remove `useApiBudget` from the re-export:
    ```typescript
    // Before:
    export { useUserStore, useFeature, useApiBudget } from './userStore';
    // After:
    export { useUserStore, useFeature } from './userStore';
    ```

**Verify**: `npm run build`

- [ ] Completed

---

### Step B11: Clean Dead Code from `src/utils/db/database.ts`

**Action**:

1. **Lines 6-18** (type imports) — Remove `AudioRecording`, `ApiUsage`, and `FamilyMember` from the import:
   ```typescript
   // Before:
   import type {
     Topic,
     Agent,
     ResearchFinding,
     AudioRecording,
     Notification,
     ApiUsage,
     UserPreferences,
     FamilyMember,
     SmartDigest,
     FindingsChat,
     DigestQueueItem
   } from '@/types';

   // After:
   import type {
     Topic,
     Agent,
     ResearchFinding,
     Notification,
     UserPreferences,
     SmartDigest,
     FindingsChat,
     DigestQueueItem
   } from '@/types';
   ```

2. **Lines 49-56** — Remove the `audio` store from the schema:
   ```typescript
   // Remove:
   audio: {
     key: string;
     value: AudioRecording;
     indexes: {
       'by-date': number;
       'by-event': string;
     };
   };
   ```

3. **Lines 66-74** — Remove the `apiUsage` store from the schema:
   ```typescript
   // Remove:
   apiUsage: {
     key: string;
     value: ApiUsage;
     indexes: {
       'by-date': number;
       'by-service': string;
       'by-agent': string;
     };
   };
   ```

4. **Lines 79-86** — Remove the `family` store from the schema:
   ```typescript
   // Remove:
   family: {
     key: string;
     value: FamilyMember;
     indexes: {
       'by-email': string;
       'by-role': string;
     };
   };
   ```

5. **Lines 158-163** — Remove the audio store creation in `upgrade()`:
   ```typescript
   // Remove:
   // Audio store
   if (!db.objectStoreNames.contains('audio')) {
     const audioStore = db.createObjectStore('audio', { keyPath: 'id' });
     audioStore.createIndex('by-date', 'recordedAt');
     audioStore.createIndex('by-event', 'linkedEventId');
   }
   ```

6. **Lines 174-179** — Remove the apiUsage store creation in `upgrade()`:
   ```typescript
   // Remove:
   // API Usage store
   if (!db.objectStoreNames.contains('apiUsage')) {
     const apiStore = db.createObjectStore('apiUsage', { keyPath: 'id' });
     apiStore.createIndex('by-date', 'timestamp');
     apiStore.createIndex('by-service', 'service');
     apiStore.createIndex('by-agent', 'agentId');
   }
   ```

7. **Lines 186-191** — Remove the family store creation in `upgrade()`:
   ```typescript
   // Remove:
   // Family store
   if (!db.objectStoreNames.contains('family')) {
     const familyStore = db.createObjectStore('family', { keyPath: 'id' });
     familyStore.createIndex('by-email', 'email', { unique: true });
     familyStore.createIndex('by-role', 'role');
   }
   ```

8. **Lines 287-288** — Update the `clearAllData` stores array:
   ```typescript
   // Before:
   const stores = ['topics', 'agents', 'findings', 'audio',
                   'notifications', 'apiUsage', 'preferences', 'family', 'digests', 'chats', 'digestQueue'] as const;
   // After:
   const stores = ['topics', 'agents', 'findings',
                   'notifications', 'preferences', 'digests', 'chats', 'digestQueue'] as const;
   ```

9. **Lines 300-301** — Update the `exportAllData` stores array (same change):
   ```typescript
   // Before:
   const stores = ['topics', 'agents', 'findings', 'audio',
                   'notifications', 'apiUsage', 'preferences', 'family', 'digests', 'chats', 'digestQueue'] as const;
   // After:
   const stores = ['topics', 'agents', 'findings',
                   'notifications', 'preferences', 'digests', 'chats', 'digestQueue'] as const;
   ```

**IMPORTANT NOTE about IndexedDB schema removal**: Removing stores from the TypeScript schema definition (`MedCompanionDB extends DBSchema`) and removing `createObjectStore` calls inside `if (!contains)` guards does NOT require a `DB_VERSION` bump. Existing IndexedDB databases will simply have extra stores that the app no longer reads from or writes to. These orphaned stores are harmless and will be cleaned up naturally when/if DB_VERSION is bumped in the future.

**Verify**: `npm run build`

- [ ] Completed

---

### Step B12: Clean Dead Code from `src/utils/db/version.ts`

**Action**:

1. **Lines 6-7** — Remove the dead sw.js comments:
   ```typescript
   // Remove:
    * 2. Update public/sw.js - indexedDB.open('MedCompanionDB', VERSION)
    * 3. Update public/sw.js - CACHE_NAME = 'med-companion-vVERSION'
   ```

2. **Line 12** — Remove the `CACHE_VERSION` export:
   ```typescript
   // Remove:
   export const CACHE_VERSION = 'v8';
   ```

3. **Lines 22-23** in VERSION_HISTORY — Remove voice recording references:
   ```typescript
   // Remove:
   6: 'Voice recording compression and chunking support',
   7: 'Server persistence for voice recordings and timeline events',
   ```

**Verify**: `npm run build` — Check that nothing imports `CACHE_VERSION`. (It should not be imported anywhere since service worker was removed.)

- [ ] Completed

---

### Step B13: Clean Dead Code from `src/config/storage.config.ts`

**Action**:

1. **Line 62** — Remove `'offline_queue'` from the IndexedDB stores list:
   ```typescript
   // Before:
   stores: [
     'topics',
     'agents',
     'findings',
     'digests',
     'chats',
     'notifications',
     'offline_queue'
   ] as const,

   // After:
   stores: [
     'topics',
     'agents',
     'findings',
     'digests',
     'chats',
     'notifications'
   ] as const,
   ```

2. **Line 119** — Remove `enableOfflineCache`:
   ```typescript
   // Remove:
   enableOfflineCache: true,
   ```

   Check if `enableOfflineCache` is referenced anywhere else. If it is, remove those references too. If nothing references it, just remove the property.

**Verify**: `npm run build`

- [ ] Completed

---

### Step B14: Clean Dead `offline_queue` Reference from `src/services/cache/CacheManager.ts`

**Action**: Around line 209, remove the `offline_queue` guard:

```typescript
// Before:
if (store !== 'offline_queue') {
  await this.clearExpired(store);
}

// After:
await this.clearExpired(store);
```

Since `offline_queue` was removed from the stores list in Step B13, this guard would never match anyway. But clean it up for clarity.

**Verify**: `npm run build`

- [ ] Completed

---

### Step B15: Clean Dead Family Code from `src/services/topics.service.ts`

**Action**: Remove the dead `getTopicsForFamilyMember` method and its deprecated export wrapper.

1. Remove the method (around lines 519-524):
   ```typescript
   async getTopicsForFamilyMember(memberId: string): Promise<Topic[]> {
     const topics = await this.getTopics();
     return topics.filter(topic =>
       topic.familyAccess?.some(access => access.memberId === memberId)
     );
   }
   ```

2. Remove the deprecated export (around lines 710-713):
   ```typescript
   /**
    * @deprecated Import topicsService and use topicsService.getTopicsForFamilyMember() instead
    */
   export const getTopicsForFamilyMember = (memberId: string) =>
     topicsService.getTopicsForFamilyMember(memberId);
   ```

**Note**: After removing `FamilyAccess` from types in Step B9, the `topic.familyAccess` reference will already cause a type error. This step fixes that error.

**Verify**: `npm run build`

- [ ] Completed

---

### Step B16: Final Build Verification

**Action**: Run the full build pipeline and verify:

```bash
# Frontend build
npm run build

# Backend type check
cd backend && npx tsc --noEmit

# Check for any remaining references to deleted items
```

Search for any remaining broken references. Run these grep checks (all should return 0 results from active source files):

```bash
grep -r "AudioRecording" src/ --include="*.ts" --include="*.tsx"
grep -r "TranscriptionSummary" src/ --include="*.ts" --include="*.tsx"
grep -r "FamilyMember" src/ --include="*.ts" --include="*.tsx"
grep -r "ApiUsage" src/ --include="*.ts" --include="*.tsx"
grep -r "VoiceTranscriptionResult" src/ --include="*.ts" --include="*.tsx"
grep -r "timelineRoutes\|audioRoutes\|transcribeRoute" backend/src/ --include="*.ts"
grep -r "SyncService\|serviceWorker" src/ --include="*.ts" --include="*.tsx"
grep -r "CACHE_VERSION" src/ --include="*.ts"
grep -r "offline_queue" src/ --include="*.ts" --include="*.tsx"
grep -r "useApiBudget" src/ --include="*.ts" --include="*.tsx"
```

If any references are found, trace and remove them before proceeding.

- [ ] Completed

---

## Post-Completion

### What Was Removed

| Category | Files Deleted | Lines Removed |
|---|---|---|
| Stale documentation (.md) | ~30 files | ~5,500 |
| Dead scripts (.sh/.js) | 5 files | ~420 |
| Dead HTML utilities (public/) | 4 files | ~960 |
| Dead backend routes + models | 5 files | ~1,500 |
| Dead frontend components | 2 files | ~610 |
| Dead service worker utilities | 3 files | ~530 |
| Dead code in shared files | — (edits) | ~750 |
| **TOTAL** | **~49 files** | **~10,270** |

### What Was Kept (And Why)

| File | Reason |
|---|---|
| `IMPLEMENTATION_PLANS/005_DIGEST_UI_MAGAZINE_REDESIGN.md` | Active Plan 007 depends on it (9 references) |
| `REFACTORING/README.md` | Referenced by CLAUDE.md, self-contained summary |
| `public/unregister-sw.html` | Referenced in CLAUDE.md for legacy SW cleanup |
| `public/clear-digest-store.html` | Active debugging utility |
| `start-with-postgres.sh` / `.bat` | Active development scripts |
| `deploy-safeguards.sh` | Active deployment safety checks |

### Sign-Off

- [ ] Phase A completed — Date: ___
- [ ] Phase B completed — Date: ___
- [ ] Frontend builds successfully
- [ ] Backend compiles successfully
- [ ] App loads and navigates correctly
- [ ] Git committed

---

*Plan created: February 8, 2026*
*This plan can be deleted after completion.*
