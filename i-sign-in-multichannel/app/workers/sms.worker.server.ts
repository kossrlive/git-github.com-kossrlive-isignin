/**
 * SMS Worker
 * Processes SMS jobs from the Bull queue
 */

import type { Job } from 'bull';
import { logger } from '../config/logger.js';
import type { SMSJobData } from '../lib/queue.server.js';
import { getSMSQueue } from '../lib/queue.server.js';
import { getRedis } from '../lib/redis.server.js';
import type { ISMSProvider } from '../providers/ISMSProvider.js';
import { SmsToProvider } from '../providers/SmsToProvider.js';
import { TwilioProvider } from '../providers/TwilioProvider.js';
import { SMSService } from '../services/SMSService.js';

/**
 * Initialize SMS worker
 * Sets up job processor for the SMS queue
 */
export function initializeSMSWorker(): void {
  const queue = getSMSQueue();
  const redis = getRedis();

  logger.info('Initializing SMS worker');

  // Process SMS jobs
  queue.process(async (job: Job<SMSJobData>) => {
    logger.info('Processing SMS job', {
      jobId: job.id,
      phone: maskPhone(job.data.phone),
      attempt: job.attemptsMade + 1
    });

    try {
      // Initialize SMS providers
      const providers = initializeSMSProviders();

      if (providers.length === 0) {
        throw new Error('No SMS providers configured');
      }

      // Create SMS service
      const smsService = new SMSService(providers, redis);

      // Send SMS
      const result = await smsService.sendSMS({
        to: job.data.phone,
        message: job.data.message,
        callbackUrl: job.data.callbackUrl
      }, job.data.attemptNumber || 0);

      if (!result.success) {
        throw new Error(result.error || 'SMS send failed');
      }

      logger.info('SMS job completed successfully', {
        jobId: job.id,
        phone: maskPhone(job.data.phone),
        messageId: result.messageId,
        provider: result.provider
      });

      return result;
    } catch (error) {
      logger.error('SMS job failed', {
        jobId: job.id,
        phone: maskPhone(job.data.phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  });

  logger.info('SMS worker initialized successfully');
}

/**
 * Initialize SMS providers from environment variables
 */
function initializeSMSProviders(): ISMSProvider[] {
  const providers: ISMSProvider[] = [];

  // Initialize sms.to provider if configured
  const smsToApiKey = process.env.SMSTO_API_KEY;
  const smsToSenderId = process.env.SMSTO_SENDER_ID;

  if (smsToApiKey && smsToSenderId) {
    try {
      const smsToProvider = new SmsToProvider(smsToApiKey, smsToSenderId);
      providers.push(smsToProvider);
      logger.info('SMS.to provider initialized', { priority: smsToProvider.priority });
    } catch (error) {
      logger.error('Failed to initialize SMS.to provider', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Initialize Twilio provider if configured
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

  if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
    try {
      const twilioProvider = new TwilioProvider(
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber
      );
      providers.push(twilioProvider);
      logger.info('Twilio provider initialized', { priority: twilioProvider.priority });
    } catch (error) {
      logger.error('Failed to initialize Twilio provider', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return providers;
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
