/**
 * Example usage of error logging with severity levels
 * Demonstrates Requirement 16.5: Log errors with appropriate severity levels
 */

import { logger } from "../config/logger";

/**
 * Example 1: Info level - Expected validation failures
 * Use for: Invalid user input, expected authentication failures
 */
export function exampleInfoLevel() {
  logger.info("Customer attempted login with invalid OTP", {
    phoneNumber: "+1234567890", // Will be masked automatically
    attemptNumber: 1,
  });
  // Output: [timestamp] INFO: Customer attempted login with invalid OTP {"phoneNumber":"******7890","attemptNumber":1}
}

/**
 * Example 2: Warn level - Recoverable issues
 * Use for: Rate limits, retry attempts, deprecated features
 */
export function exampleWarnLevel() {
  logger.warn("Rate limit approaching for IP address", {
    ipAddress: "192.168.1.1",
    requestCount: 45,
    limit: 50,
  });
  // Output: [timestamp] WARN: Rate limit approaching for IP address {"ipAddress":"192.168.1.1","requestCount":45,"limit":50}
}

/**
 * Example 3: Error level - Operational failures
 * Use for: SMS provider failures, API errors, unexpected exceptions
 */
export function exampleErrorLevel() {
  logger.error("SMS provider failed to send message", {
    provider: "sms.to",
    phoneNumber: "+1234567890", // Will be masked
    errorCode: "INSUFFICIENT_BALANCE",
  });
  // Output: [timestamp] ERROR: SMS provider failed to send message {"provider":"sms.to","phoneNumber":"******7890","errorCode":"INSUFFICIENT_BALANCE"}
}

/**
 * Example 4: Critical level - System failures
 * Use for: Database failures, Redis connection loss, security breaches
 */
export function exampleCriticalLevel() {
  logger.critical("Redis connection lost", {
    host: "localhost",
    port: 6379,
    retryAttempt: 3,
    impact: "OTP verification unavailable",
  });
  // Output: [timestamp] CRITICAL: Redis connection lost {"host":"localhost","port":6379,"retryAttempt":3,"impact":"OTP verification unavailable","severity":"critical"}
}

/**
 * Example 5: Automatic severity detection with Error objects
 * The logger will automatically detect severity based on error type
 */
export function exampleAutoSeverityDetection() {
  // Critical error - database connection
  const dbError = new Error("Database connection failed");
  logger.logError("Failed to save customer data", dbError);
  // Automatically logged as CRITICAL

  // Error - operational failure
  const apiError = new Error("Failed to fetch customer from Shopify");
  logger.logError("Shopify API request failed", apiError);
  // Automatically logged as ERROR

  // Warning - retry scenario
  const retryError = new Error("Retry attempt 2 of 3");
  logger.logError("SMS send retry", retryError);
  // Automatically logged as WARN
}

/**
 * Example 6: Explicit severity override
 * You can override automatic detection if needed
 */
export function exampleExplicitSeverity() {
  const error = new Error("Custom error");
  
  // Force critical severity
  logger.logError("Security breach detected", error, "critical");
  
  // Force info severity
  logger.logError("Expected validation failure", error, "info");
}

/**
 * Example 7: Context and metadata
 * Include relevant context for debugging
 */
export function exampleContextMetadata() {
  logger.error("Order webhook processing failed", {
    orderId: "12345",
    shop: "example.myshopify.com",
    customerEmail: "customer@example.com", // Will be masked
    errorType: "INVALID_PAYLOAD",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Example 8: Sensitive data masking
 * All sensitive data is automatically masked
 */
export function exampleSensitiveDataMasking() {
  logger.error("Authentication failed", {
    phoneNumber: "+1234567890", // Masked to ******7890
    email: "customer@example.com", // Masked to cu****@ex****.com
    password: "secret123", // Masked to ***REDACTED***
    apiKey: "sk_test_123456", // Masked to ***REDACTED***
    creditCard: "4111111111111111", // Masked to **** **** **** 1111
  });
}

/**
 * Example 9: Complete error handling flow
 * Demonstrates proper error handling with severity levels
 */
export async function exampleCompleteFlow() {
  try {
    // Simulate some operation
    throw new Error("Redis connection timeout");
  } catch (error) {
    if (error instanceof Error) {
      // Log with automatic severity detection
      logger.logError("Failed to verify OTP", error);
      
      // Also log context about the operation
      logger.error("OTP verification unavailable", {
        service: "OTPService",
        method: "verifyOTP",
        impact: "Customers cannot complete SMS authentication",
        action: "Falling back to email authentication",
      });
    }
  }
}

/**
 * Example 10: Different severity levels for different scenarios
 */
export function exampleScenarioBasedSeverity() {
  // Info: Expected user behavior
  logger.info("Customer requested new OTP code", {
    phoneNumber: "+1234567890",
    reason: "Previous code expired",
  });

  // Warn: Approaching limits
  logger.warn("Customer approaching failed login limit", {
    email: "customer@example.com",
    failedAttempts: 4,
    maxAttempts: 5,
  });

  // Error: Service degradation
  logger.error("Primary SMS provider unavailable", {
    provider: "sms.to",
    fallback: "twilio",
    status: "degraded",
  });

  // Critical: Complete service failure
  logger.critical("All SMS providers unavailable", {
    primaryProvider: "sms.to",
    secondaryProvider: "twilio",
    impact: "SMS authentication completely unavailable",
    action: "Manual intervention required",
  });
}

/**
 * Example 11: Logging in route handlers
 */
export async function exampleRouteHandler() {
  const requestId = crypto.randomUUID();

  try {
    // Info: Request received
    logger.info("SMS OTP request received", {
      requestId,
      endpoint: "/api/auth/sms/send",
    });

    // Simulate validation error
    const phoneNumber = "invalid";
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      // Info: Validation failure (expected)
      logger.info("Invalid phone number format", {
        requestId,
        phoneNumber,
      });
      return;
    }

    // Simulate rate limit
    const isRateLimited = true;
    if (isRateLimited) {
      // Warn: Rate limit hit
      logger.warn("Rate limit exceeded", {
        requestId,
        ipAddress: "192.168.1.1",
      });
      return;
    }

    // Simulate SMS provider error
    throw new Error("SMS provider connection timeout");

  } catch (error) {
    if (error instanceof Error) {
      // Error: Operational failure
      logger.logError("Failed to send SMS OTP", error);
      
      // Include request context
      logger.error("Request failed", {
        requestId,
        endpoint: "/api/auth/sms/send",
        errorType: error.name,
      });
    }
  }
}

/**
 * Example 12: Structured logging for analytics
 */
export function exampleStructuredLogging() {
  // Log authentication events with consistent structure
  logger.info("Authentication attempt", {
    eventType: "auth_attempt",
    method: "sms",
    shop: "example.myshopify.com",
    timestamp: Date.now(),
  });

  logger.info("Authentication success", {
    eventType: "auth_success",
    method: "sms",
    shop: "example.myshopify.com",
    customerId: "gid://shopify/Customer/123",
    timestamp: Date.now(),
  });

  logger.warn("Authentication failure", {
    eventType: "auth_failure",
    method: "sms",
    shop: "example.myshopify.com",
    reason: "invalid_otp",
    timestamp: Date.now(),
  });
}
