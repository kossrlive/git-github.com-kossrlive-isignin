/**
 * Bull queue configuration for SMS job processing
 * Provides queue instances for background job processing
 */

import type { Job, Queue } from 'bull';
import Bull from 'bull';
import { logger } from '../config/logger.js';

export interface SMSJobData {
  phone: string;
  message: string;
  attemptNumber?: number;
  callbackUrl?: string;
}

let smsQueue: Queue<SMSJobData> | null = null;

/**
 * Get or create SMS queue instance
 * Uses singleton pattern to ensure only one queue
 */
export function getSMSQueue(): Queue<SMSJobData> {
  if (smsQueue) {
    return smsQueue;
  }

  // Get Redis configuration from environment variables
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  logger.info('Initializing SMS queue');

  try {
    // Requirement 10.5: Configure Bull queue with retry settings
    // - Set retry attempts to 3
    // - Use exponential backoff (1s, 2s, 4s)
    smsQueue = new Bull<SMSJobData>('sms-queue', redisUrl, {
      defaultJobOptions: {
        attempts: 3, // Requirement 10.5: Retry up to 3 times
        backoff: {
          type: 'exponential', // Requirement 10.5: Exponential backoff
          delay: 1000 // Requirement 10.5: Start with 1s, then 2s, 4s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500 // Keep last 500 failed jobs
      }
    });

    // Queue event handlers
    smsQueue.on('error', (error) => {
      logger.error('SMS queue error', { error: error.message });
    });

    smsQueue.on('waiting', (jobId) => {
      logger.debug('SMS job waiting', { jobId });
    });

    smsQueue.on('active', (job: Job<SMSJobData>) => {
      logger.info('SMS job started', {
        jobId: job.id,
        phone: maskPhone(job.data.phone),
        attempt: job.attemptsMade + 1
      });
    });

    smsQueue.on('completed', (job: Job<SMSJobData>) => {
      logger.info('SMS job completed', {
        jobId: job.id,
        phone: maskPhone(job.data.phone)
      });
    });

    smsQueue.on('failed', (job: Job<SMSJobData>, error: Error) => {
      logger.error('SMS job failed', {
        jobId: job.id,
        phone: maskPhone(job.data.phone),
        attempt: job.attemptsMade,
        error: error.message
      });
    });

    smsQueue.on('stalled', (job: Job<SMSJobData>) => {
      logger.warn('SMS job stalled', {
        jobId: job.id,
        phone: maskPhone(job.data.phone)
      });
    });

    logger.info('SMS queue initialized successfully');

    return smsQueue;
  } catch (error) {
    logger.error('Failed to initialize SMS queue', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Failed to initialize SMS queue');
  }
}

/**
 * Close SMS queue
 * Should be called when shutting down the application
 */
export async function closeSMSQueue(): Promise<void> {
  if (smsQueue) {
    logger.info('Closing SMS queue');
    await smsQueue.close();
    smsQueue = null;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  if (!smsQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    smsQueue.getWaitingCount(),
    smsQueue.getActiveCount(),
    smsQueue.getCompletedCount(),
    smsQueue.getFailedCount(),
    smsQueue.getDelayedCount()
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return '****';
  }
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}
