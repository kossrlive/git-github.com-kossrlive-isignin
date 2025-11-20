import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import {
    AuthenticationError,
    ExternalServiceError,
    InternalError,
    RateLimitError,
    ValidationError,
} from '../errors/index.js';

/**
 * Global error handler middleware
 * Requirements: 7.1, 7.2, 7.4 - Catch all errors, log with request ID, return appropriate responses, send alerts
 */

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: object;
    requestId: string;
  };
}

/**
 * Sanitize error messages for external service errors
 * Prevents leaking internal details like API keys or provider-specific errors
 */
const sanitizeErrorMessage = (error: Error): string => {
  if (error instanceof ExternalServiceError) {
    // Generic message for external service errors
    return 'An external service is temporarily unavailable. Please try again later.';
  }
  return error.message;
};

/**
 * Determine if an error is critical and requires alerting
 */
const isCriticalError = (error: Error): boolean => {
  // Critical errors that should trigger alerts
  if (error instanceof InternalError) return true;
  if (error instanceof ExternalServiceError && error.statusCode >= 500) return true;
  
  // Database/Redis connection errors
  if (error.message.includes('Redis') || error.message.includes('connection')) return true;
  
  return false;
};

/**
 * Send alert for critical errors
 * In production, this would integrate with monitoring systems like Sentry, PagerDuty, etc.
 */
const sendAlert = (error: Error, req: Request): void => {
  logger.error('🚨 CRITICAL ERROR - Alert triggered', {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  
  // TODO: Integrate with monitoring service (Sentry, PagerDuty, etc.)
  // Example: Sentry.captureException(error);
};

/**
 * Global error handler middleware
 * Must be registered AFTER all routes
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Ensure we have a request ID
  const requestId = req.requestId || 'unknown';
  
  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let errorMessage = 'An unexpected error occurred';
  let errorDetails: object | undefined;

  // Handle known error types
  if (error instanceof ValidationError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    errorDetails = error.details;
    
    // Log validation errors at info level (not critical)
    req.logger?.info('Validation error', {
      error: error.message,
      details: error.details,
    });
  } else if (error instanceof AuthenticationError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    
    // Log authentication errors at warn level
    req.logger?.warn('Authentication error', {
      error: error.message,
    });
  } else if (error instanceof RateLimitError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    
    // Set Retry-After header
    res.setHeader('Retry-After', error.retryAfter.toString());
    
    // Log rate limit errors at warn level
    req.logger?.warn('Rate limit exceeded', {
      error: error.message,
      retryAfter: error.retryAfter,
    });
  } else if (error instanceof ExternalServiceError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = sanitizeErrorMessage(error);
    
    // Log external service errors with full details
    req.logger?.error('External service error', {
      error: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
    });
  } else if (error instanceof InternalError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    
    // Log internal errors with full details
    req.logger?.error('Internal error', {
      error: error.message,
      stack: error.stack,
    });
  } else {
    // Unknown error type - log with full details
    req.logger?.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
  }

  // Send alert for critical errors
  if (isCriticalError(error)) {
    sendAlert(error, req);
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: {
      code: errorCode,
      message: errorMessage,
      requestId,
    },
  };

  // Include details only for validation errors
  if (errorDetails) {
    errorResponse.error.details = errorDetails;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Should be registered after all routes but before error handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.requestId || 'unknown';
  
  req.logger?.warn('Route not found', {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      requestId,
    },
  });
};
