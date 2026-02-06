/**
 * Digest Processor Service
 *
 * Autonomous background processor that polls the digest_queue table
 * and generates digests without requiring user presence.
 *
 * This service closes the critical gap in the autonomous agent system:
 * - Scheduler runs agents → stores findings → queues digest
 * - DigestProcessor polls queue → generates digest → stores result
 * - User sees completed digest immediately (no "Ready to Generate")
 *
 * Follows the same pattern as SchedulerService for consistency.
 */

import { Pool } from 'pg';
import DigestQueueServicePG from './digestQueue.service.pg.js';
import { FindingModel } from '../models/finding.model.js';
import { TopicModel } from '../models/topic.model.js';
import { generateSmartDigest } from './ai.service.js';
import { query } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Count findings by source type for the source stats bar
 * This serves as a backup/validation for AI-generated sourceBreakdown
 */
function countSourcesByType(findings: any[]): {
  pubmed: number;
  clinicalTrials: number;
  fda: number;
  web: number;
} {
  const breakdown = { pubmed: 0, clinicalTrials: 0, fda: 0, web: 0 };

  for (const finding of findings) {
    const sourceType = (finding.source?.type || '').toLowerCase();

    if (sourceType.includes('pubmed') || sourceType.includes('research') || sourceType === 'academic') {
      breakdown.pubmed++;
    } else if (sourceType.includes('clinical') || sourceType.includes('trial')) {
      breakdown.clinicalTrials++;
    } else if (sourceType.includes('fda')) {
      breakdown.fda++;
    } else {
      breakdown.web++;
    }
  }

  return breakdown;
}

interface QueueItem {
  id: string;
  user_id: string;
  topic_id: string;
  timeframe: string;
  digest_type: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  metadata: any;
}

export class DigestProcessorService {
  private pool: Pool;
  private queueService: DigestQueueServicePG;
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 10000; // 10 seconds — faster pickup for user-initiated digests

  constructor(pool: Pool) {
    this.pool = pool;
    this.queueService = new DigestQueueServicePG(pool);
  }

  /**
   * Start the background processor
   */
  start(): void {
    console.log('[DigestProcessor] Starting background digest processor');
    console.log(`[DigestProcessor] Poll interval: ${this.POLL_INTERVAL_MS / 1000} seconds`);

    // Run immediately on start
    this.processNextItem();

    // Then poll at regular intervals
    this.pollInterval = setInterval(() => {
      this.processNextItem();
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop the background processor
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[DigestProcessor] Stopped');
  }

  /**
   * Process the next pending queue item
   */
  private async processNextItem(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get next pending item (oldest first, respecting priority)
      const pending = await this.getNextPendingItem();

      if (!pending) {
        // No items to process
        return;
      }

      console.log(`[DigestProcessor] Processing queue item ${pending.id} for topic ${pending.topic_id}`);

      // Update status to 'processing'
      await this.queueService.updateQueueStatus(pending.id, 'processing');

      try {
        // Generate the digest
        const digestId = await this.generateAndStoreDigest(pending);

        // Mark as completed with result reference
        await this.markCompleted(pending.id, digestId);

        console.log(`[DigestProcessor] ✅ Completed digest ${digestId} for topic ${pending.topic_id}`);

      } catch (error) {
        // Handle generation failure
        await this.handleFailure(pending, error);
      }

    } catch (error) {
      console.error('[DigestProcessor] Error in processNextItem:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the next pending queue item
   */
  private async getNextPendingItem(): Promise<QueueItem | null> {
    const result = await query<QueueItem>(
      `SELECT * FROM digest_queue
       WHERE (
         status = 'pending'
         OR (status = 'processing' AND started_at < NOW() - INTERVAL '5 minutes')
       )
       AND retry_count < max_retries
       ORDER BY
         CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
         priority DESC,
         created_at ASC
       LIMIT 1`,
      []
    );
    return result[0] || null;
  }

  /**
   * Generate digest and store it
   */
  private async generateAndStoreDigest(item: QueueItem): Promise<string> {
    // 1. Fetch findings for the topic
    let findings = await FindingModel.getFiltered(item.user_id, {
      topic_id: item.topic_id,
      limit: 100 // Reasonable limit for digest generation
    });

    // SAFETY CAP: Limit to 50 most recent findings to prevent AI timeout
    // If more than 50 findings exist, prioritize by recency
    const MAX_FINDINGS_FOR_DIGEST = 50;
    if (findings.length > MAX_FINDINGS_FOR_DIGEST) {
      console.log(`[DigestProcessor] Capping findings from ${findings.length} to ${MAX_FINDINGS_FOR_DIGEST}`);
      // Sort by created_at descending (most recent first) and take top 50
      findings = findings
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, MAX_FINDINGS_FOR_DIGEST);
    }

    if (findings.length === 0) {
      throw new Error('No findings available for digest generation');
    }

    console.log(`[DigestProcessor] Found ${findings.length} findings for topic ${item.topic_id}`);

    // 2. Fetch topic details (needed for diseaseProfile context)
    const topic = await TopicModel.getById(item.topic_id, item.user_id);

    if (!topic) {
      throw new Error(`Topic ${item.topic_id} not found`);
    }

    // 3. Prepare topic object for AI service (matches expected format)
    const topicForDigest = {
      id: topic.id,
      name: topic.name,
      diseaseProfile: (topic.metadata as any)?.diseaseProfile || { name: topic.name },
      patientContext: topic.patient_context || {}
    };

    // 4. Transform findings to expected format for AI service
    const findingsForDigest = findings.map(f => ({
      id: f.id,
      type: f.source?.type || 'unknown',
      title: f.title,
      summary: f.summary || f.content?.substring(0, 500),
      source: f.source
    }));

    // 5. Generate digest using AI service
    console.log(`[DigestProcessor] Calling AI service for digest generation...`);
    const timeframe = (item.timeframe || 'all-time') as 'daily' | 'weekly' | 'monthly' | 'all-time';
    const digest = await generateSmartDigest(findingsForDigest, topicForDigest, timeframe);

    // 6. Store digest in database
    const digestId = uuidv4();
    const findingIds = findings.map(f => f.id);

    await query(
      `INSERT INTO digests (
        id, user_id, topic_id, type, title,
        executive_summary, layman_summary, themes, contradictions,
        breakthroughs, knowledge_gaps, next_steps, key_takeaways,
        trends, clinical_implications, lifestyle_considerations,
        questions_for_doctor, warning_signs, finding_ids, metadata,
        featured_discovery, top_findings, source_breakdown
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23
      )`,
      [
        digestId,
        item.user_id,
        item.topic_id,
        item.timeframe || item.digest_type || 'smart_digest',
        (digest as any).title || `${topic.name} Research Digest`,
        (digest as any).executiveSummary,
        (digest as any).laymanSummary,
        JSON.stringify((digest as any).themes || []),
        JSON.stringify((digest as any).contradictions || []),
        JSON.stringify((digest as any).breakthroughs || []),
        JSON.stringify((digest as any).knowledgeGaps || []),
        JSON.stringify((digest as any).nextSteps || []),
        JSON.stringify((digest as any).keyTakeaways || []),
        JSON.stringify((digest as any).trends || {}),
        JSON.stringify((digest as any).clinicalImplications || []),
        JSON.stringify((digest as any).lifestyleConsiderations || []),
        JSON.stringify((digest as any).questionsForDoctor || []),
        JSON.stringify((digest as any).warningSigns || []),
        findingIds,
        JSON.stringify({
          source: 'background-processor',
          queueItemId: item.id,
          findingsCount: findings.length,
          generatedAt: new Date().toISOString(),
          timeframe: item.timeframe || 'all-time'
        }),
        JSON.stringify((digest as any).featuredDiscovery || null),
        JSON.stringify((digest as any).topFindings || []),
        JSON.stringify((digest as any).sourceBreakdown || countSourcesByType(findings))
      ]
    );

    return digestId;
  }

  /**
   * Mark queue item as completed
   */
  private async markCompleted(queueId: string, digestId: string): Promise<void> {
    await query(
      `UPDATE digest_queue
       SET status = 'completed',
           completed_at = NOW(),
           result_id = $2
       WHERE id = $1`,
      [queueId, digestId]
    );
  }

  /**
   * Handle processing failure with retry logic
   */
  private async handleFailure(item: QueueItem, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = item.retry_count + 1;

    console.error(`[DigestProcessor] Failed to process queue item ${item.id}:`, errorMessage);

    if (newRetryCount >= item.max_retries) {
      // Max retries reached - mark as failed
      await query(
        `UPDATE digest_queue
         SET status = 'failed',
             error = $2,
             retry_count = $3
         WHERE id = $1`,
        [item.id, errorMessage, newRetryCount]
      );
      console.log(`[DigestProcessor] Queue item ${item.id} failed after ${newRetryCount} attempts`);
    } else {
      // Reset to pending for retry
      await query(
        `UPDATE digest_queue
         SET status = 'pending',
             error = $2,
             retry_count = $3
         WHERE id = $1`,
        [item.id, errorMessage, newRetryCount]
      );
      console.log(`[DigestProcessor] Queue item ${item.id} will retry (attempt ${newRetryCount}/${item.max_retries})`);
    }
  }
}
