import { getDB } from '@/utils/db/database';
import { api, longOperationApi } from '@/services/api';
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

    // Check if there's already a pending request for this topic/timeframe
    const existingQueue = await db.getAllFromIndex('digestQueue', 'by-topic', topicId);
    const existing = existingQueue.find(
      q => q.timeframe === timeframe &&
      (q.status === 'pending' || q.status === 'processing')
    );

    if (existing) {
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

    // Trigger queue processing
    this.processQueue();

    return queueItem;
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

  // Process the queue
  private async processQueue(): Promise<void> {
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

      // Get topic and findings
      const topic = await db.get('topics', item.topicId);
      const findings = await Promise.all(
        item.findingIds.map(id => db.get('findings', id))
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

      // Save the digest
      await db.add('digests', digest);

      // Mark all findings in this digest as read (not new)
      for (const findingId of digest.allFindingIds) {
        const finding = await db.get('findings', findingId);
        if (finding && finding.isNew) {
          finding.isNew = false;
          finding.userEngagement = {
            ...finding.userEngagement,
            viewed: true
          };
          await db.put('findings', finding);
        }
      }

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
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // API call using long operation API with 5-minute timeout
        const response = await longOperationApi.post('/generate-digest', {
          findings: findings.slice(0, 50), // Limit to 50 findings to reduce payload
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