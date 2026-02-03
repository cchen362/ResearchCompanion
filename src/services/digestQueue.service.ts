import { digestQueueAPI } from '@/api/digestQueue.api';
import { api, longOperationApi } from '@/services/api';
import { runAllResearchAgents, ensureDefaultAgents } from '@/services/agentRunner';
import { findingsService } from '@/services/findings.service';
import { topicsService } from '@/services/topics.service';
import { digestService } from '@/services/digest.service';
import type {
  DigestQueueItem,
  DigestQueueStatus,
  DigestPriority,
  DigestTimeframe,
  ResearchFinding,
  Topic,
  SmartDigest
} from '@/types';

// Digest Queue Service - Manages background digest generation using PostgreSQL backend
export class DigestQueueService {
  private static instance: DigestQueueService;
  private processingQueue = false;
  private currentProcessingId: string | null = null;
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private queueLocks = new Set<string>();
  private queueProcessorInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Don't auto-start - wait for explicit startPolling() call after login
    console.log('[DigestQueueService] Service created - polling not started until login');
  }

  static getInstance(): DigestQueueService {
    if (!DigestQueueService.instance) {
      DigestQueueService.instance = new DigestQueueService();
    }
    return DigestQueueService.instance;
  }

  // Add a digest generation request to the queue
  async queueDigestGeneration(
    topicId: string,
    timeframe: DigestTimeframe,
    findingIds: string[],
    priority: DigestPriority = 'normal',
    requestedBy: 'user' | 'system' | 'background' = 'user'
  ): Promise<DigestQueueItem> {
    // Add mutex-like check to prevent race conditions
    const lockKey = `queue_${topicId}_${timeframe}`;
    if (this.queueLocks.has(lockKey)) {
      console.log(`Queue generation already in progress for ${topicId}/${timeframe}, returning existing`);
      // Wait a moment for the other request to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      const existingQueue = await this.getQueueStatusByTopic(topicId);
      if (existingQueue) {
        return existingQueue;
      }
    }

    // Set lock
    this.queueLocks.add(lockKey);

    try {
      // Check if there's already an active queue for this topic/timeframe via API
      const queueStatus = await digestQueueAPI.getQueueStatus(topicId, timeframe);

      if (queueStatus.hasActiveQueue && queueStatus.queueId) {
        console.log(`Found existing queue item for ${topicId}/${timeframe}, reusing`);

        // Return existing queue item format
        const existing: DigestQueueItem = {
          id: queueStatus.queueId,
          topicId,
          timeframe,
          status: queueStatus.status || 'pending',
          priority,
          createdAt: queueStatus.createdAt ? new Date(queueStatus.createdAt).getTime() : Date.now(),
          startedAt: queueStatus.startedAt ? new Date(queueStatus.startedAt).getTime() : undefined,
          attempts: 0,
          maxAttempts: 3,
          findingIds,
          requestedBy,
          estimatedCompletionTime: Date.now() + 30000,
          progress: {
            stage: queueStatus.status === 'processing' ? 'generating' : 'queued',
            percentage: queueStatus.status === 'processing' ? 50 : 0,
            message: queueStatus.status === 'processing' ? 'Generating digest...' : 'Waiting in queue...'
          }
        };

        return existing;
      }

      // Create new queue item via API
      const response = await digestQueueAPI.createQueueItem({
        topicId,
        timeframe,
        digestType: 'smart',
        priority: priority === 'high' ? 5 : priority === 'normal' ? 3 : 1,
        metadata: { findingIds, requestedBy }
      });

      if (!response.success || !response.queueId) {
        throw new Error(response.error || 'Failed to create queue item');
      }

      // Create queue item object
      const queueItem: DigestQueueItem = {
        id: response.queueId,
        topicId,
        timeframe,
        status: response.status as DigestQueueStatus || 'pending',
        priority,
        createdAt: Date.now(),
        attempts: 0,
        maxAttempts: 3,
        findingIds,
        requestedBy,
        estimatedCompletionTime: Date.now() + 30000,
        progress: {
          stage: 'queued',
          percentage: 0,
          message: 'Waiting in queue...'
        }
      };

      // Dispatch event to notify UI that digest has been queued
      window.dispatchEvent(new CustomEvent('digest-queued', {
        detail: { queueItem }
      }));
      console.log('Dispatched digest-queued event for topic:', topicId);

      // Trigger queue processing
      this.processQueue();

      return queueItem;
    } finally {
      // Always clear the lock
      this.queueLocks.delete(lockKey);
    }
  }

  // Get queue status by queue ID (for polling after queueing)
  async getQueueStatus(queueId: string): Promise<DigestQueueItem | null> {
    // For now, we'll return null as we don't have a way to get by queue ID
    // This would need an API endpoint to get queue item by ID
    console.warn('getQueueStatus by ID not yet implemented for PostgreSQL backend');
    return null;
  }

  // Get queue status by topic ID (for checking if topic has pending digests)
  async getQueueStatusByTopic(topicId: string): Promise<DigestQueueItem | null> {
    const queueStatus = await digestQueueAPI.getQueueStatus(topicId);

    if (!queueStatus.hasActiveQueue || !queueStatus.queueId) {
      return null;
    }

    // Convert API response to DigestQueueItem format
    return {
      id: queueStatus.queueId,
      topicId,
      timeframe: queueStatus.timeframe || 'all-time',
      status: queueStatus.status || 'pending',
      priority: 'normal',
      createdAt: queueStatus.createdAt ? new Date(queueStatus.createdAt).getTime() : Date.now(),
      startedAt: queueStatus.startedAt ? new Date(queueStatus.startedAt).getTime() : undefined,
      attempts: 0,
      maxAttempts: 3,
      findingIds: [],
      requestedBy: 'user',
      estimatedCompletionTime: Date.now() + 30000,
      progress: {
        stage: queueStatus.status === 'processing' ? 'generating' : 'queued',
        percentage: queueStatus.status === 'processing' ? 50 : 0,
        message: queueStatus.status === 'processing' ? 'Generating digest...' : 'Waiting in queue...'
      }
    };
  }

  // Get all queue items
  async getAllQueueItems(): Promise<DigestQueueItem[]> {
    const response = await digestQueueAPI.getUserQueueItems(50);

    // Convert API response to DigestQueueItem format
    return response.items.map(item => ({
      id: item.id,
      topicId: item.topicId,
      timeframe: item.timeframe as DigestTimeframe,
      status: item.status as DigestQueueStatus,
      priority: 'normal',
      createdAt: new Date(item.createdAt).getTime(),
      startedAt: item.startedAt ? new Date(item.startedAt).getTime() : undefined,
      completedAt: item.completedAt ? new Date(item.completedAt).getTime() : undefined,
      attempts: item.retryCount || 0,
      maxAttempts: 3,
      findingIds: item.metadata?.findingIds || [],
      requestedBy: item.metadata?.requestedBy || 'user',
      estimatedCompletionTime: Date.now() + 30000,
      progress: {
        stage: item.status === 'processing' ? 'generating' :
               item.status === 'completed' ? 'validating' : 'queued',
        percentage: item.status === 'processing' ? 50 :
                   item.status === 'completed' ? 100 : 0,
        message: item.status === 'processing' ? 'Generating digest...' :
                item.status === 'completed' ? 'Complete!' : 'Waiting in queue...'
      },
      error: item.error,
      resultDigestId: item.resultId
    }));
  }

  // Cancel a queued digest generation
  async cancelQueueItem(queueItemId: string): Promise<boolean> {
    return await digestQueueAPI.cancelQueueItem(queueItemId);
  }

  // Update queue item progress (NOTE: This now updates via API)
  async updateProgress(
    queueItemId: string,
    stage: 'queued' | 'fetching' | 'analyzing' | 'generating' | 'validating',
    percentage: number,
    message: string
  ): Promise<void> {
    // For now, we'll just dispatch the event locally
    // In the future, this could update the backend queue item metadata
    const queueItem: Partial<DigestQueueItem> = {
      id: queueItemId,
      progress: { stage, percentage, message },
      estimatedCompletionTime: percentage > 0 ?
        Date.now() + ((100 - percentage) * 600) : // Estimate based on percentage
        Date.now() + 30000
    };

    // Notify UI of progress update
    this.notifyProgressUpdate(queueItem as DigestQueueItem);
  }

  // Process the queue (made public so components can trigger immediate processing)
  async processQueue(): Promise<void> {
    if (this.processingQueue) return;

    // Don't process queue if user is not logged in
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('[DigestQueueService] Skipping queue processing - user not logged in');
      return;
    }

    this.processingQueue = true;

    try {
      // Get user's pending queue items
      const response = await digestQueueAPI.getUserQueueItems(10);
      const pendingItems = response.items.filter(item =>
        item.status === 'pending' || item.status === 'processing'
      );

      if (pendingItems.length === 0) {
        return;
      }

      // Process each pending item
      for (const item of pendingItems) {
        // Skip if already processing (another instance might be handling it)
        if (item.status === 'processing' && this.currentProcessingId !== item.id) {
          // Just notify progress for items being processed elsewhere
          this.notifyProgressUpdate({
            id: item.id,
            topicId: item.topicId,
            timeframe: item.timeframe as DigestTimeframe,
            status: 'processing',
            priority: 'normal',
            createdAt: new Date(item.createdAt).getTime(),
            startedAt: item.startedAt ? new Date(item.startedAt).getTime() : undefined,
            attempts: 0,
            maxAttempts: 3,
            findingIds: [],
            requestedBy: 'user',
            estimatedCompletionTime: Date.now() + 30000,
            progress: {
              stage: 'generating',
              percentage: 50,
              message: 'Generating digest...'
            }
          });
          continue;
        }

        // Process pending items
        if (item.status === 'pending') {
          console.log(`[DigestQueueService] Processing pending queue item ${item.id} for topic ${item.topicId}`);

          try {
            // Mark as processing (but don't fail if update fails)
            this.currentProcessingId = item.id;
            try {
              await digestQueueAPI.updateQueueStatus(item.id, 'processing');
            } catch (updateError: any) {
              console.error(`[DigestQueueService] QUEUE UPDATE FAILED:`, {
                queueId: item.id,
                topicId: item.topicId,
                endpoint: `/api/digest-queue/${item.id}`,
                status: updateError.response?.status,
                statusText: updateError.response?.statusText,
                errorMessage: updateError.message,
                errorData: updateError.response?.data
              });
              // Continue anyway - we'll still try to generate the digest
            }

            // Get topic and findings
            const topic = await topicsService.getTopic(item.topicId);
            if (!topic) {
              throw new Error(`Topic ${item.topicId} not found`);
            }

            const findings = await findingsService.getFindings(item.topicId);
            if (findings.length === 0) {
              throw new Error('No findings available for digest generation');
            }

            // Notify progress
            const queueItem: DigestQueueItem = {
              id: item.id,
              topicId: item.topicId,
              timeframe: item.timeframe as DigestTimeframe,
              status: 'processing',
              priority: 'normal',
              createdAt: new Date(item.createdAt).getTime(),
              startedAt: Date.now(),
              attempts: 1,
              maxAttempts: 3,
              findingIds: findings.map(f => f.id),
              requestedBy: 'user',
              estimatedCompletionTime: Date.now() + 60000,
              progress: {
                stage: 'generating',
                percentage: 10,
                message: 'Starting digest generation...'
              }
            };

            this.notifyProgressUpdate(queueItem);

            // Generate the digest with timeout protection (5 minutes)
            console.log(`[DigestQueueService] Generating digest from ${findings.length} findings`);
            const DIGEST_GENERATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

            const digest = await Promise.race([
              this.generateDigestFromFindings(
                queueItem,
                topic,
                findings,
                item.timeframe as DigestTimeframe
              ),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error('Digest generation timeout after 5 minutes')),
                  DIGEST_GENERATION_TIMEOUT
                )
              )
            ]);

            // Save the digest
            const savedDigest = await digestService.saveDigest(digest);

            // Update queue as completed (but don't fail if queue update fails)
            try {
              await digestQueueAPI.updateQueueStatus(
                item.id,
                'completed',
                undefined,
                savedDigest.id
              );
              console.log(`[DigestQueueService] Queue ${item.id} marked as completed`);
            } catch (updateError: any) {
              console.error(`[DigestQueueService] QUEUE COMPLETION UPDATE FAILED:`, {
                queueId: item.id,
                topicId: item.topicId,
                digestId: savedDigest.id,
                endpoint: `/api/digest-queue/${item.id}`,
                status: updateError.response?.status,
                statusText: updateError.response?.statusText,
                errorMessage: updateError.message,
                errorData: updateError.response?.data
              });
              // Continue anyway - digest was saved successfully
            }

            // ALWAYS notify completion even if queue update failed
            // The digest exists and was saved, that's what matters
            queueItem.status = 'completed';
            queueItem.completedAt = Date.now();
            queueItem.progress = {
              stage: 'completed',
              percentage: 100,
              message: 'Digest generated successfully'
            };
            this.notifyCompletion(queueItem, savedDigest);

            console.log(`[DigestQueueService] Successfully completed digest ${savedDigest.id} for queue item ${item.id}`);

          } catch (error) {
            console.error(`[DigestQueueService] Failed to process queue item ${item.id}:`, error);

            // Update queue as failed
            await digestQueueAPI.updateQueueStatus(
              item.id,
              'failed',
              error instanceof Error ? error.message : 'Unknown error'
            );

            // Notify failure
            this.notifyFailure({
              id: item.id,
              topicId: item.topicId,
              timeframe: item.timeframe as DigestTimeframe,
              status: 'failed',
              priority: 'normal',
              createdAt: new Date(item.createdAt).getTime(),
              startedAt: Date.now(),
              completedAt: Date.now(),
              attempts: 1,
              maxAttempts: 3,
              findingIds: [],
              requestedBy: 'user',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          } finally {
            if (this.currentProcessingId === item.id) {
              this.currentProcessingId = null;
            }
          }
        }
      }

      // DON'T RECURSIVELY CALL - let the setInterval handle periodic checks
      // The startQueueProcessor already runs this every 30 seconds

    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Integrated method to refresh research and regenerate digest
   * This fetches new findings first, then generates a digest from all findings
   */
  async refreshResearchAndDigest(
    topicId: string,
    timeframe: DigestTimeframe = 'all-time',
    priority: DigestPriority = 'high'
  ): Promise<DigestQueueItem> {
    console.log(`Starting integrated refresh for topic ${topicId}`);

    // Get the topic from the backend service
    const topic = await topicsService.getTopic(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    // Step 1: Ensure agents exist for the topic
    await ensureDefaultAgents(topicId);

    // Step 2: Create a queue item via API
    const response = await digestQueueAPI.createQueueItem({
      topicId,
      timeframe,
      digestType: 'smart',
      priority: priority === 'high' ? 5 : 3,
      metadata: {
        requestedBy: 'user',
        action: 'refresh_and_regenerate'
      }
    });

    if (!response.success || !response.queueId) {
      throw new Error(response.error || 'Failed to create queue item');
    }

    const queueItem: DigestQueueItem = {
      id: response.queueId,
      topicId,
      timeframe,
      status: 'processing',
      priority,
      createdAt: Date.now(),
      startedAt: Date.now(),
      attempts: 1,
      maxAttempts: 3,
      findingIds: [],
      requestedBy: 'user',
      estimatedCompletionTime: Date.now() + 120000,
      progress: {
        stage: 'fetching',
        percentage: 0,
        message: 'Starting research agents...'
      }
    };

    this.notifyProgressUpdate(queueItem);

    try {
      // Step 3: Run research agents to fetch new findings
      await this.updateProgress(
        queueItem.id,
        'fetching',
        10,
        'Searching PubMed for latest research...'
      );

      const newFindings = await runAllResearchAgents(topicId);
      console.log(`Research complete: ${newFindings.length} new findings`);

      await this.updateProgress(
        queueItem.id,
        'fetching',
        40,
        `Found ${newFindings.length} new findings. Processing...`
      );

      // Step 4: Get all findings for the topic (including existing ones)
      const allFindings = await findingsService.getFindings(topicId);
      console.log(`Total findings for digest: ${allFindings.length}`);

      await this.updateProgress(
        queueItem.id,
        'generating',
        50,
        'Generating AI digest from all findings...'
      );

      // Step 5: Generate digest from all findings
      const digest = await this.generateDigestFromFindings(
        queueItem,
        topic,
        allFindings,
        timeframe
      );

      // Step 6: Update queue status as completed
      await digestQueueAPI.updateQueueStatus(
        queueItem.id,
        'completed',
        undefined,
        digest.id
      );

      queueItem.status = 'completed';
      queueItem.completedAt = Date.now();
      queueItem.result = digest;

      await this.updateProgress(
        queueItem.id,
        'validating',
        100,
        'Complete!'
      );

      // Notify UI of completion
      this.notifyCompletion(queueItem, digest);

      console.log(`Integrated refresh complete for topic ${topicId}`);
      return queueItem;

    } catch (error) {
      console.error('Error in refreshResearchAndDigest:', error);

      // Update queue status as failed
      await digestQueueAPI.updateQueueStatus(
        queueItem.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      queueItem.status = 'failed';
      queueItem.completedAt = Date.now();
      queueItem.error = error instanceof Error ? error.message : 'Unknown error';

      this.notifyFailure(queueItem);

      throw error;
    }
  }

  /**
   * Queue digest generation from existing findings (no new research)
   * This is used when findings already exist and we just need to generate the digest
   */
  async queueDigestFromExistingFindings(
    topicId: string,
    timeframe: DigestTimeframe = 'weekly'
  ): Promise<DigestQueueItem> {
    console.log('Queueing digest generation from existing findings for topic:', topicId);

    try {
      // Get existing findings for the topic using the service (respects storage config)
      const findings = await findingsService.getFindings(topicId);

      if (findings.length === 0) {
        throw new Error('No findings available to generate digest');
      }

      // Sort findings by timestamp (newest first)
      findings.sort((a, b) => b.timestamp - a.timestamp);

      // Get finding IDs
      const findingIds = findings.map(f => f.id);

      // Queue the digest generation with high priority since user is waiting
      const queueItem = await this.queueDigestGeneration(
        topicId,
        timeframe,
        findingIds,
        'high',
        'user'
      );

      console.log(`Queued digest generation from ${findings.length} existing findings`);

      // Force immediate processing
      setTimeout(() => {
        console.log('[DigestQueueService] Triggering immediate queue processing');
        this.processQueue();
      }, 100);

      return queueItem;
    } catch (error) {
      console.error('Error queueing digest from existing findings:', error);
      throw error;
    }
  }

  /**
   * Helper method to generate digest from findings
   */
  private async generateDigestFromFindings(
    queueItem: DigestQueueItem,
    topic: Topic,
    findings: ResearchFinding[],
    timeframe: DigestTimeframe
  ): Promise<SmartDigest> {
    // Filter findings based on timeframe
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let filteredFindings = findings;

    switch (timeframe) {
      case 'daily':
        filteredFindings = findings.filter(f => f.timestamp > now - day);
        break;
      case 'weekly':
        filteredFindings = findings.filter(f => f.timestamp > now - (7 * day));
        break;
      case 'monthly':
        filteredFindings = findings.filter(f => f.timestamp > now - (30 * day));
        break;
      // 'all-time' uses all findings
    }

    console.log(`Generating digest from ${filteredFindings.length} findings (${timeframe})`);

    // Call backend to generate digest with ALL findings
    try {
      // Send ALL findings for complete analysis - backend uses smart formatting
      const response = await longOperationApi.post('/digest/generate-digest', {
        findings: filteredFindings, // Send ALL findings - no artificial limits
        topic,
        timeframe
      });

      // Backend returns digest directly, not wrapped in { digest: ... }
      if (!response.data) {
        throw new Error('No digest data returned from backend');
      }

      // Ensure the digest has the topicId (backend might not include it)
      const digest = {
        ...response.data,
        topicId: topic.id  // Ensure topicId is always present
      };

      return digest;
    } catch (error) {
      console.error('Error calling generate-digest API:', error);

      if (error && typeof error === 'object') {
        const axiosError = error as any;

        if (axiosError.response?.status === 504) {
          console.error('Gateway timeout - digest generation took too long');
        }

        if (axiosError.code === 'ECONNABORTED') {
          throw new Error('Request timeout - digest generation took too long');
        }

        if (axiosError.response?.data?.error) {
          throw new Error(axiosError.response.data.error);
        }
      }
      throw error;
    }
  }

  // Helper methods
  private getPriorityLevel(priority: DigestPriority): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  // Start queue processor (runs continuously)
  private startQueueProcessor(): void {
    // Clear any existing interval
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
    }

    // REMOVED: Continuous polling every 30 seconds was causing unnecessary API calls
    // Only process queue when explicitly triggered (new digest request, etc.)
    console.log('[DigestQueueService] Queue processor ready - will process on demand only');
  }

  // Start polling (call after user logs in)
  public startPolling(): void {
    console.log('[DigestQueueService] Initializing queue service after login');
    this.startQueueProcessor();

    // Check for any pending items ONCE on login
    setTimeout(() => {
      console.log('[DigestQueueService] One-time queue check after login');
      this.processQueue();
    }, 1000);
  }

  // Stop polling (call on logout)
  public stopPolling(): void {
    console.log('[DigestQueueService] Stopping queue polling on logout');
    this.stopQueueProcessor();
  }

  // Stop the queue processor (internal use)
  private stopQueueProcessor(): void {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
  }

  // Notification methods (these would trigger UI updates via events or state management)
  private notifyProgressUpdate(item: DigestQueueItem): void {
    // Dispatch event or update global state
    window.dispatchEvent(new CustomEvent('digest-progress', {
      detail: { queueItem: item }
    }));
  }

  private notifyCompletion(item: DigestQueueItem, digest: SmartDigest): void {
    // Dispatch event or update global state
    window.dispatchEvent(new CustomEvent('digest-completed', {
      detail: { queueItem: item, digest }
    }));
  }

  private notifyFailure(item: DigestQueueItem): void {
    // Dispatch event or update global state
    window.dispatchEvent(new CustomEvent('digest-failed', {
      detail: { queueItem: item }
    }));
  }

  // Clean up old completed/failed items (housekeeping)
  async cleanupOldItems(daysToKeep = 7): Promise<void> {
    // Trigger cleanup via API
    const response = await digestQueueAPI.cleanupQueue();

    if (response.success) {
      console.log(`Cleaned up ${response.staleCancelled || 0} stale and ${response.oldDeleted || 0} old items`);
    }
  }
}

// Export singleton instance
export const digestQueueService = DigestQueueService.getInstance();