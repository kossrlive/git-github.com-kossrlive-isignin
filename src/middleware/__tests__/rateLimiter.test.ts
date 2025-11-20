/**
 * Property-based tests for rate limiting middleware
 * Feature: shopify-sms-auth
 */

import { Request, Response } from 'express';
import fc from 'fast-check';
import RedisMock from 'ioredis-mock';
import { RateLimitError } from '../../errors/index.js';
import { createRateLimiter } from '../rateLimiter.js';

describe('Rate Limiting Middleware', () => {
  let redis: RedisMock;

  beforeEach(() => {
    redis = new RedisMock();
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  /**
   * Feature: shopify-sms-auth, Property 16: IP rate limiting
   * Validates: Requirements 6.3
   * 
   * Property: For any IP address, after 10 requests to any endpoint within 1 minute,
   * further requests should be rate limited
   */
  describe('Property 16: IP rate limiting', () => {
    it('should block requests after threshold is exceeded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.startsWith('/')),
          async (ip, endpoint) => {
            // Create rate limiter with test settings
            const rateLimiter = createRateLimiter({
              windowMs: 60000,
              maxRequests: 10,
              keyPrefix: `test:ratelimit:${Date.now()}`,
              redis: redis as any,
            });

            let blockedCount = 0;
            let allowedCount = 0;

            // Make 15 requests (10 should pass, 5 should be blocked)
            for (let i = 0; i < 15; i++) {
              const mockReq = {
                ip,
                path: endpoint,
                logger: {
                  warn: jest.fn(),
                  error: jest.fn(),
                },
              } as unknown as Request;

              const mockRes = {
                setHeader: jest.fn(),
              } as unknown as Response;

              let errorThrown = false;
              const mockNext = jest.fn((error?: any) => {
                if (error instanceof RateLimitError) {
                  errorThrown = true;
                  blockedCount++;
                }
              });

              await rateLimiter(mockReq, mockRes, mockNext);

              if (!errorThrown) {
                allowedCount++;
              }
            }

            // Verify that exactly 10 requests were allowed and 5 were blocked
            expect(allowedCount).toBe(10);
            expect(blockedCount).toBe(5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set correct rate limit headers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.startsWith('/')),
          fc.integer({ min: 1, max: 10 }),
          async (ip, endpoint, requestNumber) => {
            const maxRequests = 10;
            const rateLimiter = createRateLimiter({
              windowMs: 60000,
              maxRequests,
              keyPrefix: `test:ratelimit:${Date.now()}`,
              redis: redis as any,
            });

            const mockReq = {
              ip,
              path: endpoint,
              logger: {
                warn: jest.fn(),
                error: jest.fn(),
              },
            } as unknown as Request;

            const headers: Record<string, string> = {};
            const mockRes = {
              setHeader: jest.fn((name: string, value: string) => {
                headers[name] = value;
              }),
            } as unknown as Response;

            const mockNext = jest.fn();

            // Make the specified number of requests
            for (let i = 0; i < requestNumber; i++) {
              await rateLimiter(mockReq, mockRes, mockNext);
            }

            // Verify headers are set
            expect(headers['X-RateLimit-Limit']).toBe(maxRequests.toString());
            expect(headers['X-RateLimit-Remaining']).toBeDefined();
            expect(headers['X-RateLimit-Reset']).toBeDefined();

            // Verify remaining count is correct
            const remaining = parseInt(headers['X-RateLimit-Remaining'], 10);
            expect(remaining).toBe(Math.max(0, maxRequests - requestNumber));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 429 with retry-after header when rate limited', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.startsWith('/')),
          async (ip, endpoint) => {
            const rateLimiter = createRateLimiter({
              windowMs: 60000,
              maxRequests: 10,
              keyPrefix: `test:ratelimit:${Date.now()}`,
              redis: redis as any,
            });

            // Make 10 requests to reach the limit
            for (let i = 0; i < 10; i++) {
              const mockReq = {
                ip,
                path: endpoint,
                logger: { warn: jest.fn(), error: jest.fn() },
              } as unknown as Request;

              const mockRes = {
                setHeader: jest.fn(),
              } as unknown as Response;

              await rateLimiter(mockReq, mockRes, jest.fn());
            }

            // 11th request should be rate limited
            const mockReq = {
              ip,
              path: endpoint,
              logger: { warn: jest.fn(), error: jest.fn() },
            } as unknown as Request;

            const headers: Record<string, string> = {};
            const mockRes = {
              setHeader: jest.fn((name: string, value: string) => {
                headers[name] = value;
              }),
            } as unknown as Response;

            let rateLimitError: RateLimitError | null = null;
            const mockNext = jest.fn((error?: any) => {
              if (error instanceof RateLimitError) {
                rateLimitError = error;
              }
            });

            await rateLimiter(mockReq, mockRes, mockNext);

            // Verify rate limit error was thrown
            expect(rateLimitError).toBeInstanceOf(RateLimitError);
            expect(rateLimitError?.statusCode).toBe(429);
            expect(rateLimitError?.retryAfter).toBeGreaterThan(0);

            // Verify Retry-After header is set
            expect(headers['Retry-After']).toBeDefined();
            expect(parseInt(headers['Retry-After'], 10)).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should track requests per IP independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.ipV4(), { minLength: 2, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.startsWith('/')),
          async (ips, endpoint) => {
            const rateLimiter = createRateLimiter({
              windowMs: 60000,
              maxRequests: 10,
              keyPrefix: `test:ratelimit:${Date.now()}`,
              redis: redis as any,
            });

            // Each IP should be able to make 10 requests independently
            for (const ip of ips) {
              let allowedCount = 0;

              for (let i = 0; i < 10; i++) {
                const mockReq = {
                  ip,
                  path: endpoint,
                  logger: { warn: jest.fn(), error: jest.fn() },
                } as unknown as Request;

                const mockRes = {
                  setHeader: jest.fn(),
                } as unknown as Response;

                let errorThrown = false;
                const mockNext = jest.fn((error?: unknown) => {
                  if (error instanceof RateLimitError) {
                    errorThrown = true;
                  }
                });

                await rateLimiter(mockReq, mockRes, mockNext);

                if (!errorThrown) {
                  allowedCount++;
                }
              }

              // Each IP should be allowed exactly 10 requests
              expect(allowedCount).toBe(10);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
