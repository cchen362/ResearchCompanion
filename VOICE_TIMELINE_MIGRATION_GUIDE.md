# Voice Recording & Timeline Server Migration - Complete Implementation Guide

## Executive Summary

The voice recording and timeline features currently store data only in IndexedDB (browser local storage), causing complete data loss when users clear browser data or login from different devices. This guide provides a comprehensive plan to migrate these features to server storage while optimizing for mobile use cases, particularly 20-30 minute medical consultations.

## Current State Analysis

### Critical Issues Identified

1. **Data Loss**: All voice recordings and timeline events are lost when browser data is cleared
2. **No Multi-Device Sync**: Data exists only on the device where it was created
3. **File Size Limitations**:
   - 30-minute recordings generate 45-60MB files
   - Express body limit: 50MB (barely fits)
   - Whisper API limit: 25MB (will fail for long recordings)
   - Base64 encoding adds 33% overhead
4. **Poor Mobile UX**:
   - No upload progress indicators
   - App must stay in foreground
   - High memory usage (entire file in RAM)
   - No failure recovery

### Current Implementation Details

#### Voice Recording (Frontend)
- **File**: `src/components/VoiceRecorder.tsx`
- **Format**: WebM audio codec
- **Capture**: 200ms chunks stored in memory
- **Process**: Entire blob sent as base64 to `/api/transcribe`
- **Storage**: Results saved to IndexedDB `timeline` store only

#### Timeline Events (Frontend)
- **File**: `src/utils/db/timeline.ts`
- **Storage**: IndexedDB only, no server sync
- **Service**: `src/services/timeline.service.ts`
- **UI**: `src/components/Timeline.tsx`

#### Backend Infrastructure
- **Existing Tables** (PostgreSQL):
  ```sql
  -- timeline_events table (lines 105-118 in init.sql)
  CREATE TABLE timeline_events (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    topic_id UUID REFERENCES topics(id),
    type VARCHAR(50),
    title TEXT,
    timestamp BIGINT,
    data JSONB,
    metadata JSONB
  );

  -- audio_recordings table (lines 121-135 in init.sql)
  CREATE TABLE audio_recordings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    timeline_event_id UUID REFERENCES timeline_events(id),
    storage_path TEXT,
    file_size BIGINT,
    duration INTEGER,
    mime_type VARCHAR(50),
    transcription TEXT,
    transcription_status VARCHAR(50),
    metadata JSONB
  );
  ```

- **Missing Backend Components**:
  - No timeline API endpoints
  - No audio CRUD endpoints
  - No model classes for timeline/audio
  - Transcribe endpoint doesn't persist data

## Technical Specifications for 20-30 Minute Consultations

### File Size Calculations

| Recording Length | WebM Size | Base64 Size | Network Time (4G) | Memory Usage |
|-----------------|-----------|-------------|-------------------|--------------|
| 10 minutes | 15-20 MB | 20-27 MB | 5-7 seconds | 27 MB |
| 20 minutes | 30-40 MB | 40-53 MB | 10-15 seconds | 53 MB |
| 30 minutes | 45-60 MB | 60-80 MB | 15-30 seconds | 80 MB |

### Current System Limits

```javascript
// Backend limits (backend/src/index.ts)
app.use(express.json({ limit: '50mb' }));  // Line 87-88
server.timeout = 5 * 60 * 1000;  // 5 minutes, Line 145-146

// Frontend timeout (src/services/api.ts)
timeout: 60000  // 60 seconds, Line 8

// Whisper API limit
Maximum file size: 25 MB  // Will reject 30-minute recordings
```

## Proposed Solution Architecture

### Phase 1: Audio Optimization (Immediate Priority)

#### 1.1 Implement Audio Compression

**File**: Create `src/services/audioCompression.service.ts`

```typescript
interface AudioCompressionConfig {
  mimeType: 'audio/webm;codecs=opus' | 'audio/mp4';
  audioBitsPerSecond: number;  // 32000 for voice, 64000 for quality
  numberOfAudioChannels: 1;    // Mono for speech
}

class AudioCompressionService {
  getOptimalSettings(recordingType: 'consultation' | 'note'): AudioCompressionConfig {
    // Consultation: 30min target = 15MB (32kbps mono)
    // Note: 5min target = 5MB (64kbps mono)
  }

  async compressAudioChunk(blob: Blob, settings: AudioCompressionConfig): Promise<Blob> {
    // Use Web Audio API for compression
  }
}
```

**Action Items**:
1. Create compression service class
2. Add bitrate selection based on recording type
3. Implement mono channel conversion
4. Test file size reduction (target: 60-70% reduction)

#### 1.2 Update VoiceRecorder Component

**File**: Modify `src/components/VoiceRecorder.tsx`

```typescript
// Line 114-116: Replace with compression settings
const compressionSettings = audioCompressionService.getOptimalSettings('consultation');
const mediaRecorder = new MediaRecorder(stream, compressionSettings);

// Add recording type selector UI
// Add quality indicator UI
// Add estimated file size display
```

### Phase 2: Chunked Recording & Upload

#### 2.1 Implement Recording Chunks

**File**: Create `src/services/chunkedRecording.service.ts`

```typescript
interface RecordingChunk {
  id: string;
  recordingSessionId: string;
  chunkIndex: number;
  blob: Blob;
  duration: number;
  timestamp: number;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
}

class ChunkedRecordingService {
  private readonly CHUNK_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  async startChunkedRecording(topicId: string): Promise<string> {
    // Generate session ID
    // Initialize chunk storage
    // Return session ID
  }

  async saveChunk(sessionId: string, audioBlob: Blob): Promise<RecordingChunk> {
    // Save to IndexedDB
    // Queue for upload
    // Return chunk metadata
  }

  async uploadChunk(chunk: RecordingChunk): Promise<void> {
    // Upload to server with retry logic
    // Update chunk status
    // Handle failures gracefully
  }
}
```

**Action Items**:
1. Create chunked recording service
2. Implement 5-minute auto-segmentation
3. Add IndexedDB chunk storage
4. Create upload queue mechanism

#### 2.2 Create Backend Chunk Endpoints

**File**: Create `backend/src/routes/audioChunks.routes.ts`

```typescript
router.post('/api/audio/chunk', authenticate, async (req, res) => {
  // Receive chunk
  // Store temporarily
  // Return chunk ID
});

router.post('/api/audio/finalize/:sessionId', authenticate, async (req, res) => {
  // Combine all chunks
  // Process with Whisper
  // Save to audio_recordings
  // Clean up chunks
});

router.get('/api/audio/session/:sessionId/status', authenticate, async (req, res) => {
  // Return upload progress
  // List uploaded chunks
  // Provide resume info
});
```

**Action Items**:
1. Create chunk upload endpoint
2. Implement chunk storage (temp table or file system)
3. Create finalization endpoint
4. Add progress tracking endpoint

### Phase 3: Progressive Upload Implementation

#### 3.1 Create Upload Service

**File**: Create `src/services/progressiveUpload.service.ts`

```typescript
class ProgressiveUploadService {
  private uploadQueue: UploadTask[] = [];
  private activeUploads: Map<string, UploadProgress> = new Map();

  async uploadWithProgress(
    chunk: Blob,
    onProgress: (percent: number) => void
  ): Promise<void> {
    // Use XMLHttpRequest for progress events
    // Implement exponential backoff retry
    // Update progress callbacks
  }

  async resumeFailedUploads(): Promise<void> {
    // Check IndexedDB for pending chunks
    // Resume from last successful chunk
    // Update UI with resume status
  }
}
```

**Action Items**:
1. Implement progress tracking
2. Add retry mechanism with exponential backoff
3. Create resume capability
4. Add network status detection

#### 3.2 Update API Client

**File**: Modify `src/services/api.ts`

```typescript
// Add new methods for chunked upload
export async function uploadAudioChunk(
  chunk: Blob,
  sessionId: string,
  chunkIndex: number,
  onProgress?: (percent: number) => void
): Promise<{ chunkId: string }> {
  // Implementation with progress tracking
}

export async function finalizeAudioSession(
  sessionId: string,
  totalChunks: number
): Promise<VoiceTranscriptionResult> {
  // Finalize and process recording
}
```

### Phase 4: Mobile-Optimized UI

#### 4.1 Redesign Recording Interface

**File**: Update `src/components/VoiceRecorder.tsx`

```typescript
// New UI components needed:
interface RecordingProgress {
  recordingTime: string;
  chunksUploaded: number;
  totalChunks: number;
  uploadProgress: number;
  networkStatus: 'online' | 'offline' | 'slow';
  estimatedTimeRemaining: string;
}

// Add new UI sections:
// - Recording progress bar
// - Chunk upload status
// - Network indicator
// - Background recording notice
// - Auto-save indicator
```

**UI Mockup**:
```
┌─────────────────────────────────┐
│ 🔴 Recording Consultation        │
│                                  │
│ ⏱ 15:32 / 30:00 (estimated)     │
│                                  │
│ Upload Progress:                 │
│ [████████░░░░░░] 3/4 segments    │
│                                  │
│ 📶 Network: Good                 │
│ ✓ Auto-saving every 5 min        │
│ ✓ Can switch apps safely         │
│                                  │
│ [⏸ Pause] [⏹ Stop Early]        │
└─────────────────────────────────┐
```

**Action Items**:
1. Design mobile-first recording UI
2. Add real-time upload progress
3. Implement network status indicator
4. Add chunk completion notifications
5. Create background recording notice

### Phase 5: Timeline Server Migration

#### 5.1 Create Timeline Backend

**File**: Create `backend/src/models/timeline.model.ts`

```typescript
export class TimelineModel {
  static async create(userId: string, data: Partial<TimelineEvent>): Promise<TimelineEvent> {
    // Insert into timeline_events table
  }

  static async getByUser(userId: string): Promise<TimelineEvent[]> {
    // Fetch user's timeline events
  }

  static async getByTopic(userId: string, topicId: string): Promise<TimelineEvent[]> {
    // Fetch topic-specific events
  }

  static async update(userId: string, eventId: string, data: Partial<TimelineEvent>): Promise<void> {
    // Update timeline event
  }

  static async delete(userId: string, eventId: string): Promise<void> {
    // Delete timeline event
  }
}
```

**File**: Create `backend/src/routes/timeline.routes.ts`

```typescript
router.get('/api/timeline', authenticate, async (req, res) => {
  // Get user's timeline events
});

router.get('/api/timeline/topic/:topicId', authenticate, async (req, res) => {
  // Get topic-specific timeline
});

router.post('/api/timeline', authenticate, async (req, res) => {
  // Create timeline event
});

router.put('/api/timeline/:id', authenticate, async (req, res) => {
  // Update timeline event
});

router.delete('/api/timeline/:id', authenticate, async (req, res) => {
  // Delete timeline event
});
```

**Action Items**:
1. Create timeline model class
2. Implement CRUD operations
3. Add timeline routes
4. Register routes in app.ts

#### 5.2 Update Frontend Timeline Service

**File**: Modify `src/utils/db/timeline.ts`

```typescript
// Add dual-write strategy
export async function createTimelineEvent(
  topicId: string,
  type: TimelineEventType,
  title: string,
  data: any,
  metadata?: any
): Promise<TimelineEvent> {
  // 1. Save to IndexedDB (immediate response)
  const localEvent = await saveToIndexedDB(event);

  // 2. Sync to server (background)
  syncToServer(localEvent).catch(error => {
    // Queue for retry
    addToSyncQueue(localEvent);
  });

  return localEvent;
}

// Add sync mechanism
export async function syncTimelineToServer(): Promise<void> {
  // Get all unsynced events
  // Upload to server
  // Mark as synced
}
```

### Phase 6: Service Worker Enhancement

#### 6.1 Add Background Sync

**File**: Update `public/sw.js`

```javascript
// Add background sync for uploads
self.addEventListener('sync', event => {
  if (event.tag === 'upload-audio-chunks') {
    event.waitUntil(uploadPendingAudioChunks());
  }
  if (event.tag === 'sync-timeline') {
    event.waitUntil(syncTimelineEvents());
  }
});

async function uploadPendingAudioChunks() {
  // Get pending chunks from IndexedDB
  // Upload each chunk
  // Update upload status
}

async function syncTimelineEvents() {
  // Get unsynced timeline events
  // Upload to server
  // Mark as synced
}
```

**Action Items**:
1. Implement background sync API
2. Add chunk upload handler
3. Add timeline sync handler
4. Implement offline queue

### Phase 7: Database Schema Updates

#### 7.1 Add New Tables

**File**: Create migration `backend/src/migrations/add_audio_chunks.sql`

```sql
-- Temporary storage for audio chunks
CREATE TABLE audio_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_data BYTEA,
  chunk_size INTEGER,
  mime_type VARCHAR(50),
  duration INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  UNIQUE(session_id, chunk_index)
);

CREATE INDEX idx_audio_chunks_session ON audio_chunks(session_id);
CREATE INDEX idx_audio_chunks_user ON audio_chunks(user_id);

-- Recording sessions
CREATE TABLE recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id),
  total_chunks INTEGER,
  chunks_uploaded INTEGER DEFAULT 0,
  total_duration INTEGER,
  status VARCHAR(20) DEFAULT 'in_progress',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB
);

-- Add sync tracking to timeline_events
ALTER TABLE timeline_events
ADD COLUMN synced_at TIMESTAMP,
ADD COLUMN sync_status VARCHAR(20) DEFAULT 'pending';
```

## Implementation Checklist

### Week 1: Audio Optimization
- [ ] Create `audioCompression.service.ts`
- [ ] Update `VoiceRecorder.tsx` with compression settings
- [ ] Add recording type selector (consultation vs note)
- [ ] Test file size reduction (target: 60-70% smaller)
- [ ] Verify audio quality for medical use

### Week 2: Chunked Recording
- [ ] Create `chunkedRecording.service.ts`
- [ ] Implement 5-minute auto-segmentation
- [ ] Add IndexedDB chunk storage
- [ ] Update UI to show chunk progress
- [ ] Test memory usage improvements

### Week 3: Progressive Upload
- [ ] Create `progressiveUpload.service.ts`
- [ ] Create backend chunk endpoints
- [ ] Implement upload queue with retry
- [ ] Add progress tracking UI
- [ ] Test resume after interruption

### Week 4: Mobile UI Optimization
- [ ] Redesign recording interface for mobile
- [ ] Add upload progress indicators
- [ ] Implement network status display
- [ ] Add background recording notices
- [ ] Test on various mobile devices

### Week 5: Timeline Migration
- [ ] Create timeline model and routes
- [ ] Update timeline service with dual-write
- [ ] Implement sync mechanism
- [ ] Add conflict resolution
- [ ] Test multi-device sync

### Week 6: Service Worker & Testing
- [ ] Add background sync to service worker
- [ ] Implement offline queue
- [ ] Create migration utilities
- [ ] End-to-end testing with 30-minute recordings
- [ ] Performance testing on mobile devices

## Testing Requirements

### Functional Testing
1. Record 30-minute consultation
2. Verify file size < 20MB
3. Test upload with network interruption
4. Verify resume works after app close
5. Test background upload
6. Verify multi-device sync
7. Test offline recording and sync

### Performance Testing
1. Memory usage during 30-min recording
2. Battery consumption on mobile
3. Network bandwidth usage
4. Upload speed on 3G/4G/WiFi
5. App responsiveness during upload

### Edge Cases
1. Phone call interruption during recording
2. App killed during upload
3. Network timeout during transcription
4. Storage quota exceeded
5. Multiple concurrent uploads

## Migration Strategy for Existing Data

### On First Login After Update
```javascript
async function migrateLocalDataToServer() {
  // 1. Check for local timeline events
  const localEvents = await getAllLocalTimelineEvents();

  // 2. Check for local audio metadata
  const localAudio = await getAllLocalAudioMetadata();

  // 3. Upload in batches to avoid overwhelming server
  for (const batch of chunks(localEvents, 50)) {
    await uploadTimelineBatch(batch);
  }

  // 4. Mark as migrated to prevent duplicates
  await markDataAsMigrated();
}
```

## Risk Mitigation

### Data Loss Prevention
1. Never delete local data until server confirms receipt
2. Implement checksums for data integrity
3. Keep local backup for 7 days after migration
4. Add manual recovery option

### Performance Optimization
1. Use Web Workers for compression
2. Implement lazy loading for timeline
3. Use virtual scrolling for long lists
4. Cache frequently accessed data

### Security Considerations
1. Encrypt audio chunks before upload
2. Use secure temporary storage
3. Implement rate limiting
4. Add file type validation

## Success Metrics

### Technical Metrics
- [ ] 30-min recording < 20MB
- [ ] Upload success rate > 99%
- [ ] Memory usage < 50MB
- [ ] Upload can resume after interruption
- [ ] Multi-device sync works

### User Experience Metrics
- [ ] Clear progress indicators
- [ ] Recording works in background
- [ ] No data loss on browser clear
- [ ] Smooth playback of recordings
- [ ] Fast loading of timeline

## Notes for Implementing Agents

### Critical Files to Review First
1. `src/components/VoiceRecorder.tsx` - Current implementation
2. `src/utils/db/timeline.ts` - Local storage logic
3. `backend/src/routes/transcribe.ts` - Existing endpoint
4. `backend/src/database/init.sql` - Database schema
5. `src/services/api.ts` - API client

### Common Pitfalls to Avoid
1. Don't remove IndexedDB storage - keep for offline
2. Don't block UI during upload - use background processing
3. Don't lose chunks if upload fails - implement retry
4. Don't exceed Whisper 25MB limit - split large files
5. Don't trust network - always handle failures

### Dependencies to Install
```bash
# Frontend
npm install workbox-background-sync  # For service worker sync
npm install lamejs  # For MP3 encoding (optional)

# Backend
# No new dependencies required
```

### Environment Variables Needed
```env
# Backend
MAX_AUDIO_FILE_SIZE=20971520  # 20MB in bytes
CHUNK_STORAGE_PATH=./temp/audio_chunks
AUDIO_STORAGE_TYPE=database  # or 'filesystem' or 's3'
```

## Questions to Resolve

1. **Audio Storage Location**:
   - Option A: PostgreSQL BYTEA (simple but limited to ~1GB)
   - Option B: File system (requires cleanup strategy)
   - Option C: S3/Cloud storage (scalable but adds complexity)

2. **Chunk Size Strategy**:
   - Fixed time (5 minutes)
   - Fixed size (5MB)
   - Adaptive based on network speed

3. **Transcription Strategy**:
   - Process chunks individually and merge
   - Wait for complete recording
   - Hybrid based on recording length

4. **Conflict Resolution**:
   - Server data always wins
   - Last write wins
   - Manual merge UI

## Conclusion

This migration is critical for the PWA's viability as a medical tool. The current implementation will fail for typical 20-30 minute consultations. The proposed solution addresses all identified issues while maintaining backward compatibility and providing an excellent mobile experience.

**Estimated Timeline**: 6 weeks for full implementation
**Priority**: HIGH - Data loss is unacceptable for medical records
**Complexity**: HIGH - Requires changes across entire stack

---

*Document created: January 26, 2025*
*Last updated: January 26, 2025*
*Status: Ready for Implementation*