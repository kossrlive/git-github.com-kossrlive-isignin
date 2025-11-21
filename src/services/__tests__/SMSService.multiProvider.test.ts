/**
 * Tests for SMSService with multiple providers (sms.to and Twilio)
 * Tests fallback mechanism and provider rotation
 */

import Redis from 'ioredis-mock';
import { ISMSProvider, SendSMSParams, SendSMSResult } from '../../providers/ISMSProvider.js';
import { SMSService } from '../SMSService.js';

// Mock SMS Provider for testing
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
        error: `${this.name} provider failed`
      };
    }

    return {
      success: true,
      messageId: `msg_${this.name}_${Date.now()}`,
      provider: this.name
    };
  }

  async checkDeliveryStatus(messageId: string) {
    return {
      messageId,
      status: 'delivered' as const,
      timestamp: new Date()
    };
  }

  handleWebhook(payload: any) {
    return {
      messageId: payload.messageId,
      status: 'delivered' as const
    };
  }

  setFailure(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  resetCallCount() {
    this.callCount = 0;
  }
}

describe('SMSService - Multi-Provider Tests', () => {
  let redis: Redis;
  let smsToProvider: MockSMSProvider;
  let twilioProvider: MockSMSProvider;
  let smsService: SMSService;

  beforeEach(() => {
    redis = new Redis();
    smsToProvider = new MockSMSProvider('sms.to', 1, false);
    twilioProvider = new MockSMSProvider('twilio', 2, false);
    smsService = new SMSService([smsToProvider, twilioProvider], redis);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('Provider Fallback Mechanism', () => {
    it('should use primary provider (sms.to) when available', async () => {
      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await smsService.sendSMS(params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('sms.to');
      expect(smsToProvider.callCount).toBe(1);
      expect(twilioProvider.callCount).toBe(0);
    });

    it('should fallback to Twilio when sms.to fails', async () => {
      smsToProvider.setFailure(true);

      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await smsService.sendSMS(params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio');
      expect(smsToProvider.callCount).toBe(1);
      expect(twilioProvider.callCount).toBe(1);
    });

    it('should try all providers in priority order', async () => {
      smsToProvider.setFailure(true);
      twilioProvider.setFailure(true);

      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await smsService.sendSMS(params);

      expect(result.success).toBe(false);
      expect(smsToProvider.callCount).toBe(1);
      expect(twilioProvider.callCount).toBe(1);
    });

    it('should track delivery with successful provider', async () => {
      smsToProvider.setFailure(true);

      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await smsService.sendSMS(params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('twilio');

      // Check that delivery is tracked in Redis
      const trackingKey = `sms:delivery:${result.messageId}`;
      const trackingData = await redis.get(trackingKey);
      expect(trackingData).toBeTruthy();

      const tracking = JSON.parse(trackingData!);
      expect(tracking.provider).toBe('twilio');
      expect(tracking.phone).toBe(params.to);
    });
  });

  describe('Provider Rotation for Resend', () => {
    it('should rotate to next provider on resend', async () => {
      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      // First send - should use sms.to
      const result1 = await smsService.sendSMS(params);
      expect(result1.provider).toBe('sms.to');
      expect(smsToProvider.callCount).toBe(1);
      expect(twilioProvider.callCount).toBe(0);

      // Reset call counts
      smsToProvider.resetCallCount();
      twilioProvider.resetCallCount();

      // Resend - should rotate to Twilio
      const result2 = await smsService.sendWithRotation(params, 'sms.to');
      expect(result2.provider).toBe('twilio');
      expect(smsToProvider.callCount).toBe(0);
      expect(twilioProvider.callCount).toBe(1);
    });

    it('should use last provider from Redis for rotation', async () => {
      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      // First send
      await smsService.sendSMS(params);

      // Reset call counts
      smsToProvider.resetCallCount();
      twilioProvider.resetCallCount();

      // Resend without specifying last provider - should read from Redis
      const result = await smsService.sendWithRotation(params);
      expect(result.provider).toBe('twilio');
      expect(twilioProvider.callCount).toBe(1);
    });

    it('should fallback to other providers if rotated provider fails', async () => {
      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      // First send with sms.to
      await smsService.sendSMS(params);

      // Make Twilio fail
      twilioProvider.setFailure(true);

      // Reset call counts
      smsToProvider.resetCallCount();
      twilioProvider.resetCallCount();

      // Resend - should try Twilio first (rotation), then fallback to sms.to
      const result = await smsService.sendWithRotation(params, 'sms.to');
      expect(result.success).toBe(true);
      expect(result.provider).toBe('sms.to');
      expect(twilioProvider.callCount).toBe(1); // Tried first
      expect(smsToProvider.callCount).toBe(1); // Fallback
    });

    it('should rotate circularly through providers', async () => {
      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      // Send with sms.to
      const result1 = await smsService.sendWithRotation(params, undefined);
      expect(result1.provider).toBe('sms.to');

      smsToProvider.resetCallCount();
      twilioProvider.resetCallCount();

      // Rotate to Twilio
      const result2 = await smsService.sendWithRotation(params, 'sms.to');
      expect(result2.provider).toBe('twilio');

      smsToProvider.resetCallCount();
      twilioProvider.resetCallCount();

      // Rotate back to sms.to (circular)
      const result3 = await smsService.sendWithRotation(params, 'twilio');
      expect(result3.provider).toBe('sms.to');
    });
  });

  describe('Provider Priority Sorting', () => {
    it('should sort providers by priority on initialization', () => {
      // Create providers in wrong order
      const provider1 = new MockSMSProvider('provider-1', 3, false);
      const provider2 = new MockSMSProvider('provider-2', 1, false);
      const provider3 = new MockSMSProvider('provider-3', 2, false);

      const service = new SMSService([provider1, provider2, provider3], redis);
      const providers = service.getProviders();

      expect(providers[0].name).toBe('provider-2'); // Priority 1
      expect(providers[1].name).toBe('provider-3'); // Priority 2
      expect(providers[2].name).toBe('provider-1'); // Priority 3
    });
  });

  describe('Error Logging', () => {
    it('should log provider name in error messages', async () => {
      smsToProvider.setFailure(true);
      twilioProvider.setFailure(true);

      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await smsService.sendSMS(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
    });
  });

  describe('Multiple Provider Configuration', () => {
    it('should work with only one provider configured', async () => {
      const singleProviderService = new SMSService([smsToProvider], redis);

      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await singleProviderService.sendSMS(params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('sms.to');
    });

    it('should handle three or more providers', async () => {
      const provider3 = new MockSMSProvider('provider-3', 3, false);
      const multiProviderService = new SMSService(
        [smsToProvider, twilioProvider, provider3],
        redis
      );

      smsToProvider.setFailure(true);
      twilioProvider.setFailure(true);

      const params: SendSMSParams = {
        to: '+1234567890',
        message: 'Test message'
      };

      const result = await multiProviderService.sendSMS(params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('provider-3');
      expect(smsToProvider.callCount).toBe(1);
      expect(twilioProvider.callCount).toBe(1);
      expect(provider3.callCount).toBe(1);
    });
  });
});
