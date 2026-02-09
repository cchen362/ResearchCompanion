/**
 * Autonomous Agent Scheduler Service
 *
 * This service implements the originally-intended autonomous agent execution system.
 * It runs on a schedule to check which agents are due for execution and runs them
 * in the background without user interaction.
 *
 * Key features:
 * - Runs every 15 minutes to check agent schedules
 * - Executes agents based on their configured schedule (daily/weekly/monthly)
 * - Non-blocking background execution
 * - Creates notifications when agents complete
 * - Respects rate limits and prevents concurrent runs
 */

import { AgentModel } from '../models/agent.model.js';
import { TopicModel } from '../models/topic.model.js';
import { FindingModel } from '../models/finding.model.js';
import { NotificationModel } from '../models/notification.model.js';
// import { digestQueueService } from './digestQueue.service.js'; // TODO: Implement when needed
import { AgentExecutionService } from './agent-execution.service.js';
import type { Agent } from '../models/agent.model.js';

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private executionService: AgentExecutionService;

  // Run scheduler every 15 minutes in production, 1 minute in development for testing
  private readonly SCHEDULE_INTERVAL = process.env.NODE_ENV === 'production'
    ? 15 * 60 * 1000  // 15 minutes
    : 1 * 60 * 1000;  // 1 minute for testing

  constructor() {
    this.executionService = new AgentExecutionService();
  }

  /**
   * Start the autonomous agent scheduler
   */
  start() {
    if (this.intervalId) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting autonomous agent scheduler');
    console.log(`[Scheduler] Check interval: ${this.SCHEDULE_INTERVAL / 1000} seconds`);

    // Set up the interval
    this.intervalId = setInterval(() => {
      this.processScheduledAgents().catch(error => {
        console.error('[Scheduler] Error in scheduled processing:', error);
      });
    }, this.SCHEDULE_INTERVAL);

    // Run immediately on startup to catch any overdue agents
    this.processScheduledAgents().catch(error => {
      console.error('[Scheduler] Error in initial processing:', error);
    });
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      console.log('[Scheduler] Stopping autonomous agent scheduler');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Process all agents that are due for execution
   */
  private async processScheduledAgents() {
    if (this.isRunning) {
      console.log('[Scheduler] Previous run still in progress, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[Scheduler] Checking for agents due to run...');

      // Get all active topics with enabled auto-refresh
      const activeTopics = await TopicModel.getAllActive();

      if (!activeTopics || activeTopics.length === 0) {
        console.log('[Scheduler] No active topics found');
        return;
      }

      console.log(`[Scheduler] Found ${activeTopics.length} active topics`);

      let totalAgentsRun = 0;
      const maxConcurrent = 5; // Limit concurrent topic processing

      // Process topics in batches to avoid overloading the server
      for (let i = 0; i < activeTopics.length; i += maxConcurrent) {
        const batch = activeTopics.slice(i, i + maxConcurrent);

        await Promise.all(batch.map(async (topic) => {
          try {
            // Get agents that are due for this topic
            const dueAgents = await this.getAgentsDueForTopic(topic.id, topic.user_id);

            if (dueAgents.length > 0) {
              console.log(`[Scheduler] Topic ${topic.id} (${topic.name}): ${dueAgents.length} agents due`);

              // Execute agents in background (don't await)
              this.executeAgentsInBackground(topic.id, topic.user_id, topic.name, dueAgents)
                .catch(error => {
                  console.error(`[Scheduler] Error executing agents for topic ${topic.id}:`, error);
                });

              totalAgentsRun += dueAgents.length;
            }
          } catch (error) {
            console.error(`[Scheduler] Error processing topic ${topic.id}:`, error);
          }
        }));
      }

      const duration = Date.now() - startTime;
      console.log(`[Scheduler] Cycle complete: ${totalAgentsRun} agents queued for execution (${duration}ms)`);

    } catch (error) {
      console.error('[Scheduler] Error in processScheduledAgents:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get agents that are due to run for a specific topic
   */
  private async getAgentsDueForTopic(topicId: string, userId: string): Promise<Agent[]> {
    try {
      // Get all agents for this user
      const allAgents = await AgentModel.getAllByUserId(userId);

      // Filter to agents for this topic that are enabled and due
      const now = new Date();
      const dueAgents = allAgents.filter(agent => {
        // Check if agent is for this topic and enabled
        if (!agent.enabled || agent.topic_id !== topicId) {
          return false;
        }

        // Check if it's time to run based on schedule
        if (!agent.last_run) {
          // Never run before, so it's due
          return true;
        }

        const lastRunTime = new Date(agent.last_run).getTime();
        const timeSinceLastRun = now.getTime() - lastRunTime;

        // Check based on schedule
        switch (agent.schedule || 'daily') {
          case 'hourly':
            return timeSinceLastRun >= 60 * 60 * 1000; // 1 hour
          case 'daily':
            return timeSinceLastRun >= 24 * 60 * 60 * 1000; // 24 hours
          case 'weekly':
            return timeSinceLastRun >= 7 * 24 * 60 * 60 * 1000; // 7 days
          case 'monthly':
            return timeSinceLastRun >= 30 * 24 * 60 * 60 * 1000; // 30 days
          default:
            return false; // Manual only
        }
      });

      return dueAgents;
    } catch (error) {
      console.error(`[Scheduler] Error getting due agents for topic ${topicId}:`, error);
      return [];
    }
  }

  /**
   * Execute agents in the background for a topic
   */
  private async executeAgentsInBackground(
    topicId: string,
    userId: string,
    topicName: string,
    agents: Agent[]
  ) {
    const startTime = Date.now();
    const AGENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes max

    console.log(`[Scheduler] Starting background execution for topic "${topicName}"`);

    try {
      // Wrap execution with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Agent execution timed out')), AGENT_TIMEOUT);
      });

      const executionPromise = this.executionService.runAgentsForTopic(
        topicId,
        userId,
        agents
      );

      const findings = await Promise.race([executionPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      console.log(`[Scheduler] Topic "${topicName}": Found ${findings.length} findings in ${duration}ms`);

      // Update last_run and next_run for all executed agents
      for (const agent of agents) {
        try {
          const now = new Date();
          const nextRun = this.calculateNextRun(agent.schedule || 'daily', now);
          await AgentModel.update(agent.id, userId, {
            last_run: now,
            next_run: nextRun
          });
        } catch (updateError) {
          console.error(`[Scheduler] Failed to update timestamps for agent ${agent.name}:`, updateError);
        }
      }

      if (findings.length > 0) {
        // PHASE 1: Queue digest generation directly in backend
        try {
          const { pool } = await import('../db/database.js');
          const DigestQueueServicePG = (await import('./digestQueue.service.pg.js')).default;
          const queueService = new DigestQueueServicePG(pool);

          await queueService.createQueueItem({
            userId,
            topicId,
            timeframe: 'weekly',  // Match frontend default for seamless display
            digestType: 'smart',
            priority: 5,
            metadata: {
              source: 'scheduled-agent-run',
              findingsCount: findings.length
            }
          });
          console.log(`[Scheduler] Queued digest generation for topic "${topicName}"`);
        } catch (queueError) {
          console.error(`[Scheduler] Failed to queue digest for topic "${topicName}":`, queueError);
        }

        // Create notification
        await this.createBackgroundNotification(userId, topicId, topicName, findings.length, agents.length);
      }
    } catch (error: any) {
      if (error.message === 'Agent execution timed out') {
        console.log(`[Scheduler] Topic "${topicName}": Timed out after 5 minutes`);
      } else {
        console.error(`[Scheduler] Error executing agents for topic "${topicName}":`, error);
      }
    }
  }

  /**
   * Create a notification for background agent completion
   */
  private async createBackgroundNotification(
    userId: string,
    topicId: string,
    topicName: string,
    findingsCount: number,
    agentsCount: number
  ) {
    try {
      await NotificationModel.create({
        userId,
        type: 'agent_complete',
        title: 'Research Update Available',
        message: `Found ${findingsCount} new research item${findingsCount !== 1 ? 's' : ''} for "${topicName}"`,
        priority: findingsCount > 10 ? 'high' : 'normal',
        data: {
          topicId,
          topicName,
          findingsCount,
          agentsCount,
          source: 'autonomous'
        }
      });

      console.log(`[Scheduler] Notification created for user ${userId}`);
    } catch (error) {
      console.error('[Scheduler] Error creating notification:', error);
    }
  }

  /**
   * Calculate the next run time based on schedule
   */
  private calculateNextRun(schedule: string, from: Date = new Date()): Date {
    const baseTime = from.getTime();

    switch (schedule) {
      case 'hourly':
        return new Date(baseTime + 60 * 60 * 1000); // 1 hour
      case 'daily':
        return new Date(baseTime + 24 * 60 * 60 * 1000); // 24 hours
      case 'weekly':
        return new Date(baseTime + 7 * 24 * 60 * 60 * 1000); // 7 days
      case 'monthly':
        return new Date(baseTime + 30 * 24 * 60 * 60 * 1000); // 30 days
      default:
        // For manual or unknown schedules, set far in the future
        return new Date(baseTime + 365 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get scheduler status for monitoring
   */
  getStatus() {
    return {
      running: this.intervalId !== null,
      processing: this.isRunning,
      interval: this.SCHEDULE_INTERVAL,
      environment: process.env.NODE_ENV
    };
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();