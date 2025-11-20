/**
 * Custom error classes for the application
 * Requirements: 7.1, 7.2, 7.3
 */

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'VALIDATION_ERROR';
  public readonly details?: object;

  constructor(message: string, details?: object) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends Error {
  public readonly statusCode = 401;
  public readonly code = 'AUTHENTICATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class RateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly code = 'RATE_LIMIT_ERROR';
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ExternalServiceError extends Error {
  public readonly statusCode: number;
  public readonly code = 'EXTERNAL_SERVICE_ERROR';

  constructor(message: string, statusCode: number = 502) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InternalError extends Error {
  public readonly statusCode = 500;
  public readonly code = 'INTERNAL_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'InternalError';
    Error.captureStackTrace(this, this.constructor);
  }
}
