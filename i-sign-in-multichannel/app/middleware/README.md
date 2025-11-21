# Middleware Documentation

This directory contains middleware utilities for rate limiting, HMAC validation, and other security features.

## Rate Limiting

The `RateLimiter` class provides IP-based rate limiting using Redis.

### Usage Example

```typescript
import { RateLimiter, getClientIp, createRateLimitResponse } from '../middleware';
import { getRedis } from '../lib/redis.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  // Initialize rate limiter
  const redis = getRedis();
  const rateLimiter = new RateLimiter(redis, {
    windowMs: 60 * 1000,  // 1 minute window
    maxRequests: 10,       // 10 requests per minute
    keyPrefix: 'api:auth', // Redis key prefix
  });

  // Get client IP
  const clientIp = getClientIp(request);
  
  // Check rate limit
  const result = await rateLimiter.checkLimit(clientIp, 'login');
  
  if (!result.allowed) {
    return createRateLimitResponse(result);
  }

  // Process request...
};
```

### Configuration Options

- `windowMs`: Time window in milliseconds
- `maxRequests`: Maximum number of requests allowed in the window
- `keyPrefix`: Optional Redis key prefix (default: 'ratelimit')

## HMAC Validation

The HMAC validation middleware validates Shopify webhook signatures.

### Usage Example

```typescript
import { requireValidHmac } from '../middleware';

export const action = async ({ request }: ActionFunctionArgs) => {
  // Validate HMAC signature
  const hmacError = await requireValidHmac(
    request,
    process.env.SHOPIFY_API_SECRET!
  );
  
  if (hmacError) {
    return hmacError; // Returns 401 response
  }

  // Process webhook...
};
```

### Alternative Usage

```typescript
import { validateWebhookHmac, createInvalidHmacResponse } from '../middleware';

export const action = async ({ request }: ActionFunctionArgs) => {
  const validation = await validateWebhookHmac(
    request,
    process.env.SHOPIFY_API_SECRET!
  );
  
  if (!validation.valid) {
    return createInvalidHmacResponse(validation.error);
  }

  // Process webhook...
};
```

## Sensitive Data Masking

The logger automatically masks sensitive data in log output.

### Automatic Masking

The logger automatically masks:
- Phone numbers (shows last 4 digits)
- Email addresses (shows first 2 chars of local part and domain)
- Credit card numbers (shows last 4 digits)
- Fields containing: password, secret, token, key (completely redacted)

### Usage

```typescript
import { logger } from '../config/logger';

// Phone numbers are automatically masked
logger.info('User authenticated', {
  phone: '+1234567890',  // Logged as: ******7890
  email: 'user@example.com',  // Logged as: us****@ex****.com
});

// Sensitive fields are redacted
logger.info('API call', {
  apiKey: 'secret-key-123',  // Logged as: ***REDACTED***
  password: 'mypassword',     // Logged as: ***REDACTED***
});
```

## OTP Storage with Metadata

The `OTPService` now stores OTP codes with metadata including attempts and creation timestamp.

### Storage Format

```typescript
{
  code: "123456",
  attempts: 0,
  createdAt: 1234567890000
}
```

This metadata is automatically tracked and used for:
- Counting verification attempts
- Calculating OTP age
- Enhanced logging and debugging

## Security Best Practices

1. **Always use rate limiting** on authentication endpoints
2. **Validate HMAC signatures** on all webhook endpoints
3. **Never log sensitive data** without masking
4. **Use Redis for distributed rate limiting** across multiple servers
5. **Set appropriate TTLs** on Redis keys to prevent memory leaks
6. **Monitor rate limit violations** for potential attacks
7. **Use timing-safe comparisons** for HMAC validation (already implemented)
