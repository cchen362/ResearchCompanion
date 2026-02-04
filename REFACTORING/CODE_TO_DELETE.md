# Code To Delete - Complete Manifest

**Total Lines to Delete**: ~5,000+ lines
**Total Files to Delete**: 46 files

---

## Phase 1: Service Layer (Week 1)

### Service Files to Delete (19 files, ~3,500 lines)

```
src/services/
  ├── findings.api.service.ts          (330 lines) - REDUNDANT API LAYER
  ├── agents.api.service.ts            (200 lines) - REDUNDANT API LAYER
  ├── agentService.ts                  (100 lines) - OLD VERSION
  ├── digests.api.service.ts           (150 lines) - REDUNDANT API LAYER
  ├── digestQueue.service.ts           (800 lines) - MERGE INTO digest.service
  ├── digestCache.service.ts           (200 lines) - MERGE INTO digest.service
  ├── topics.api.service.ts            (180 lines) - REDUNDANT API LAYER
  ├── chat.api.service.ts              (250 lines) - REDUNDANT API LAYER
  ├── conversations.service.ts         (150 lines) - DEPRECATED
  ├── conversations.api.service.ts     (200 lines) - DEPRECATED
  ├── timeline.service.ts              (120 lines) - NOT USED
  ├── timeline.api.service.ts          (150 lines) - NOT USED
  ├── analytics.service.ts             (300 lines) - DEPRECATED FEATURE
  ├── audioCompression.service.ts      (80 lines)  - NOT NEEDED
  ├── chunkedRecording.service.ts      (120 lines) - NOT NEEDED
  ├── audio.api.service.ts             (100 lines) - REDUNDANT API LAYER
  ├── serviceWorker.ts                 (50 lines)  - REMOVED FEATURE
  ├── sw-registration.ts               (30 lines)  - REMOVED FEATURE
  └── sw-utils.ts                      (40 lines)  - REMOVED FEATURE
```

### Database Utils to Delete (8 files, ~500 lines)

```
src/utils/db/
  ├── findings.ts                      (45 lines)  - DIRECT DB ACCESS
  ├── agents.ts                        (80 lines)  - DIRECT DB ACCESS
  ├── topics.ts                        (60 lines)  - DIRECT DB ACCESS
  ├── timeline.ts                      (50 lines)  - NOT USED
  ├── conversations.ts                 (70 lines)  - DEPRECATED
  ├── digests.ts                       (40 lines)  - DIRECT DB ACCESS
  ├── cleanup.ts                       (100 lines) - UNUSED UTILITY
  └── migration.ts                     (150 lines) - OLD MIGRATION
```

### Component File to Move Logic From (1 file)

```
src/components/agents/
  └── agentRunner.ts                   (400 lines) - MOVE TO agents.service
```

**Phase 1 Total**: 28 files, ~4,400 lines

---

## Phase 2: State Management (Week 2)

### Unused Store Attempts to Delete (if any)

```
src/stores/
  └── (Check for any unused .ts files that aren't the 3 main stores)
```

### Context Providers to Delete (if any)

```
src/contexts/
  └── *.tsx (All context files if they exist - replaced by Zustand)
```

**Phase 2 Total**: ~0-200 lines (depends on what exists)

---

## Phase 3: Component Decomposition (Week 3)

### Component Files to Delete (7 files, ~3,000 lines)

```
src/components/
  ├── FindingsViewerProgressive.tsx    (1,146 lines) - THE MEGA-COMPONENT
  ├── FindingsViewer.tsx                (400 lines)  - UNUSED VARIANT
  ├── FindingsViewerEnhanced.tsx       (600 lines)  - UNUSED VARIANT
  └── UpdateNotification.tsx            (50 lines)   - PWA FEATURE REMOVED

src/components/chat/
  ├── ChatPanelDebug.tsx                (300 lines)  - DEBUG VERSION
  ├── ChatPanelLazy.tsx                 (200 lines)  - ATTEMPTED FIX
  └── ChatPanelMinimal.backup.tsx      (200 lines)  - BACKUP FILE
```

**Phase 3 Total**: 7 files, ~2,900 lines

---

## Phase 4: Storage & Cleanup (Week 4)

### Database Files to Delete (3 files, ~300 lines)

```
src/utils/db/
  ├── databaseV5.ts                    (150 lines) - FAILED MIGRATION
  ├── indexeddb-helpers.ts             (80 lines)  - UNUSED HELPERS
  └── storage-utils.ts                 (70 lines)  - REDUNDANT UTILS
```

### Backend Duplicate Routes to Delete (4 files, ~400 lines)

```
backend/src/routes/
  ├── agent.ts                         (100 lines) - USE agents.routes.ts
  ├── digest.routes.ts                 (120 lines) - USE digests.crud.routes.ts
  ├── chat.routes.ts                   (100 lines) - USE chats.routes.ts
  └── timeline.routes.ts               (80 lines)  - NOT USED
```

**Phase 4 Total**: 7 files, ~700 lines

---

## Additional Dead Code to Delete

### Test Files (if not maintained)

```
src/__tests__/
  └── *.test.ts (Any broken or unmaintained test files)

src/components/__tests__/
  └── *.test.tsx (Component tests for deleted components)
```

### Config Files

```
src/config/
  └── service-worker.config.ts        (If exists - SW removed)
  └── offline.config.ts               (If exists - No offline support)
```

### Type Definitions for Deleted Features

```
src/types/
  └── timeline.ts                     (If exists - Feature removed)
  └── analytics.ts                    (If exists - Feature removed)
  └── service-worker.ts               (If exists - Feature removed)
```

---

## Order of Deletion

### Week 1 (Phase 1):
1. Delete all `.api.service.ts` files first
2. Delete utils/db/*.ts files (except database.ts)
3. Delete deprecated service files
4. Move agentRunner.ts logic to agents.service.ts, then delete

### Week 2 (Phase 2):
1. After Zustand migration, delete any Context providers
2. Delete any unused store attempts
3. Clean up any state management utilities

### Week 3 (Phase 3):
1. After decomposition, delete FindingsViewerProgressive.tsx
2. Delete all unused FindingsViewer variants
3. Delete all ChatPanel variants except the one used
4. Delete any orphaned sub-components

### Week 4 (Phase 4):
1. Delete database version files
2. Delete redundant backend routes
3. Delete all console.log statements (replace with logger)
4. Final cleanup of any remaining dead code

---

## Validation Script

Create a script to verify deletions:

```typescript
// scripts/verify-deletions.ts
import * as fs from 'fs';
import * as path from 'path';

const filesToDelete = [
  'src/services/findings.api.service.ts',
  'src/services/agents.api.service.ts',
  // ... all files from this manifest
];

function verifyDeletions() {
  const stillExists: string[] = [];

  for (const file of filesToDelete) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      stillExists.push(file);
    }
  }

  if (stillExists.length > 0) {
    console.error('❌ These files should be deleted:');
    stillExists.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('✅ All files successfully deleted!');
}

verifyDeletions();
```

---

## Git Commands for Deletion

### Bulk delete service files:
```bash
git rm src/services/*.api.service.ts
git rm src/services/digestQueue.service.ts src/services/digestCache.service.ts
git rm src/services/timeline*.ts src/services/analytics.service.ts
git rm src/services/conversations*.ts src/services/audio*.service.ts
```

### Bulk delete component files:
```bash
git rm src/components/FindingsViewer*.tsx
git rm src/components/chat/ChatPanel*.tsx
```

### Bulk delete utils:
```bash
git rm src/utils/db/*.ts
# Then restore the one we keep:
git checkout HEAD -- src/utils/db/database.ts
```

---

## Important Notes

1. **ALWAYS DELETE, NEVER COMMENT OUT** - Use git history to recover if needed
2. **DELETE IN ORDER** - Some files depend on others
3. **TEST AFTER EACH PHASE** - Ensure nothing breaks
4. **COMMIT DELETIONS SEPARATELY** - Makes it easy to revert if needed

---

## Success Metrics

After all deletions:
- **Service files**: From 27 → 8 files
- **Component files**: From 1,146-line monster → 10 files under 200 lines each
- **Database utils**: From 8 → 1 file
- **Total codebase**: ~5,000 lines lighter

---

**Remember**: When in doubt, DELETE IT. We're building a clean foundation, not preserving legacy code.