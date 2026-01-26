/**
 * Chunked Recording Service
 *
 * Splits long recordings into manageable chunks for:
 * - Progressive upload (upload while recording)
 * - Memory efficiency (don't hold entire recording in RAM)
 * - Failure recovery (only lose current chunk if crash)
 * - Better mobile experience (background upload)
 */

import { openDB, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

export interface RecordingChunk {
  id: string;
  sessionId: string;
  chunkIndex: number;
  blob: Blob;
  duration: number; // in seconds
  timestamp: number;
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadAttempts: number;
  error?: string;
}

export interface RecordingSession {
  id: string;
  topicId: string;
  userId?: string;
  totalChunks: number;
  chunksUploaded: number;
  totalDuration: number; // in seconds
  status: 'recording' | 'paused' | 'processing' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  metadata?: {
    recordingType?: string;
    compressionSettings?: any;
    deviceInfo?: string;
  };
}

export interface ChunkUploadProgress {
  sessionId: string;
  chunkIndex: number;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

class ChunkedRecordingService {
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'ChunkedRecordingsDB';
  private readonly DB_VERSION = 1;

  // Configuration
  private readonly CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB max per chunk
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_BASE = 2000; // Base delay for exponential backoff

  // Active sessions
  private activeSessions: Map<string, RecordingSession> = new Map();
  private uploadQueue: RecordingChunk[] = [];
  private isUploading = false;

  constructor() {
    this.initDB();
  }

  /**
   * Initialize IndexedDB for chunk storage
   */
  private async initDB() {
    if (this.db) return;

    this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Store recording sessions
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('status', 'status');
          sessionStore.createIndex('topicId', 'topicId');
        }

        // Store individual chunks
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunkStore.createIndex('sessionId', 'sessionId');
          chunkStore.createIndex('uploadStatus', 'uploadStatus');
          chunkStore.createIndex('sessionChunk', ['sessionId', 'chunkIndex'], { unique: true });
        }
      }
    });
  }

  /**
   * Start a new chunked recording session
   */
  async startChunkedRecording(
    topicId: string,
    metadata?: RecordingSession['metadata']
  ): Promise<string> {
    await this.initDB();

    const sessionId = uuidv4();
    const session: RecordingSession = {
      id: sessionId,
      topicId,
      totalChunks: 0,
      chunksUploaded: 0,
      totalDuration: 0,
      status: 'recording',
      startedAt: Date.now(),
      metadata
    };

    // Store in IndexedDB
    await this.db!.put('sessions', session);

    // Keep in memory for quick access
    this.activeSessions.set(sessionId, session);

    console.log(`Started chunked recording session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Save a recording chunk
   */
  async saveChunk(
    sessionId: string,
    audioBlob: Blob,
    chunkIndex: number,
    duration: number
  ): Promise<RecordingChunk> {
    await this.initDB();

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const chunk: RecordingChunk = {
      id: uuidv4(),
      sessionId,
      chunkIndex,
      blob: audioBlob,
      duration,
      timestamp: Date.now(),
      uploadStatus: 'pending',
      uploadAttempts: 0
    };

    // Store chunk in IndexedDB
    await this.db!.put('chunks', chunk);

    // Update session
    session.totalChunks = Math.max(session.totalChunks, chunkIndex + 1);
    session.totalDuration += duration;
    await this.db!.put('sessions', session);

    // Add to upload queue
    this.queueChunkForUpload(chunk);

    console.log(`Saved chunk ${chunkIndex} for session ${sessionId}, size: ${(audioBlob.size / 1024).toFixed(2)}KB`);
    return chunk;
  }

  /**
   * Queue a chunk for upload
   */
  private queueChunkForUpload(chunk: RecordingChunk) {
    this.uploadQueue.push(chunk);
    this.processUploadQueue();
  }

  /**
   * Process the upload queue
   */
  private async processUploadQueue() {
    if (this.isUploading || this.uploadQueue.length === 0) {
      return;
    }

    this.isUploading = true;

    while (this.uploadQueue.length > 0) {
      const chunk = this.uploadQueue.shift()!;

      try {
        await this.uploadChunk(chunk);
      } catch (error) {
        console.error(`Failed to upload chunk ${chunk.chunkIndex}:`, error);

        // Put back in queue if retry attempts remaining
        if (chunk.uploadAttempts < this.MAX_RETRY_ATTEMPTS) {
          // Exponential backoff
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, chunk.uploadAttempts);
          setTimeout(() => {
            this.uploadQueue.push(chunk);
            this.processUploadQueue();
          }, delay);
        }
      }
    }

    this.isUploading = false;
  }

  /**
   * Upload a chunk to the server
   */
  async uploadChunk(
    chunk: RecordingChunk,
    onProgress?: (progress: ChunkUploadProgress) => void
  ): Promise<void> {
    await this.initDB();

    // Update status to uploading
    chunk.uploadStatus = 'uploading';
    chunk.uploadAttempts++;
    await this.db!.put('chunks', chunk);

    try {
      // Convert blob to base64 for upload
      const base64 = await this.blobToBase64(chunk.blob);

      // TODO: Replace with actual API call
      // For now, simulate upload with delay
      await this.simulateUpload(chunk, onProgress);

      // Mark as completed
      chunk.uploadStatus = 'completed';
      await this.db!.put('chunks', chunk);

      // Update session
      const session = this.activeSessions.get(chunk.sessionId);
      if (session) {
        session.chunksUploaded++;
        await this.db!.put('sessions', session);
      }

      console.log(`Successfully uploaded chunk ${chunk.chunkIndex} for session ${chunk.sessionId}`);
    } catch (error) {
      chunk.uploadStatus = 'failed';
      chunk.error = error instanceof Error ? error.message : 'Unknown error';
      await this.db!.put('chunks', chunk);
      throw error;
    }
  }

  /**
   * Simulate upload (placeholder for actual API call)
   */
  private async simulateUpload(
    chunk: RecordingChunk,
    onProgress?: (progress: ChunkUploadProgress) => void
  ): Promise<void> {
    const totalBytes = chunk.blob.size;
    const steps = 10;
    const stepDelay = 100; // ms per step

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDelay));

      const bytesUploaded = (totalBytes * i) / steps;
      const percentage = (i / steps) * 100;

      if (onProgress) {
        onProgress({
          sessionId: chunk.sessionId,
          chunkIndex: chunk.chunkIndex,
          bytesUploaded,
          totalBytes,
          percentage
        });
      }
    }
  }

  /**
   * Get all chunks for a session
   */
  async getSessionChunks(sessionId: string): Promise<RecordingChunk[]> {
    await this.initDB();

    const tx = this.db!.transaction('chunks', 'readonly');
    const index = tx.objectStore('chunks').index('sessionId');
    const chunks = await index.getAll(sessionId);

    return chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  /**
   * Get session information
   */
  async getSession(sessionId: string): Promise<RecordingSession | undefined> {
    await this.initDB();
    return await this.db!.get('sessions', sessionId);
  }

  /**
   * Pause recording session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'paused';
      await this.db!.put('sessions', session);
    }
  }

  /**
   * Resume recording session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'recording';
      await this.db!.put('sessions', session);
    }
  }

  /**
   * Complete a recording session
   */
  async completeSession(sessionId: string): Promise<void> {
    await this.initDB();

    const session = this.activeSessions.get(sessionId) || await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'completed';
    session.completedAt = Date.now();
    await this.db!.put('sessions', session);

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    console.log(`Completed session ${sessionId}. Total chunks: ${session.totalChunks}, Duration: ${session.totalDuration}s`);
  }

  /**
   * Get upload progress for a session
   */
  async getSessionProgress(sessionId: string): Promise<{
    totalChunks: number;
    uploadedChunks: number;
    failedChunks: number;
    pendingChunks: number;
    percentage: number;
  }> {
    await this.initDB();

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const chunks = await this.getSessionChunks(sessionId);

    const uploadedChunks = chunks.filter(c => c.uploadStatus === 'completed').length;
    const failedChunks = chunks.filter(c => c.uploadStatus === 'failed').length;
    const pendingChunks = chunks.filter(c => c.uploadStatus === 'pending').length;

    return {
      totalChunks: session.totalChunks,
      uploadedChunks,
      failedChunks,
      pendingChunks,
      percentage: session.totalChunks > 0 ? (uploadedChunks / session.totalChunks) * 100 : 0
    };
  }

  /**
   * Resume failed uploads for a session
   */
  async resumeFailedUploads(sessionId: string): Promise<void> {
    await this.initDB();

    const chunks = await this.getSessionChunks(sessionId);
    const failedChunks = chunks.filter(c =>
      c.uploadStatus === 'failed' || c.uploadStatus === 'pending'
    );

    console.log(`Resuming ${failedChunks.length} failed/pending uploads for session ${sessionId}`);

    for (const chunk of failedChunks) {
      this.queueChunkForUpload(chunk);
    }
  }

  /**
   * Clean up old completed sessions (older than 7 days)
   */
  async cleanupOldSessions(): Promise<void> {
    await this.initDB();

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const tx = this.db!.transaction(['sessions', 'chunks'], 'readwrite');
    const sessions = await tx.objectStore('sessions').getAll();

    for (const session of sessions) {
      if (session.status === 'completed' && session.completedAt && session.completedAt < sevenDaysAgo) {
        // Delete session
        await tx.objectStore('sessions').delete(session.id);

        // Delete associated chunks
        const chunks = await this.getSessionChunks(session.id);
        for (const chunk of chunks) {
          await tx.objectStore('chunks').delete(chunk.id);
        }

        console.log(`Cleaned up old session ${session.id}`);
      }
    }

    await tx.done;
  }

  /**
   * Convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:audio/webm;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Combine all chunks into a single blob (for fallback processing)
   */
  async combineChunks(sessionId: string): Promise<Blob> {
    const chunks = await this.getSessionChunks(sessionId);
    const blobs = chunks.map(c => c.blob);

    return new Blob(blobs, { type: blobs[0]?.type || 'audio/webm' });
  }

  /**
   * Get estimated time remaining for uploads
   */
  getEstimatedTimeRemaining(
    bytesUploaded: number,
    totalBytes: number,
    startTime: number
  ): string {
    if (bytesUploaded === 0) return 'Calculating...';

    const elapsedMs = Date.now() - startTime;
    const bytesPerMs = bytesUploaded / elapsedMs;
    const remainingBytes = totalBytes - bytesUploaded;
    const remainingMs = remainingBytes / bytesPerMs;

    const seconds = Math.ceil(remainingMs / 1000);
    if (seconds < 60) return `${seconds}s remaining`;

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes}m remaining`;

    const hours = Math.ceil(minutes / 60);
    return `${hours}h remaining`;
  }
}

// Export singleton instance
export const chunkedRecordingService = new ChunkedRecordingService();

// Export types
export type { RecordingChunk, RecordingSession, ChunkUploadProgress };