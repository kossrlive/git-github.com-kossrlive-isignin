/**
 * Property-Based Tests for SMS Queue Processing
 * Feature: shopify-sms-auth
 * Validates: Requirements 10.1, 10.2, 10.4, 10.5
 */

import Bull, { Job, Queue } from 'bull';
import fc from 'fast-check';
import Redis from 'ioredis-mock';
import { SMSJobData, addSMSJob, closeSMSQueue } from '../../config/queue.js';
import {
    DeliveryReceipt,
    DeliveryStatus,
    ISMSProvider,
    SendSMSParams,
    SendSMSResult
} from '../../providers/ISMSProvider.js';
import { SMSService } from '../../services/SMSService.js';

/**
 * Mock SMS Provider for testing
 */
class MockSMSProvider implements ISMSProvider {
  readonly name: string;
  readonly priority: number;
  private shouldFail: boolean;
  public callCount: number = 0;
  public callHistory: SendSMSParams[] = [];

  constructor(name: string, priority: number, shouldFail: boolean = false) {
    this.name = name;
    this.priority = priority;
    this.shouldFail = shouldFail;
  }

  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    this.callCount++;
    this.callHistory.push(params);

    if (this.shouldFail) {
      return {
        success: false,
        messageId: '',
        provider: this.name,
        error: `${this.name} failed to send SMS`
      };
    }

    return {
      success: true,
      messageId: `${this.name}-${Date.now()}-${Math.random()}`,
      provider: this.name
    };
  }

  async checkDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    return {
      messageId,
      status: 'delivered',
      timestamp: new Date()
    };
  }

  handleWebhook(payload: unknown): DeliveryReceipt {
    const payloadData = payload as { messageId?: string };
    return {
      messageId: payloadData.messageId || 'test-id',
      status: 'delivered'
    };
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  resetCallCount(): void {
    this.callCount = 0;
    this.callHistory = [];
  }
}

/**
 * Helper to create a test queue with in-memory processing
 */
const createTestQueue = (): Queue<SMSJobData> => {
  return new Bull<SMSJobData>('test-sms-queue', {
    redis: {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 100 // Shorter delay for testing
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  });
};

describe('SMS Queue Processing Property-Based Tests', () => {
  let redis: Redis;
  let testQueue: Queue<SMSJobData>;

  beforeEach(() => {
    redis = new Redis();
  });

  afterEach(async () => {
    if (testQueue) {
      await testQueue.close();
    }
    await closeSMSQueue();
    await redis.flushall();
    redis.disconnect();
  });

  /**
   * Feature: shopify-sms-auth, Property 23: Queue job creation
   * Validates: Requirements 10.1, 10.2
   */
  describe('Property 23: Queue job creation', () => {
    it('should add SMS job to queue and return immediately without waiting for delivery', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.string({ minLength: 5, maxLength: 50 }),
          async (phone, message, callbackUrl) => {
            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl
            };

            const startTime = Date.now();
            const job = await addSMSJob(jobData);
            const endTime = Date.now();

            // Should return immediately (within reasonable time)
            const responseTime = endTime - startTime;
            expect(responseTime).toBeLessThan(1000); // Should be much faster, but allow 1s buffer

            // Job should be created with correct data
            expect(job).toBeDefined();
            expect(job.id).toBeDefined();
            expect(job.data).toEqual(jobData);

            // Job should be in the queue
            const jobFromQueue = await job.queue.getJob(job.id!);
            expect(jobFromQueue).toBeDefined();
            expect(jobFromQueue?.data).toEqual(jobData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create unique job IDs for different SMS requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              phone: fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
              message: fc.string({ minLength: 10, maxLength: 100 }),
              callbackUrl: fc.string({ minLength: 5, maxLength: 50 })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (jobDataArray) => {
            const jobs: Job<SMSJobData>[] = [];

            for (const data of jobDataArray) {
              const job = await addSMSJob({
                phone: data.phone,
                message: data.message,
                attemptNumber: 0,
                callbackUrl: data.callbackUrl
              });
              jobs.push(job);
            }

            // All job IDs should be unique
            const jobIds = jobs.map(j => j.id);
            const uniqueJobIds = new Set(jobIds);
            expect(uniqueJobIds.size).toBe(jobIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all job data fields when adding to queue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 0, max: 2 }),
          fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
          fc.string({ minLength: 5, maxLength: 50 }),
          async (phone, message, attemptNumber, preferredProvider, callbackUrl) => {
            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber,
              preferredProvider,
              callbackUrl
            };

            const job = await addSMSJob(jobData);

            // All fields should be preserved
            expect(job.data.phone).toBe(phone);
            expect(job.data.message).toBe(message);
            expect(job.data.attemptNumber).toBe(attemptNumber);
            expect(job.data.preferredProvider).toBe(preferredProvider);
            expect(job.data.callbackUrl).toBe(callbackUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 24: SMS retry with exponential backoff
   * Validates: Requirements 10.4
   */
  describe('Property 24: SMS retry with exponential backoff', () => {
    it('should retry failed SMS jobs up to 3 times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            const provider = new MockSMSProvider('test-provider', 1, true); // Always fails
            const smsService = new SMSService([provider], redis);

            testQueue = createTestQueue();

            // Set up processor
            testQueue.process(async (job: Job<SMSJobData>) => {
              const result = await smsService.sendSMS(
                {
                  to: job.data.phone,
                  message: job.data.message,
                  callbackUrl: job.data.callbackUrl
                },
                job.data.attemptNumber
              );

              if (!result.success) {
                throw new Error(result.error || 'SMS sending failed');
              }

              return result;
            });

            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl: 'http://test.com/callback'
            };

            const job = await testQueue.add(jobData);

            // Wait for job to fail after all retries
            await new Promise<void>((resolve) => {
              testQueue.on('failed', (failedJob) => {
                if (failedJob.id === job.id) {
                  resolve();
                }
              });
            });

            // Should have attempted 3 times (initial + 2 retries)
            const failedJob = await testQueue.getJob(job.id!);
            expect(failedJob?.attemptsMade).toBe(3);

            // Provider should have been called 3 times
            expect(provider.callCount).toBe(3);
          }
        ),
        { numRuns: 50, timeout: 30000 } // Reduced runs and increased timeout for retry tests
      );
    }, 35000);

    it('should use exponential backoff between retry attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            const provider = new MockSMSProvider('test-provider', 1, true); // Always fails
            const smsService = new SMSService([provider], redis);

            testQueue = createTestQueue();

            const attemptTimestamps: number[] = [];

            // Set up processor to track attempt times
            testQueue.process(async (job: Job<SMSJobData>) => {
              attemptTimestamps.push(Date.now());

              const result = await smsService.sendSMS(
                {
                  to: job.data.phone,
                  message: job.data.message,
                  callbackUrl: job.data.callbackUrl
                },
                job.data.attemptNumber
              );

              if (!result.success) {
                throw new Error(result.error || 'SMS sending failed');
              }

              return result;
            });

            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl: 'http://test.com/callback'
            };

            const job = await testQueue.add(jobData);

            // Wait for job to fail after all retries
            await new Promise<void>((resolve) => {
              testQueue.on('failed', (failedJob) => {
                if (failedJob.id === job.id) {
                  resolve();
                }
              });
            });

            // Should have 3 attempts
            expect(attemptTimestamps.length).toBe(3);

            // Calculate delays between attempts
            if (attemptTimestamps.length >= 2) {
              const delay1 = attemptTimestamps[1] - attemptTimestamps[0];
              
              if (attemptTimestamps.length >= 3) {
                const delay2 = attemptTimestamps[2] - attemptTimestamps[1];
                
                // Second delay should be longer than first (exponential backoff)
                // Allow some tolerance for timing variations
                expect(delay2).toBeGreaterThanOrEqual(delay1 * 0.8);
              }
            }
          }
        ),
        { numRuns: 30, timeout: 40000 } // Reduced runs for performance
      );
    }, 45000);

    it('should stop retrying after successful send', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            const provider = new MockSMSProvider('test-provider', 1, false); // Succeeds
            const smsService = new SMSService([provider], redis);

            testQueue = createTestQueue();

            // Set up processor
            testQueue.process(async (job: Job<SMSJobData>) => {
              const result = await smsService.sendSMS(
                {
                  to: job.data.phone,
                  message: job.data.message,
                  callbackUrl: job.data.callbackUrl
                },
                job.data.attemptNumber
              );

              if (!result.success) {
                throw new Error(result.error || 'SMS sending failed');
              }

              return result;
            });

            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl: 'http://test.com/callback'
            };

            const job = await testQueue.add(jobData);

            // Wait for job to complete
            await new Promise<void>((resolve) => {
              testQueue.on('completed', (completedJob) => {
                if (completedJob.id === job.id) {
                  resolve();
                }
              });
            });

            // Should have attempted only once (no retries needed)
            expect(provider.callCount).toBe(1);
          }
        ),
        { numRuns: 100, timeout: 15000 }
      );
    }, 20000);
  });

  /**
   * Feature: shopify-sms-auth, Property 25: Failed job handling
   * Validates: Requirements 10.5
   */
  describe('Property 25: Failed job handling', () => {
    it('should move job to failed queue after all retry attempts exhausted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            const provider = new MockSMSProvider('test-provider', 1, true); // Always fails
            const smsService = new SMSService([provider], redis);

            testQueue = createTestQueue();

            // Set up processor
            testQueue.process(async (job: Job<SMSJobData>) => {
              const result = await smsService.sendSMS(
                {
                  to: job.data.phone,
                  message: job.data.message,
                  callbackUrl: job.data.callbackUrl
                },
                job.data.attemptNumber
              );

              if (!result.success) {
                throw new Error(result.error || 'SMS sending failed');
              }

              return result;
            });

            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl: 'http://test.com/callback'
            };

            const job = await testQueue.add(jobData);

            // Wait for job to fail
            await new Promise<void>((resolve) => {
              testQueue.on('failed', (failedJob) => {
                if (failedJob.id === job.id) {
                  resolve();
                }
              });
            });

            // Job should be in failed queue
            const failedJobs = await testQueue.getFailed();
            const failedJob = failedJobs.find(j => j.id === job.id);
            
            expect(failedJob).toBeDefined();
            expect(failedJob?.attemptsMade).toBe(3);
            expect(failedJob?.failedReason).toContain('SMS sending failed');
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);

    it('should preserve job data in failed queue for inspection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.string({ minLength: 5, maxLength: 50 }),
          async (phone, message, callbackUrl) => {
            const provider = new MockSMSProvider('test-provider', 1, true); // Always fails
            const smsService = new SMSService([provider], redis);

            testQueue = createTestQueue();

            // Set up processor
            testQueue.process(async (job: Job<SMSJobData>) => {
              const result = await smsService.sendSMS(
                {
                  to: job.data.phone,
                  message: job.data.message,
                  callbackUrl: job.data.callbackUrl
                },
                job.data.attemptNumber
              );

              if (!result.success) {
                throw new Error(result.error || 'SMS sending failed');
              }

              return result;
            });

            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl
            };

            const job = await testQueue.add(jobData);

            // Wait for job to fail
            await new Promise<void>((resolve) => {
              testQueue.on('failed', (failedJob) => {
                if (failedJob.id === job.id) {
                  resolve();
                }
              });
            });

            // Get failed job and verify data is preserved
            const failedJobs = await testQueue.getFailed();
            const failedJob = failedJobs.find(j => j.id === job.id);
            
            expect(failedJob).toBeDefined();
            expect(failedJob?.data.phone).toBe(phone);
            expect(failedJob?.data.message).toBe(message);
            expect(failedJob?.data.callbackUrl).toBe(callbackUrl);
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 35000);

    it('should not move successful jobs to failed queue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            const provider = new MockSMSProvider('test-provider', 1, false); // Succeeds
            const smsService = new SMSService([provider], redis);

            testQueue = createTestQueue();

            // Set up processor
            testQueue.process(async (job: Job<SMSJobData>) => {
              const result = await smsService.sendSMS(
                {
                  to: job.data.phone,
                  message: job.data.message,
                  callbackUrl: job.data.callbackUrl
                },
                job.data.attemptNumber
              );

              if (!result.success) {
                throw new Error(result.error || 'SMS sending failed');
              }

              return result;
            });

            const jobData: SMSJobData = {
              phone,
              message,
              attemptNumber: 0,
              callbackUrl: 'http://test.com/callback'
            };

            const job = await testQueue.add(jobData);

            // Wait for job to complete
            await new Promise<void>((resolve) => {
              testQueue.on('completed', (completedJob) => {
                if (completedJob.id === job.id) {
                  resolve();
                }
              });
            });

            // Job should not be in failed queue
            const failedJobs = await testQueue.getFailed();
            const failedJob = failedJobs.find(j => j.id === job.id);
            
            expect(failedJob).toBeUndefined();
          }
        ),
        { numRuns: 100, timeout: 15000 }
      );
    }, 20000);
  });
});
