# Foundation Refactoring Guide

## ⛔ STOP: No Feature Work Until This Is Complete

**ALL DEVELOPMENT IS PAUSED FOR ARCHITECTURAL REFACTORING**

This is not optional. The app has accumulated critical technical debt that prevents it from fulfilling its core promise of being an "autonomous medical research companion." We MUST fix the foundation before adding any features.

---

## Current Status

- **Phase**: 1 of 4
- **Start Date**: February 4, 2026
- **End Date**: March 4, 2026 (4 weeks)
- **Current Week**: Week 1
- **Focus**: Service Layer Consolidation
- **Next Phase Starts**: February 11, 2026

---

## The Critical Problem

The Medical Companion PWA has **fundamentally failed** to deliver autonomous behavior due to:

1. **Service Layer Chaos**: 27 service files with 3 redundant layers doing the same thing
2. **State Management Disaster**: 27 useState calls causing race conditions and data loss
3. **Storage Confusion**: PostgreSQL vs IndexedDB vs LocalStorage with no clear boundaries
4. **Mega-Component Monster**: 1,146-line FindingsViewerProgressive.tsx that's impossible to maintain
5. **5,000+ Lines of Dead Code**: Unused components, services, and utilities

**Result**: Auto-generation had to be DISABLED because the architecture can't handle it.

---

## The 4-Phase Solution

### Phase 1: Service Layer Consolidation (Week 1)
- Reduce from 27 service files to 8 clean services
- Delete all redundant API service layers
- Implement single, clear data flow pattern
- **Document**: [PHASE_1_SERVICE_LAYER.md](./PHASE_1_SERVICE_LAYER.md)

### Phase 2: State Management Migration (Week 2)
- Complete Zustand migration (eliminate 27 useState calls)
- Fix state persistence across navigation
- Eliminate all race conditions
- **Document**: [PHASE_2_STATE_MANAGEMENT.md](./PHASE_2_STATE_MANAGEMENT.md)

### Phase 3: Component Decomposition (Week 3)
- Break 1,146-line mega-component into 10 focused components
- Extract business logic to orchestrators
- Delete all unused component variants
- **Document**: [PHASE_3_COMPONENTS.md](./PHASE_3_COMPONENTS.md)

### Phase 4: Storage Architecture (Week 4)
- Define clear PostgreSQL vs IndexedDB boundaries
- Implement proper sync strategy
- Fix transaction boundaries
- **Document**: [PHASE_4_STORAGE.md](./PHASE_4_STORAGE.md)

---

## Strict Rules for All Agents

### ✅ MUST DO:
1. **Follow the current phase document exactly** - No deviations
2. **Delete code according to CODE_TO_DELETE.md** - Be ruthless
3. **Test each change before proceeding** - No assumptions
4. **Document decisions in code comments** - Future agents need context
5. **Update this README when completing a phase** - Track progress

### ❌ MUST NOT DO:
1. **Add ANY new features** - Not even "quick wins"
2. **Create new abstractions** - Simplify, don't abstract
3. **Keep commented code** - Delete it completely
4. **Add band-aid fixes** - Fix the root cause only
5. **Skip testing** - Every phase must work before moving on

---

## Code Deletion Manifest

See [CODE_TO_DELETE.md](./CODE_TO_DELETE.md) for the complete list of files to delete.

**Target**: Delete 5,000+ lines of dead/redundant code

---

## Success Metrics

After completing all 4 phases:

### Quantitative:
- Service files: 27 → 8 (-70%)
- Component size: 1,146 lines → max 200 lines
- useState calls: 27 → 0 in data components
- Dead code: 5,000+ lines deleted
- Console.logs: 200+ → 0

### Qualitative:
- Auto-generation works reliably
- State persists across navigation
- No race conditions
- Clear data flow
- Testable components

---

## How to Use This Guide

1. **Read this README first** - Understand the full scope
2. **Read the current phase document** - Week 1 = PHASE_1_SERVICE_LAYER.md
3. **Check CODE_TO_DELETE.md** - Know what to remove
4. **Follow the phase instructions exactly** - No improvements or deviations
5. **Update status here when done** - Mark phase complete

---

## Phase Completion Checklist

### Phase 1 ⏳ (In Progress)
- [ ] All service layers consolidated
- [ ] Redundant files deleted
- [ ] Tests passing
- [ ] No console errors

### Phase 2 ⏸️ (Not Started)
- [ ] Zustand migration complete
- [ ] useState eliminated from data components
- [ ] State persists across navigation
- [ ] No race conditions

### Phase 3 ⏸️ (Not Started)
- [ ] Mega-component decomposed
- [ ] All components under 200 lines
- [ ] Business logic extracted
- [ ] Dead components deleted

### Phase 4 ⏸️ (Not Started)
- [ ] Storage boundaries defined
- [ ] Sync strategy implemented
- [ ] Transactions working
- [ ] All console.logs removed

---

## Important Notes

1. **This is not optional** - The app cannot function properly without these fixes
2. **No shortcuts** - Each phase builds on the previous one
3. **Delete aggressively** - When in doubt, delete it
4. **Simplify everything** - Choose simple over clever every time
5. **Test thoroughly** - A working foundation is better than broken features

---

## Questions?

If you encounter issues:
1. Check the current phase document for detailed instructions
2. Review CODE_TO_DELETE.md to ensure you're deleting the right files
3. Look at git history for context on why code exists
4. When in doubt, DELETE rather than keep

**Remember**: We're building a foundation that will last. No rush, no shortcuts, just clean, simple, maintainable code.

---

**Last Updated**: February 4, 2026
**Updated By**: Architecture Refactoring Agent
**Status**: Phase 1 Active