/**
 * SMS Service
 * Manages SMS providers with fallback logic and delivery tracking
 * Requirements: 13.1, 13.2, 13.3, 5.1
 */

import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';
import {
    DeliveryStatus,
    ISMSProvider,
    SendSMSParams,
    SendSMSResult
} from '../providers/ISMSProvider.js';

interface SMSDeliveryTracking {
  phone: string;
  provider: string;
  status: string;
  sentAt: number;
  deliveredAt?: number;
  lastProvider?: string;
}

export class SMSService {
  private providers: ISMSProvider[];
  private redis: Redis;

  /**
   * Initialize SMS Service with providers
   * Requirement 13.1: Load SMS provider configuration with priorities
   */
  constructor(providers: ISMSProvider[], redis: Redis) {
    if (!providers || providers.length === 0) {
      throw new Error('At least one SMS provider is required');
    }

    // Sort providers by priority (lower number = higher priority)
    this.providers = [...providers].sort((a, b) => a.priority - b.priority);
    this.redis = redis;

    logger.info('SMS Service initialized', {
      providers: this.providers.map(p => ({ name: p.name, priority: p.priority }))
    });
  }

  /**
   * Send SMS with automatic fallback to next provider on failure
   * Requirement 13.2: Implement fallback mechanism (try next provider on failure)
   */
  async sendSMS(params: SendSMSParams, attemptNumber: number = 0): Promise<SendSMSResult> {
    return await this.sendWithFallback(params, attemptNumber);
  }

  /**
   * Send SMS with fallback logic
   * Requirement 13.2: Automatically switch to backup provider on failure
   */
  async sendWithFallback(params: SendSMSParams, attemptNumber: number = 0): Promise<SendSMSResult> {
    let lastError: string | undefined;

    // Try each provider in priority order
    for (const provider of this.providers) {
      try {
        logger.info('Attempting to send SMS', {
          provider: provider.name,
          priority: provider.priority,
          to: this.maskPhone(params.to),
          attemptNumber
        });

        const result = await provider.sendSMS(params);

        if (result.success) {
          // Track delivery in Redis (Requirement 5.1)
          await this.trackDelivery(result.messageId, provider.name, params.to);

          logger.info('SMS sent successfully', {
            provider: provider.name,
            messageId: result.messageId,
            to: this.maskPhone(params.to)
          });

          return result;
        } else {
          // Provider returned failure, try next provider
          lastError = result.error;
          logger.warn('SMS provider returned failure, trying next provider', {
            provider: provider.name,
            error: result.error,
            to: this.maskPhone(params.to)
          });
          continue;
        }
      } catch (error) {
        // Exception occurred, try next provider
        lastError = error instanceof Error ? error.message : 'Unknown error';
        logger.error('SMS provider threw exception, trying next provider', {
          provider: provider.name,
          error: lastError,
          to: this.maskPhone(params.to)
        });
        continue;
      }
    }

    // All providers failed
    logger.error('All SMS providers failed', {
      to: this.maskPhone(params.to),
      providersAttempted: this.providers.length,
      lastError
    });

    return {
      success: false,
      messageId: '',
      provider: 'none',
      error: lastError || 'All SMS providers failed'
    };
  }

  /**
   * Get next provider for resend (rotation)
   * Requirement 13.3: Implement provider rotation for resend requests
   */
  getNextProvider(currentProvider?: string): ISMSProvider | null {
    if (!currentProvider) {
      // Return first provider (highest priority)
      return this.providers[0] || null;
    }

    // Find current provider index
    const currentIndex = this.providers.findIndex(p => p.name === currentProvider);

    if (currentIndex === -1) {
      // Current provider not found, return first provider
      return this.providers[0] || null;
    }

    // Return next provider in rotation (circular)
    const nextIndex = (currentIndex + 1) % this.providers.length;
    return this.providers[nextIndex];
  }

  /**
   * Send SMS with provider rotation for resend
   * Requirement 13.3: Use next provider for resend requests
   */
  async sendWithRotation(params: SendSMSParams, lastProvider?: string): Promise<SendSMSResult> {
    // Get last provider used for this phone number
    const lastUsedProvider = lastProvider || await this.getLastProviderUsed(params.to);

    // Get next provider in rotation
    const nextProvider = this.getNextProvider(lastUsedProvider);

    if (!nextProvider) {
      logger.error('No providers available for rotation', {
        to: this.maskPhone(params.to)
      });
      return {
        success: false,
        messageId: '',
        provider: 'none',
        error: 'No SMS providers available'
      };
    }

    logger.info('Using rotated provider for resend', {
      lastProvider: lastUsedProvider,
      nextProvider: nextProvider.name,
      to: this.maskPhone(params.to)
    });

    // Try the next provider first, then fallback to others if it fails
    const reorderedProviders = [
      nextProvider,
      ...this.providers.filter(p => p.name !== nextProvider.name)
    ];

    // Temporarily swap providers for this request
    const originalProviders = this.providers;
    this.providers = reorderedProviders;

    try {
      const result = await this.sendWithFallback(params);
      return result;
    } finally {
      // Restore original provider order
      this.providers = originalProviders;
    }
  }

  /**
   * Track SMS delivery in Redis
   * Requirement 5.1: Track SMS delivery status
   */
  async trackDelivery(messageId: string, provider: string, phone: string): Promise<void> {
    const key = this.getDeliveryTrackingKey(messageId);
    const ttl = 86400; // 24 hours

    const tracking: SMSDeliveryTracking = {
      phone,
      provider,
      status: 'pending',
      sentAt: Date.now()
    };

    try {
      await this.redis.setex(key, ttl, JSON.stringify(tracking));

      // Also store last provider used for this phone (for rotation)
      await this.setLastProviderUsed(phone, provider);

      logger.info('SMS delivery tracked', {
        messageId,
        provider,
        phone: this.maskPhone(phone)
      });
    } catch (error) {
      logger.error('Failed to track SMS delivery', {
        messageId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - tracking failure shouldn't fail the SMS send
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(messageId: string, status: DeliveryStatus): Promise<void> {
    const key = this.getDeliveryTrackingKey(messageId);

    try {
      const trackingData = await this.redis.get(key);

      if (!trackingData) {
        logger.warn('Delivery tracking not found for message', { messageId });
        return;
      }

      const tracking: SMSDeliveryTracking = JSON.parse(trackingData);
      tracking.status = status.status;

      if (status.status === 'delivered') {
        tracking.deliveredAt = Date.now();
      }

      // Update with remaining TTL
      const ttl = await this.redis.ttl(key);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, JSON.stringify(tracking));
      }

      logger.info('Delivery status updated', {
        messageId,
        status: status.status,
        phone: this.maskPhone(tracking.phone)
      });
    } catch (error) {
      logger.error('Failed to update delivery status', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get delivery status for a message
   */
  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryTracking | null> {
    const key = this.getDeliveryTrackingKey(messageId);

    try {
      const trackingData = await this.redis.get(key);

      if (!trackingData) {
        return null;
      }

      return JSON.parse(trackingData);
    } catch (error) {
      logger.error('Failed to get delivery status', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Store last provider used for a phone number (for rotation)
   */
  private async setLastProviderUsed(phone: string, provider: string): Promise<void> {
    const key = this.getLastProviderKey(phone);
    const ttl = 3600; // 1 hour

    try {
      await this.redis.setex(key, ttl, provider);
    } catch (error) {
      logger.error('Failed to store last provider used', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get last provider used for a phone number
   */
  private async getLastProviderUsed(phone: string): Promise<string | undefined> {
    const key = this.getLastProviderKey(phone);

    try {
      const provider = await this.redis.get(key);
      return provider || undefined;
    } catch (error) {
      logger.error('Failed to get last provider used', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return undefined;
    }
  }

  /**
   * Get all available providers
   */
  getProviders(): ISMSProvider[] {
    return [...this.providers];
  }

  // Redis key helpers
  private getDeliveryTrackingKey(messageId: string): string {
    return `sms:delivery:${messageId}`;
  }

  private getLastProviderKey(phone: string): string {
    return `sms:last_provider:${phone}`;
  }

  // Mask phone number for logging (PII protection)
  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }
}
