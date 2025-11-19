import Bull, { Queue, QueueOptions } from 'bull';
import { logger } from './logger.js';
import { getRedisClient } from './redis.js';

/**
 * Bull queue configuration for SMS job processing
 * Requirements: 10.1 - Queue for SMS processing with Redis
 */

export interface SMSJobData {
  phone: string;
  message: string;
  attemptNumber: number;
  preferredProvider?: string;
  callbackUrl: string;
}

const createQueueOptions = (): QueueOptions => {
  const redisClient = getRedisClient();
  
  return {
    redis: {
      port: redisClient.options.port || 6379,
      host: redisClient.options.host || 'localhost',
      password: redisClient.options.password,
      tls: redisClient.options.tls,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds
      },
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for inspection
    },
  };
};

// SMS Queue singleton
let smsQueue: Queue<SMSJobData> | null = null;

export const getSMSQueue = (): Queue<SMSJobData> => {
  if (!smsQueue) {
    smsQueue = new Bull<SMSJobData>('sms-queue', createQueueOptions());

    // Queue event handlers
    smsQueue.on('error', (error) => {
      logger.error('SMS Queue error', { error: error.message });
    });

    smsQueue.on('waiting', (jobId) => {
      logger.debug('SMS Job waiting', { jobId });
    });

    smsQueue.on('active', (job) => {
      logger.info('SMS Job started', { 
        jobId: job.id, 
        phone: job.data.phone,
        attempt: job.attemptsMade + 1 
      });
    });

    smsQueue.on('completed', (job) => {
      logger.info('SMS Job completed', { 
        jobId: job.id, 
        phone: job.data.phone 
      });
    });

    smsQueue.on('failed', (job, err) => {
      logger.error('SMS Job failed', { 
        jobId: job?.id, 
        phone: job?.data.phone,
        attempt: job?.attemptsMade,
        error: err.message 
      });
    });

    smsQueue.on('stalled', (job) => {
      logger.warn('SMS Job stalled', { 
        jobId: job.id, 
        phone: job.data.phone 
      });
    });

    logger.info('SMS Queue initialized');
  }

  return smsQueue;
};

export const closeSMSQueue = async (): Promise<void> => {
  if (smsQueue) {
    await smsQueue.close();
    smsQueue = null;
    logger.info('SMS Queue closed');
  }
};

/**
 * Add an SMS job to the queue
 */
export const addSMSJob = async (data: SMSJobData): Promise<Bull.Job<SMSJobData>> => {
  const queue = getSMSQueue();
  const job = await queue.add(data, {
    jobId: `sms-${data.phone}-${Date.now()}`,
  });
  
  logger.info('SMS Job added to queue', { 
    jobId: job.id, 
    phone: data.phone 
  });
  
  return job;
};
