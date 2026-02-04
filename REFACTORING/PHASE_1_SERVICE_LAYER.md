# Phase 1: Service Layer Consolidation

**Duration**: Week 1 (February 4-10, 2026)
**Goal**: Reduce from 27 service files to 8 clean, single-responsibility services

---

## The Problem

Currently, we have **3 redundant layers** for every operation:
```
Component → service.ts → api.service.ts → api.ts → Backend
Component → service.ts → utils/db/*.ts → IndexedDB
```

This creates:
- Confusion about where to add features
- Inconsistent data flow
- Race conditions between paths
- Impossible to maintain

---

## The Solution

Create **ONE service per domain** with clear responsibilities:
```
Component → service.ts → Backend/Storage
```

---

## Step-by-Step Implementation

### Day 1-2: Create Storage Service Foundation

#### 1. Create Base Storage Service

**File**: `src/services/storage.service.ts`

```typescript
import { apiClient } from './api.client';
import { getDB } from '@/utils/db/database';

export class StorageService {
  constructor(private storeName: string) {}

  async get(id: string): Promise<any> {
    try {
      // Server first
      const { data } = await apiClient.get(`/${this.storeName}/${id}`);
      await this.cacheItem(data);
      return data;
    } catch (error) {
      // Fallback to cache if offline
      if (!navigator.onLine) {
        return await this.getCached(id);
      }
      throw error;
    }
  }

  async getAll(filter?: any): Promise<any[]> {
    try {
      const { data } = await apiClient.get(`/${this.storeName}`, { params: filter });
      await this.cacheAll(data);
      return data;
    } catch (error) {
      if (!navigator.onLine) {
        return await this.getAllCached(filter);
      }
      throw error;
    }
  }

  async create(item: any): Promise<any> {
    const { data } = await apiClient.post(`/${this.storeName}`, item);
    await this.cacheItem(data);
    return data;
  }

  async update(id: string, updates: any): Promise<any> {
    const { data } = await apiClient.put(`/${this.storeName}/${id}`, updates);
    await this.cacheItem(data);
    return data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/${this.storeName}/${id}`);
    await this.removeCached(id);
  }

  // Cache management
  private async cacheItem(item: any): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    await tx.objectStore(this.storeName).put({
      ...item,
      _cachedAt: Date.now()
    });
  }

  private async getCached(id: string): Promise<any> {
    const db = await getDB();
    return await db.get(this.storeName, id);
  }
}
```

### Day 3-4: Consolidate Each Service

#### 2. Consolidate Findings Service

**Current Files to Merge**:
- `src/services/findings.service.ts` (192 lines)
- `src/services/findings.api.service.ts` (330 lines)
- `src/utils/db/findings.ts` (45 lines)

**New File**: `src/services/findings.service.ts`

```typescript
import { StorageService } from './storage.service';
import { ResearchFinding } from '@/types';

class FindingsService {
  private storage = new StorageService('findings');

  async getFindings(topicId?: string, limit: number = 100): Promise<ResearchFinding[]> {
    return await this.storage.getAll({ topicId, limit });
  }

  async createFinding(finding: Partial<ResearchFinding>): Promise<ResearchFinding> {
    return await this.storage.create(finding);
  }

  async updateFinding(id: string, updates: Partial<ResearchFinding>): Promise<ResearchFinding> {
    return await this.storage.update(id, updates);
  }

  async deleteFinding(id: string): Promise<void> {
    return await this.storage.delete(id);
  }

  async deleteByTopic(topicId: string): Promise<void> {
    const findings = await this.getFindings(topicId);
    await Promise.all(findings.map(f => this.deleteFinding(f.id)));
  }
}

export const findingsService = new FindingsService();
```

**Delete These Files**:
- `src/services/findings.api.service.ts`
- `src/utils/db/findings.ts`

#### 3. Consolidate Digest Service

**Current Files to Merge**:
- `src/services/digest.service.ts` (minimal)
- `src/services/digestQueue.service.ts` (800+ lines)
- `src/services/digestCache.service.ts` (200+ lines)
- `src/services/digests.api.service.ts` (150 lines)

**New File**: `src/services/digest.service.ts`

```typescript
import { StorageService } from './storage.service';
import { SmartDigest, DigestQueueItem } from '@/types';
import { apiClient } from './api.client';

class DigestService {
  private storage = new StorageService('digests');
  private queue = new Map<string, DigestQueueItem>();

  async getDigest(topicId: string, timeframe: string = 'all'): Promise<SmartDigest | null> {
    // Check cache first
    const cached = await this.storage.getAll({ topicId, timeframe });
    if (cached.length > 0 && this.isRecent(cached[0])) {
      return cached[0];
    }
    return null;
  }

  async generateDigest(topicId: string, timeframe: string = 'all'): Promise<SmartDigest> {
    // Check if already generating
    const queueKey = `${topicId}-${timeframe}`;
    if (this.queue.has(queueKey)) {
      return await this.waitForQueue(queueKey);
    }

    // Check for existing digest FIRST (fix backwards deduplication)
    const existing = await this.getDigest(topicId, timeframe);
    if (existing) {
      return existing;
    }

    // Generate new digest
    const queueItem: DigestQueueItem = {
      id: crypto.randomUUID(),
      topicId,
      timeframe,
      status: 'processing',
      createdAt: new Date()
    };

    this.queue.set(queueKey, queueItem);

    try {
      const { data } = await apiClient.post('/digest/generate', {
        topicId,
        timeframe
      });

      await this.storage.create(data);
      this.queue.delete(queueKey);
      return data;
    } catch (error) {
      this.queue.delete(queueKey);
      throw error;
    }
  }

  private isRecent(digest: SmartDigest): boolean {
    const age = Date.now() - new Date(digest.createdAt).getTime();
    return age < 6 * 60 * 60 * 1000; // 6 hours
  }

  private async waitForQueue(key: string): Promise<SmartDigest> {
    // Wait for existing generation to complete
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        if (!this.queue.has(key)) {
          clearInterval(checkInterval);
          const [topicId, timeframe] = key.split('-');
          const digest = await this.getDigest(topicId, timeframe);
          if (digest) {
            resolve(digest);
          } else {
            reject(new Error('Digest generation failed'));
          }
        }
      }, 1000);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Digest generation timeout'));
      }, 120000);
    });
  }
}

export const digestService = new DigestService();
```

**Delete These Files**:
- `src/services/digestQueue.service.ts`
- `src/services/digestCache.service.ts`
- `src/services/digests.api.service.ts`

#### 4. Consolidate Agent Service

**Current Files to Merge**:
- `src/services/agents.service.ts` (150 lines)
- `src/services/agents.api.service.ts` (200 lines)
- `src/services/agentService.ts` (old version, 100 lines)
- `src/components/agents/agentRunner.ts` (400 lines)
- `src/utils/db/agents.ts` (80 lines)

**New File**: `src/services/agents.service.ts`

```typescript
import { StorageService } from './storage.service';
import { Agent, Topic, ResearchFinding } from '@/types';
import { apiClient } from './api.client';

class AgentsService {
  private storage = new StorageService('agents');

  async getAgents(topicId?: string): Promise<Agent[]> {
    return await this.storage.getAll({ topicId });
  }

  async runAgent(agent: Agent, topic: Topic): Promise<ResearchFinding[]> {
    const { data } = await apiClient.post(`/agents/${agent.id}/run`, {
      topic: topic.name,
      description: topic.description
    });

    // Update agent status
    await this.storage.update(agent.id, {
      lastRun: new Date(),
      status: 'completed',
      findingsCount: data.findings.length
    });

    return data.findings;
  }

  async runAllAgents(topicId: string): Promise<ResearchFinding[]> {
    const agents = await this.getAgents(topicId);
    const topic = await topicsService.getTopic(topicId);

    // Run in parallel
    const results = await Promise.allSettled(
      agents.map(agent => this.runAgent(agent, topic))
    );

    // Collect all findings
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<ResearchFinding[]>).value);
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    return await this.storage.update(id, updates);
  }
}

export const agentsService = new AgentsService();
```

**Delete These Files**:
- `src/services/agents.api.service.ts`
- `src/services/agentService.ts`
- `src/components/agents/agentRunner.ts` (move logic to service)
- `src/utils/db/agents.ts`

### Day 5: Clean Up Remaining Services

#### 5. Services to Simply Update

These services are already clean, just remove any api.service references:

- `auth.service.ts` - Keep as is
- `topics.service.ts` - Remove topics.api.service.ts
- `chat.service.ts` - Remove chat.api.service.ts

#### 6. Services to Delete Completely

These are unused or deprecated:

**Delete**:
- `analytics.service.ts` - Deprecated feature
- `timeline.service.ts` - Not used
- `timeline.api.service.ts` - Not used
- `conversations.service.ts` - Merged into chat
- `conversations.api.service.ts` - Merged into chat
- `audioCompression.service.ts` - Not needed
- `chunkedRecording.service.ts` - Not needed
- `audio.api.service.ts` - Keep only audio.service.ts

---

## Files to Delete (Complete List)

### Service Files (19 files)
```
src/services/
  ├── findings.api.service.ts (330 lines)
  ├── agents.api.service.ts (200 lines)
  ├── agentService.ts (100 lines)
  ├── digests.api.service.ts (150 lines)
  ├── digestQueue.service.ts (800 lines)
  ├── digestCache.service.ts (200 lines)
  ├── topics.api.service.ts (180 lines)
  ├── chat.api.service.ts (250 lines)
  ├── conversations.service.ts (150 lines)
  ├── conversations.api.service.ts (200 lines)
  ├── timeline.service.ts (120 lines)
  ├── timeline.api.service.ts (150 lines)
  ├── analytics.service.ts (300 lines)
  ├── audioCompression.service.ts (80 lines)
  ├── chunkedRecording.service.ts (120 lines)
  └── audio.api.service.ts (100 lines)
```

### Utils/DB Files (8 files)
```
src/utils/db/
  ├── findings.ts (45 lines)
  ├── agents.ts (80 lines)
  ├── topics.ts (60 lines)
  ├── timeline.ts (50 lines)
  ├── conversations.ts (70 lines)
  ├── digests.ts (40 lines)
  ├── cleanup.ts (unused, 100 lines)
  └── migration.ts (unused, 150 lines)
```

### Component Files (1 file)
```
src/components/agents/
  └── agentRunner.ts (400 lines) - Logic moved to agents.service.ts
```

**Total Lines to Delete**: ~4,000 lines

---

## Testing Checklist

After completing Phase 1, verify:

### Functionality Tests
- [ ] Create a new topic
- [ ] Run agents on the topic
- [ ] Findings are saved correctly
- [ ] Digest generation works
- [ ] Chat functionality works
- [ ] Authentication still works

### Code Quality Tests
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All imports resolved
- [ ] No circular dependencies
- [ ] Services follow single pattern

### Performance Tests
- [ ] API calls work online
- [ ] Offline fallback works
- [ ] No duplicate API calls
- [ ] Response times acceptable

---

## Common Pitfalls to Avoid

1. **Don't keep "backup" code** - Delete it completely
2. **Don't create new abstractions** - Use the StorageService pattern
3. **Don't mix patterns** - All services must follow same structure
4. **Don't skip testing** - Each service must work before moving on
5. **Don't optimize early** - Get it working first

---

## Update Component Imports

After consolidating services, update ALL component imports:

### Before:
```typescript
import { findingsService } from '@/services/findings.service';
import { findingsAPIService } from '@/services/findings.api.service';
import { saveFinding } from '@/utils/db/findings';
```

### After:
```typescript
import { findingsService } from '@/services/findings.service';
```

---

## Success Criteria

Phase 1 is complete when:

1. ✅ Only 8 service files remain in src/services/
2. ✅ All api.service.ts files deleted
3. ✅ All utils/db/*.ts files deleted (except database.ts)
4. ✅ agentRunner.ts logic moved to agents.service.ts
5. ✅ All tests passing
6. ✅ No console errors
7. ✅ All components using new service imports

---

## Next Phase

Once Phase 1 is complete:
1. Update README.md status
2. Commit all changes with message: "Phase 1 Complete: Service Layer Consolidated"
3. Move to Phase 2: State Management Migration

---

**Remember**: DELETE aggressively. When in doubt, remove it. We're building a clean foundation.