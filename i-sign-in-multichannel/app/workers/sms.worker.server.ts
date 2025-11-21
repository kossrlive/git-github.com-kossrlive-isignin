/**
 * SMS Worker
 * Processes SMS jobs from the Bull queue
 */

import prisma from 'app/db.server.js';
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
  // Requirement 10.5: Jobs will be retried up to 3 times with exponential backoff
  queue.process(async (job: Job<SMSJobData>) => {
    const attemptNumber = job.attemptsMade + 1;
    const isRetry = attemptNumber > 1;
    
    logger.info('Processing SMS job', {
      jobId: job.id,
      phone: maskPhone(job.data.phone),
      attempt: attemptNumber,
      maxAttempts: job.opts.attempts || 3,
      isRetry
    });

    try {
      // Initialize SMS providers
      const providers = initializeSMSProviders();

      if (providers.length === 0) {
        throw new Error('No SMS providers configured');
      }

      // Create SMS service
      const smsService = new SMSService(providers, redis);

      // Send SMS with attempt number for tracking
      const result = await smsService.sendSMS({
        to: job.data.phone,
        message: job.data.message,
        callbackUrl: job.data.callbackUrl
      }, attemptNumber);

      if (!result.success) {
        // Log failure with retry information
        const willRetry = attemptNumber < (job.opts.attempts || 3);
        logger.error('SMS send failed', {
          jobId: job.id,
          phone: maskPhone(job.data.phone),
          attempt: attemptNumber,
          willRetry,
          error: result.error
        });
        
        // Log analytics event for SMS failure
        try {
          const shop = await getShopFromJobData(job.data);
          if (shop) {
            await prisma.analytics.create({
              data: {
                shopId: shop.id,
                eventType: 'sms_failed',
                method: 'sms',
                metadata: JSON.stringify({
                  provider: result.provider || 'unknown',
                  error: result.error,
                  attempt: attemptNumber,
                }),
              },
            });
          }
        } catch (analyticsError) {
          logger.error('Failed to log SMS failure analytics', {
            error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
          });
        }
        
        throw new Error(result.error || 'SMS send failed');
      }

      logger.info('SMS job completed successfully', {
        jobId: job.id,
        phone: maskPhone(job.data.phone),
        messageId: result.messageId,
        provider: result.provider,
        attempt: attemptNumber,
        wasRetry: isRetry
      });

      // Log analytics event for SMS success
      try {
        const shop = await getShopFromJobData(job.data);
        if (shop) {
          await prisma.analytics.create({
            data: {
              shopId: shop.id,
              eventType: 'sms_sent',
              method: 'sms',
              metadata: JSON.stringify({
                provider: result.provider,
                messageId: result.messageId,
                attempt: attemptNumber,
                wasRetry: isRetry,
              }),
            },
          });
        }
      } catch (analyticsError) {
        logger.error('Failed to log SMS success analytics', {
          error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
        });
      }

      return result;
    } catch (error) {
      const willRetry = attemptNumber < (job.opts.attempts || 3);
      const nextRetryDelay = willRetry ? Math.pow(2, attemptNumber - 1) * 1000 : null;
      
      logger.error('SMS job failed', {
        jobId: job.id,
        phone: maskPhone(job.data.phone),
        attempt: attemptNumber,
        maxAttempts: job.opts.attempts || 3,
        willRetry,
        nextRetryDelay: nextRetryDelay ? `${nextRetryDelay}ms` : null,
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
 * Get shop record from job data
 * Extracts shop domain from callback URL or uses default
 */
async function getShopFromJobData(jobData: SMSJobData) {
  try {
    // Try to extract shop domain from callback URL
    let shopDomain: string | null = null;
    
    if (jobData.callbackUrl) {
      const url = new URL(jobData.callbackUrl);
      // Assuming callback URL contains shop domain as a query parameter or in the path
      shopDomain = url.searchParams.get('shop') || url.hostname;
    }
    
    // If we couldn't extract shop domain, try to get the first shop
    if (!shopDomain) {
      const firstShop = await prisma.shop.findFirst();
      return firstShop;
    }
    
    // Find or create shop record
    let shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });
    
    if (!shop) {
      // Create shop record if it doesn't exist
      shop = await prisma.shop.create({
        data: {
          domain: shopDomain,
          accessToken: '', // Will be updated during OAuth
        },
      });
    }
    
    return shop;
  } catch (error) {
    logger.error('Failed to get shop from job data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
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
