# Phase 2: State Management Migration

**Duration**: Week 2 (February 11-17, 2026)
**Goal**: Complete Zustand migration, eliminate 27 useState calls, fix race conditions

---

## The Problem

**FindingsViewerProgressive.tsx** has **27 useState calls**:
```typescript
// Data state mixed with UI state
const [findings, setFindings] = useState<ResearchFinding[]>([]);
const [topics, setTopics] = useState<Topic[]>([]);
const [digest, setDigest] = useState<SmartDigest | null>(null);
// ... 24 more useState calls
```

This causes:
- **State loss on navigation** - Everything resets when component unmounts
- **Race conditions** - Multiple operations updating same state
- **Prop drilling** - Passing data through 5+ component layers
- **Duplicate data fetching** - Each component fetches independently
- **Impossible to test** - Too many state combinations

---

## The Solution

Create **3 focused Zustand stores** with clear responsibilities:

1. **researchStore** - All research data (findings, topics, digests, agents)
2. **uiStore** - UI state only (modals, loading, progress)
3. **appStore** - Global app state (user, theme, preferences)

---

## Step-by-Step Implementation

### Day 1: Create Core Stores

#### 1. Research Store (Primary Data)

**File**: `src/stores/researchStore.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ResearchFinding, Topic, SmartDigest, Agent } from '@/types';
import { findingsService, topicsService, digestService, agentsService } from '@/services';

interface ResearchStore {
  // Data
  findings: Map<string, ResearchFinding[]>; // Keyed by topicId
  topics: Topic[];
  digests: Map<string, SmartDigest>; // Keyed by topicId-timeframe
  agents: Map<string, Agent[]>; // Keyed by topicId

  // Selection
  selectedTopicId: string | null;
  selectedFindingId: string | null;

  // Actions - Data Loading
  loadTopics: () => Promise<void>;
  loadFindings: (topicId: string) => Promise<void>;
  loadDigest: (topicId: string, timeframe?: string) => Promise<void>;
  loadAgents: (topicId: string) => Promise<void>;

  // Actions - Selection
  selectTopic: (topicId: string | null) => void;
  selectFinding: (findingId: string | null) => void;

  // Actions - Mutations
  addFinding: (finding: ResearchFinding) => void;
  updateFinding: (id: string, updates: Partial<ResearchFinding>) => void;
  deleteFinding: (id: string) => void;

  // Actions - Digest
  generateDigest: (topicId: string, timeframe?: string) => Promise<void>;
  clearDigest: (topicId: string) => void;

  // Getters
  getFindingsForTopic: (topicId: string) => ResearchFinding[];
  getDigestForTopic: (topicId: string, timeframe?: string) => SmartDigest | null;
  getSelectedTopic: () => Topic | null;
}

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      // Initial state
      findings: new Map(),
      topics: [],
      digests: new Map(),
      agents: new Map(),
      selectedTopicId: null,
      selectedFindingId: null,

      // Data Loading
      loadTopics: async () => {
        const topics = await topicsService.getTopics();
        set({ topics });
      },

      loadFindings: async (topicId: string) => {
        const findings = await findingsService.getFindings(topicId);
        set(state => ({
          findings: new Map(state.findings).set(topicId, findings)
        }));
      },

      loadDigest: async (topicId: string, timeframe = 'all') => {
        const digest = await digestService.getDigest(topicId, timeframe);
        if (digest) {
          const key = `${topicId}-${timeframe}`;
          set(state => ({
            digests: new Map(state.digests).set(key, digest)
          }));
        }
      },

      loadAgents: async (topicId: string) => {
        const agents = await agentsService.getAgents(topicId);
        set(state => ({
          agents: new Map(state.agents).set(topicId, agents)
        }));
      },

      // Selection
      selectTopic: (topicId: string | null) => {
        set({ selectedTopicId: topicId, selectedFindingId: null });
      },

      selectFinding: (findingId: string | null) => {
        set({ selectedFindingId: findingId });
      },

      // Mutations
      addFinding: (finding: ResearchFinding) => {
        set(state => {
          const topicFindings = state.findings.get(finding.topicId) || [];
          return {
            findings: new Map(state.findings).set(
              finding.topicId,
              [...topicFindings, finding]
            )
          };
        });
      },

      updateFinding: (id: string, updates: Partial<ResearchFinding>) => {
        set(state => {
          const newFindings = new Map(state.findings);
          newFindings.forEach((findings, topicId) => {
            const index = findings.findIndex(f => f.id === id);
            if (index !== -1) {
              findings[index] = { ...findings[index], ...updates };
              newFindings.set(topicId, [...findings]);
            }
          });
          return { findings: newFindings };
        });
      },

      deleteFinding: (id: string) => {
        set(state => {
          const newFindings = new Map(state.findings);
          newFindings.forEach((findings, topicId) => {
            const filtered = findings.filter(f => f.id !== id);
            if (filtered.length !== findings.length) {
              newFindings.set(topicId, filtered);
            }
          });
          return { findings: newFindings };
        });
      },

      // Digest
      generateDigest: async (topicId: string, timeframe = 'all') => {
        const digest = await digestService.generateDigest(topicId, timeframe);
        const key = `${topicId}-${timeframe}`;
        set(state => ({
          digests: new Map(state.digests).set(key, digest)
        }));
      },

      clearDigest: (topicId: string) => {
        set(state => {
          const newDigests = new Map(state.digests);
          Array.from(newDigests.keys())
            .filter(key => key.startsWith(topicId))
            .forEach(key => newDigests.delete(key));
          return { digests: newDigests };
        });
      },

      // Getters
      getFindingsForTopic: (topicId: string) => {
        return get().findings.get(topicId) || [];
      },

      getDigestForTopic: (topicId: string, timeframe = 'all') => {
        const key = `${topicId}-${timeframe}`;
        return get().digests.get(key) || null;
      },

      getSelectedTopic: () => {
        const { topics, selectedTopicId } = get();
        return topics.find(t => t.id === selectedTopicId) || null;
      }
    }),
    {
      name: 'research-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist selection, not data
        selectedTopicId: state.selectedTopicId,
        selectedFindingId: state.selectedFindingId
      })
    }
  )
);
```

#### 2. UI Store (Interface State)

**File**: `src/stores/uiStore.ts`

```typescript
import { create } from 'zustand';

interface UIStore {
  // Loading States (single source of truth)
  loading: {
    topics: boolean;
    findings: boolean;
    digest: boolean;
    agents: boolean;
  };

  // Progress Tracking
  digestProgress: number;
  digestMessage: string;
  agentProgress: Map<string, number>;

  // Modals/Drawers
  modals: {
    findingDetail: boolean;
    sourceDrawer: boolean;
    digestSettings: boolean;
    topicEdit: boolean;
  };

  // View Settings
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'relevance' | 'source';
  filterBy: 'all' | 'pubmed' | 'clinical' | 'web';

  // Actions
  setLoading: (key: keyof UIStore['loading'], value: boolean) => void;
  setDigestProgress: (progress: number, message?: string) => void;
  setAgentProgress: (agentId: string, progress: number) => void;
  openModal: (modal: keyof UIStore['modals']) => void;
  closeModal: (modal: keyof UIStore['modals']) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sort: UIStore['sortBy']) => void;
  setFilterBy: (filter: UIStore['filterBy']) => void;

  // Bulk actions
  resetLoadingStates: () => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  loading: {
    topics: false,
    findings: false,
    digest: false,
    agents: false
  },

  digestProgress: 0,
  digestMessage: '',
  agentProgress: new Map(),

  modals: {
    findingDetail: false,
    sourceDrawer: false,
    digestSettings: false,
    topicEdit: false
  },

  viewMode: 'grid',
  sortBy: 'date',
  filterBy: 'all',

  // Actions
  setLoading: (key, value) => {
    set(state => ({
      loading: { ...state.loading, [key]: value }
    }));
  },

  setDigestProgress: (progress, message) => {
    set({
      digestProgress: progress,
      digestMessage: message || ''
    });
  },

  setAgentProgress: (agentId, progress) => {
    set(state => ({
      agentProgress: new Map(state.agentProgress).set(agentId, progress)
    }));
  },

  openModal: (modal) => {
    set(state => ({
      modals: { ...state.modals, [modal]: true }
    }));
  },

  closeModal: (modal) => {
    set(state => ({
      modals: { ...state.modals, [modal]: false }
    }));
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setFilterBy: (filter) => set({ filterBy: filter }),

  resetLoadingStates: () => {
    set({
      loading: {
        topics: false,
        findings: false,
        digest: false,
        agents: false
      }
    });
  },

  closeAllModals: () => {
    set({
      modals: {
        findingDetail: false,
        sourceDrawer: false,
        digestSettings: false,
        topicEdit: false
      }
    });
  }
}));
```

#### 3. App Store (Global Settings)

**File**: `src/stores/appStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, DigestTimeframe, ExplanationMode } from '@/types';

interface AppStore {
  // User & Auth
  user: User | null;
  isAuthenticated: boolean;

  // Preferences
  theme: 'light' | 'dark' | 'system';
  digestTimeframe: DigestTimeframe;
  explanationMode: ExplanationMode;
  autoGenerateDigest: boolean;

  // Actions
  setUser: (user: User | null) => void;
  logout: () => void;
  updatePreferences: (prefs: Partial<AppStore>) => void;
  setTheme: (theme: AppStore['theme']) => void;
  setDigestTimeframe: (timeframe: DigestTimeframe) => void;
  setExplanationMode: (mode: ExplanationMode) => void;
  toggleAutoGenerate: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      theme: 'system',
      digestTimeframe: 'all',
      explanationMode: 'simple',
      autoGenerateDigest: true, // Re-enable after fixing!

      // Actions
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user
        });
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false
        });
        // Clear other stores
        useResearchStore.getState().selectTopic(null);
        useUIStore.getState().closeAllModals();
      },

      updatePreferences: (prefs) => {
        set(prefs);
      },

      setTheme: (theme) => set({ theme }),
      setDigestTimeframe: (digestTimeframe) => set({ digestTimeframe }),
      setExplanationMode: (explanationMode) => set({ explanationMode }),
      toggleAutoGenerate: () => set(state => ({
        autoGenerateDigest: !state.autoGenerateDigest
      }))
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        // Persist everything except user (stored in auth)
        theme: state.theme,
        digestTimeframe: state.digestTimeframe,
        explanationMode: state.explanationMode,
        autoGenerateDigest: state.autoGenerateDigest
      })
    }
  )
);
```

### Day 2: Create Migration Utilities

#### 4. Store Hydration Hook

**File**: `src/hooks/useStoreHydration.ts`

```typescript
import { useEffect, useState } from 'react';
import { useResearchStore } from '@/stores/researchStore';

export function useStoreHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Wait for all stores to hydrate from localStorage
    const unsubscribe = useResearchStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    // Check if already hydrated
    if (useResearchStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  return isHydrated;
}
```

### Day 3-4: Migrate FindingsViewerProgressive

#### 5. Replace Component State with Stores

**Before** (1,146 lines with 27 useState):
```typescript
function FindingsViewerProgressive() {
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [digest, setDigest] = useState<SmartDigest | null>(null);
  const [loadingFindings, setLoadingFindings] = useState(false);
  // ... 22 more useState calls
}
```

**After** (using Zustand stores):
```typescript
function FindingsViewerProgressive() {
  // Hydration check
  const isHydrated = useStoreHydration();

  // Research data from store
  const {
    topics,
    selectedTopicId,
    getFindingsForTopic,
    getDigestForTopic,
    loadTopics,
    loadFindings,
    loadDigest,
    selectTopic
  } = useResearchStore();

  // UI state from store
  const {
    loading,
    setLoading,
    viewMode,
    sortBy,
    filterBy,
    modals,
    openModal,
    closeModal
  } = useUIStore();

  // App preferences
  const {
    digestTimeframe,
    explanationMode,
    autoGenerateDigest
  } = useAppStore();

  // Derived state (computed)
  const findings = selectedTopicId ? getFindingsForTopic(selectedTopicId) : [];
  const digest = selectedTopicId ? getDigestForTopic(selectedTopicId, digestTimeframe) : null;

  // Load data on mount
  useEffect(() => {
    if (!isHydrated) return;
    loadTopics();
  }, [isHydrated]);

  // Load topic data when selected
  useEffect(() => {
    if (!selectedTopicId || !isHydrated) return;

    const loadTopicData = async () => {
      setLoading('findings', true);
      await loadFindings(selectedTopicId);
      setLoading('findings', false);

      setLoading('digest', true);
      await loadDigest(selectedTopicId, digestTimeframe);
      setLoading('digest', false);
    };

    loadTopicData();
  }, [selectedTopicId, digestTimeframe, isHydrated]);

  // No more useState! All state in stores
}
```

#### 6. Extract Custom Hooks

**File**: `src/hooks/useFindings.ts`

```typescript
export function useFindings(topicId: string | null) {
  const { getFindingsForTopic, loadFindings } = useResearchStore();
  const { loading, setLoading } = useUIStore();
  const { filterBy, sortBy } = useUIStore();

  const findings = topicId ? getFindingsForTopic(topicId) : [];

  // Apply filters
  const filteredFindings = useMemo(() => {
    if (filterBy === 'all') return findings;
    return findings.filter(f => f.source.type === filterBy);
  }, [findings, filterBy]);

  // Apply sorting
  const sortedFindings = useMemo(() => {
    const sorted = [...filteredFindings];
    if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'relevance') {
      sorted.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    }
    return sorted;
  }, [filteredFindings, sortBy]);

  const refreshFindings = async () => {
    if (!topicId) return;
    setLoading('findings', true);
    await loadFindings(topicId);
    setLoading('findings', false);
  };

  return {
    findings: sortedFindings,
    isLoading: loading.findings,
    refreshFindings
  };
}
```

**File**: `src/hooks/useDigest.ts`

```typescript
export function useDigest(topicId: string | null) {
  const { getDigestForTopic, generateDigest } = useResearchStore();
  const { loading, setLoading, digestProgress, setDigestProgress } = useUIStore();
  const { digestTimeframe, autoGenerateDigest } = useAppStore();

  const digest = topicId ? getDigestForTopic(topicId, digestTimeframe) : null;

  const handleGenerateDigest = async () => {
    if (!topicId) return;

    setLoading('digest', true);
    setDigestProgress(0, 'Starting digest generation...');

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setDigestProgress(prev => Math.min(prev + 10, 90));
      }, 1000);

      await generateDigest(topicId, digestTimeframe);

      clearInterval(progressInterval);
      setDigestProgress(100, 'Digest complete!');

      setTimeout(() => {
        setDigestProgress(0, '');
      }, 2000);
    } finally {
      setLoading('digest', false);
    }
  };

  // Auto-generate if enabled and no digest exists
  useEffect(() => {
    if (topicId && autoGenerateDigest && !digest && !loading.digest) {
      handleGenerateDigest();
    }
  }, [topicId, autoGenerateDigest, digest]);

  return {
    digest,
    isLoading: loading.digest,
    progress: digestProgress,
    generateDigest: handleGenerateDigest
  };
}
```

### Day 5: Update All Components

#### 7. Components to Update

Update these components to use Zustand stores:

**Priority 1 - Main Components**:
- `FindingsViewerProgressive.tsx` → Use all 3 stores
- `Dashboard.tsx` → Use researchStore for topics
- `TopicSelector.tsx` → Use researchStore
- `DigestCard.tsx` → Use researchStore + uiStore
- `FindingCard.tsx` → Use researchStore + uiStore

**Priority 2 - Secondary Components**:
- `AgentMonitor.tsx` → Use researchStore for agents
- `ChatPanel.tsx` → Use researchStore for context
- `SourceDrawer.tsx` → Use uiStore for modal state
- `FindingDetailDrawer.tsx` → Use uiStore for modal state

**Priority 3 - Settings Components**:
- `SettingsPanel.tsx` → Use appStore
- `ThemeToggle.tsx` → Use appStore
- `UserMenu.tsx` → Use appStore

---

## Common Migration Patterns

### Pattern 1: Replace useState with Store

**Before**:
```typescript
const [data, setData] = useState<Type>(initial);
```

**After**:
```typescript
const data = useStore(state => state.data);
const setData = useStore(state => state.setData);
```

### Pattern 2: Replace useEffect Data Loading

**Before**:
```typescript
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    const result = await service.getData();
    setData(result);
    setLoading(false);
  };
  loadData();
}, [dependency]);
```

**After**:
```typescript
useEffect(() => {
  store.loadData(dependency);
}, [dependency]);
```

### Pattern 3: Replace Prop Drilling

**Before**:
```typescript
<Parent data={data}>
  <Child data={data}>
    <GrandChild data={data}>
      <GreatGrandChild data={data} />
    </GrandChild>
  </Child>
</Parent>
```

**After**:
```typescript
// In GreatGrandChild
const data = useStore(state => state.data);
// No props needed!
```

---

## Testing Checklist

After Phase 2, verify:

### State Persistence
- [ ] Navigate away and back - state persists
- [ ] Refresh browser - selection persists
- [ ] Close and reopen app - preferences persist

### No Race Conditions
- [ ] Fast navigation doesn't duplicate operations
- [ ] Multiple clicks don't cause issues
- [ ] Async operations complete properly

### Loading States
- [ ] Single source of loading truth
- [ ] No conflicting loading states
- [ ] Progress indicators accurate

### Performance
- [ ] No unnecessary re-renders
- [ ] Memoization working
- [ ] Store updates efficient

---

## Files to Delete

After migration, delete:
- Any component with "Enhanced" or old version suffix
- Unused store attempts (if any)
- Old context providers (if any)

---

## Success Criteria

Phase 2 is complete when:

1. ✅ All 27 useState calls removed from FindingsViewerProgressive
2. ✅ 3 Zustand stores fully implemented
3. ✅ State persists across navigation
4. ✅ No race conditions
5. ✅ All components using stores (no prop drilling)
6. ✅ Loading states consolidated
7. ✅ Auto-generation can be safely re-enabled

---

## Next Phase

Once Phase 2 is complete:
1. Update README.md status
2. Test auto-generation thoroughly
3. Commit with message: "Phase 2 Complete: State Management Migrated"
4. Move to Phase 3: Component Decomposition

---

**Remember**: This phase fixes the ROOT CAUSE of why auto-generation was disabled. Take time to get it right.