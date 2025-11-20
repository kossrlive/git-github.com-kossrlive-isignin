import { NextFunction, Request, Response } from 'express';
import fc from 'fast-check';
import {
    AuthenticationError,
    ExternalServiceError,
    InternalError,
    RateLimitError,
    ValidationError,
} from '../../errors/index.js';
import { errorHandler } from '../errorHandler.js';

/**
 * Property-based tests for error handling
 * Requirements: 7.2, 7.3
 */

// Mock request object
const createMockRequest = (requestId: string = 'test-request-id'): Partial<Request> => ({
  requestId,
  method: 'POST',
  path: '/api/test',
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'test-agent',
  },
  socket: {
    remoteAddress: '127.0.0.1',
  } as any,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any,
});

// Mock response object
const createMockResponse = (): Partial<Response> => {
  const res: any = {
    statusCode: 200,
    headers: {},
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
  };
  return res;
};

describe('Error Handler Middleware - Property Tests', () => {
  /**
   * Feature: shopify-sms-auth, Property 18: Error message safety
   * Validates: Requirements 7.2
   * 
   * For any SMS sending error, the error message returned to the client should not contain
   * internal details like API keys or provider-specific errors
   */
  describe('Property 18: Error message safety', () => {
    it('should sanitize external service error messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 502, max: 503 }),
          (internalMessage, statusCode) => {
            // Create an external service error with internal details
            const error = new ExternalServiceError(
              `Internal error: API_KEY=secret123, Provider=sms.to failed: ${internalMessage}`,
              statusCode
            );

            const req = createMockRequest() as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            // Get the response that was sent
            const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
            const responseMessage = jsonCall.error.message;

            // Verify the message is sanitized (generic)
            expect(responseMessage).toBe(
              'An external service is temporarily unavailable. Please try again later.'
            );

            // Verify it doesn't contain the internal message
            expect(responseMessage).not.toContain(internalMessage);
            expect(responseMessage).not.toContain('API_KEY');
            expect(responseMessage).not.toContain('secret123');
            expect(responseMessage).not.toContain('sms.to');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not sanitize validation and authentication error messages', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('validation'),
            fc.constant('authentication')
          ),
          fc.string({ minLength: 10, maxLength: 50 }),
          (errorType, message) => {
            const error = errorType === 'validation'
              ? new ValidationError(message)
              : new AuthenticationError(message);

            const req = createMockRequest() as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            // Get the response that was sent
            const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
            const responseMessage = jsonCall.error.message;

            // Verify the original message is preserved
            expect(responseMessage).toBe(message);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 19: Validation error specificity
   * Validates: Requirements 7.3
   * 
   * For any validation error, the error response should specify which fields are invalid and why
   */
  describe('Property 19: Validation error specificity', () => {
    it('should include details for validation errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.record({
            field: fc.string({ minLength: 1, maxLength: 20 }),
            reason: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          (message, details) => {
            const error = new ValidationError(message, details);

            const req = createMockRequest() as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            // Get the response that was sent
            const jsonCall = (res.json as jest.Mock).mock.calls[0][0];

            // Verify status code is 400
            expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);

            // Verify error response structure
            expect(jsonCall.error).toBeDefined();
            expect(jsonCall.error.code).toBe('VALIDATION_ERROR');
            expect(jsonCall.error.message).toBe(message);
            expect(jsonCall.error.details).toEqual(details);
            expect(jsonCall.error.requestId).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include details for non-validation errors', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(new AuthenticationError('Auth failed')),
            fc.constant(new RateLimitError('Rate limit exceeded', 60)),
            fc.constant(new InternalError('Internal error')),
            fc.constant(new ExternalServiceError('Service unavailable', 502))
          ),
          (error) => {
            const req = createMockRequest() as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            // Get the response that was sent
            const jsonCall = (res.json as jest.Mock).mock.calls[0][0];

            // Verify details are not included
            expect(jsonCall.error.details).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Handler - Additional Properties', () => {
    it('should always include request ID in error response', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.oneof(
            fc.constant(new ValidationError('Validation failed')),
            fc.constant(new AuthenticationError('Auth failed')),
            fc.constant(new RateLimitError('Rate limit', 60)),
            fc.constant(new InternalError('Internal error')),
            fc.constant(new ExternalServiceError('Service error', 502))
          ),
          (requestId, error) => {
            const req = createMockRequest(requestId) as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
            expect(jsonCall.error.requestId).toBe(requestId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set correct status codes for different error types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({ error: fc.constant(new ValidationError('test')), expectedStatus: fc.constant(400) }),
            fc.record({ error: fc.constant(new AuthenticationError('test')), expectedStatus: fc.constant(401) }),
            fc.record({ error: fc.constant(new RateLimitError('test', 60)), expectedStatus: fc.constant(429) }),
            fc.record({ error: fc.constant(new InternalError('test')), expectedStatus: fc.constant(500) }),
            fc.record({ error: fc.constant(new ExternalServiceError('test', 502)), expectedStatus: fc.constant(502) }),
            fc.record({ error: fc.constant(new ExternalServiceError('test', 503)), expectedStatus: fc.constant(503) })
          ),
          ({ error, expectedStatus }) => {
            const req = createMockRequest() as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            expect((res.status as jest.Mock).mock.calls[0][0]).toBe(expectedStatus);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set Retry-After header for rate limit errors', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }),
          (retryAfter) => {
            const error = new RateLimitError('Rate limit exceeded', retryAfter);

            const req = createMockRequest() as Request;
            const res = createMockResponse() as Response;
            const next = jest.fn() as NextFunction;

            errorHandler(error, req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('Retry-After', retryAfter.toString());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
