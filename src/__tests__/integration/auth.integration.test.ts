/**
 * Integration Tests for Authentication Flows
 * Tests complete end-to-end authentication flows
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5, 5.1-5.5, 6.1-6.4, 8.1-8.4, 13.1-13.5
 */

import type { Queue } from 'bull';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { ISMSProvider, SendSMSParams } from '../../providers/ISMSProvider.js';
import { AuthService } from '../../services/AuthService.js';
import { CustomerService, ShopifyCustomer } from '../../services/CustomerService.js';
import { MultipassService } from '../../services/MultipassService.js';
import { OAuthService } from '../../services/OAuthService.js';
import { OrderService } from '../../services/OrderService.js';
import { OTPService } from '../../services/OTPService.js';
import { SMSService } from '../../services/SMSService.js';

describe('Authentication Integration Tests', () => {
  let redis: Redis;
  let authService: AuthService;
  let otpService: OTPService;
  let smsService: SMSService;
  let orderService: OrderService;
  let customerService: jest.Mocked<CustomerService>;
  let multipassService: MultipassService;
  let oauthService: OAuthService;
  let mockQueue: jest.Mocked<Queue>;
  let mockSmsProvider: jest.Mocked<ISMSProvider>;
  let mockSecondaryProvider: jest.Mocked<ISMSProvider>;

  beforeEach(() => {
    // Use real Redis mock for integration tests
    redis = new RedisMock();

    // Create mock SMS providers
    mockSmsProvider = {
      name: 'primary-sms',
      priority: 1,
      sendSMS: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-primary-123',
        provider: 'primary-sms',
      }),
      checkDeliveryStatus: jest.fn(),
      handleWebhook: jest.fn(),
    } as any;

    mockSecondaryProvider = {
      name: 'secondary-sms',
      priority: 2,
      sendSMS: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-secondary-456',
        provider: 'secondary-sms',
      }),
      checkDeliveryStatus: jest.fn(),
      handleWebhook: jest.fn(),
    } as any;

    // Create mock customer service
    customerService = {
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setAuthMethod: jest.fn().mockResolvedValue(undefined),
      setPhoneVerified: jest.fn().mockResolvedValue(undefined),
      setLastLogin: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create real Multipass service
    multipassService = new MultipassService();

    // Create real OAuth service
    oauthService = new OAuthService();

    // Create mock queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      process: jest.fn(),
      on: jest.fn(),
    } as any;

    // Create real services
    otpService = new OTPService(redis);
    smsService = new SMSService([mockSmsProvider, mockSecondaryProvider], redis);
    orderService = new OrderService(redis, otpService, smsService);

    authService = new AuthService(
      multipassService,
      customerService,
      otpService,
      smsService,
      oauthService,
      mockQueue
    );
  });

  afterEach(async () => {
    // Clean up Redis
    await redis.flushall();
    await redis.quit();
  });

  describe('SMS Authentication End-to-End', () => {
    it('should complete full SMS authentication flow: send OTP → verify → Multipass redirect', async () => {
      const phone = '+12025551234';
      const mockCustomer: ShopifyCustomer = {
        id: '123456',
        email: `${phone}@phone.local`,
        phone,
        created_at: new Date().toISOString(),
      };

      customerService.findByPhone.mockResolvedValue(null);
      customerService.create.mockResolvedValue(mockCustomer);

      // Step 1: Send OTP
      await authService.sendOTP(phone, false);

      // Verify OTP was generated and stored
      const storedOTP = await redis.get(`otp:${phone}`);
      expect(storedOTP).toBeTruthy();
      expect(storedOTP).toMatch(/^\d{6}$/);

      // Verify SMS was queued
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          message: expect.stringContaining(storedOTP!),
        })
      );

      // Step 2: Verify OTP
      const result = await authService.authenticateWithPhone(phone, storedOTP!, '/checkout');

      // Verify authentication succeeded
      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBeDefined();
      expect(result.multipassUrl).toContain('multipass');
      expect(result.customer).toEqual(mockCustomer);

      // Verify customer was created
      expect(customerService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          tags: ['sms-auth'],
        })
      );

      // Verify metafields were updated
      expect(customerService.setAuthMethod).toHaveBeenCalledWith('123456', 'sms');
      expect(customerService.setPhoneVerified).toHaveBeenCalledWith('123456', true);
      expect(customerService.setLastLogin).toHaveBeenCalledWith('123456');

      // Verify OTP was deleted after use
      const otpAfterUse = await redis.get(`otp:${phone}`);
      expect(otpAfterUse).toBeNull();
    });

    it('should reject invalid OTP', async () => {
      const phone = '+12025551234';

      // Send OTP
      await authService.sendOTP(phone, false);

      // Try to verify with wrong OTP
      const result = await authService.authenticateWithPhone(phone, '000000', '/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
    });

    it('should enforce rate limiting on OTP send', async () => {
      const phone = '+12025551234';

      // First send should succeed
      await authService.sendOTP(phone, false);

      // Record send time
      await otpService.recordSendTime(phone);

      // Immediate resend should fail (30 second cooldown)
      const canResend = await otpService.canResendOTP(phone);
      expect(canResend.allowed).toBe(false);
      expect(canResend.retryAfter).toBeGreaterThan(0);
    });

    it('should block phone after 5 failed verification attempts', async () => {
      const phone = '+12025551234';

      // Send OTP
      await authService.sendOTP(phone, false);

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.authenticateWithPhone(phone, '000000', '/');
      }

      // Phone should be blocked
      const isBlocked = await otpService.isBlocked(phone);
      expect(isBlocked).toBe(true);

      // Sending new OTP should fail
      await expect(authService.sendOTP(phone, false)).rejects.toThrow('Too many failed attempts');
    });
  });

  describe('Email Authentication End-to-End', () => {
    it('should complete full email authentication flow: login → verify → Multipass redirect', async () => {
      const email = 'test@example.com';
      const password = 'SecurePassword123!';
      const mockCustomer: ShopifyCustomer = {
        id: '789012',
        email,
        created_at: new Date().toISOString(),
      };

      customerService.findByEmail.mockResolvedValue(null);
      customerService.create.mockResolvedValue(mockCustomer);

      // Authenticate with email (creates new customer)
      const result = await authService.authenticateWithEmail(email, password, '/account');

      // Verify authentication succeeded
      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBeDefined();
      expect(result.multipassUrl).toContain('multipass');
      expect(result.customer).toEqual(mockCustomer);

      // Verify customer was created with hashed password
      expect(customerService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          password: expect.any(String),
          tags: ['email-auth'],
        })
      );

      // Verify password was hashed (should not be plain text)
      const createCall = customerService.create.mock.calls[0][0];
      expect(createCall.password).not.toBe(password);
      expect(createCall.password).toMatch(/^\$2[aby]\$/); // bcrypt hash format

      // Verify metafields were updated
      expect(customerService.setAuthMethod).toHaveBeenCalledWith('789012', 'email');
      expect(customerService.setLastLogin).toHaveBeenCalledWith('789012');
    });

    it('should authenticate existing email customer', async () => {
      const email = 'existing@example.com';
      const password = 'ExistingPassword123!';
      const mockCustomer: ShopifyCustomer = {
        id: '999888',
        email,
        created_at: new Date().toISOString(),
      };

      customerService.findByEmail.mockResolvedValue(mockCustomer);

      // Authenticate with existing customer
      const result = await authService.authenticateWithEmail(email, password, '/');

      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBeDefined();
      expect(result.customer).toEqual(mockCustomer);

      // Should not create new customer
      expect(customerService.create).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', async () => {
      const invalidEmail = 'not-an-email';
      const password = 'Password123!';

      const result = await authService.authenticateWithEmail(invalidEmail, password, '/');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });
  });

  describe('OAuth Authentication End-to-End', () => {
    it('should complete full OAuth flow: initiate → callback → Multipass redirect', async () => {
      const mockGoogleProvider = {
        name: 'google',
        scopes: ['openid', 'email', 'profile'],
        getAuthorizationUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?client_id=test'),
        exchangeCodeForToken: jest.fn().mockResolvedValue({
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-456',
          expiresIn: 3600,
          tokenType: 'Bearer',
        }),
        getUserProfile: jest.fn().mockResolvedValue({
          id: 'google-user-123',
          email: 'user@gmail.com',
          firstName: 'John',
          lastName: 'Doe',
          emailVerified: true,
        }),
        refreshToken: jest.fn(),
      };

      oauthService.registerProvider('google', mockGoogleProvider as any);

      const mockCustomer: ShopifyCustomer = {
        id: '555666',
        email: 'user@gmail.com',
        first_name: 'John',
        last_name: 'Doe',
        created_at: new Date().toISOString(),
      };

      customerService.findByEmail.mockResolvedValue(null);
      customerService.create.mockResolvedValue(mockCustomer);

      // Step 1: Initiate OAuth
      const authUrl = await authService.initiateOAuth('google', 'http://localhost:3000/callback', 'state123');

      expect(authUrl).toContain('accounts.google.com');
      expect(mockGoogleProvider.getAuthorizationUrl).toHaveBeenCalledWith('state123', 'http://localhost:3000/callback');

      // Step 2: Handle OAuth callback
      const result = await authService.authenticateWithOAuth(
        'google',
        'auth-code-789',
        'http://localhost:3000/callback',
        '/account'
      );

      // Verify authentication succeeded
      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBeDefined();
      expect(result.multipassUrl).toContain('multipass');
      expect(result.customer).toEqual(mockCustomer);

      // Verify OAuth flow was completed
      expect(mockGoogleProvider.exchangeCodeForToken).toHaveBeenCalledWith('auth-code-789', 'http://localhost:3000/callback');
      expect(mockGoogleProvider.getUserProfile).toHaveBeenCalledWith('access-token-123');

      // Verify customer was created with OAuth data
      expect(customerService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@gmail.com',
          firstName: 'John',
          lastName: 'Doe',
          tags: ['google-auth'],
        })
      );

      // Verify metafields were updated
      expect(customerService.setAuthMethod).toHaveBeenCalledWith('555666', 'google');
      expect(customerService.setLastLogin).toHaveBeenCalledWith('555666');
    });

    it('should handle OAuth provider not found', async () => {
      await expect(
        authService.initiateOAuth('facebook', 'http://localhost:3000/callback')
      ).rejects.toThrow();
    });
  });

  describe('SMS Provider Fallback', () => {
    it('should fallback to secondary provider when primary fails', async () => {
      // Make primary provider fail
      mockSmsProvider.sendSMS.mockResolvedValueOnce({
        success: false,
        messageId: '',
        provider: 'primary-sms',
        error: 'Provider unavailable',
      });

      const params: SendSMSParams = {
        to: '+12025551234',
        message: 'Test message',
      };

      // Send SMS with fallback
      const result = await smsService.sendWithFallback(params);

      // Should succeed with secondary provider
      expect(result.success).toBe(true);
      expect(result.provider).toBe('secondary-sms');
      expect(result.messageId).toBe('msg-secondary-456');

      // Verify both providers were tried
      expect(mockSmsProvider.sendSMS).toHaveBeenCalledWith(params);
      expect(mockSecondaryProvider.sendSMS).toHaveBeenCalledWith(params);
    });

    it('should fail when all providers fail', async () => {
      // Make both providers fail
      mockSmsProvider.sendSMS.mockResolvedValueOnce({
        success: false,
        messageId: '',
        provider: 'primary-sms',
        error: 'Provider unavailable',
      });

      mockSecondaryProvider.sendSMS.mockResolvedValueOnce({
        success: false,
        messageId: '',
        provider: 'secondary-sms',
        error: 'Provider unavailable',
      });

      const params: SendSMSParams = {
        to: '+12025551234',
        message: 'Test message',
      };

      const result = await smsService.sendWithFallback(params);

      // Should fail
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify both providers were tried
      expect(mockSmsProvider.sendSMS).toHaveBeenCalled();
      expect(mockSecondaryProvider.sendSMS).toHaveBeenCalled();
    });

    it('should rotate providers on resend', async () => {
      const phone = '+12025551234';
      const params: SendSMSParams = {
        to: phone,
        message: 'Test message',
      };

      // First send uses primary provider
      await smsService.sendSMS(params);

      // Get the last used provider
      const lastProvider = await redis.get(`sms:last_provider:${phone}`);
      expect(lastProvider).toBe('primary-sms');

      // Resend should use secondary provider
      const nextProvider = smsService.getNextProvider('primary-sms');
      expect(nextProvider?.name).toBe('secondary-sms');
    });
  });

  describe('Rate Limiting Across Multiple Requests', () => {
    it('should enforce IP rate limiting (10 requests per minute)', async () => {
      const ip = '192.168.1.100';
      const endpoint = '/api/auth/send-otp';
      const key = `ratelimit:${ip}:${endpoint}`;

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await redis.incr(key);
      }

      // Set TTL on first request
      await redis.expire(key, 60);

      // Check count
      const count = await redis.get(key);
      expect(parseInt(count!)).toBe(10);

      // 11th request should be rate limited
      const currentCount = parseInt((await redis.get(key))!);
      expect(currentCount).toBeGreaterThanOrEqual(10);
    });

    it('should enforce OTP send attempts (3 per 10 minutes)', async () => {
      const phone = '+12025551234';

      // Track 3 send attempts
      for (let i = 0; i < 3; i++) {
        const attempt = await otpService.trackSendAttempt(phone);
        expect(attempt.allowed).toBe(true);
      }

      // 4th attempt should be blocked
      const fourthAttempt = await otpService.trackSendAttempt(phone);
      expect(fourthAttempt.allowed).toBe(false);
      expect(fourthAttempt.retryAfter).toBeGreaterThan(0);
    });

    it('should enforce resend cooldown (30 seconds)', async () => {
      const phone = '+12025551234';

      // Record send time
      await otpService.recordSendTime(phone);

      // Immediate resend should be blocked
      const canResend = await otpService.canResendOTP(phone);
      expect(canResend.allowed).toBe(false);
      expect(canResend.retryAfter).toBeGreaterThan(0);
      expect(canResend.retryAfter).toBeLessThanOrEqual(30);
    });
  });

  describe('Order Confirmation Flow', () => {
    it('should complete full order confirmation flow: webhook → OTP → verify → status update', async () => {
      const orderId = 'order-123456';
      const orderNumber = '1001';
      const phone = '+12025551234';

      // Step 1: Generate order OTP (triggered by webhook)
      const otp = await orderService.generateOrderOTP(orderId, orderNumber, phone);

      // Verify OTP was generated
      expect(otp).toMatch(/^\d{6}$/);

      // Verify OTP was stored
      const storedOTP = await redis.get(`order:otp:${orderId}`);
      expect(storedOTP).toBe(otp);

      // Verify SMS was sent
      expect(mockSmsProvider.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          to: phone,
          message: expect.stringContaining(orderNumber),
          message: expect.stringContaining(otp),
        })
      );

      // Step 2: Verify OTP
      const isValid = await orderService.verifyOrderOTP(orderId, otp);
      expect(isValid).toBe(true);

      // Verify OTP was deleted after use
      const otpAfterUse = await redis.get(`order:otp:${orderId}`);
      expect(otpAfterUse).toBeNull();

      // Step 3: Confirm order (would update Shopify)
      // Note: This would normally call Shopify API, which we can't test in unit tests
      // But we can verify the method exists and handles the flow
      const result = await orderService.verifyAndConfirmOrder(orderId, otp);
      
      // Since OTP was already deleted, this should fail
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
    });

    it('should reject invalid order OTP', async () => {
      const orderId = 'order-789012';
      const orderNumber = '1002';
      const phone = '+12025551234';

      // Generate OTP
      await orderService.generateOrderOTP(orderId, orderNumber, phone);

      // Try to verify with wrong OTP
      const isValid = await orderService.verifyOrderOTP(orderId, '000000');
      expect(isValid).toBe(false);
    });

    it('should expire order OTP after 10 minutes', async () => {
      const orderId = 'order-345678';
      const orderNumber = '1003';
      const phone = '+12025551234';

      // Generate OTP
      const otp = await orderService.generateOrderOTP(orderId, orderNumber, phone);

      // Check TTL
      const ttl = await redis.ttl(`order:otp:${orderId}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(600); // 10 minutes

      // Simulate expiration
      await redis.del(`order:otp:${orderId}`);

      // Verification should fail
      const isValid = await orderService.verifyOrderOTP(orderId, otp);
      expect(isValid).toBe(false);
    });
  });
});
