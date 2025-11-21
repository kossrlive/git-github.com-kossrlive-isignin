/**
 * Example usage of error response utilities
 * This file demonstrates how to use the standardized error responses
 */

import {
    accountBlockedError,
    createErrorResponse,
    ErrorCode,
    expiredOTPError,
    internalError,
    invalidCredentialsError,
    invalidOTPError,
    invalidPhoneNumberError,
    missingFieldError,
    rateLimitError,
    smsProviderError,
    validationError,
} from "./errors.server";

// Example 1: Invalid OTP (Requirement 15.2)
// Usage: When a customer enters an incorrect OTP code
export function exampleInvalidOTP() {
  return invalidOTPError();
  // Returns: { success: false, error: { code: "INVALID_OTP", message: "Invalid code. Please try again." }, requestId: "..." }
}

// Example 2: Expired OTP (Requirement 15.3)
// Usage: When an OTP has expired (older than 5 minutes)
export function exampleExpiredOTP() {
  return expiredOTPError();
  // Returns: { success: false, error: { code: "EXPIRED_OTP", message: "Code expired. Request a new one." }, requestId: "..." }
}

// Example 3: Rate Limit (Requirement 15.4)
// Usage: When a customer has made too many requests
export function exampleRateLimit() {
  return rateLimitError(30); // 30 seconds cooldown
  // Returns: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many attempts. Please try again in 30 seconds." }, requestId: "..." }
}

// Example 4: SMS Provider Error (Requirement 15.5)
// Usage: When both SMS providers fail to send a message
export function exampleSMSProviderError() {
  return smsProviderError();
  // Returns: { success: false, error: { code: "SMS_PROVIDER_ERROR", message: "Unable to send SMS. Please try another method." }, requestId: "..." }
}

// Example 5: Invalid Phone Number
// Usage: When a phone number doesn't match E.164 format
export function exampleInvalidPhoneNumber() {
  return invalidPhoneNumberError();
  // Returns: { success: false, error: { code: "INVALID_PHONE_NUMBER", message: "Invalid phone number format. Please use E.164 format (e.g., +1234567890)." }, requestId: "..." }
}

// Example 6: Missing Required Field
// Usage: When a required field is not provided
export function exampleMissingField() {
  return missingFieldError("Phone number");
  // Returns: { success: false, error: { code: "MISSING_REQUIRED_FIELD", message: "Phone number is required" }, requestId: "..." }
}

// Example 7: Invalid Credentials
// Usage: When email/password authentication fails (ambiguous message)
export function exampleInvalidCredentials() {
  return invalidCredentialsError();
  // Returns: { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials. Please try again." }, requestId: "..." }
}

// Example 8: Account Blocked
// Usage: When an account is temporarily blocked due to too many failed attempts
export function exampleAccountBlocked() {
  return accountBlockedError();
  // Returns: { success: false, error: { code: "ACCOUNT_BLOCKED", message: "Account temporarily blocked due to too many failed attempts. Please try again later." }, requestId: "..." }
}

// Example 9: Internal Error
// Usage: When an unexpected error occurs
export function exampleInternalError() {
  const error = new Error("Database connection failed");
  return internalError(error);
  // Returns: { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }, requestId: "..." }
  // Note: Stack trace is logged but never exposed to users
}

// Example 10: Custom Validation Error
// Usage: When you need a custom validation error message
export function exampleCustomValidation() {
  return validationError("Order ID must be a positive integer");
  // Returns: { success: false, error: { code: "VALIDATION_ERROR", message: "Order ID must be a positive integer" }, requestId: "..." }
}

// Example 11: Custom Error with Details
// Usage: When you need complete control over the error response
export function exampleCustomError() {
  return createErrorResponse(
    ErrorCode.SHOPIFY_API_ERROR,
    "Failed to fetch customer data from Shopify",
    502,
    { shopifyErrorCode: "CUSTOMER_NOT_FOUND" }
  );
  // Returns: { success: false, error: { code: "SHOPIFY_API_ERROR", message: "Failed to fetch customer data from Shopify" }, requestId: "..." }
  // Note: Details are only included in development mode
}

/**
 * Complete example in a route handler
 */
export async function exampleRouteHandler() {
  try {
    const phoneNumber = "+1234567890";
    const code = "123456";

    // Validate phone number
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      return invalidPhoneNumberError();
    }

    // Validate OTP format
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(code)) {
      return validationError("Invalid verification code format");
    }

    // Check rate limits
    const isRateLimited = false; // Your rate limit check here
    if (isRateLimited) {
      return rateLimitError(60);
    }

    // Verify OTP
    const isValid = false; // Your OTP verification here
    const otpExpired = true; // Check if OTP exists

    if (!isValid) {
      if (otpExpired) {
        return expiredOTPError();
      } else {
        return invalidOTPError();
      }
    }

    // Success case
    return { success: true, data: { /* ... */ } };

  } catch (error) {
    return internalError(error instanceof Error ? error : undefined);
  }
}
