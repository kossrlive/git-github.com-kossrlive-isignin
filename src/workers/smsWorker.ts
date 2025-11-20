/**
 * SMS Worker - Processes SMS jobs from Bull queue
 * Requirements: 10.3, 10.4, 10.5
 */

import { Job } from 'bull';
import { logger } from '../config/logger.js';
import { SMSJobData, getSMSQueue } from '../config/queue.js';
import { SMSService } from '../services/SMSService.js';

/**
 * Initialize SMS worker to process jobs from the queue
 * Requirement 10.3: Process SMS jobs from queue
 * Requirement 10.4: Implement retry logic with exponential backoff (3 attempts)
 * Requirement 10.5: Move failed jobs to failed queue after all attempts
 */
export const initializeSMSWorker = (smsService: SMSService): void => {
  const queue = getSMSQueue();

  // Process SMS jobs
  queue.process(async (job: Job<SMSJobData>) => {
    const { phone, message, attemptNumber, callbackUrl } = job.data;

    logger.info('Processing SMS job', {
      jobId: job.id,
      phone: maskPhone(phone),
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 3
    });

    try {
      // Call SMSService to send SMS
      const result = await smsService.sendSMS(
        {
          to: phone,
          message,
          callbackUrl
        },
        attemptNumber
      );

      if (!result.success) {
        // SMS sending failed, throw error to trigger retry
        const error = new Error(result.error || 'SMS sending failed');
        logger.error('SMS job failed', {
          jobId: job.id,
          phone: maskPhone(phone),
          provider: result.provider,
          error: result.error,
          attempt: job.attemptsMade + 1
        });
        throw error;
      }

      // Success
      logger.info('SMS job completed successfully', {
        jobId: job.id,
        phone: maskPhone(phone),
        provider: result.provider,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('SMS job processing error', {
        jobId: job.id,
        phone: maskPhone(phone),
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || 3,
        error: errorMessage
      });

      // Check if this is the last attempt
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

      if (isLastAttempt) {
        logger.error('SMS job failed after all retry attempts', {
          jobId: job.id,
          phone: maskPhone(phone),
          totalAttempts: job.attemptsMade + 1,
          error: errorMessage
        });
      }

      // Re-throw to let Bull handle retry logic
      throw error;
    }
  });

  logger.info('SMS Worker initialized and processing jobs');
};

/**
 * Mask phone number for logging (PII protection)
 */
const maskPhone = (phone: string): string => {
  if (phone.length <= 4) {
    return '****';
  }
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
};
