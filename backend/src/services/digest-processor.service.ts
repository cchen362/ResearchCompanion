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
import { DigestModel } from '../models/digest.model.js';
import { generateSmartDigest, scoreAndClusterFindings } from './ai.service.js';
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
    // 1. Fetch ALL findings for the topic (no limit — Haiku handles any corpus size)
    const findings = await FindingModel.getFiltered(item.user_id, {
      topic_id: item.topic_id
    });

    if (findings.length === 0) {
      throw new Error('No findings available for digest generation');
    }

    console.log(`[DigestProcessor] Found ${findings.length} findings for topic ${item.topic_id}`);

    // 2. Fetch topic details (needed for diseaseProfile context)
    const topic = await TopicModel.getById(item.topic_id, item.user_id);

    if (!topic) {
      throw new Error(`Topic ${item.topic_id} not found`);
    }

    // Temporal context: when was the last digest generated for this topic?
    const previousDigest = await DigestModel.getLatestByTopicId(item.user_id, item.topic_id);
    const previousDigestDate: Date | null = previousDigest?.created_at || null;
    if (previousDigestDate) {
      console.log(`[DigestProcessor] Previous digest found from ${previousDigestDate.toISOString()}`);
    } else {
      console.log(`[DigestProcessor] No previous digest — first for topic ${item.topic_id}`);
    }

    // 3. Prepare topic object for AI service (matches expected format)
    const topicForDigest = {
      id: topic.id,
      name: topic.name,
      diseaseProfile: (topic.metadata as any)?.diseaseProfile || { name: topic.name },
      patientContext: topic.patient_context || {}
    };

    // 4. Transform findings to expected format for AI service
    const findingsForAI = findings.map(f => ({
      id: f.id,
      type: f.source?.type || 'unknown',
      title: f.title,
      summary: f.summary || f.content?.substring(0, 300),
      source: f.source,
      created_at: f.created_at
    }));

    // Capture real total before any filtering
    const totalFindingsCount = findings.length;

    // PASS 1: Haiku scores and clusters ALL findings by significance
    console.log(`[DigestProcessor] Pass 1: Scoring ${totalFindingsCount} findings with Haiku...`);
    const scoredResult = await scoreAndClusterFindings(findingsForAI, topicForDigest.name, previousDigestDate);

    // Build tiered finding set for Sonnet based on Haiku's ranking
    const topFindingIds = new Set(scoredResult.topFindingIds);
    const topFindings = findingsForAI.filter(f => topFindingIds.has(f.id));
    const remainingFindings = findingsForAI.filter(f => !topFindingIds.has(f.id));

    // PASS 2: Sonnet generates editorial digest with Haiku context
    console.log(`[DigestProcessor] Pass 2: Generating digest with Sonnet (${topFindings.length} full + ${remainingFindings.length} condensed)...`);
    const digest = await generateSmartDigest(
      topFindings,
      remainingFindings,
      scoredResult,
      topicForDigest,
      totalFindingsCount,
      previousDigestDate
    );

    // 6. Store digest in database
    const digestId = uuidv4();
    const findingIds = findings.map(f => f.id);

    await query(
      `INSERT INTO digests (
        id, user_id, topic_id, type, title,
        whats_new, key_takeaways, finding_ids, metadata,
        featured_discovery, notable_findings, source_breakdown, for_your_doctor
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13
      )`,
      [
        digestId,
        item.user_id,
        item.topic_id,
        item.timeframe || item.digest_type || 'smart_digest',
        (digest as any).title || `${topic.name} Research Digest`,
        JSON.stringify((digest as any).whatsNew || { technical: '', explained: '' }),
        JSON.stringify((digest as any).keyTakeaways || []),
        findingIds,
        JSON.stringify({
          source: 'background-processor',
          queueItemId: item.id,
          findingsCount: totalFindingsCount,
          generatedAt: new Date().toISOString(),
          timeframe: item.timeframe || 'all-time',
          statistics: (digest as any).statistics || {
            totalFindings: totalFindingsCount,
            newFindings: previousDigestDate
              ? findings.filter(f => f.created_at && new Date(f.created_at) > previousDigestDate).length
              : totalFindingsCount,
            analyzedFindings: totalFindingsCount
          }
        }),
        JSON.stringify((digest as any).featuredDiscovery || null),
        JSON.stringify((digest as any).notableFindings || []),
        JSON.stringify((digest as any).sourceBreakdown || countSourcesByType(findings)),
        JSON.stringify((digest as any).forYourDoctor || { questions: [], watchFor: [], conflicts: [] })
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
