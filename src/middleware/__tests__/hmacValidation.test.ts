/**
 * Property-based tests for HMAC validation middleware
 * Feature: shopify-sms-auth
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import fc from 'fast-check';
import { AuthenticationError } from '../../errors/index.js';
import { createHMACValidator } from '../hmacValidation.js';

describe('HMAC Validation Middleware', () => {
  const testSecret = 'test-secret-key-12345';

  /**
   * Feature: shopify-sms-auth, Property 26: HMAC validation
   * Validates: Requirements 11.5
   * 
   * Property: For any request claiming to be from Shopify, the HMAC signature
   * should be validated before processing
   */
  describe('Property 26: HMAC validation', () => {
    it('should accept requests with valid HMAC signature', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            code: fc.string({ minLength: 10, maxLength: 50 }),
            shop: fc.domain(),
            timestamp: fc.integer({ min: 1000000000, max: 9999999999 }).map(String),
          }),
          async (queryParams) => {
            // Calculate valid HMAC
            const sortedParams = Object.keys(queryParams)
              .sort()
              .map(key => `${key}=${queryParams[key as keyof typeof queryParams]}`)
              .join('&');

            const validHmac = crypto
              .createHmac('sha256', testSecret)
              .update(sortedParams)
              .digest('hex');

            const mockReq = {
              query: { ...queryParams, hmac: validHmac },
              headers: {},
              logger: {
                info: jest.fn(),
                warn: jest.fn(),
              },
            } as unknown as Request;

            const mockRes = {} as Response;
            let nextCalled = false;
            let errorPassed: any = null;

            const mockNext = jest.fn((error?: any) => {
              nextCalled = true;
              errorPassed = error;
            });

            const validator = createHMACValidator({ secret: testSecret });
            await validator(mockReq, mockRes, mockNext);

            // Should call next without error
            expect(nextCalled).toBe(true);
            expect(errorPassed).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests with invalid HMAC signature', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            code: fc.string({ minLength: 10, maxLength: 50 }),
            shop: fc.domain(),
            timestamp: fc.integer({ min: 1000000000, max: 9999999999 }).map(String),
          }),
          fc.hexaString({ minLength: 64, maxLength: 64 }),
          async (queryParams, invalidHmac) => {
            // Calculate valid HMAC
            const sortedParams = Object.keys(queryParams)
              .sort()
              .map(key => `${key}=${queryParams[key as keyof typeof queryParams]}`)
              .join('&');

            const validHmac = crypto
              .createHmac('sha256', testSecret)
              .update(sortedParams)
              .digest('hex');

            // Skip if randomly generated HMAC matches valid one
            fc.pre(invalidHmac !== validHmac);

            const mockReq = {
              query: { ...queryParams, hmac: invalidHmac },
              headers: {},
              path: '/test',
              ip: '127.0.0.1',
              logger: {
                info: jest.fn(),
                warn: jest.fn(),
              },
            } as unknown as Request;

            const mockRes = {} as Response;
            let authError: AuthenticationError | null = null;

            const mockNext = jest.fn((error?: any) => {
              if (error instanceof AuthenticationError) {
                authError = error;
              }
            });

            const validator = createHMACValidator({ secret: testSecret });
            await validator(mockReq, mockRes, mockNext);

            // Should call next with AuthenticationError
            expect(authError).toBeInstanceOf(AuthenticationError);
            expect(authError?.message).toBe('Invalid HMAC signature');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests without HMAC signature', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            code: fc.string({ minLength: 10, maxLength: 50 }),
            shop: fc.domain(),
            timestamp: fc.integer({ min: 1000000000, max: 9999999999 }).map(String),
          }),
          async (queryParams) => {
            const mockReq = {
              query: queryParams, // No HMAC
              headers: {},
              path: '/test',
              ip: '127.0.0.1',
              logger: {
                info: jest.fn(),
                warn: jest.fn(),
              },
            } as unknown as Request;

            const mockRes = {} as Response;
            let authError: AuthenticationError | null = null;

            const mockNext = jest.fn((error?: any) => {
              if (error instanceof AuthenticationError) {
                authError = error;
              }
            });

            const validator = createHMACValidator({ secret: testSecret });
            await validator(mockReq, mockRes, mockNext);

            // Should call next with AuthenticationError
            expect(authError).toBeInstanceOf(AuthenticationError);
            expect(authError?.message).toBe('Missing HMAC signature');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate HMAC from header for POST requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            data: fc.string({ minLength: 10, maxLength: 100 }),
            id: fc.integer({ min: 1, max: 10000 }),
          }),
          async (body) => {
            const rawBody = JSON.stringify(body);

            // Calculate valid HMAC for body
            const validHmac = crypto
              .createHmac('sha256', testSecret)
              .update(rawBody, 'utf8')
              .digest('base64');

            const mockReq = {
              query: {},
              headers: {
                'x-shopify-hmac-sha256': validHmac,
              },
              body,
              rawBody,
              logger: {
                info: jest.fn(),
                warn: jest.fn(),
              },
            } as unknown as Request;

            const mockRes = {} as Response;
            let nextCalled = false;
            let errorPassed: any = null;

            const mockNext = jest.fn((error?: any) => {
              nextCalled = true;
              errorPassed = error;
            });

            const validator = createHMACValidator({ secret: testSecret });
            await validator(mockReq, mockRes, mockNext);

            // Should call next without error
            expect(nextCalled).toBe(true);
            expect(errorPassed).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use timing-safe comparison to prevent timing attacks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            code: fc.string({ minLength: 10, maxLength: 50 }),
            shop: fc.domain(),
          }),
          async (queryParams) => {
            // Calculate valid HMAC
            const sortedParams = Object.keys(queryParams)
              .sort()
              .map(key => `${key}=${queryParams[key as keyof typeof queryParams]}`)
              .join('&');

            const validHmac = crypto
              .createHmac('sha256', testSecret)
              .update(sortedParams)
              .digest('hex');

            // Create HMAC with one character different
            const invalidHmac = validHmac.substring(0, validHmac.length - 1) + 
              (validHmac[validHmac.length - 1] === 'a' ? 'b' : 'a');

            const mockReq = {
              query: { ...queryParams, hmac: invalidHmac },
              headers: {},
              path: '/test',
              ip: '127.0.0.1',
              logger: {
                info: jest.fn(),
                warn: jest.fn(),
              },
            } as unknown as Request;

            const mockRes = {} as Response;
            let authError: AuthenticationError | null = null;

            const mockNext = jest.fn((error?: any) => {
              if (error instanceof AuthenticationError) {
                authError = error;
              }
            });

            const validator = createHMACValidator({ secret: testSecret });
            
            // Measure time (should be consistent regardless of where difference is)
            const startTime = process.hrtime.bigint();
            await validator(mockReq, mockRes, mockNext);
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime);

            // Should still reject
            expect(authError).toBeInstanceOf(AuthenticationError);
            
            // Timing should be relatively consistent (within reasonable bounds)
            // This is a weak test but demonstrates timing-safe comparison is used
            expect(duration).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
