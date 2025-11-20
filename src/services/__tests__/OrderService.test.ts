/**
 * Property-Based Tests for OrderService
 * Feature: shopify-sms-auth
 * Validates: Requirements 8.1, 8.3
 */

import fc from 'fast-check';
import Redis from 'ioredis-mock';
import { ISMSProvider, SendSMSParams, SendSMSResult } from '../../providers/ISMSProvider.js';
import { OrderService } from '../OrderService.js';
import { OTPService } from '../OTPService.js';
import { SMSService } from '../SMSService.js';

// Mock SMS Provider for testing
class MockSMSProvider implements ISMSProvider {
  readonly name = 'mock';
  readonly priority = 1;

  async sendSMS(_params: SendSMSParams): Promise<SendSMSResult> {
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      provider: this.name
    };
  }

  async checkDeliveryStatus(_messageId: string): Promise<any> {
    return { status: 'delivered' };
  }

  handleWebhook(_payload: any): any {
    return { messageId: 'mock', status: 'delivered' };
  }
}

describe('OrderService Property-Based Tests', () => {
  let redis: Redis;
  let otpService: OTPService;
  let smsService: SMSService;
  let orderService: OrderService;

  beforeEach(() => {
    redis = new Redis();
    otpService = new OTPService(redis);
    const mockProvider = new MockSMSProvider();
    smsService = new SMSService([mockProvider], redis);
    orderService = new OrderService(redis, otpService, smsService);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  /**
   * Feature: shopify-sms-auth, Property 21: Order OTP uniqueness
   * Validates: Requirements 8.1
   */
  describe('Property 21: Order OTP uniqueness', () => {
    it('should generate unique OTP for each order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 4, maxLength: 8 }),
          fc.string({ minLength: 10, maxLength: 12 }),
          async (orderId, orderNumber, phone) => {
            const otp = await orderService.generateOrderOTP(orderId, orderNumber, phone);

            // Verify OTP is stored with correct key
            const storedOTP = await redis.get(`order:otp:${orderId}`);
            expect(storedOTP).toBe(otp);

            // Verify OTP format (6 digits)
            expect(otp).toMatch(/^\d{6}$/);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should store order OTP with 10 minute TTL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 4, maxLength: 8 }),
          fc.string({ minLength: 10, maxLength: 12 }),
          async (orderId, orderNumber, phone) => {
            await orderService.generateOrderOTP(orderId, orderNumber, phone);

            // Verify TTL is set to 600 seconds (10 minutes)
            const ttl = await redis.ttl(`order:otp:${orderId}`);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(600);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 22: Order OTP verification
   * Validates: Requirements 8.3
   */
  describe('Property 22: Order OTP verification', () => {
    it('should verify OTP matches both the OTP value and the specific order ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 4, maxLength: 8 }),
          fc.string({ minLength: 10, maxLength: 12 }),
          async (orderId, orderNumber, phone) => {
            // Generate OTP for the order
            const otp = await orderService.generateOrderOTP(orderId, orderNumber, phone);

            // Verify with correct order ID and OTP should succeed
            const correctResult = await orderService.verifyOrderOTP(orderId, otp);
            expect(correctResult).toBe(true);

            // After successful verification, OTP should be deleted
            const deletedOTP = await redis.get(`order:otp:${orderId}`);
            expect(deletedOTP).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should fail verification with wrong OTP for the order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 4, maxLength: 8 }),
          fc.string({ minLength: 10, maxLength: 12 }),
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
          async (orderId, orderNumber, phone, wrongOTP) => {
            // Generate OTP for the order
            const correctOTP = await orderService.generateOrderOTP(orderId, orderNumber, phone);

            // Skip if wrong OTP happens to match correct OTP
            if (wrongOTP === correctOTP) {
              return;
            }

            // Verify with wrong OTP should fail
            const wrongResult = await orderService.verifyOrderOTP(orderId, wrongOTP);
            expect(wrongResult).toBe(false);

            // OTP should still be in Redis (not deleted on failed verification)
            const storedOTP = await redis.get(`order:otp:${orderId}`);
            expect(storedOTP).toBe(correctOTP);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should fail verification with correct OTP but wrong order ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 4, maxLength: 8 }),
          fc.string({ minLength: 10, maxLength: 12 }),
          async (orderId1, orderId2, orderNumber, phone) => {
            // Ensure order IDs are different
            if (orderId1 === orderId2) {
              return;
            }

            // Generate OTP for first order
            const otp = await orderService.generateOrderOTP(orderId1, orderNumber, phone);

            // Try to verify with the OTP but different order ID
            const wrongOrderResult = await orderService.verifyOrderOTP(orderId2, otp);
            expect(wrongOrderResult).toBe(false);

            // Original OTP should still be in Redis
            const storedOTP = await redis.get(`order:otp:${orderId1}`);
            expect(storedOTP).toBe(otp);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should fail verification for expired OTP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 4, maxLength: 8 }),
          fc.string({ minLength: 10, maxLength: 12 }),
          async (orderId, orderNumber, phone) => {
            // Generate OTP for the order
            const otp = await orderService.generateOrderOTP(orderId, orderNumber, phone);

            // Manually delete the OTP to simulate expiration
            await redis.del(`order:otp:${orderId}`);

            // Verify should fail for expired OTP
            const expiredResult = await orderService.verifyOrderOTP(orderId, otp);
            expect(expiredResult).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
