/**
 * Property-Based Tests for SMSService
 * Feature: shopify-sms-auth
 * Validates: Requirements 13.2, 13.3
 */

import fc from 'fast-check';
import Redis from 'ioredis-mock';
import {
    DeliveryReceipt,
    DeliveryStatus,
    ISMSProvider,
    SendSMSParams,
    SendSMSResult
} from '../../providers/ISMSProvider.js';
import { SMSService } from '../SMSService.js';

/**
 * Mock SMS Provider for testing
 */
class MockSMSProvider implements ISMSProvider {
  readonly name: string;
  readonly priority: number;
  private shouldFail: boolean;
  public callCount: number = 0;

  constructor(name: string, priority: number, shouldFail: boolean = false) {
    this.name = name;
    this.priority = priority;
    this.shouldFail = shouldFail;
  }

  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    this.callCount++;

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
    return {
      messageId: payload.messageId || 'test-id',
      status: 'delivered'
    };
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }
}

describe('SMSService Property-Based Tests', () => {
  let redis: Redis;

  beforeEach(() => {
    redis = new Redis();
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  /**
   * Feature: shopify-sms-auth, Property 29: SMS provider fallback
   * Validates: Requirements 13.2
   */
  describe('Property 29: SMS provider fallback', () => {
    it('should automatically try next provider when primary fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            // Create providers: primary fails, secondary succeeds
            const primaryProvider = new MockSMSProvider('primary', 1, true);
            const secondaryProvider = new MockSMSProvider('secondary', 2, false);

            const smsService = new SMSService([primaryProvider, secondaryProvider], redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            const result = await smsService.sendSMS(params);

            // Should succeed using secondary provider
            expect(result.success).toBe(true);
            expect(result.provider).toBe('secondary');

            // Both providers should have been called
            expect(primaryProvider.callCount).toBe(1);
            expect(secondaryProvider.callCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should try all providers in priority order when multiple fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 2, max: 5 }),
          async (phone, message, numProviders) => {
            // Create multiple failing providers and one succeeding provider
            const providers: MockSMSProvider[] = [];

            for (let i = 0; i < numProviders - 1; i++) {
              providers.push(new MockSMSProvider(`provider-${i}`, i + 1, true));
            }

            // Last provider succeeds
            const successProvider = new MockSMSProvider('success-provider', numProviders, false);
            providers.push(successProvider);

            const smsService = new SMSService(providers, redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            const result = await smsService.sendSMS(params);

            // Should succeed using the last provider
            expect(result.success).toBe(true);
            expect(result.provider).toBe('success-provider');

            // All providers should have been called
            providers.forEach(provider => {
              expect(provider.callCount).toBe(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return failure when all providers fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 1, max: 4 }),
          async (phone, message, numProviders) => {
            // Create multiple failing providers
            const providers: MockSMSProvider[] = [];

            for (let i = 0; i < numProviders; i++) {
              providers.push(new MockSMSProvider(`provider-${i}`, i + 1, true));
            }

            const smsService = new SMSService(providers, redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            const result = await smsService.sendSMS(params);

            // Should fail after trying all providers
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            // All providers should have been called
            providers.forEach(provider => {
              expect(provider.callCount).toBe(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect provider priority order during fallback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            // Create providers with different priorities (lower number = higher priority)
            const lowPriorityProvider = new MockSMSProvider('low-priority', 3, true);
            const highPriorityProvider = new MockSMSProvider('high-priority', 1, true);
            const mediumPriorityProvider = new MockSMSProvider('medium-priority', 2, false);

            // Add in random order to test sorting
            const smsService = new SMSService(
              [lowPriorityProvider, highPriorityProvider, mediumPriorityProvider],
              redis
            );

            const params: SendSMSParams = {
              to: phone,
              message
            };

            const result = await smsService.sendSMS(params);

            // Should succeed with medium priority provider
            expect(result.success).toBe(true);
            expect(result.provider).toBe('medium-priority');

            // High priority should be tried first, then medium
            expect(highPriorityProvider.callCount).toBe(1);
            expect(mediumPriorityProvider.callCount).toBe(1);
            // Low priority should not be called since medium succeeded
            expect(lowPriorityProvider.callCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 30: Provider rotation on resend
   * Validates: Requirements 13.3
   */
  describe('Property 30: Provider rotation on resend', () => {
    it('should use different provider for resend request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            // Create multiple providers
            const provider1 = new MockSMSProvider('provider-1', 1, false);
            const provider2 = new MockSMSProvider('provider-2', 2, false);
            const provider3 = new MockSMSProvider('provider-3', 3, false);

            const smsService = new SMSService([provider1, provider2, provider3], redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            // First send - should use provider-1 (highest priority)
            const firstResult = await smsService.sendSMS(params);
            expect(firstResult.success).toBe(true);
            expect(firstResult.provider).toBe('provider-1');

            // Reset call counts
            provider1.resetCallCount();
            provider2.resetCallCount();
            provider3.resetCallCount();

            // Resend with rotation - should use provider-2 (next in rotation)
            const resendResult = await smsService.sendWithRotation(params, 'provider-1');
            expect(resendResult.success).toBe(true);
            expect(resendResult.provider).toBe('provider-2');

            // Provider-2 should be tried first due to rotation
            expect(provider2.callCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should rotate through all providers in circular fashion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 2, max: 4 }),
          async (phone, message, numProviders) => {
            // Create multiple providers
            const providers: MockSMSProvider[] = [];
            for (let i = 0; i < numProviders; i++) {
              providers.push(new MockSMSProvider(`provider-${i}`, i + 1, false));
            }

            const smsService = new SMSService(providers, redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            const usedProviders: string[] = [];

            // Send multiple times and track which provider is used
            for (let i = 0; i < numProviders + 1; i++) {
              const lastProvider = usedProviders[usedProviders.length - 1];
              const result = await smsService.sendWithRotation(params, lastProvider);
              
              expect(result.success).toBe(true);
              usedProviders.push(result.provider);
            }

            // Should have rotated through providers
            // After going through all providers, should wrap back to first
            expect(usedProviders.length).toBe(numProviders + 1);
            
            // First provider used should be different from last (circular rotation)
            const firstProvider = usedProviders[0];
            const lastProvider = usedProviders[usedProviders.length - 1];
            
            // After full rotation, we should be back to a provider we've seen before
            expect(usedProviders.slice(0, -1)).toContain(lastProvider);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fallback to other providers if rotated provider fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            // Create providers where the rotated provider will fail
            const provider1 = new MockSMSProvider('provider-1', 1, false);
            const provider2 = new MockSMSProvider('provider-2', 2, true); // Will fail
            const provider3 = new MockSMSProvider('provider-3', 3, false);

            const smsService = new SMSService([provider1, provider2, provider3], redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            // Resend with rotation to provider-2 (which will fail)
            const result = await smsService.sendWithRotation(params, 'provider-1');

            // Should succeed by falling back to another provider
            expect(result.success).toBe(true);
            // Should use either provider-1 or provider-3 as fallback (not provider-2 which failed)
            expect(result.provider).not.toBe('provider-2');
            expect(['provider-1', 'provider-3']).toContain(result.provider);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track last provider used for automatic rotation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (phone, message) => {
            // Create providers
            const provider1 = new MockSMSProvider('provider-1', 1, false);
            const provider2 = new MockSMSProvider('provider-2', 2, false);

            const smsService = new SMSService([provider1, provider2], redis);

            const params: SendSMSParams = {
              to: phone,
              message
            };

            // First send
            const firstResult = await smsService.sendSMS(params);
            expect(firstResult.success).toBe(true);
            expect(firstResult.provider).toBe('provider-1');

            // Reset call counts
            provider1.resetCallCount();
            provider2.resetCallCount();

            // Resend without specifying last provider - should auto-detect from Redis
            const resendResult = await smsService.sendWithRotation(params);
            expect(resendResult.success).toBe(true);
            
            // Should rotate to provider-2
            expect(resendResult.provider).toBe('provider-2');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
