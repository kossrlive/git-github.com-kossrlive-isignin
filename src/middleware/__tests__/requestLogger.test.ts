import { NextFunction, Request, Response } from 'express';
import fc from 'fast-check';
import { requestLogger } from '../requestLogger.js';

/**
 * Property-based tests for request logging
 * Requirements: 7.5
 */

// Mock response object
const createMockResponse = (): Partial<Response> => {
  const res: any = {
    statusCode: 200,
    headers: {},
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
  };
  return res;
};

describe('Request Logger Middleware - Property Tests', () => {
  /**
   * Feature: shopify-sms-auth, Property 20: Request logging completeness
   * Validates: Requirements 7.5
   * 
   * For any authentication request, the logs should contain request ID, authentication method,
   * and processing time
   */
  describe('Property 20: Request logging completeness', () => {
    it('should log request start with method, path, and IP', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          fc.constantFrom('/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/email-login'),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 100 }),
          (method, path, ip, userAgent) => {
            const req: Partial<Request> = {
              method,
              path,
              ip,
              headers: {
                'user-agent': userAgent,
              },
              socket: {
                remoteAddress: ip,
              } as any,
            };

            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            requestLogger(req as Request, res, next);

            // Verify request ID was generated
            expect(req.requestId).toBeDefined();
            expect(typeof req.requestId).toBe('string');
            expect(req.requestId!.length).toBeGreaterThan(0);

            // Verify logger was created
            expect(req.logger).toBeDefined();
            expect(typeof req.logger!.info).toBe('function');

            // Verify start time was recorded
            expect(req.startTime).toBeDefined();
            expect(typeof req.startTime).toBe('number');
            expect(req.startTime).toBeGreaterThan(0);

            // Verify logger.info was called with correct data
            expect(req.logger!.info).toHaveBeenCalledWith(
              'Request started',
              expect.objectContaining({
                method,
                path,
                ip,
                userAgent,
              })
            );

            // Verify X-Request-ID header was set
            expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);

            // Verify next was called
            expect(next).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use provided X-Request-ID header if present', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (providedRequestId) => {
            const req: Partial<Request> = {
              method: 'POST',
              path: '/api/auth/send-otp',
              ip: '127.0.0.1',
              headers: {
                'x-request-id': providedRequestId,
                'user-agent': 'test-agent',
              },
              socket: {
                remoteAddress: '127.0.0.1',
              } as any,
            };

            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            requestLogger(req as Request, res, next);

            // Verify the provided request ID was used
            expect(req.requestId).toBe(providedRequestId);
            expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', providedRequestId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log request completion with status, duration, and auth method', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.constantFrom('/api/auth/send-otp', '/api/auth/verify-otp'),
          fc.integer({ min: 200, max: 599 }),
          fc.constantFrom('sms', 'email', 'google', 'none'),
          fc.string({ minLength: 1, maxLength: 100 }),
          (method, path, statusCode, authMethod, responseData) => {
            const req: Partial<Request> = {
              method,
              path,
              ip: '127.0.0.1',
              headers: {
                'user-agent': 'test-agent',
              },
              socket: {
                remoteAddress: '127.0.0.1',
              } as any,
            };

            const res = createMockResponse() as Response;
            res.statusCode = statusCode;
            const next = jest.fn() as NextFunction;

            // Initialize the middleware
            requestLogger(req as Request, res, next);

            // Set auth method (would be set by auth middleware in real scenario)
            (req as any).authMethod = authMethod;

            // Simulate response being sent
            const startTime = req.startTime!;
            res.send!(responseData);

            // Verify completion was logged
            expect(req.logger!.info).toHaveBeenCalledWith(
              'Request completed',
              expect.objectContaining({
                method,
                path,
                status: statusCode,
                authMethod,
              })
            );

            // Verify duration was logged
            const completionCall = (req.logger!.info as jest.Mock).mock.calls.find(
              (call) => call[0] === 'Request completed'
            );
            expect(completionCall).toBeDefined();
            expect(completionCall[1].duration).toMatch(/^\d+ms$/);

            // Verify duration is reasonable (should be very small in tests)
            const durationMs = parseInt(completionCall[1].duration.replace('ms', ''));
            expect(durationMs).toBeGreaterThanOrEqual(0);
            expect(durationMs).toBeLessThan(1000); // Should complete in less than 1 second
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique request IDs for concurrent requests', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 20 }),
          (numRequests) => {
            const requestIds = new Set<string>();

            for (let i = 0; i < numRequests; i++) {
              const req: Partial<Request> = {
                method: 'POST',
                path: '/api/auth/send-otp',
                ip: '127.0.0.1',
                headers: {
                  'user-agent': 'test-agent',
                },
                socket: {
                  remoteAddress: '127.0.0.1',
                } as any,
              };

              const res = createMockResponse() as Response;
              const next = jest.fn() as NextFunction;

              requestLogger(req as Request, res, next);

              requestIds.add(req.requestId!);
            }

            // All request IDs should be unique
            expect(requestIds.size).toBe(numRequests);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle missing IP address gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST'),
          fc.constantFrom('/api/auth/send-otp', '/api/health'),
          (method, path) => {
            const req: Partial<Request> = {
              method,
              path,
              ip: undefined,
              headers: {
                'user-agent': 'test-agent',
              },
              socket: {
                remoteAddress: undefined,
              } as any,
            };

            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            // Should not throw
            expect(() => {
              requestLogger(req as Request, res, next);
            }).not.toThrow();

            // Should still log request start
            expect(req.logger!.info).toHaveBeenCalledWith(
              'Request started',
              expect.objectContaining({
                method,
                path,
              })
            );

            // Should still call next
            expect(next).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
