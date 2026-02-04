# Phase 3: Component Decomposition

**Duration**: Week 3 (February 18-24, 2026)
**Goal**: Break the 1,146-line mega-component into 10 focused components under 200 lines each

---

## The Problem

**FindingsViewerProgressive.tsx** is a 1,146-line monster containing:
- Data fetching logic
- Business rules
- UI rendering
- Event handling
- State management
- Progress tracking
- Error handling
- 10+ sub-components defined inline

This makes it:
- **Impossible to test** - Too many responsibilities
- **Hard to maintain** - Can't find specific logic
- **Prone to bugs** - Changes affect everything
- **Performance nightmare** - Everything re-renders

---

## The Solution

Break it into **10 focused components** with clear responsibilities:

```
ResearchPage (orchestrator, 150 lines)
├── ResearchContainer (data management, 180 lines)
│   ├── TopicSelector (topic operations, 120 lines)
│   ├── FindingsGrid (findings display, 150 lines)
│   └── DigestPanel (digest operations, 180 lines)
├── ResearchToolbar (controls, 100 lines)
└── ResearchDrawers (modals, 80 lines)
```

---

## New Component Structure

```
src/components/research/
├── ResearchPage.tsx               # Main page component
├── ResearchContainer.tsx          # Data orchestration
├── topic/
│   ├── TopicSelector.tsx         # Topic dropdown
│   ├── TopicActions.tsx          # Add/edit/delete
│   └── TopicBadge.tsx           # Topic display
├── findings/
│   ├── FindingsGrid.tsx          # Grid/list container
│   ├── FindingCard.tsx           # Individual card
│   ├── FindingActions.tsx        # Card actions
│   └── FindingsEmpty.tsx         # Empty state
├── digest/
│   ├── DigestPanel.tsx           # Digest container
│   ├── DigestContent.tsx         # Digest display
│   ├── DigestProgress.tsx        # Progress indicator
│   └── DigestActions.tsx         # Generate/export
├── toolbar/
│   ├── ResearchToolbar.tsx       # Main toolbar
│   ├── ViewToggle.tsx            # Grid/list toggle
│   ├── SortDropdown.tsx          # Sort options
│   └── FilterDropdown.tsx        # Filter options
└── drawers/
    ├── FindingDetailDrawer.tsx   # Finding details
    └── SourceDrawer.tsx          # Source viewer
```

---

## Step-by-Step Decomposition

### Day 1: Extract Pure UI Components

These components have NO state, only props:

#### 1. DigestProgress Component

**File**: `src/components/research/digest/DigestProgress.tsx`

```typescript
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface DigestProgressProps {
  progress: number;
  message: string;
}

export function DigestProgress({ progress, message }: DigestProgressProps) {
  return (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-3 mb-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-blue-900">
          Generating AI-Powered Insights
        </span>
      </div>
      <Progress value={progress} className="mb-2" />
      <p className="text-xs text-blue-700">{message}</p>
    </div>
  );
}
```

#### 2. FindingCard Component

**File**: `src/components/research/findings/FindingCard.tsx`

```typescript
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResearchFinding } from '@/types';
import { FindingActions } from './FindingActions';

interface FindingCardProps {
  finding: ResearchFinding;
  onClick: () => void;
  viewMode: 'grid' | 'list';
}

export function FindingCard({ finding, onClick, viewMode }: FindingCardProps) {
  const isGrid = viewMode === 'grid';

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-shadow ${
        isGrid ? '' : 'mb-2'
      }`}
      onClick={onClick}
    >
      <CardHeader className={isGrid ? 'pb-2' : 'pb-1'}>
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-sm line-clamp-2">
            {finding.title}
          </h3>
          <FindingActions finding={finding} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-600 line-clamp-3 mb-2">
          {finding.summary}
        </p>
        <div className="flex gap-2 items-center">
          <Badge variant="secondary" className="text-xs">
            {finding.source.type}
          </Badge>
          <span className="text-xs text-gray-500">
            {finding.source.displayName}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 3. ViewToggle Component

**File**: `src/components/research/toolbar/ViewToggle.tsx`

```typescript
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Grid3x3, List } from 'lucide-react';

interface ViewToggleProps {
  viewMode: 'grid' | 'list';
  onViewChange: (mode: 'grid' | 'list') => void;
}

export function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(value) => value && onViewChange(value as 'grid' | 'list')}
    >
      <ToggleGroupItem value="grid" aria-label="Grid view">
        <Grid3x3 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
```

### Day 2: Extract Container Components

These components connect to Zustand stores:

#### 4. TopicSelector Component

**File**: `src/components/research/topic/TopicSelector.tsx`

```typescript
import { useResearchStore } from '@/stores/researchStore';
import { useUIStore } from '@/stores/uiStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash } from 'lucide-react';
import { TopicActions } from './TopicActions';

export function TopicSelector() {
  const { topics, selectedTopicId, selectTopic } = useResearchStore();
  const { openModal } = useUIStore();

  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  return (
    <div className="flex gap-2 items-center">
      <Select value={selectedTopicId || ''} onValueChange={selectTopic}>
        <SelectTrigger className="w-[300px]">
          <SelectValue placeholder="Select a medical topic" />
        </SelectTrigger>
        <SelectContent>
          {topics.map(topic => (
            <SelectItem key={topic.id} value={topic.id}>
              {topic.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TopicActions topic={selectedTopic} />

      <Button
        variant="outline"
        size="icon"
        onClick={() => openModal('topicEdit')}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

#### 5. FindingsGrid Component

**File**: `src/components/research/findings/FindingsGrid.tsx`

```typescript
import { useFindings } from '@/hooks/useFindings';
import { useResearchStore } from '@/stores/researchStore';
import { useUIStore } from '@/stores/uiStore';
import { FindingCard } from './FindingCard';
import { FindingsEmpty } from './FindingsEmpty';
import { Skeleton } from '@/components/ui/skeleton';

export function FindingsGrid() {
  const { selectedTopicId } = useResearchStore();
  const { viewMode, openModal } = useUIStore();
  const { findings, isLoading } = useFindings(selectedTopicId);

  if (isLoading) {
    return (
      <div className={viewMode === 'grid' ?
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' :
        'space-y-2'
      }>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (findings.length === 0) {
    return <FindingsEmpty topicId={selectedTopicId} />;
  }

  return (
    <div className={viewMode === 'grid' ?
      'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' :
      'space-y-2'
    }>
      {findings.map(finding => (
        <FindingCard
          key={finding.id}
          finding={finding}
          viewMode={viewMode}
          onClick={() => {
            useResearchStore.getState().selectFinding(finding.id);
            openModal('findingDetail');
          }}
        />
      ))}
    </div>
  );
}
```

#### 6. DigestPanel Component

**File**: `src/components/research/digest/DigestPanel.tsx`

```typescript
import { useDigest } from '@/hooks/useDigest';
import { useResearchStore } from '@/stores/researchStore';
import { useUIStore } from '@/stores/uiStore';
import { DigestContent } from './DigestContent';
import { DigestProgress } from './DigestProgress';
import { DigestActions } from './DigestActions';
import { Card } from '@/components/ui/card';

export function DigestPanel() {
  const { selectedTopicId } = useResearchStore();
  const { digestProgress, digestMessage } = useUIStore();
  const { digest, isLoading, generateDigest } = useDigest(selectedTopicId);

  if (isLoading) {
    return (
      <DigestProgress
        progress={digestProgress}
        message={digestMessage}
      />
    );
  }

  if (!digest) {
    return (
      <Card className="p-6 text-center">
        <h3 className="text-lg font-semibold mb-2">
          No Digest Available
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Generate an AI-powered digest to get insights from your research findings.
        </p>
        <DigestActions
          onGenerate={generateDigest}
          canGenerate={!!selectedTopicId}
        />
      </Card>
    );
  }

  return (
    <Card>
      <DigestContent digest={digest} />
      <DigestActions
        onGenerate={generateDigest}
        onExport={() => {/* TODO */}}
        canGenerate={!!selectedTopicId}
        hasDigest={true}
      />
    </Card>
  );
}
```

### Day 3: Create the Main Orchestrator

#### 7. ResearchContainer Component

**File**: `src/components/research/ResearchContainer.tsx`

```typescript
import { useEffect } from 'react';
import { useStoreHydration } from '@/hooks/useStoreHydration';
import { useResearchStore } from '@/stores/researchStore';
import { useAppStore } from '@/stores/appStore';
import { TopicSelector } from './topic/TopicSelector';
import { FindingsGrid } from './findings/FindingsGrid';
import { DigestPanel } from './digest/DigestPanel';
import { ResearchToolbar } from './toolbar/ResearchToolbar';

export function ResearchContainer() {
  const isHydrated = useStoreHydration();
  const { selectedTopicId, loadTopics, loadFindings, loadDigest } = useResearchStore();
  const { digestTimeframe, autoGenerateDigest } = useAppStore();

  // Load topics on mount
  useEffect(() => {
    if (isHydrated) {
      loadTopics();
    }
  }, [isHydrated]);

  // Load topic data when selected
  useEffect(() => {
    if (!selectedTopicId || !isHydrated) return;

    const loadTopicData = async () => {
      await Promise.all([
        loadFindings(selectedTopicId),
        loadDigest(selectedTopicId, digestTimeframe)
      ]);
    };

    loadTopicData();
  }, [selectedTopicId, digestTimeframe, isHydrated]);

  if (!isHydrated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <TopicSelector />

      <ResearchToolbar />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FindingsGrid />
        </div>
        <div className="lg:col-span-1">
          <DigestPanel />
        </div>
      </div>
    </div>
  );
}
```

#### 8. ResearchPage Component

**File**: `src/components/research/ResearchPage.tsx`

```typescript
import { ResearchContainer } from './ResearchContainer';
import { FindingDetailDrawer } from './drawers/FindingDetailDrawer';
import { SourceDrawer } from './drawers/SourceDrawer';

export function ResearchPage() {
  return (
    <>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">
          Medical Research Companion
        </h1>
        <ResearchContainer />
      </div>

      {/* Drawers rendered at page level */}
      <FindingDetailDrawer />
      <SourceDrawer />
    </>
  );
}
```

### Day 4: Extract Business Logic

#### 9. Digest Orchestrator

**File**: `src/services/orchestrators/DigestOrchestrator.ts`

```typescript
import { useResearchStore } from '@/stores/researchStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppStore } from '@/stores/appStore';

export class DigestOrchestrator {
  async checkAndGenerateDigest(topicId: string): Promise<void> {
    const researchStore = useResearchStore.getState();
    const uiStore = useUIStore.getState();
    const appStore = useAppStore.getState();

    // Check conditions for auto-generation
    if (!appStore.autoGenerateDigest) {
      console.log('Auto-generation disabled');
      return;
    }

    const findings = researchStore.getFindingsForTopic(topicId);
    if (findings.length < 20) {
      console.log('Not enough findings for digest generation');
      return;
    }

    const existingDigest = researchStore.getDigestForTopic(
      topicId,
      appStore.digestTimeframe
    );

    if (existingDigest && this.isRecent(existingDigest)) {
      console.log('Recent digest already exists');
      return;
    }

    // Check if already generating
    if (uiStore.loading.digest) {
      console.log('Digest generation already in progress');
      return;
    }

    // Generate digest
    console.log('Auto-generating digest for topic:', topicId);
    await researchStore.generateDigest(topicId, appStore.digestTimeframe);
  }

  private isRecent(digest: any): boolean {
    const age = Date.now() - new Date(digest.createdAt).getTime();
    return age < 6 * 60 * 60 * 1000; // 6 hours
  }
}

export const digestOrchestrator = new DigestOrchestrator();
```

### Day 5: Delete the Mega-Component

#### 10. Files to Delete

**Primary Target**:
- `src/components/FindingsViewerProgressive.tsx` (1,146 lines)

**Also Delete These Unused Variants**:
- `src/components/FindingsViewer.tsx` (~400 lines)
- `src/components/FindingsViewerEnhanced.tsx` (~600 lines)

**Chat Component Cleanup**:
Delete all except the one actually used:
- `src/components/chat/ChatPanelDebug.tsx`
- `src/components/chat/ChatPanelLazy.tsx`
- `src/components/chat/ChatPanelMinimal.backup.tsx`

**Total Lines Deleted**: ~3,000 lines

---

## Component Guidelines

### Maximum Lines per Component

- **Page components**: 150 lines max
- **Container components**: 200 lines max
- **Display components**: 150 lines max
- **Control components**: 100 lines max
- **Pure UI components**: 80 lines max

### Responsibility Rules

1. **Page components**: Route handling, drawer management
2. **Container components**: Store connections, data orchestration
3. **Display components**: Rendering data, no business logic
4. **Control components**: User interactions, form handling
5. **Pure UI components**: Props only, no stores

### Import Organization

```typescript
// 1. React and hooks
import { useState, useEffect } from 'react';

// 2. Store imports
import { useResearchStore } from '@/stores/researchStore';

// 3. Custom hooks
import { useFindings } from '@/hooks/useFindings';

// 4. UI components
import { Card, CardContent } from '@/components/ui/card';

// 5. Local components
import { FindingCard } from './FindingCard';

// 6. Types
import type { ResearchFinding } from '@/types';

// 7. Utils and constants
import { cn } from '@/lib/utils';
```

---

## Update Import Paths

After decomposition, update all imports:

### In App.tsx or Router

**Before**:
```typescript
import { FindingsViewerProgressive } from '@/components/FindingsViewerProgressive';
```

**After**:
```typescript
import { ResearchPage } from '@/components/research/ResearchPage';
```

### In Other Components

Update any components that imported from the old mega-component:
- DigestCard imports
- FindingCard imports
- Any shared sub-components

---

## Testing Checklist

After Phase 3, verify:

### Component Structure
- [ ] No component over 200 lines
- [ ] Clear responsibility boundaries
- [ ] No business logic in display components

### Functionality
- [ ] All features still work
- [ ] No missing functionality
- [ ] Modals and drawers work

### Performance
- [ ] Reduced re-renders
- [ ] Faster initial load
- [ ] Smooth interactions

### Code Quality
- [ ] No circular dependencies
- [ ] Clean import structure
- [ ] TypeScript types correct

---

## Success Criteria

Phase 3 is complete when:

1. ✅ FindingsViewerProgressive deleted completely
2. ✅ 10 focused components created
3. ✅ No component over 200 lines
4. ✅ Clear separation of concerns
5. ✅ Business logic extracted to orchestrators
6. ✅ All unused component variants deleted
7. ✅ Clean component hierarchy established

---

## Next Phase

Once Phase 3 is complete:
1. Update README.md status
2. Run full test suite
3. Commit with message: "Phase 3 Complete: Components Decomposed"
4. Move to Phase 4: Storage Architecture

---

**Remember**: Smaller components are easier to test, maintain, and understand. When in doubt, split it further!