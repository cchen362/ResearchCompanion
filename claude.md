# Medical Companion PWA - Development Guide

## Project Overview

The Medical Companion PWA is a research-focused medical information companion that helps users explore, understand, and track medical conditions through AI-powered research agents, smart digests, and conversational interfaces. This document captures architectural decisions, development best practices, and implementation guidelines established during the project's evolution.

## Core Architecture Principles

### 1. Hybrid Storage Architecture
- **Server Storage**: PostgreSQL for persistent, multi-device data
- **Local Storage**: IndexedDB for offline caching and performance
- **Sync Strategy**: Automatic sync between server and local storage
- **Privacy by Design**: All sensitive data encrypted, HIPAA-compliant architecture
- **Offline Capability**: Full functionality without network via IndexedDB cache

### 2. Progressive Web App (PWA)
- **Installable**: Works as standalone app on all platforms
- **Service Worker**: Background agent execution and offline support
- **Push Notifications**: For research updates and reminders
- **Responsive Design**: Mobile-first with desktop optimization

### 3. AI-Powered Intelligence
- **Primary AI**: Anthropic Claude Sonnet 4.5 for reasoning and analysis
- **Transcription**: OpenAI Whisper for voice-to-text
- **Structured Output**: Zod schema validation for AI responses
- **Fallback Mechanisms**: Graceful degradation if AI services unavailable

### 4. Facts, Not Scores™ Principle
- **No Arbitrary Metrics**: System displays only factual, verifiable information
- **No Mock Data**: Only real medical research from trusted sources
- **Transparent Attribution**: Every piece of information clearly attributed to its source
- **Factual Metadata Only**: Study type, participant count, publication date - never invented scores
- **Trust Through Transparency**: Users can verify every claim through source links

### 5. Data Persistence Strategy
- **PostgreSQL Primary Storage**: All user data, findings, digests, and preferences stored in PostgreSQL
- **Multi-Device Sync**: Automatic synchronization across devices via user sessions
- **IndexedDB Cache**: Local cache for offline access and performance
- **Dual-Mode Operation**:
  - Server mode: PostgreSQL + IndexedDB cache
  - Offline mode: IndexedDB only (with sync on reconnection)
- **Migration Support**: Seamless migration from IndexedDB-only to PostgreSQL

## Technology Stack

### Frontend
- **Framework**: React 19.2.0 with TypeScript 5.9.3
- **Build Tool**: Vite 7.2.4 (fast HMR, optimized builds)
- **State Management**: Zustand 5.0.9 (installed, ready for activation)
- **Local Database**: IndexedDB via idb 8.0.3 (offline cache)
- **Styling**: Tailwind CSS with Radix UI components
- **API Client**: Axios with request/response interceptors

### Backend
- **Runtime**: Node.js with Express 4.19.2
- **Language**: TypeScript with strict mode
- **Database**:
  - PostgreSQL 15 (primary persistent storage)
  - SQLite 3 (legacy fallback)
  - Connection pooling via pg library
- **Authentication**:
  - JWT tokens with 30-day expiry
  - bcrypt for password hashing
  - Multi-device session management
- **AI Services**:
  - Anthropic SDK 0.71.2
  - OpenAI SDK 6.15.0
- **Medical Data Sources**:
  - PubMed API for peer-reviewed research
  - ClinicalTrials.gov API for active trials
  - FDA API for drug approvals and announcements
  - Brave Search API for supplementary web research
- **Validation**: Zod 4.3.5 for runtime type safety
- **API Design**: RESTful with structured error handling

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Database**: PostgreSQL 15 Alpine in Docker
- **Web Server**: Nginx for static assets
- **Process Management**: PM2 for Node.js

### Development Tools
- **Package Manager**: npm (lockfile v3)
- **Linting**: ESLint with TypeScript rules
- **Type Checking**: TypeScript strict mode
- **Testing**: Vitest (to be implemented)
- **Database Migrations**: SQL init scripts

## Development Best Practices

### 1. Holistic Change Management

**Principle**: Every change must consider its impact across the entire system.

**Implementation**:
```typescript
// Before making changes, verify:
// 1. Database schema alignment
// 2. Type definitions consistency
// 3. Service layer compatibility
// 4. UI component contracts
// 5. Backend API contracts

// Example: Adding a new field to Finding
// ❌ BAD: Only update the type definition
// ✅ GOOD: Update type, database schema, API validation, UI display, and export formats
```

**Checklist for Changes**:
- [ ] Update TypeScript interfaces in `src/types/index.ts`
- [ ] Modify database schema if needed
- [ ] Update Zod schemas in backend
- [ ] Adjust UI components consuming the data
- [ ] Update API endpoints handling the data
- [ ] Verify data export/import functionality
- [ ] Test agent system compatibility

### 2. No Band-Aid Fixes

**Principle**: Address root causes, not symptoms. Avoid quick fixes that create technical debt.

**Anti-Patterns to Avoid**:
```typescript
// ❌ BAD: Catching and suppressing errors
try {
  someOperation();
} catch (e) {
  // Ignore error and continue
}

// ✅ GOOD: Proper error handling with recovery
try {
  someOperation();
} catch (error) {
  logger.error('Operation failed:', error);
  // Implement fallback behavior
  return fallbackOperation();
}
```

**When You Find a Bug**:
1. Identify the root cause, not just the symptom
2. Check if similar issues exist elsewhere
3. Fix the pattern, not just the instance
4. Add tests to prevent regression
5. Document the fix in comments if non-obvious

### 3. Component Alignment

**Principle**: Maintain consistency across all layers of the application.

**Data Flow Alignment**:
```
Database Schema → TypeScript Types → Service Layer → API Contract → UI Components
```

**Example Implementation**:
```typescript
// 1. Database Schema (src/utils/db/database.ts)
const FINDINGS_STORE = 'findings';

// 2. Type Definition (src/types/index.ts)
interface Finding {
  id: string;
  source: FindingSource;
  content: string;
  // ... aligned across all layers
}

// 3. Service Layer (src/services/findings.service.ts)
async function getFinding(id: string): Promise<Finding> {
  // Uses same Finding type
}

// 4. API Contract (backend/src/routes/findings.routes.ts)
const FindingSchema = z.object({
  // Matches Finding interface
});

// 5. UI Component (src/components/FindingCard.tsx)
interface Props {
  finding: Finding; // Same type throughout
}
```

### 4. State Management Strategy

**Current State**: Component-level state with prop drilling

**Future State** (Phase 2): Zustand for global state

**Guidelines**:
```typescript
// Store Organization (when implementing Zustand)
// src/stores/
//   ├── chatStore.ts      - Conversation state
//   ├── findingsStore.ts  - Research findings cache
//   ├── uiStore.ts        - UI preferences
//   └── userStore.ts      - User preferences

// Example Store Structure
interface ChatStore {
  messages: ChatMessage[];
  context: ConversationContext;
  addMessage: (message: ChatMessage) => void;
  updateContext: (context: Partial<ConversationContext>) => void;
}
```

### 5. Error Handling Philosophy

**Principle**: Fail gracefully with user-friendly feedback.

```typescript
// Service Layer Pattern
class FindingsService {
  async searchFindings(query: string): Promise<Result<Finding[], AppError>> {
    try {
      const results = await this.performSearch(query);
      return { success: true, data: results };
    } catch (error) {
      logger.error('Search failed:', error);
      return {
        success: false,
        error: new AppError(
          'SEARCH_FAILED',
          'Unable to search findings. Please try again.',
          error
        )
      };
    }
  }
}

// UI Layer Pattern
function FindingsSearch() {
  const handleSearch = async (query: string) => {
    setLoading(true);
    const result = await findingsService.searchFindings(query);

    if (!result.success) {
      showToast({
        type: 'error',
        message: result.error.userMessage,
        action: { label: 'Retry', handler: () => handleSearch(query) }
      });
      return;
    }

    setFindings(result.data);
  };
}
```

### 6. Database Design Patterns

**PostgreSQL Best Practices**:

```typescript
// Transaction management with PostgreSQL
async function updateFindingAndTimeline(finding: Finding, event: TimelineEvent) {
  return await db.transaction(async (client) => {
    // All queries in this function run in a single transaction
    await client.query(
      'INSERT INTO findings (id, topic_id, content, source) VALUES ($1, $2, $3, $4)',
      [finding.id, finding.topicId, finding.content, finding.source]
    );

    await client.query(
      'INSERT INTO timeline_events (id, user_id, event_type, data) VALUES ($1, $2, $3, $4)',
      [event.id, event.userId, event.eventType, JSON.stringify(event.data)]
    );

    return { finding, event };
  });
}

// Connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// JSONB for flexible data
CREATE TABLE findings (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  source JSONB NOT NULL, -- Flexible source metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**IndexedDB Cache Strategy**:

```typescript
// Sync between PostgreSQL and IndexedDB
class StorageService {
  async syncToLocal(findings: Finding[]) {
    const tx = db.transaction(['findings'], 'readwrite');
    const store = tx.objectStore('findings');

    // Clear old data and insert fresh from server
    await store.clear();
    for (const finding of findings) {
      await store.add(finding);
    }
    await tx.done;
  }

  async getWithFallback(id: string): Promise<Finding> {
    // Try server first
    try {
      const serverData = await api.get(`/findings/${id}`);
      await this.cacheLocally(serverData);
      return serverData;
    } catch (error) {
      // Fall back to local cache
      return await db.get('findings', id);
    }
  }
}
```

### 7. AI Integration Patterns

**Structured AI Responses**:

```typescript
// Always define Zod schemas for AI responses
const DigestSchema = z.object({
  executiveSummary: z.string(),
  themes: z.array(ThemeSchema),
  contradictions: z.array(ContradictionSchema),
  breakthroughs: z.array(BreakthroughSchema),
  knowledgeGaps: z.array(z.string()),
  nextSteps: z.array(z.string())
});

// Validate AI responses
async function generateDigest(findings: Finding[]): Promise<Digest> {
  const response = await ai.complete({
    messages: [/* ... */],
    response_format: { type: 'json_object' }
  });

  // Parse and validate
  const result = DigestSchema.safeParse(JSON.parse(response.content));

  if (!result.success) {
    // Fallback to simpler prompt or retry
    return generateSimpleDigest(findings);
  }

  return result.data;
}
```

### 8. Performance Optimization

**Key Strategies**:

```typescript
// 1. Lazy Loading
const FindingsViewer = lazy(() => import('./components/FindingsViewer'));

// 2. Memoization for Expensive Computations
const processedFindings = useMemo(() => {
  return findings.map(f => processComplexFinding(f));
}, [findings]);

// 3. Virtual Scrolling for Long Lists
import { VirtualList } from '@tanstack/react-virtual';

// 4. Debouncing User Input
const debouncedSearch = useMemo(
  () => debounce(performSearch, 300),
  []
);

// 5. IndexedDB Query Optimization
// Use indexes and limit results
const recentFindings = await db
  .transaction('findings')
  .objectStore('findings')
  .index('date')
  .openCursor(null, 'prev')
  .take(20);
```

## Component Development Guidelines

### 1. Component Structure

```typescript
// src/components/ExampleComponent.tsx

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/utils/cn';
import type { ComponentProps } from '@/types';

interface ExampleComponentProps {
  // Props interface - explicit and typed
  data: SomeDataType;
  onAction: (id: string) => void;
  className?: string;
}

export function ExampleComponent({
  data,
  onAction,
  className
}: ExampleComponentProps) {
  // State declarations
  const [localState, setLocalState] = useState(false);

  // Computed values
  const computedValue = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);

  // Effects
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, [/* deps */]);

  // Event handlers
  const handleClick = (id: string) => {
    onAction(id);
  };

  // Render
  return (
    <div className={cn('base-styles', className)}>
      {/* Component JSX */}
    </div>
  );
}
```

### 2. Service Layer Pattern

```typescript
// src/services/example.service.ts

class ExampleService {
  private cache = new Map<string, CachedItem>();

  async fetchData(id: string): Promise<Result<Data>> {
    // Check cache first
    if (this.cache.has(id)) {
      return { success: true, data: this.cache.get(id)!.data };
    }

    try {
      // API call
      const response = await api.get(`/endpoint/${id}`);

      // Validate response
      const validated = DataSchema.parse(response.data);

      // Cache result
      this.cache.set(id, {
        data: validated,
        timestamp: Date.now()
      });

      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error)
      };
    }
  }

  private handleError(error: unknown): AppError {
    // Centralized error handling
  }
}

export const exampleService = new ExampleService();
```

## Testing Requirements

### Unit Testing Strategy

```typescript
// Component Testing (example.test.tsx)
import { render, screen, fireEvent } from '@testing-library/react';
import { ExampleComponent } from './ExampleComponent';

describe('ExampleComponent', () => {
  it('renders data correctly', () => {
    const mockData = { /* ... */ };
    render(<ExampleComponent data={mockData} onAction={jest.fn()} />);

    expect(screen.getByText(mockData.title)).toBeInTheDocument();
  });

  it('calls onAction when clicked', () => {
    const onAction = jest.fn();
    render(<ExampleComponent data={mockData} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalledWith(mockData.id);
  });
});
```

### Integration Testing

```typescript
// Service Testing (example.service.test.ts)
describe('ExampleService', () => {
  it('fetches and caches data', async () => {
    const result = await exampleService.fetchData('123');

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      id: '123',
      // ... expected shape
    });

    // Verify caching
    const cached = await exampleService.fetchData('123');
    expect(cached).toBe(result); // Same reference
  });
});
```

## Security Considerations

### 1. Data Encryption (Future Implementation)

```typescript
// src/utils/crypto/encryption.ts
class EncryptionService {
  async encrypt(data: string, key: CryptoKey): Promise<EncryptedData> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    return {
      data: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv)
    };
  }
}
```

### 2. API Security

```typescript
// Never expose API keys in frontend
// ❌ BAD
const API_KEY = 'sk-abc123';

// ✅ GOOD - Use backend proxy
async function callAI(prompt: string) {
  return api.post('/api/ai/complete', { prompt });
  // Backend handles API key securely
}
```

### 3. Database Security

```typescript
// PostgreSQL Security Best Practices

// Always use parameterized queries
// ❌ BAD - SQL injection vulnerable
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);

// Connection string security
// Store in environment variables, never in code
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true
  } : false
});

// Row-level security for multi-tenant data
CREATE POLICY user_data_policy ON findings
  FOR ALL
  USING (user_id = current_user_id());
```

### 4. Authentication & Sessions

```typescript
// JWT token management
interface SessionToken {
  userId: string;
  deviceId: string;
  exp: number;
  iat: number;
}

// Secure password hashing
import bcrypt from 'bcrypt';
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

// Session validation middleware
async function validateSession(req: Request) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new UnauthorizedError();

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const session = await db.queryOne(
    'SELECT * FROM user_sessions WHERE token_id = $1 AND expires_at > NOW()',
    [decoded.jti]
  );

  if (!session) throw new SessionExpiredError();
  return decoded;
}
```

### 5. Input Validation

```typescript
// Always validate user input
const SearchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    dateRange: z.tuple([z.date(), z.date()]).optional(),
    sources: z.array(z.enum(['pubmed', 'clinical', 'web'])).optional()
  }).optional()
});
```

## Phase 2 & 3 Implementation Guide

### Phase 2: Conversational Interface

**Key Components to Build**:
1. `ConversationContextManager` - Tracks interaction context
2. `ChatService` - Manages chat operations
3. `ConversationalPanel` - UI for chat interface
4. Streaming response handler

**Integration Points**:
- Track user clicks/expansions in findings viewer
- Link chat citations to specific findings
- Accumulate context from user interactions

### Phase 3A: Research Insights Dashboard

**Export Formats**:
- PDF reports via jspdf
- CSV/Excel via xlsx
- JSON export for research data

**Research Insights Features**:
- Research progress tracking (findings over time)
- Source diversity analysis (journals, trials, web)
- Finding pattern detection
- Knowledge gap identification
- Smart Digest integration

**Note**: Analytics was pivoted from health tracking to research insights to align with actual data collected (research findings) rather than timeline events (which users don't create).

### Phase 3B: Advanced Research Analytics (Future)

**Planned Features**:
- Research velocity metrics
- Topic exploration depth
- Agent performance analytics
- Collaborative research tools
- Integration with medical databases

**Note**: Knowledge Graph was deprecated due to:
- Reliance on deprecated scoring metrics
- High maintenance burden
- Violation of "Facts, Not Scores™" principle
- Limited value beyond existing insights

## Common Pitfalls to Avoid

### 1. State Synchronization Issues

```typescript
// ❌ BAD: Multiple sources of truth
const [findings, setFindings] = useState([]);
const [cachedFindings, setCachedFindings] = useState([]);

// ✅ GOOD: Single source of truth
const findings = useFindingsStore(state => state.findings);
```

### 2. Memory Leaks

```typescript
// ❌ BAD: Forgetting cleanup
useEffect(() => {
  const timer = setInterval(fetchData, 5000);
  // Missing cleanup!
}, []);

// ✅ GOOD: Proper cleanup
useEffect(() => {
  const timer = setInterval(fetchData, 5000);
  return () => clearInterval(timer);
}, []);
```

### 3. Race Conditions

```typescript
// ❌ BAD: Not handling concurrent requests
const handleSearch = async (query) => {
  const results = await search(query);
  setResults(results); // May set outdated results
};

// ✅ GOOD: Cancel previous requests
const handleSearch = useCallback(async (query) => {
  const abortController = new AbortController();

  try {
    const results = await search(query, { signal: abortController.signal });
    setResults(results);
  } catch (error) {
    if (error.name !== 'AbortError') {
      handleError(error);
    }
  }

  return () => abortController.abort();
}, []);
```

## Critical Debugging Lessons Learned

### The "Unknown Source" Investigation (January 2025)

**Problem**: Clinical trial findings showed "Unknown Source" while treatment findings displayed correctly.

**Root Cause**: Frontend was destroying backend's complete data structure.

#### What Went Wrong

```typescript
// ❌ BAD: agentRunner.ts was destroying the backend's source object
const finding = {
  source: {
    name: sourceName,      // Only preserved 4 fields
    url: sourceUrl,
    type: determineSourceType(result),
    publishDate: result.publishedAt
  }
  // Lost: displayName, journal, and other backend fields!
}
```

#### The Fix

```typescript
// ✅ GOOD: Preserve the complete backend object
const finding = {
  source: result.source ? {
    ...result.source,  // Keep ALL backend fields
    // Only override if missing:
    name: result.source.name || fallbackName,
    displayName: result.source.displayName || result.source.name || fallbackName
  } : {
    // Fallback construction only if no source provided
  }
}
```

#### Key Lessons

1. **Don't Destroy Data Structures**: When receiving objects from backend, preserve them completely using spread operator
2. **Trace the Complete Data Flow**: Check what backend sends vs what frontend receives vs what gets stored
3. **Avoid Band-Aid Fixes**: Don't mask symptoms (like defaulting to "Research Database") - fix the root cause
4. **Check for Type-Specific Bugs**: If one type works but another doesn't, compare their data flow paths
5. **Use Debug Logging**: Add `console.log` at critical points to see actual data structure

### The Voice Recording Fix Investigation (January 2025)

**Problem**: Voice recordings disappeared when navigating away, despite successful processing.

**Root Cause**: Service worker had hardcoded DB version 1 while main app used version 4.

#### Critical Discovery - "Works in Incognito"
When the app worked in incognito mode but not regular browser, this immediately indicated:
- Service worker cache issues
- IndexedDB version mismatches
- Browser cache conflicts

#### The Version Mismatch

```javascript
// ❌ BAD: Service worker hardcoded to old version
// public/sw.js
const dbRequest = indexedDB.open('MedCompanionDB', 1); // Hardcoded!

// src/utils/db/database.ts
const DB_VERSION = 4; // Main app at version 4

// Result: VersionError when service worker tries to open DB
```

#### The Solution

1. **Centralized Version Management** ([src/utils/db/version.ts](src/utils/db/version.ts)):
```typescript
export const DB_VERSION = 4;
export const CACHE_VERSION = 'v4';
export const DB_NAME = 'MedCompanionDB';
```

2. **Updated Service Worker** to use correct version
3. **Added Auto-Update PWA Configuration**
4. **Created Cache Clear Utility** ([public/clear-cache.html](public/clear-cache.html))

#### Key Lesson: PWA Version Management Protocol

**CRITICAL**: When updating DB_VERSION, you MUST update ALL of these:
1. `src/utils/db/version.ts` - Central version file
2. `public/sw.js` - indexedDB.open() version parameter
3. `public/sw.js` - CACHE_NAME version suffix
4. Clear browser caches after deployment
5. Document version change in VERSION_HISTORY

**Warning Signs of Version Issues**:
- App works in incognito but not regular browser
- Data disappears on navigation
- `VersionError` in console
- Features work initially then break

For detailed case study, see [docs/VOICE-RECORDING-FIX-CASE-STUDY.md](docs/VOICE-RECORDING-FIX-CASE-STUDY.md)

### Debugging Best Practices

#### 1. Systematic Investigation

```typescript
// Add debug logging at each transformation point
console.log('1. Backend sends:', response.data);
console.log('2. Frontend receives:', searchResults);
console.log('3. Frontend transforms:', finding);
console.log('4. Stored in DB:', storedFinding);
console.log('5. UI displays:', displayedFinding);
```

#### 2. Check Build Artifacts

```bash
# Always verify TypeScript compilation is current
ls -la backend/dist/routes/*.js
# Compare timestamps with source files
ls -la backend/src/routes/*.ts

# If stale, rebuild:
cd backend && npm run build
```

#### 3. Clear Test Data

```javascript
// Clear IndexedDB when testing fixes
await indexedDB.deleteDatabase('MedicalCompanionDB');
console.log('✅ Database cleared!');
location.reload();
```

#### 4. Identify Active vs Dead Code

Before fixing, verify which code path is actually executing:
- Check component imports (`import { service } from ...`)
- Add console.log to confirm execution
- Search for all references to ensure it's used

#### 5. Compare Working vs Broken Features

If treatments work but trials don't:
1. Compare their data structures at each point
2. Look for type-specific handling
3. Check for missing fields or different processing

## Performance Monitoring

### Key Metrics to Track

```typescript
// src/utils/monitoring.ts
class PerformanceMonitor {
  trackAPICall(endpoint: string, duration: number) {
    // Log to analytics
  }

  trackRenderTime(component: string, duration: number) {
    // Monitor component performance
  }

  trackDatabaseOperation(operation: string, duration: number) {
    // Track IndexedDB performance
  }
}
```

## Deployment Checklist

### Before Each Deployment

- [ ] Run TypeScript type checking: `npm run type-check`
- [ ] Test service worker updates
- [ ] Verify IndexedDB migrations
- [ ] Check API backward compatibility
- [ ] Test offline functionality
- [ ] Validate AI response schemas
- [ ] Review security headers
- [ ] Test PWA installation
- [ ] Verify responsive design
- [ ] Check accessibility (ARIA labels, keyboard navigation)

## Maintenance Guidelines

### Regular Tasks

1. **Weekly**:
   - Review error logs
   - Check API rate limits
   - Monitor storage usage

2. **Monthly**:
   - Update dependencies (security patches)
   - Review AI model performance
   - Analyze user feedback

3. **Quarterly**:
   - Performance audit
   - Security review
   - Architecture review

## Contributing Guidelines

### Code Review Checklist

- [ ] Types are properly defined and exported
- [ ] Error handling follows patterns
- [ ] Database operations use transactions
- [ ] UI components are accessible
- [ ] Changes are tested
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Documentation updated

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: feat, fix, docs, style, refactor, test, chore

Example:
```
feat(chat): add streaming response support

- Implement SSE for real-time AI responses
- Add typing indicator during generation
- Handle connection errors gracefully

Closes #123
```

## Documentation Requirements

### CRITICAL: Always Update server_storage_fixes.md

**Every agent working on this project MUST update the `server_storage_fixes.md` file when:**
- Fixing any bug or issue
- Deploying changes to production
- Discovering new problems
- Learning debugging insights
- Changing architecture or implementation

**The `server_storage_fixes.md` file is the PRIMARY LOG for:**
- All issues encountered and their fixes
- Debugging steps and solutions
- Deployment procedures
- Lessons learned
- Known remaining issues

### Documentation Best Practices

1. **Immediate Documentation**: Document fixes AS YOU MAKE THEM, not after
2. **Include Root Causes**: Always explain WHY something broke, not just the fix
3. **Show File Changes**: List exact files modified with brief descriptions
4. **Provide Code Examples**: Include before/after code snippets for clarity
5. **Track Deployment**: Document exact deployment commands and timestamps
6. **Update Issue Status**: Mark issues as FIXED, PARTIAL, or PENDING
7. **Add Lessons Learned**: Document insights for future debugging

### Documentation Template for New Issues

```markdown
### Issue [Number]: [Brief Description] ([STATUS])
**Problem:** [What was broken/not working]
**Root Cause:** [Why it was broken]
**Fix:** [How it was fixed]
**Files Modified:**
- `path/to/file.ts` - [What was changed]
**Deployment:** [Date and deployment steps if applicable]
**Lessons:** [Any insights gained]
```

### Required Documentation Sections

When completing work, ensure these sections are current:
1. **Issues & Fixes**: Detailed problem/solution pairs
2. **Known Remaining Issues**: Prioritized list of unfixed problems
3. **Deployment Summary**: Recent deployment history
4. **Lessons Learned**: Debugging insights and patterns
5. **Best Practices**: Development and deployment guidelines
6. **Next Steps**: Prioritized action items

## Resources

### Internal Documentation
- [README.md](./README.md) - Project overview and setup
- [server_storage_fixes.md](./server_storage_fixes.md) - **PRIMARY ISSUE TRACKING & FIX LOG**
- [PHASE_ALIGNMENT_STRATEGY.md](./PHASE_ALIGNMENT_STRATEGY.md) - Product vision
- [src/types/index.ts](./src/types/index.ts) - Type definitions

### External Resources
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [PWA Best Practices](https://web.dev/pwa/)
- [Anthropic API Docs](https://docs.anthropic.com)

## Version History

- **v1.0.0** - Initial Phase 1 implementation
- **v1.0.1** - Fixed "Unknown Source" issue for clinical trials
  - Root cause: Frontend was destroying backend's source object structure
  - Solution: Preserve complete backend objects using spread operator
  - Lesson: Always trace complete data flow when debugging
- **v1.0.2** - Fixed Voice Recording persistence issue
  - Root cause: Service worker DB version mismatch (hardcoded v1 vs app v4)
  - Solution: Centralized version management, auto-update PWA config
  - Lesson: "Works in incognito" = cache/version issue
  - Added: Cache clear utility and version management protocol
- **v1.1.0** - Analytics pivoted to Research Insights (January 2025)
  - Removed broken Knowledge Graph (used deprecated fields)
  - Transformed Analytics from health tracking to research insights
  - Aligned with "Facts, Not Scores™" principle
  - Now uses existing findings data instead of non-existent timeline events
- **v2.0.0** - PostgreSQL Persistent Storage (January 2026)
  - **Major Architecture Change**: Migrated from IndexedDB-only to PostgreSQL + IndexedDB hybrid
  - **New Features**:
    - Multi-device sync via PostgreSQL backend
    - User authentication and session management
    - Persistent data storage across browser clears
    - Automatic data backup and recovery
  - **Technical Improvements**:
    - 13 PostgreSQL tables for structured data
    - Connection pooling for performance
    - JSONB fields for flexible metadata
    - JWT-based authentication
  - **Migration Support**: Automatic migration from IndexedDB to PostgreSQL
  - **Deployment**: Docker containerization with PostgreSQL 15
- **v2.0.1** - Fixed Critical Agent & API Issues (January 18, 2026)
  - **Fixed**: Agent finding creation 404 errors (wrong ID generation)
  - **Fixed**: Digest-findings race condition (incomplete digests showing 10/20 findings)
  - **Fixed**: Unnecessary API calls flooding console on page load
  - **Fixed**: Topic deletion always returning false
  - **Solution**: Coordinated agent execution with `runAllResearchAgents`
  - **Deployment**: Successfully deployed to production at 100.94.82.35
  - **Documentation**: Established `server_storage_fixes.md` as primary issue log
- **v3.0.0** (Planned) - Conversational interface
- **v4.0.0** (Planned) - Advanced Research Analytics

---

*Last Updated: January 18, 2026*
*Maintained by: Development Team*