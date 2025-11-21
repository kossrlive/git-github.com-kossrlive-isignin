# Error Logging with Severity Levels Implementation

## Overview
This document describes the implementation of error logging with severity levels as specified in Requirement 16.5.

## Implementation Details

### Severity Levels
The logger now supports five severity levels:
- **debug**: Detailed debugging information
- **info**: Informational messages (expected behavior, validation failures)
- **warn**: Warning messages (rate limits, recoverable issues)
- **error**: Error messages (operational failures, service errors)
- **critical**: Critical errors (system failures, security breaches)

### Key Features

#### 1. Automatic Severity Detection
The logger can automatically detect the appropriate severity level based on error type:
```typescript
logger.logError("Failed to connect", error); // Auto-detects severity
```

Detection rules:
- **Critical**: Database/Redis connection failures, security issues, data corruption
- **Error**: Operational failures, API errors, exceptions
- **Warn**: Retry attempts, deprecated features
- **Info**: Validation errors, expected failures

#### 2. Context and Metadata
All log entries support rich context and metadata:
```typescript
logger.error("SMS failed", {
  provider: "sms.to",
  phoneNumber: "+1234567890",
  errorCode: "TIMEOUT",
  retryAttempt: 2
});
```

#### 3. Sensitive Data Masking
All sensitive data is automatically masked (Requirement 9.4):
- **Phone numbers**: Shows only last 4 digits (e.g., `******7890`)
- **Email addresses**: Partially masked (e.g., `cu****@ex****.com`)
- **Passwords/Secrets/Tokens**: Completely redacted (`***REDACTED***`)
- **Credit cards**: Shows only last 4 digits (e.g., `**** **** **** 1111`)

#### 4. Integration with Error Responses
The error response utility automatically determines severity based on error codes and HTTP status:
```typescript
createErrorResponse(ErrorCode.DATABASE_ERROR, "DB failed", 500);
// Automatically logged as CRITICAL
```

Severity mapping:
- **Critical**: 500+ errors, database/Redis errors
- **Error**: 400+ errors, external service failures
- **Warn**: Rate limits, account blocks
- **Info**: Validation errors, invalid credentials

## Usage Examples

### Basic Usage
```typescript
import { logger } from "../config/logger";

// Info level
logger.info("User logged in", { userId: "123" });

// Warn level
logger.warn("Rate limit approaching", { count: 45, limit: 50 });

// Error level
logger.error("API call failed", { endpoint: "/api/customers" });

// Critical level
logger.critical("Database connection lost", { host: "localhost" });
```

### With Error Objects
```typescript
try {
  // Some operation
} catch (error) {
  if (error instanceof Error) {
    // Automatic severity detection
    logger.logError("Operation failed", error);
    
    // Or explicit severity
    logger.logError("Critical failure", error, "critical");
  }
}
```

### In Route Handlers
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const requestId = crypto.randomUUID();
  
  try {
    logger.info("Request received", { requestId, endpoint: "/api/auth" });
    
    // Process request...
    
  } catch (error) {
    logger.logError("Request failed", error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Something went wrong",
      500,
      error,
      requestId
    );
  }
}
```

## Files Modified

### 1. `app/config/logger.ts`
- Added `critical` severity level
- Added `logError()` method with automatic severity detection
- Added `detectSeverity()` method for error type analysis
- Enhanced `LogContext` interface with severity metadata

### 2. `app/lib/errors.server.ts`
- Added `determineSeverity()` function for HTTP status/error code mapping
- Updated `createErrorResponse()` to use severity-aware logging
- Integrated with enhanced logger for proper severity levels

### 3. `app/lib/errors.severity.example.ts` (New)
- Comprehensive examples of all severity levels
- Demonstrates automatic severity detection
- Shows context and metadata usage
- Illustrates sensitive data masking

## Requirements Satisfied

✅ **Requirement 16.5**: Log errors with appropriate severity (info, warn, error, critical)
✅ **Requirement 16.5**: Include context and metadata
✅ **Requirement 9.4**: Mask sensitive data in logs

## Testing Recommendations

The implementation should be tested with:
1. Unit tests for severity detection logic
2. Unit tests for sensitive data masking
3. Integration tests for error response logging
4. Manual testing of log output format

## Future Enhancements

Potential improvements:
- Integration with external logging services (e.g., Sentry, LogRocket)
- Log aggregation and analysis
- Alerting for critical errors
- Performance metrics logging
- Structured logging for better parsing
