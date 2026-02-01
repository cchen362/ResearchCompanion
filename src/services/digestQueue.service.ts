import { getDB } from '@/utils/db/database';
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

// Digest Queue Service - Manages background digest generation
export class DigestQueueService {
  private static instance: DigestQueueService;
  private processingQueue = false;
  private currentProcessingId: string | null = null;
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private queueLocks = new Set<string>();

  private constructor() {
    // Start processing queue on instantiation
    this.startQueueProcessor();
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
    const db = await getDB();

    // Add mutex-like check to prevent race conditions
    const lockKey = `queue_${topicId}_${timeframe}`;
    if (this.queueLocks.has(lockKey)) {
      console.log(`Queue generation already in progress for ${topicId}/${timeframe}, returning existing`);
      // Wait a moment for the other request to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      const existingQueue = await this.getQueueStatus(topicId);
      if (existingQueue) {
        return existingQueue;
      }
    }

    // Set lock
    this.queueLocks.add(lockKey);

    try {
      // Check if there's already a pending request for this topic/timeframe
      const existingQueue = await db.getAllFromIndex('digestQueue', 'by-topic', topicId);
      const existing = existingQueue.find(
        q => q.timeframe === timeframe &&
        (q.status === 'pending' || q.status === 'processing')
      );

      if (existing) {
        console.log(`Found existing queue item for ${topicId}/${timeframe}, reusing`);
        // Update priority if new request is higher priority
        if (this.getPriorityLevel(priority) > this.getPriorityLevel(existing.priority)) {
          existing.priority = priority;
          await db.put('digestQueue', existing);
        }
        return existing;
      }

    // Create new queue item
    const queueItem: DigestQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId,
      timeframe,
      status: 'pending',
      priority,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
      findingIds,
      requestedBy,
      estimatedCompletionTime: Date.now() + 30000, // Estimate 30 seconds
      progress: {
        stage: 'queued',
        percentage: 0,
        message: 'Waiting in queue...'
      }
    };

      await db.add('digestQueue', queueItem);

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

  // Get queue status for a topic
  async getQueueStatus(topicId: string): Promise<DigestQueueItem | null> {
    const db = await getDB();
    const items = await db.getAllFromIndex('digestQueue', 'by-topic', topicId);

    // Return the most recent active item
    return items.find(item =>
      item.status === 'pending' || item.status === 'processing'
    ) || null;
  }

  // Get all queue items
  async getAllQueueItems(): Promise<DigestQueueItem[]> {
    const db = await getDB();
    return await db.getAll('digestQueue');
  }

  // Cancel a queued digest generation
  async cancelQueueItem(queueItemId: string): Promise<boolean> {
    const db = await getDB();
    const item = await db.get('digestQueue', queueItemId);

    if (!item || item.status === 'completed') {
      return false;
    }

    item.status = 'cancelled';
    item.completedAt = Date.now();
    await db.put('digestQueue', item);

    // Clear retry timeout if exists
    const timeout = this.retryTimeouts.get(queueItemId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(queueItemId);
    }

    return true;
  }

  // Update queue item progress
  async updateProgress(
    queueItemId: string,
    stage: 'queued' | 'fetching' | 'analyzing' | 'generating' | 'validating',
    percentage: number,
    message: string
  ): Promise<void> {
    const db = await getDB();
    const item = await db.get('digestQueue', queueItemId);

    if (item && item.status === 'processing') {
      item.progress = { stage, percentage, message };

      // Update estimated completion time based on progress
      if (percentage > 0) {
        const elapsed = Date.now() - (item.startedAt || Date.now());
        const estimatedTotal = elapsed / (percentage / 100);
        item.estimatedCompletionTime = (item.startedAt || Date.now()) + estimatedTotal;
      }

      await db.put('digestQueue', item);

      // Notify UI of progress update
      this.notifyProgressUpdate(item);
    }
  }

  // Process the queue (made public so components can trigger immediate processing)
  async processQueue(): Promise<void> {
    if (this.processingQueue) return;

    this.processingQueue = true;

    try {
      const db = await getDB();

      // Get next item to process (highest priority first)
      const pendingItems = await db.getAllFromIndex('digestQueue', 'by-status', 'pending');

      if (pendingItems.length === 0) {
        return;
      }

      // Sort by priority and creation time
      const sortedItems = pendingItems.sort((a, b) => {
        const priorityDiff = this.getPriorityLevel(b.priority) - this.getPriorityLevel(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      });

      const nextItem = sortedItems[0];
      this.currentProcessingId = nextItem.id;

      // Update status to processing
      nextItem.status = 'processing';
      nextItem.startedAt = Date.now();
      nextItem.attempts += 1;
      await db.put('digestQueue', nextItem);

      // Process the digest generation
      await this.processDigestGeneration(nextItem);

      // Continue processing queue
      setTimeout(() => this.processQueue(), 1000);

    } finally {
      this.processingQueue = false;
      this.currentProcessingId = null;
    }
  }

  // Process individual digest generation
  private async processDigestGeneration(item: DigestQueueItem): Promise<void> {
    const db = await getDB();

    try {
      // Update progress: Fetching data
      await this.updateProgress(item.id, 'fetching', 10, 'Fetching research findings...');

      // Get topic and findings using services (respects storage config)
      const topic = await topicsService.getTopic(item.topicId);
      const findings = await Promise.all(
        item.findingIds.map(id => findingsService.getFinding(id))
      );

      const validFindings = findings.filter(f => f !== undefined) as ResearchFinding[];

      if (!topic || validFindings.length === 0) {
        throw new Error('Topic or findings not found');
      }

      // Update progress: Analyzing
      await this.updateProgress(item.id, 'analyzing', 30, 'Analyzing research patterns...');

      // Generate digest via API (with simulated progress updates)
      const digest = await this.generateDigestWithProgress(
        item,
        topic,
        validFindings,
        item.timeframe
      );

      // Update progress: Validating
      await this.updateProgress(item.id, 'validating', 90, 'Validating and saving digest...');

      // Save the digest using service (respects storage config)
      console.log('[DIGEST SAVE] Saving digest with finding_ids:', digest.allFindingIds?.length || 0);
      console.log('[DIGEST SAVE] First 3 finding IDs:', digest.allFindingIds?.slice(0, 3));
      await digestService.saveDigest(digest);

      // Skip marking findings as read here to avoid unnecessary API calls
      // Findings will be marked as read when user actually views them
      console.log(`[DIGEST SAVE] Successfully saved digest with ${digest.allFindingIds?.length || 0} findings`);

      // Update queue item as completed
      item.status = 'completed';
      item.completedAt = Date.now();
      item.resultDigestId = digest.id;
      await db.put('digestQueue', item);

      // Notify UI of completion
      this.notifyCompletion(item, digest);

    } catch (error) {
      console.error('Error generating digest:', error);

      // Handle retry logic
      if (item.attempts < item.maxAttempts) {
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, item.attempts) * 5000; // 5s, 10s, 20s

        item.status = 'pending';
        item.error = error instanceof Error ? error.message : 'Unknown error';
        await db.put('digestQueue', item);

        const timeout = setTimeout(() => {
          this.retryTimeouts.delete(item.id);
          this.processQueue();
        }, retryDelay);

        this.retryTimeouts.set(item.id, timeout);

      } else {
        // Max attempts reached, mark as failed
        item.status = 'failed';
        item.completedAt = Date.now();
        item.error = error instanceof Error ? error.message : 'Unknown error';
        await db.put('digestQueue', item);

        // Notify UI of failure
        this.notifyFailure(item);
      }
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

    const db = await getDB();

    // Get the topic from the backend service
    const topic = await topicsService.getTopic(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    // Step 1: Ensure agents exist for the topic
    await ensureDefaultAgents(topicId);

    // Step 2: Create a special queue item for research + digest
    const queueItem: DigestQueueItem = {
      id: `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId,
      timeframe,
      status: 'processing',
      priority,
      createdAt: Date.now(),
      startedAt: Date.now(),
      attempts: 1,
      maxAttempts: 3,
      findingIds: [], // Will be populated after research
      requestedBy: 'user',
      estimatedCompletionTime: Date.now() + 120000, // Estimate 2 minutes for research + digest
      progress: {
        stage: 'fetching',
        percentage: 0,
        message: 'Starting research agents...'
      }
    };

    // Save the queue item
    await db.add('digestQueue', queueItem);
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

      // Update queue item with all finding IDs
      queueItem.findingIds = allFindings.map(f => f.id);
      await db.put('digestQueue', queueItem);

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

      // Step 6: Complete the queue item
      queueItem.status = 'completed';
      queueItem.completedAt = Date.now();
      queueItem.result = digest;
      await db.put('digestQueue', queueItem);

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

      // Update queue item as failed
      queueItem.status = 'failed';
      queueItem.completedAt = Date.now();
      queueItem.error = error instanceof Error ? error.message : 'Unknown error';
      await db.put('digestQueue', queueItem);

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

    const db = await getDB();

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

      // Force immediate processing instead of waiting for the interval
      // This fixes the issue where digest generation requires navigation
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
      const response = await longOperationApi.post('/generate-digest', {
        findings: filteredFindings, // Send ALL findings - no artificial limits
        topic,
        timeframe
      });

      // Backend returns digest directly, not wrapped in { digest: ... }
      if (!response.data) {
        throw new Error('No digest data returned from backend');
      }

      return response.data;
    } catch (error) {
      console.error('Error calling generate-digest API:', error);

      // Check for timeout errors
      if (error && typeof error === 'object') {
        const axiosError = error as any;

        // Check for 504 Gateway Timeout
        if (axiosError.response?.status === 504) {
          console.error('Gateway timeout - digest generation took too long');
          // Note: With 120s timeout, this should rarely happen
          // If it does, the issue is infrastructure (Cloudflare), not finding count
        }

        // Check for other axios errors
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

  // Generate digest with progress updates and robust error handling
  private async generateDigestWithProgress(
    queueItem: DigestQueueItem,
    topic: Topic,
    findings: ResearchFinding[],
    timeframe: DigestTimeframe
  ): Promise<SmartDigest> {

    // First, check if backend is healthy
    try {
      const healthCheck = await api.get('/health');

      if (healthCheck.status !== 200) {
        throw new Error('Backend health check failed');
      }
    } catch (error) {
      console.error('Backend is not available:', error);
      // Use fallback client-side digest generation
      return this.generateClientSideDigest(topic, findings, timeframe);
    }

    // Update progress: Generating
    await this.updateProgress(queueItem.id, 'generating', 50, 'Generating intelligent digest...');

    // Implement retry logic with exponential backoff
    let lastError: Error | null = null;
    const maxRetries = 2; // Reasonable retry count with 120s timeout

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Send ALL findings - backend now has 120s timeout and smart formatting
        console.log(`[DigestQueue] Attempt ${attempt}: Sending ALL ${findings.length} findings`);

        const response = await longOperationApi.post('/generate-digest', {
          findings: findings, // Send ALL findings - no artificial limits
          topic,
          timeframe
        });

        // Axios returns data directly
        const digestData = response.data;

        // Validate response has required fields
        if (!digestData.executiveSummary || !digestData.themes) {
          throw new Error('Invalid digest response: missing required fields');
        }

        // Update progress: Almost done
        await this.updateProgress(queueItem.id, 'generating', 80, 'Finalizing digest...');

        // Create SmartDigest object with fallback values
        const digest: SmartDigest = {
          id: `digest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          topicId: topic.id,
          generatedAt: Date.now(),
          timeframe,
          executiveSummary: digestData.executiveSummary || 'No summary available',
          laymanSummary: digestData.laymanSummary,
          themes: digestData.themes || [],
          keyTakeaways: digestData.keyTakeaways || [],
          breakthroughs: digestData.breakthroughs,
          contradictions: digestData.contradictions,
          trends: digestData.trends || { emerging: [], declining: [], stable: [] },
          statistics: digestData.statistics || {
            totalFindings: findings.length,
            newFindings: 0,
            highPriorityCount: findings.filter(f => f.priority === 'high').length,
            sourceCount: new Set(findings.map(f => f.source.name)).size,
            mediumPriorityCount: findings.filter(f => f.priority === 'medium').length
          },
          topSources: digestData.topSources || [],
          allFindingIds: findings.map(f => f.id)
        };

        return digest;

      } catch (error) {
        lastError = error as Error;

        // Log error for debugging
        console.error(`Digest generation attempt ${attempt} failed:`, error);

        // Check if it's a timeout error
        if (error instanceof Error && error.message.includes('timeout')) {
          await this.updateProgress(queueItem.id, 'generating', 50,
            `Request timeout. Retrying (${attempt}/${maxRetries})...`);
        }

        if (attempt < maxRetries) {
          // Calculate backoff delay
          const backoffDelay = Math.pow(2, attempt - 1) * 2000; // 2s, 4s, 8s
          await this.updateProgress(queueItem.id, 'generating', 50,
            `Error occurred. Retrying in ${backoffDelay / 1000}s (${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('Failed to generate digest after multiple attempts');
  }

  // Generate a basic client-side digest when backend is unavailable
  private generateClientSideDigest(
    topic: Topic,
    findings: ResearchFinding[],
    timeframe: DigestTimeframe
  ): SmartDigest {
    const now = Date.now();
    const priorityOrder = ['high', 'medium', 'low'];
    const sortedFindings = [...findings].sort((a, b) => {
      const priorityA = priorityOrder.indexOf(a.priority || 'medium');
      const priorityB = priorityOrder.indexOf(b.priority || 'medium');
      return priorityA - priorityB;
    });
    const topFindings = sortedFindings.slice(0, 5);

    // Group findings by type
    const findingsByType = findings.reduce((acc, f) => {
      if (!acc[f.type]) acc[f.type] = [];
      acc[f.type].push(f);
      return acc;
    }, {} as Record<string, ResearchFinding[]>);

    // Create basic themes based on finding types
    const themes = Object.entries(findingsByType).map(([type, typeFindings]) => ({
      id: `theme_${type}_${now}`,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Updates`,
      summary: `${typeFindings.length} findings related to ${type}`,
      category: 'treatment' as const,
      importance: typeFindings.some(f => f.priority === 'high') ? 'high' as const : 'medium' as const,
      findingIds: typeFindings.map(f => f.id),
      findingCount: typeFindings.length,
      highPriorityCount: typeFindings.filter(f => f.priority === 'high').length,
      avgConfidence: 'medium' as const
    }));

    return {
      id: `digest_client_${now}`,
      topicId: topic.id,
      generatedAt: now,
      timeframe,
      executiveSummary: `Found ${findings.length} research findings for ${topic.name}. This is a basic summary generated locally. Connect to the backend for AI-powered insights.`,
      laymanSummary: `We found ${findings.length} new research items about ${topic.name}. The most relevant findings are shown below.`,
      themes,
      keyTakeaways: topFindings.map(f => f.title),
      trends: {
        emerging: [],
        declining: [],
        stable: []
      },
      statistics: {
        totalFindings: findings.length,
        newFindings: findings.filter(f => f.isNew).length,
        highPriorityCount: findings.filter(f => f.priority === 'high').length,
        sourceCount: new Set(findings.map(f => f.source.name)).size,
        mediumPriorityCount: findings.filter(f => f.priority === 'medium').length
      },
      topSources: [],
      allFindingIds: findings.map(f => f.id)
    };
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
    // Process queue every 5 seconds
    setInterval(() => {
      if (!this.processingQueue) {
        this.processQueue();
      }
    }, 5000);
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
    const db = await getDB();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const allItems = await db.getAll('digestQueue');

    for (const item of allItems) {
      if (
        (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') &&
        item.completedAt &&
        item.completedAt < cutoffTime
      ) {
        await db.delete('digestQueue', item.id);
      }
    }
  }
}

// Export singleton instance
export const digestQueueService = DigestQueueService.getInstance();