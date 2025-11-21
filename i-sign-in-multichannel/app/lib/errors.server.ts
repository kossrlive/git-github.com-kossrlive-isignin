/**
 * Error Response Utility
 * Provides consistent error response formatting across the application
 * Requirements: 15.1
 */

import { json } from "@remix-run/node";
import { logger } from "../config/logger";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
}

/**
 * Error codes for different error scenarios
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_PHONE_NUMBER = "INVALID_PHONE_NUMBER",
  INVALID_OTP_FORMAT = "INVALID_OTP_FORMAT",
  INVALID_EMAIL = "INVALID_EMAIL",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  
  // Authentication errors (401)
  INVALID_OTP = "INVALID_OTP",
  EXPIRED_OTP = "EXPIRED_OTP",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  EXPIRED_SESSION = "EXPIRED_SESSION",
  
  // Rate limiting errors (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TOO_MANY_OTP_REQUESTS = "TOO_MANY_OTP_REQUESTS",
  TOO_MANY_AUTH_ATTEMPTS = "TOO_MANY_AUTH_ATTEMPTS",
  ACCOUNT_BLOCKED = "ACCOUNT_BLOCKED",
  
  // External service errors (502)
  SMS_PROVIDER_ERROR = "SMS_PROVIDER_ERROR",
  SHOPIFY_API_ERROR = "SHOPIFY_API_ERROR",
  OAUTH_PROVIDER_ERROR = "OAUTH_PROVIDER_ERROR",
  
  // Internal errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  REDIS_ERROR = "REDIS_ERROR",
}

/**
 * User-friendly error messages for common scenarios
 * Requirements: 15.2, 15.3, 15.4, 15.5
 */
export const ErrorMessages = {
  // OTP errors
  INVALID_OTP: "Invalid code. Please try again.",
  EXPIRED_OTP: "Code expired. Request a new one.",
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please try again later.",
  TOO_MANY_OTP_REQUESTS: "Too many code requests. Please try again later.",
  
  // SMS errors
  SMS_PROVIDER_ERROR: "Unable to send SMS. Please try another method.",
  
  // Generic errors
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  INVALID_CREDENTIALS: "Invalid credentials. Please try again.",
  
  // Validation errors
  INVALID_PHONE_NUMBER: "Invalid phone number format. Please use E.164 format (e.g., +1234567890).",
  INVALID_EMAIL: "Invalid email address.",
  MISSING_REQUIRED_FIELD: "Required field is missing.",
} as const;

/**
 * Determine severity level based on HTTP status code and error code
 * Requirement 16.5: Log errors with appropriate severity levels
 */
function determineSeverity(status: number, code: ErrorCode): 'info' | 'warn' | 'error' | 'critical' {
  // Critical errors - system failures, security issues
  if (
    code === ErrorCode.DATABASE_ERROR ||
    code === ErrorCode.REDIS_ERROR ||
    status >= 500
  ) {
    return 'critical';
  }

  // Errors - operational failures
  if (
    code === ErrorCode.SMS_PROVIDER_ERROR ||
    code === ErrorCode.SHOPIFY_API_ERROR ||
    code === ErrorCode.OAUTH_PROVIDER_ERROR ||
    status >= 400
  ) {
    return 'error';
  }

  // Warnings - rate limits, validation issues
  if (
    code === ErrorCode.RATE_LIMIT_EXCEEDED ||
    code === ErrorCode.TOO_MANY_OTP_REQUESTS ||
    code === ErrorCode.TOO_MANY_AUTH_ATTEMPTS ||
    code === ErrorCode.ACCOUNT_BLOCKED
  ) {
    return 'warn';
  }

  // Info - validation errors, expected failures
  if (
    code === ErrorCode.VALIDATION_ERROR ||
    code === ErrorCode.INVALID_OTP ||
    code === ErrorCode.EXPIRED_OTP ||
    code === ErrorCode.INVALID_CREDENTIALS
  ) {
    return 'info';
  }

  return 'error';
}

/**
 * Create a standardized error response
 * 
 * @param code - Error code from ErrorCode enum
 * @param message - User-friendly error message
 * @param status - HTTP status code
 * @param details - Optional additional error details (never exposed to users)
 * @param requestId - Optional request ID for tracing (auto-generated if not provided)
 * @returns JSON response with error details
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: any,
  requestId?: string
) {
  const id = requestId || crypto.randomUUID();
  
  // Determine appropriate severity level
  // Requirement 16.5: Log errors with appropriate severity levels
  const severity = determineSeverity(status, code);
  
  // Prepare context with metadata
  const context = {
    requestId: id,
    code,
    message,
    status,
    // Only log details internally, never send to client
    details: details instanceof Error ? {
      name: details.name,
      message: details.message,
      // Stack trace only in logs, never in response
      stack: details.stack,
    } : details,
  };

  // Log error with appropriate severity
  // Requirement 16.5: Include context and metadata
  logger.logError("Error response created", context, severity);

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      // Never include details in production to avoid exposing sensitive info
      ...(process.env.NODE_ENV === "development" && details ? { details } : {}),
    },
    requestId: id,
  };

  return json(errorResponse, { status });
}

/**
 * Create a validation error response (400)
 */
export function validationError(
  message: string,
  details?: any,
  requestId?: string
) {
  return createErrorResponse(
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    details,
    requestId
  );
}

/**
 * Create an invalid phone number error response (400)
 */
export function invalidPhoneNumberError(requestId?: string) {
  return createErrorResponse(
    ErrorCode.INVALID_PHONE_NUMBER,
    ErrorMessages.INVALID_PHONE_NUMBER,
    400,
    undefined,
    requestId
  );
}

/**
 * Create an invalid OTP error response (401)
 * Requirements: 15.2
 */
export function invalidOTPError(requestId?: string) {
  return createErrorResponse(
    ErrorCode.INVALID_OTP,
    ErrorMessages.INVALID_OTP,
    401,
    undefined,
    requestId
  );
}

/**
 * Create an expired OTP error response (401)
 * Requirements: 15.3
 */
export function expiredOTPError(requestId?: string) {
  return createErrorResponse(
    ErrorCode.EXPIRED_OTP,
    ErrorMessages.EXPIRED_OTP,
    401,
    undefined,
    requestId
  );
}

/**
 * Create a rate limit error response (429)
 * Requirements: 15.4
 */
export function rateLimitError(cooldownSeconds?: number, requestId?: string) {
  const message = cooldownSeconds
    ? `Too many attempts. Please try again in ${cooldownSeconds} seconds.`
    : ErrorMessages.RATE_LIMIT_EXCEEDED;
    
  return createErrorResponse(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    message,
    429,
    { cooldownSeconds },
    requestId
  );
}

/**
 * Create an SMS provider error response (502)
 * Requirements: 15.5
 */
export function smsProviderError(requestId?: string) {
  return createErrorResponse(
    ErrorCode.SMS_PROVIDER_ERROR,
    ErrorMessages.SMS_PROVIDER_ERROR,
    502,
    undefined,
    requestId
  );
}

/**
 * Create an internal error response (500)
 */
export function internalError(error?: Error, requestId?: string) {
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    ErrorMessages.INTERNAL_ERROR,
    500,
    error,
    requestId
  );
}

/**
 * Create an invalid credentials error response (401)
 * Note: Message is intentionally ambiguous to not reveal which field was incorrect
 */
export function invalidCredentialsError(requestId?: string) {
  return createErrorResponse(
    ErrorCode.INVALID_CREDENTIALS,
    ErrorMessages.INVALID_CREDENTIALS,
    401,
    undefined,
    requestId
  );
}

/**
 * Create an account blocked error response (429)
 */
export function accountBlockedError(requestId?: string) {
  return createErrorResponse(
    ErrorCode.ACCOUNT_BLOCKED,
    "Account temporarily blocked due to too many failed attempts. Please try again later.",
    429,
    undefined,
    requestId
  );
}

/**
 * Create a missing required field error response (400)
 */
export function missingFieldError(fieldName: string, requestId?: string) {
  return createErrorResponse(
    ErrorCode.MISSING_REQUIRED_FIELD,
    `${fieldName} is required`,
    400,
    { field: fieldName },
    requestId
  );
}
