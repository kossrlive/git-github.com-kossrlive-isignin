/**
 * Unit Tests for SessionService
 * Feature: modern-shopify-auth-app
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */

import Redis from 'ioredis-mock';
import { SessionService } from '../SessionService.js';

describe('SessionService Unit Tests', () => {
  let redis: Redis;
  let sessionService: SessionService;

  beforeEach(() => {
    redis = new Redis();
    sessionService = new SessionService(redis);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('Session Token Generation', () => {
    it('should generate a unique session token', () => {
      const token1 = sessionService.generateSessionToken();
      const token2 = sessionService.generateSessionToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token2).toHaveLength(64);
    });

    it('should generate tokens with only hexadecimal characters', () => {
      const token = sessionService.generateSessionToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Session Creation', () => {
    it('should create a session with valid data', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      expect(sessionId).toBeDefined();
      expect(sessionId).toHaveLength(64);

      // Verify session is stored in Redis
      const sessionData = await sessionService.getSession(sessionId);
      expect(sessionData).not.toBeNull();
      expect(sessionData?.shop).toBe(shop);
      expect(sessionData?.customerId).toBe(customerId);
      expect(sessionData?.customerEmail).toBe(customerEmail);
    });

    it('should set TTL to 24 hours (86400 seconds)', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      // Check TTL in Redis
      const ttl = await redis.ttl(`session:${sessionId}`);
      expect(ttl).toBeGreaterThan(86390); // Allow small variance
      expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('should include creation and expiration timestamps', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const beforeCreate = Date.now();
      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );
      const afterCreate = Date.now();

      const sessionData = await sessionService.getSession(sessionId);
      expect(sessionData).not.toBeNull();
      expect(sessionData?.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(sessionData?.createdAt).toBeLessThanOrEqual(afterCreate);
      
      // Expiration should be 24 hours from creation
      const expectedExpiration = sessionData!.createdAt + (86400 * 1000);
      expect(sessionData?.expiresAt).toBeGreaterThanOrEqual(expectedExpiration - 1000);
      expect(sessionData?.expiresAt).toBeLessThanOrEqual(expectedExpiration + 1000);
    });
  });

  describe('Session Validation', () => {
    it('should validate an existing session', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      const validatedSession = await sessionService.validateSession(sessionId);
      expect(validatedSession).not.toBeNull();
      expect(validatedSession?.sessionId).toBe(sessionId);
      expect(validatedSession?.shop).toBe(shop);
      expect(validatedSession?.customerId).toBe(customerId);
      expect(validatedSession?.customerEmail).toBe(customerEmail);
    });

    it('should return null for non-existent session', async () => {
      const fakeSessionId = 'nonexistent123456789';
      const validatedSession = await sessionService.validateSession(fakeSessionId);
      expect(validatedSession).toBeNull();
    });

    it('should return null for expired session', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      // Create session with very short TTL
      const shortTTLService = new SessionService(redis, { sessionTTL: 1 });
      const sessionId = await shortTTLService.createSession(
        shop,
        customerId,
        customerEmail
      );

      // Wait for session to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const validatedSession = await sessionService.validateSession(sessionId);
      expect(validatedSession).toBeNull();
    });
  });

  describe('Session Invalidation', () => {
    it('should invalidate an existing session', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      // Verify session exists
      let sessionData = await sessionService.getSession(sessionId);
      expect(sessionData).not.toBeNull();

      // Invalidate session
      await sessionService.invalidateSession(sessionId);

      // Verify session is deleted
      sessionData = await sessionService.getSession(sessionId);
      expect(sessionData).toBeNull();
    });

    it('should not throw error when invalidating non-existent session', async () => {
      const fakeSessionId = 'nonexistent123456789';
      await expect(
        sessionService.invalidateSession(fakeSessionId)
      ).resolves.not.toThrow();
    });

    it('should make session unvalidatable after invalidation', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      await sessionService.invalidateSession(sessionId);

      const validatedSession = await sessionService.validateSession(sessionId);
      expect(validatedSession).toBeNull();
    });
  });

  describe('Session Refresh', () => {
    it('should refresh an existing session', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      const sessionId = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      const originalSession = await sessionService.getSession(sessionId);
      const originalExpiration = originalSession?.expiresAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh session
      const refreshed = await sessionService.refreshSession(sessionId);
      expect(refreshed).toBe(true);

      // Check that expiration was updated
      const refreshedSession = await sessionService.getSession(sessionId);
      expect(refreshedSession?.expiresAt).toBeGreaterThan(originalExpiration!);
    });

    it('should return false when refreshing non-existent session', async () => {
      const fakeSessionId = 'nonexistent123456789';
      const refreshed = await sessionService.refreshSession(fakeSessionId);
      expect(refreshed).toBe(false);
    });
  });

  describe('Customer Sessions', () => {
    it('should retrieve all sessions for a customer', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      // Create multiple sessions for the same customer
      const sessionId1 = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );
      const sessionId2 = await sessionService.createSession(
        shop,
        customerId,
        customerEmail
      );

      const sessions = await sessionService.getCustomerSessions(customerId);
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.sessionId)).toContain(sessionId1);
      expect(sessions.map(s => s.sessionId)).toContain(sessionId2);
    });

    it('should return empty array for customer with no sessions', async () => {
      const customerId = 'gid://shopify/Customer/999';
      const sessions = await sessionService.getCustomerSessions(customerId);
      expect(sessions).toHaveLength(0);
    });

    it('should invalidate all sessions for a customer', async () => {
      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      // Create multiple sessions
      await sessionService.createSession(shop, customerId, customerEmail);
      await sessionService.createSession(shop, customerId, customerEmail);
      await sessionService.createSession(shop, customerId, customerEmail);

      // Verify sessions exist
      let sessions = await sessionService.getCustomerSessions(customerId);
      expect(sessions).toHaveLength(3);

      // Invalidate all sessions
      const count = await sessionService.invalidateCustomerSessions(customerId);
      expect(count).toBe(3);

      // Verify all sessions are deleted
      sessions = await sessionService.getCustomerSessions(customerId);
      expect(sessions).toHaveLength(0);
    });

    it('should not affect sessions of other customers', async () => {
      const shop = 'test-shop.myshopify.com';
      const customer1Id = 'gid://shopify/Customer/123';
      const customer2Id = 'gid://shopify/Customer/456';
      const email1 = 'customer1@example.com';
      const email2 = 'customer2@example.com';

      // Create sessions for two different customers
      await sessionService.createSession(shop, customer1Id, email1);
      await sessionService.createSession(shop, customer2Id, email2);

      // Invalidate sessions for customer 1
      await sessionService.invalidateCustomerSessions(customer1Id);

      // Verify customer 1 has no sessions
      const customer1Sessions = await sessionService.getCustomerSessions(customer1Id);
      expect(customer1Sessions).toHaveLength(0);

      // Verify customer 2 still has their session
      const customer2Sessions = await sessionService.getCustomerSessions(customer2Id);
      expect(customer2Sessions).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully during creation', async () => {
      // Create a mock Redis that throws errors
      const errorRedis = {
        setex: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        get: jest.fn(),
        del: jest.fn(),
        ttl: jest.fn(),
        scan: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      const errorService = new SessionService(errorRedis);

      const shop = 'test-shop.myshopify.com';
      const customerId = 'gid://shopify/Customer/123';
      const customerEmail = 'test@example.com';

      await expect(
        errorService.createSession(shop, customerId, customerEmail)
      ).rejects.toThrow('Failed to create session');
    });

    it('should handle Redis errors gracefully during invalidation', async () => {
      // Create a mock Redis that throws errors on delete
      const errorRedis = {
        setex: jest.fn().mockResolvedValue('OK'),
        get: jest.fn(),
        del: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        ttl: jest.fn(),
        scan: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      const errorService = new SessionService(errorRedis);

      const sessionId = 'test-session-id';

      await expect(
        errorService.invalidateSession(sessionId)
      ).rejects.toThrow('Failed to invalidate session');
    });
  });
});
