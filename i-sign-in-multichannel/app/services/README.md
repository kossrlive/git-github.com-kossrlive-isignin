# Services Usage Guide

This directory contains all backend services migrated from the original application structure.

## Quick Start

### Import Services

```typescript
import { getRedis } from '~/lib/redis.server';
import { getSMSQueue } from '~/lib/queue.server';
import { OTPService, SMSService, MultipassService, SettingsService } from '~/services';
import { prisma } from '~/db.server';
```

### Initialize Services

```typescript
// In a React Router loader or action
export async function loader({ request }: LoaderFunctionArgs) {
  const redis = getRedis();
  const queue = getSMSQueue();
  
  // Initialize services
  const otpService = new OTPService(redis);
  const settingsService = new SettingsService(prisma);
  const multipassService = new MultipassService(prisma);
  
  // Use services...
}
```

## Service Overview

### OTPService
Manages OTP generation, storage, and validation with rate limiting.

```typescript
const otpService = new OTPService(redis);

// Generate and store OTP
const otp = otpService.generateOTP();
await otpService.storeOTP(phoneNumber, otp);

// Verify OTP
const isValid = await otpService.verifyOTP(phoneNumber, otp);

// Check rate limits
const canResend = await otpService.canResendOTP(phoneNumber);
```

### SMSService
Manages SMS sending with automatic provider failover.

```typescript
const smsService = new SMSService(providers, redis);

// Send SMS
const result = await smsService.sendSMS({
  to: phoneNumber,
  message: 'Your code is: 123456',
  callbackUrl: 'https://yourapp.com/webhooks/sms-dlr'
});
```

### MultipassService
Generates Shopify Multipass tokens for seamless authentication.

**Important**: All methods now require `shopDomain` as the first parameter.

```typescript
const multipassService = new MultipassService(prisma);

// Generate Multipass URL
const multipassUrl = await multipassService.generateMultipassUrl(
  'myshop.myshopify.com',
  {
    email: 'customer@example.com',
    created_at: new Date().toISOString(),
    first_name: 'John',
    last_name: 'Doe'
  },
  '/products' // optional return URL
);
```

### SettingsService
Manages app configuration stored in Prisma database.

**Important**: All methods now require `shopDomain` as a parameter.

```typescript
const settingsService = new SettingsService(prisma);

// Get settings
const settings = await settingsService.getSettings('myshop.myshopify.com');

// Save settings
await settingsService.saveSettings('myshop.myshopify.com', {
  enabledMethods: { sms: true, email: true, google: false },
  smsProvider: { /* ... */ },
  oauthProviders: { /* ... */ },
  uiCustomization: { /* ... */ }
});

// Check if method is enabled
const isSMSEnabled = await settingsService.isMethodEnabled('myshop.myshopify.com', 'sms');
```

### AuthService
Orchestrates authentication flows across all methods.

```typescript
const authService = new AuthService(
  multipassService,
  customerService,
  otpService,
  smsService,
  oauthService,
  smsQueue
);

// Send OTP
await authService.sendOTP(phoneNumber);

// Authenticate with phone
const result = await authService.authenticateWithPhone(phoneNumber, otp);
if (result.success) {
  // Redirect to result.multipassUrl
}
```

### CustomerService
Interfaces with Shopify Admin API for customer management.

```typescript
const customerService = new CustomerService();

// Find customer
const customer = await customerService.findByEmail('customer@example.com');
const customer = await customerService.findByPhone('+1234567890');

// Create customer
const newCustomer = await customerService.create({
  email: 'customer@example.com',
  phone: '+1234567890',
  firstName: 'John',
  lastName: 'Doe'
});
```

### OrderService
Manages order OTP generation and verification.

```typescript
const orderService = new OrderService(redis, otpService, smsService);

// Generate order OTP
await orderService.generateOrderOTP(orderId, orderNumber, phoneNumber);

// Verify order OTP
const isValid = await orderService.verifyOrderOTP(orderId, otp);

// Confirm order
await orderService.confirmOrder(orderId);
```

### OAuthService
Manages OAuth providers and authentication flow.

```typescript
const oauthService = new OAuthService();

// Register provider
oauthService.registerProvider('google', new GoogleOAuthProvider(clientId, clientSecret));

// Initiate OAuth
const authUrl = await oauthService.initiateOAuth('google', redirectUri, state);

// Handle callback
const profile = await oauthService.handleCallback('google', code, redirectUri);
```

## SMS Queue Usage

### Queue SMS Job

```typescript
import { getSMSQueue } from '~/lib/queue.server';

const queue = getSMSQueue();

await queue.add({
  phone: '+1234567890',
  message: 'Your verification code is: 123456',
  callbackUrl: 'https://yourapp.com/webhooks/sms-dlr'
});
```

### Start SMS Worker

Add to your app initialization (e.g., `entry.server.tsx`):

```typescript
import { initializeSMSWorker } from '~/workers/sms.worker.server';

// Start worker on app initialization
initializeSMSWorker();
```

## Important Notes

1. **Shop Domain Parameter**: `MultipassService` and `SettingsService` now require `shopDomain` as a parameter for multi-shop support.

2. **Async Methods**: `MultipassService` methods are now async and must be awaited.

3. **Prisma Integration**: `SettingsService` uses Prisma instead of Redis for persistent storage.

4. **Redis Connection**: Always use `getRedis()` to get the singleton Redis instance.

5. **Queue Management**: Always use `getSMSQueue()` to get the singleton queue instance.

6. **Environment Variables**: Ensure all required environment variables are set (see MIGRATION_COMPLETE.md).

## Error Handling

All services throw errors that should be caught and handled appropriately:

```typescript
try {
  const result = await otpService.verifyOTP(phone, otp);
  if (!result) {
    // Invalid OTP
  }
} catch (error) {
  // Handle error (e.g., Redis connection failure)
  console.error('OTP verification failed:', error);
}
```

## Testing

When testing services, you can mock Redis and Prisma:

```typescript
import { Redis } from 'ioredis-mock';
import { PrismaClient } from '@prisma/client';

const mockRedis = new Redis();
const mockPrisma = new PrismaClient();

const otpService = new OTPService(mockRedis);
const settingsService = new SettingsService(mockPrisma);
```
