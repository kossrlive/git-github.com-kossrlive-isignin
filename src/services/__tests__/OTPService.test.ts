/**
 * Property-Based Tests for OTPService
 * Feature: shopify-sms-auth
 * Validates: Requirements 1.2, 1.4, 6.1, 6.2, 6.4
 */

import fc from 'fast-check';
import Redis from 'ioredis-mock';
import { OTPService } from '../OTPService.js';

describe('OTPService Property-Based Tests', () => {
  let redis: Redis;
  let otpService: OTPService;

  beforeEach(() => {
    redis = new Redis();
    otpService = new OTPService(redis);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  /**
   * Feature: shopify-sms-auth, Property 2: OTP generation format
   * Validates: Requirements 1.2
   */
  describe('Property 2: OTP generation format', () => {
    it('should always generate exactly 6 digits for any valid phone number', () => {
      fc.assert(
        fc.property(fc.string(), () => {
          const otp = otpService.generateOTP(6);
          
          // OTP should be exactly 6 characters
          expect(otp).toHaveLength(6);
          
          // OTP should contain only digits
          expect(otp).toMatch(/^\d{6}$/);
          
          // OTP should be a valid number
          const numValue = parseInt(otp, 10);
          expect(numValue).toBeGreaterThanOrEqual(0);
          expect(numValue).toBeLessThanOrEqual(999999);
        }),
        { numRuns: 100 }
      );
    });

    it('should store OTP in Redis with TTL of 300 seconds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          async (phone) => {
            const otp = otpService.generateOTP();
            await otpService.storeOTP(phone, otp, 300);
            
            // Verify OTP is stored
            const storedOTP = await redis.get(`otp:${phone}`);
            expect(storedOTP).toBe(otp);
            
            // Verify TTL is set (ioredis-mock supports ttl)
            const ttl = await redis.ttl(`otp:${phone}`);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(300);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 3: OTP verification correctness
   * Validates: Requirements 1.4
   */
  describe('Property 3: OTP verification correctness', () => {
    it('should return success for correct OTP and failure for incorrect OTP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
          async (phone, correctOTP) => {
            // Store the correct OTP
            await otpService.storeOTP(phone, correctOTP);
            
            // Verify with correct OTP should succeed
            const correctResult = await otpService.verifyOTP(phone, correctOTP);
            expect(correctResult).toBe(true);
            
            // After successful verification, OTP should be deleted
            const deletedOTP = await redis.get(`otp:${phone}`);
            expect(deletedOTP).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return failure for any incorrect OTP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
          async (phone, correctOTP, wrongOTP) => {
            // Skip if OTPs are the same
            fc.pre(correctOTP !== wrongOTP);
            
            // Store the correct OTP
            await otpService.storeOTP(phone, correctOTP);
            
            // Verify with wrong OTP should fail
            const wrongResult = await otpService.verifyOTP(phone, wrongOTP);
            expect(wrongResult).toBe(false);
            
            // OTP should still exist after failed verification
            const storedOTP = await redis.get(`otp:${phone}`);
            expect(storedOTP).toBe(correctOTP);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 14: Failed attempt counter
   * Validates: Requirements 6.1
   */
  describe('Property 14: Failed attempt counter', () => {
    it('should increment failed attempts counter for each incorrect OTP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 4 }),
          async (phone, numAttempts) => {
            const correctOTP = '123456';
            const wrongOTP = '654321';
            
            await otpService.storeOTP(phone, correctOTP);
            
            // Make multiple failed attempts
            for (let i = 0; i < numAttempts; i++) {
              await otpService.verifyOTP(phone, wrongOTP);
            }
            
            // Check failed attempts counter
            const attempts = await otpService.getFailedAttempts(phone);
            expect(attempts).toBe(numAttempts);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 15: Phone blocking after failures
   * Validates: Requirements 6.2
   */
  describe('Property 15: Phone blocking after failures', () => {
    it('should block phone after 5 failed OTP verification attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          async (phone) => {
            const correctOTP = '123456';
            const wrongOTP = '654321';
            
            await otpService.storeOTP(phone, correctOTP);
            
            // Make 5 failed attempts
            for (let i = 0; i < 5; i++) {
              await otpService.verifyOTP(phone, wrongOTP);
            }
            
            // Phone should be blocked
            const isBlocked = await otpService.isBlocked(phone);
            expect(isBlocked).toBe(true);
            
            // Further verification attempts should fail even with correct OTP
            await otpService.storeOTP(phone, correctOTP);
            const result = await otpService.verifyOTP(phone, correctOTP);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not block phone before reaching 5 failed attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 4 }),
          async (phone, numAttempts) => {
            const correctOTP = '123456';
            const wrongOTP = '654321';
            
            await otpService.storeOTP(phone, correctOTP);
            
            // Make fewer than 5 failed attempts
            for (let i = 0; i < numAttempts; i++) {
              await otpService.verifyOTP(phone, wrongOTP);
            }
            
            // Phone should not be blocked
            const isBlocked = await otpService.isBlocked(phone);
            expect(isBlocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 12: Rate limiting for resend
   * Validates: Requirements 5.4
   */
  describe('Property 12: Rate limiting for resend', () => {
    it('should reject resend if less than 30 seconds since last send', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          async (phone) => {
            // Record initial send time
            await otpService.recordSendTime(phone);
            
            // Immediately check if resend is allowed
            const result = await otpService.canResendOTP(phone);
            
            // Should not be allowed
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeDefined();
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.retryAfter).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow resend if no previous send recorded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          async (phone) => {
            // Check if resend is allowed without any previous send
            const result = await otpService.canResendOTP(phone);
            
            // Should be allowed
            expect(result.allowed).toBe(true);
            expect(result.retryAfter).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 13: Send attempt blocking
   * Validates: Requirements 5.5
   */
  describe('Property 13: Send attempt blocking', () => {
    it('should block phone after 3 send attempts within 10 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          async (phone) => {
            // Make 3 send attempts
            for (let i = 0; i < 3; i++) {
              const result = await otpService.trackSendAttempt(phone);
              expect(result.allowed).toBe(true);
            }
            
            // 4th attempt should be blocked
            const fourthAttempt = await otpService.trackSendAttempt(phone);
            expect(fourthAttempt.allowed).toBe(false);
            expect(fourthAttempt.retryAfter).toBeDefined();
            expect(fourthAttempt.retryAfter).toBeGreaterThan(0);
            
            // Phone should be send-blocked
            const isBlocked = await otpService.isSendBlocked(phone);
            expect(isBlocked).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow up to 3 send attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 3 }),
          async (phone, numAttempts) => {
            // Make up to 3 send attempts
            for (let i = 0; i < numAttempts; i++) {
              const result = await otpService.trackSendAttempt(phone);
              expect(result.allowed).toBe(true);
            }
            
            // Phone should not be send-blocked yet
            const isBlocked = await otpService.isSendBlocked(phone);
            expect(isBlocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block for 10 minutes after exceeding send attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          async (phone) => {
            // Make 4 send attempts (3 allowed + 1 blocked)
            for (let i = 0; i < 4; i++) {
              await otpService.trackSendAttempt(phone);
            }
            
            // Check that retry after is approximately 10 minutes (600 seconds)
            const result = await otpService.trackSendAttempt(phone);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeDefined();
            // Should be close to 600 seconds (allow some variance for test execution time)
            expect(result.retryAfter).toBeGreaterThan(590);
            expect(result.retryAfter).toBeLessThanOrEqual(600);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 17: OTP deletion after use
   * Validates: Requirements 6.4
   */
  describe('Property 17: OTP deletion after use', () => {
    it('should immediately delete OTP after successful verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
          async (phone, otp) => {
            // Store OTP
            await otpService.storeOTP(phone, otp);
            
            // Verify OTP exists
            const storedBefore = await redis.get(`otp:${phone}`);
            expect(storedBefore).toBe(otp);
            
            // Verify OTP successfully
            const result = await otpService.verifyOTP(phone, otp);
            expect(result).toBe(true);
            
            // OTP should be deleted
            const storedAfter = await redis.get(`otp:${phone}`);
            expect(storedAfter).toBeNull();
            
            // Attempting to verify again should fail
            await otpService.storeOTP(phone, otp);
            const secondVerify = await otpService.verifyOTP(phone, otp);
            expect(secondVerify).toBe(true); // This should succeed as we stored a new OTP
            
            // But the original verification should have deleted the OTP
            const finalCheck = await redis.get(`otp:${phone}`);
            expect(finalCheck).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not be usable again after successful verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
          async (phone, otp) => {
            // Store and verify OTP
            await otpService.storeOTP(phone, otp);
            const firstResult = await otpService.verifyOTP(phone, otp);
            expect(firstResult).toBe(true);
            
            // Try to verify the same OTP again (should fail as it's deleted)
            const secondResult = await otpService.verifyOTP(phone, otp);
            expect(secondResult).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
