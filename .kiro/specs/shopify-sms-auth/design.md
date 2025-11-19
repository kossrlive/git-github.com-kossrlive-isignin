# Design Document: Shopify SMS Authentication App

## Overview

Shopify App для многоканальной аутентификации клиентов с поддержкой SMS (через sms.to), email/пароль, и OAuth (Google, с возможностью расширения для Apple и Facebook). Приложение построено на современном стеке Shopify CLI с использованием Node.js/TypeScript backend, React frontend для admin панели, и Liquid/JavaScript для storefront extensions.

### Key Design Decisions

1. **Shopify App Architecture**: Используем официальный Shopify CLI (@shopify/app) для создания приложения с полной интеграцией в экосистему Shopify
2. **Multipass для сессий**: Используем Shopify Plus Multipass для безопасного создания customer сессий без хранения паролей в нашей системе
3. **Provider Pattern**: Единые интерфейсы для SMS и OAuth провайдеров обеспечивают расширяемость
4. **Queue-based SMS**: Bull + Redis для надежной асинхронной отправки SMS с retry механизмом
5. **Stateless Authentication**: JWT токены для внутренней аутентификации между компонентами
6. **Extension-based UI**: App Extensions для интеграции UI в storefront без модификации темы

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Shopify Storefront                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  App Extension (Checkout UI / Account Login)               │ │
│  │  - Login Form (SMS/Email/OAuth)                            │ │
│  │  - Checkout Interceptor                                    │ │
│  │  - Session Persistence (localStorage/cookies)              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shopify App Backend (Node.js)                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Routes                                                 │ │
│  │  - POST /api/auth/send-otp                                 │ │
│  │  - POST /api/auth/verify-otp                               │ │
│  │  - POST /api/auth/email-login                              │ │
│  │  - GET  /api/auth/oauth/:provider                          │ │
│  │  - POST /api/auth/oauth/:provider/callback                 │ │
│  │  - POST /api/webhooks/sms-dlr                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Core Services                                              │ │
│  │  - AuthService (orchestration)                             │ │
│  │  - MultipassService (session creation)                     │ │
│  │  - CustomerService (Shopify Admin API)                     │ │
│  │  - OTPService (generation & validation)                    │ │
│  │  - SMSService (provider management)                        │ │
│  │  - OAuthService (provider management)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Provider Implementations                                   │ │
│  │  - SmsToProvider (implements ISMSProvider)                 │ │
│  │  - GoogleOAuthProvider (implements IOAuthProvider)         │ │
│  │  - [Future: TwilioProvider, AppleOAuthProvider, etc.]     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Redis           │  │  Bull Queue      │
        │  - OTP storage   │  │  - SMS jobs      │
        │  - Rate limiting │  │  - Retry logic   │
        │  - Session cache │  │  - DLR tracking  │
        └──────────────────┘  └──────────────────┘
                    │
                    ▼
        ┌──────────────────────────┐
        │  External Services       │
        │  - sms.to API            │
        │  - Google OAuth API      │
        │  - Shopify Admin API     │
        │  - Shopify Multipass     │
        └──────────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js 18+ with TypeScript
- Express.js for API routes
- @shopify/shopify-api for Shopify integration
- Bull for job queue
- ioredis for Redis client
- bcrypt for password hashing
- jsonwebtoken for JWT tokens
- axios for HTTP requests

**Frontend (Admin Panel):**
- React 18+
- @shopify/polaris for UI components
- @shopify/app-bridge-react for Shopify integration

**Storefront Extension:**
- Liquid templates
- Vanilla JavaScript (ES6+)
- Web Components for encapsulation

**Infrastructure:**
- Redis 7+ for caching and queue
- PostgreSQL (optional) for persistent data
- Docker for containerization

## Components and Interfaces

### 1. Provider Interfaces

#### ISMSProvider Interface

```typescript
interface ISMSProvider {
  readonly name: string;
  readonly priority: number;
  
  sendSMS(params: SendSMSParams): Promise<SendSMSResult>;
  checkDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
  handleWebhook(payload: any): DeliveryReceipt;
}

interface SendSMSParams {
  to: string;           // E.164 format phone number
  message: string;
  from?: string;        // Sender ID
  callbackUrl?: string; // DLR webhook URL
}

interface SendSMSResult {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
}

interface DeliveryStatus {
  messageId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  timestamp: Date;
  error?: string;
}

interface DeliveryReceipt {
  messageId: string;
  status: DeliveryStatus['status'];
  deliveredAt?: Date;
  failureReason?: string;
}
```

#### IOAuthProvider Interface

```typescript
interface IOAuthProvider {
  readonly name: string;
  readonly scopes: string[];
  
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokens>;
  getUserProfile(accessToken: string): Promise<UserProfile>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
}
```

### 2. Core Services

#### AuthService

Orchestrates authentication flow across all methods.

```typescript
class AuthService {
  constructor(
    private multipassService: MultipassService,
    private customerService: CustomerService,
    private otpService: OTPService,
    private smsService: SMSService,
    private oauthService: OAuthService
  ) {}
  
  async authenticateWithPhone(phone: string, otp: string): Promise<AuthResult>
  async authenticateWithEmail(email: string, password: string): Promise<AuthResult>
  async authenticateWithOAuth(provider: string, code: string): Promise<AuthResult>
  async sendOTP(phone: string, resend: boolean): Promise<void>
  async verifyOTP(phone: string, otp: string): Promise<boolean>
}

interface AuthResult {
  success: boolean;
  multipassUrl?: string;
  customer?: ShopifyCustomer;
  error?: string;
}
```

#### MultipassService

Handles Multipass token generation for Shopify Plus.

```typescript
class MultipassService {
  constructor(private multipassSecret: string) {}
  
  generateToken(customer: CustomerData, returnTo?: string): string
  encryptAndSign(data: object): string
}

interface CustomerData {
  email: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  tag_string?: string;
  identifier?: string;
  remote_ip?: string;
  return_to?: string;
}
```

#### OTPService

Manages OTP generation, storage, and validation.

```typescript
class OTPService {
  constructor(private redis: Redis) {}
  
  generateOTP(length: number = 6): string
  async storeOTP(phone: string, otp: string, ttl: number): Promise<void>
  async verifyOTP(phone: string, otp: string): Promise<boolean>
  async incrementFailedAttempts(phone: string): Promise<number>
  async isBlocked(phone: string): Promise<boolean>
  async blockPhone(phone: string, duration: number): Promise<void>
}
```

#### SMSService

Manages SMS providers with fallback logic.

```typescript
class SMSService {
  private providers: ISMSProvider[];
  
  constructor(providers: ISMSProvider[]) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
  }
  
  async sendSMS(params: SendSMSParams, attemptNumber: number = 0): Promise<SendSMSResult>
  async sendWithFallback(params: SendSMSParams): Promise<SendSMSResult>
  getNextProvider(currentProvider?: string): ISMSProvider | null
  async trackDelivery(messageId: string, provider: string): Promise<void>
}
```

#### OAuthService

Manages OAuth providers.

```typescript
class OAuthService {
  private providers: Map<string, IOAuthProvider>;
  
  constructor() {
    this.providers = new Map();
  }
  
  registerProvider(name: string, provider: IOAuthProvider): void
  getProvider(name: string): IOAuthProvider | undefined
  async initiateOAuth(providerName: string, redirectUri: string): Promise<string>
  async handleCallback(providerName: string, code: string): Promise<UserProfile>
}
```

#### CustomerService

Interfaces with Shopify Admin API for customer management.

```typescript
class CustomerService {
  constructor(private shopifyClient: Shopify) {}
  
  async findByEmail(email: string): Promise<ShopifyCustomer | null>
  async findByPhone(phone: string): Promise<ShopifyCustomer | null>
  async create(data: CreateCustomerData): Promise<ShopifyCustomer>
  async update(id: string, data: UpdateCustomerData): Promise<ShopifyCustomer>
  async addTag(id: string, tag: string): Promise<void>
}

interface CreateCustomerData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  acceptsMarketing?: boolean;
}
```

### 3. Provider Implementations

#### SmsToProvider

```typescript
class SmsToProvider implements ISMSProvider {
  readonly name = 'sms.to';
  readonly priority = 1;
  
  constructor(
    private apiKey: string,
    private senderId: string
  ) {}
  
  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    // Implementation using sms.to API
    // POST https://api.sms.to/sms/send
  }
  
  async checkDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    // GET https://api.sms.to/sms/status/{messageId}
  }
  
  handleWebhook(payload: any): DeliveryReceipt {
    // Parse sms.to DLR webhook payload
  }
}
```

#### GoogleOAuthProvider

```typescript
class GoogleOAuthProvider implements IOAuthProvider {
  readonly name = 'google';
  readonly scopes = ['openid', 'email', 'profile'];
  
  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}
  
  getAuthorizationUrl(state: string, redirectUri: string): string {
    // Generate Google OAuth URL
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokens> {
    // Exchange authorization code for tokens
  }
  
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    // Fetch user info from Google
  }
  
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // Refresh access token
  }
}
```

## Data Models

### Redis Data Structures

#### OTP Storage
```
Key: otp:{phone}
Value: {otp_code}
TTL: 300 seconds (5 minutes)
```

#### Failed Attempts Counter
```
Key: otp:attempts:{phone}
Value: {count}
TTL: 900 seconds (15 minutes)
```

#### Phone Block List
```
Key: otp:blocked:{phone}
Value: 1
TTL: 900 seconds (15 minutes)
```

#### Rate Limiting
```
Key: ratelimit:{ip}:{endpoint}
Value: {request_count}
TTL: 60 seconds
```

#### SMS Delivery Tracking
```
Key: sms:delivery:{messageId}
Value: JSON {
  phone: string,
  provider: string,
  status: string,
  sentAt: timestamp,
  deliveredAt?: timestamp
}
TTL: 86400 seconds (24 hours)
```

### Bull Queue Jobs

#### SMS Job
```typescript
interface SMSJob {
  phone: string;
  message: string;
  attemptNumber: number;
  preferredProvider?: string;
  callbackUrl: string;
}
```

### Shopify Customer Metafields

```typescript
// Store auth method used
{
  namespace: 'auth_app',
  key: 'auth_method',
  value: 'sms' | 'email' | 'google' | 'apple' | 'facebook',
  type: 'single_line_text_field'
}

// Store phone verification status
{
  namespace: 'auth_app',
  key: 'phone_verified',
  value: 'true' | 'false',
  type: 'boolean'
}

// Store last login timestamp
{
  namespace: 'auth_app',
  key: 'last_login',
  value: ISO8601 timestamp,
  type: 'date_time'
}
```

### App Configuration (Shopify Metafields)

```typescript
// Store in shop metafields
{
  namespace: 'auth_app_config',
  key: 'enabled_methods',
  value: JSON.stringify(['sms', 'email', 'google']),
  type: 'json'
}

{
  namespace: 'auth_app_config',
  key: 'ui_customization',
  value: JSON.stringify({
    primaryColor: '#000000',
    buttonStyle: 'rounded',
    logoUrl: 'https://...'
  }),
  type: 'json'
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Phone number validation consistency
*For any* string input, the phone validator should consistently classify it as valid or invalid based on E.164 format rules
**Validates: Requirements 1.1**

### Property 2: OTP generation format
*For any* valid phone number, the generated OTP code should always be exactly 6 digits and stored in Redis with TTL of 300 seconds
**Validates: Requirements 1.2**

### Property 3: OTP verification correctness
*For any* stored OTP in Redis, verifying with the correct code should return success, and verifying with any incorrect code should return failure
**Validates: Requirements 1.4**

### Property 4: Customer creation or retrieval
*For any* successfully verified OTP, the system should either find an existing customer or create a new one in Shopify
**Validates: Requirements 1.5**

### Property 5: Email validation consistency
*For any* string input, the email validator should consistently classify it as valid or invalid based on RFC 5322 format rules
**Validates: Requirements 2.1**

### Property 6: Password hashing security
*For any* password being stored, it should be hashed using bcrypt with a cost factor of at least 12
**Validates: Requirements 2.3, 9.3**

### Property 7: Multipass token generation
*For any* successfully authenticated user (via SMS, email, or OAuth), a valid Multipass token should be generated
**Validates: Requirements 2.5, 4.1**

### Property 8: Multipass token contents
*For any* generated Multipass token, when decoded it should contain customer email, created_at timestamp, and return_to URL
**Validates: Requirements 4.2**

### Property 9: OAuth authorization URL format
*For any* OAuth provider and state parameter, the generated authorization URL should contain all required parameters (client_id, redirect_uri, scope, state)
**Validates: Requirements 3.1**

### Property 10: OAuth user profile normalization
*For any* OAuth provider returning a user profile, the data should be normalized into a consistent format with email, firstName, lastName fields
**Validates: Requirements 14.4**

### Property 11: SMS delivery tracking
*For any* SMS sent through any provider, a delivery tracking record should be created with message ID and initial status
**Validates: Requirements 5.1**

### Property 12: Rate limiting for resend
*For any* phone number, if an OTP was sent less than 30 seconds ago, a resend request should be rejected
**Validates: Requirements 5.4**

### Property 13: Send attempt blocking
*For any* phone number, after 3 send attempts within 10 minutes, further requests should be blocked for 10 minutes
**Validates: Requirements 5.5**

### Property 14: Failed attempt counter
*For any* incorrect OTP verification, the failed attempts counter for that phone number should increment
**Validates: Requirements 6.1**

### Property 15: Phone blocking after failures
*For any* phone number, after 5 failed OTP verification attempts, the phone should be blocked for 15 minutes
**Validates: Requirements 6.2**

### Property 16: IP rate limiting
*For any* IP address, after 10 requests to any endpoint within 1 minute, further requests should be rate limited
**Validates: Requirements 6.3**

### Property 17: OTP deletion after use
*For any* successfully used OTP code, it should be immediately deleted from Redis and not be usable again
**Validates: Requirements 6.4**

### Property 18: Error message safety
*For any* SMS sending error, the error message returned to the client should not contain internal details like API keys or provider-specific errors
**Validates: Requirements 7.2**

### Property 19: Validation error specificity
*For any* validation error, the error response should specify which fields are invalid and why
**Validates: Requirements 7.3**

### Property 20: Request logging completeness
*For any* authentication request, the logs should contain request ID, authentication method, and processing time
**Validates: Requirements 7.5**

### Property 21: Order OTP uniqueness
*For any* order requiring confirmation, a unique OTP code should be generated that is different from login OTPs
**Validates: Requirements 8.1**

### Property 22: Order OTP verification
*For any* order OTP verification attempt, the code should match both the OTP value and the specific order ID
**Validates: Requirements 8.3**

### Property 23: Queue job creation
*For any* SMS send request, a job should be added to the Bull queue and a response should be returned immediately without waiting for SMS delivery
**Validates: Requirements 10.1, 10.2**

### Property 24: SMS retry with exponential backoff
*For any* failed SMS send attempt, the system should retry up to 3 times with exponentially increasing delays
**Validates: Requirements 10.4**

### Property 25: Failed job handling
*For any* SMS job that fails after all retry attempts, it should be moved to the failed queue
**Validates: Requirements 10.5**

### Property 26: HMAC validation
*For any* request claiming to be from Shopify, the HMAC signature should be validated before processing
**Validates: Requirements 11.5**

### Property 27: Settings persistence
*For any* admin UI setting change (colors, enabled methods), the new values should be saved to shop metafields
**Validates: Requirements 12.2**

### Property 28: Dynamic auth method availability
*For any* authentication form render, only the methods enabled in settings should be displayed
**Validates: Requirements 12.4**

### Property 29: SMS provider fallback
*For any* SMS send failure with the primary provider, the system should automatically attempt sending with the next provider in priority order
**Validates: Requirements 13.2**

### Property 30: Provider rotation on resend
*For any* OTP resend request, the system should use a different provider than the previous attempt
**Validates: Requirements 13.3**

### Property 31: Provider error logging
*For any* SMS provider error, the log entry should include the provider name and error details
**Validates: Requirements 13.5**

### Property 32: OAuth provider interface compliance
*For any* OAuth provider implementation, it should implement all methods of the IOAuthProvider interface
**Validates: Requirements 14.1**

### Property 33: Session restoration from storage
*For any* valid session data in localStorage or cookies, the system should automatically restore the session via Multipass
**Validates: Requirements 15.3**

### Property 34: Post-auth checkout redirect
*For any* successful authentication initiated from checkout, the user should be redirected back to checkout with cart preserved
**Validates: Requirements 15.5**

## Error Handling

### Error Categories

1. **Validation Errors (400)**
   - Invalid phone number format
   - Invalid email format
   - Missing required fields
   - Invalid OTP format

2. **Authentication Errors (401)**
   - Invalid OTP code
   - Expired OTP
   - Invalid credentials
   - Invalid OAuth token

3. **Rate Limiting Errors (429)**
   - Too many OTP requests
   - Too many failed attempts
   - IP rate limit exceeded

4. **External Service Errors (502/503)**
   - Shopify API errors
   - SMS provider errors
   - OAuth provider errors
   - Redis connection errors

5. **Internal Errors (500)**
   - Unexpected exceptions
   - Database errors
   - Queue errors

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: object;       // Additional context (only for validation errors)
    requestId: string;      // For tracking
  }
}
```

### Error Handling Strategy

1. **Graceful Degradation**: If primary SMS provider fails, automatically fallback to secondary
2. **Retry Logic**: Automatic retry for transient errors (network issues, timeouts)
3. **Circuit Breaker**: Temporarily disable failing providers after consecutive failures
4. **Logging**: All errors logged with context (request ID, user identifier, stack trace)
5. **Monitoring**: Critical errors trigger alerts to monitoring system
6. **User-Friendly Messages**: Never expose internal details to end users

### Specific Error Scenarios

#### SMS Provider Failure
```typescript
try {
  await primaryProvider.sendSMS(params);
} catch (error) {
  logger.error('Primary SMS provider failed', { provider: 'sms.to', error });
  try {
    await secondaryProvider.sendSMS(params);
  } catch (fallbackError) {
    logger.error('All SMS providers failed', { error: fallbackError });
    throw new ServiceUnavailableError('Unable to send SMS at this time');
  }
}
```

#### Shopify API Failure
```typescript
try {
  const customer = await shopify.customer.create(data);
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    // Wait and retry
    await delay(error.retryAfter * 1000);
    return await shopify.customer.create(data);
  }
  logger.error('Shopify API error', { error, data });
  throw new ExternalServiceError('Unable to create customer account');
}
```

#### Redis Connection Failure
```typescript
try {
  await redis.set(key, value, 'EX', ttl);
} catch (error) {
  logger.error('Redis connection failed', { error });
  // Fallback to in-memory cache for OTP (less secure but maintains functionality)
  inMemoryCache.set(key, value, ttl);
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples, edge cases, and error conditions for individual components:

**Core Services:**
- AuthService: Test each authentication method independently
- OTPService: Test OTP generation, validation, expiration
- MultipassService: Test token generation and encryption
- SMSService: Test provider selection and fallback logic
- CustomerService: Test Shopify API interactions (mocked)

**Provider Implementations:**
- SmsToProvider: Test API request formatting and response parsing
- GoogleOAuthProvider: Test OAuth flow steps

**Edge Cases:**
- Empty or whitespace inputs
- Malformed phone numbers and emails
- Expired OTPs
- Blocked phone numbers
- Rate limit boundaries

**Error Conditions:**
- External API failures
- Network timeouts
- Invalid credentials
- Redis connection failures

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** library for TypeScript/JavaScript.

**Configuration:**
- Minimum 100 iterations per property test
- Each property test tagged with format: `**Feature: shopify-sms-auth, Property {number}: {property_text}**`
- Each property test references the design document property it implements

**Key Properties to Test:**

1. **Validation Properties**: Phone and email validators should consistently classify inputs
2. **Cryptographic Properties**: Password hashing should always use bcrypt with cost ≥ 12
3. **State Management Properties**: OTP lifecycle (create → verify → delete) should maintain consistency
4. **Fallback Properties**: SMS provider fallback should try all providers in priority order
5. **Rate Limiting Properties**: Rate limits should block requests after threshold regardless of timing variations
6. **Normalization Properties**: OAuth profiles should normalize to consistent format regardless of provider
7. **Token Properties**: Multipass tokens should always contain required fields when decoded

**Example Property Test Structure:**

```typescript
import fc from 'fast-check';

describe('Property 1: Phone number validation consistency', () => {
  /**
   * Feature: shopify-sms-auth, Property 1: Phone number validation consistency
   * Validates: Requirements 1.1
   */
  it('should consistently validate phone numbers', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result1 = validatePhone(input);
        const result2 = validatePhone(input);
        // Same input should always produce same result
        expect(result1).toBe(result2);
      }),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests will verify interactions between components:

- Full authentication flows (SMS, email, OAuth)
- Queue processing with Redis
- Shopify API integration (using test store)
- Multi-provider SMS fallback
- Session persistence and restoration

### End-to-End Testing

E2E tests will verify complete user journeys:

- User logs in with SMS → receives OTP → enters code → redirected to account
- User clicks checkout → prompted to login → completes auth → proceeds to checkout
- Admin configures app settings → changes reflected on storefront

### Testing Tools

- **Jest**: Test runner and assertion library
- **fast-check**: Property-based testing library
- **Supertest**: HTTP API testing
- **nock**: HTTP mocking for external APIs
- **ioredis-mock**: Redis mocking
- **@shopify/shopify-api-test-helpers**: Shopify API mocking

## Security Considerations

### Authentication Security

1. **OTP Security**
   - 6-digit codes provide 1,000,000 combinations
   - 5-minute expiration limits brute-force window
   - Rate limiting (5 attempts) makes brute-force impractical
   - Codes deleted after successful use (no replay attacks)

2. **Password Security**
   - bcrypt with cost factor 12 (industry standard)
   - Passwords never logged or exposed in errors
   - No password reset via SMS (use Shopify's built-in flow)

3. **Session Security**
   - Multipass tokens are encrypted and signed
   - Tokens include timestamp to prevent replay
   - HTTPS required for all communications
   - Session data in localStorage has expiration

### API Security

1. **HMAC Validation**
   - All Shopify webhooks validated with HMAC
   - Prevents request forgery

2. **Rate Limiting**
   - Per-IP rate limiting prevents DoS
   - Per-phone rate limiting prevents SMS spam
   - Exponential backoff for failed attempts

3. **Input Validation**
   - All inputs validated before processing
   - SQL injection not applicable (using Shopify API)
   - XSS prevention in UI components

### Data Security

1. **Secrets Management**
   - All credentials in environment variables
   - Never committed to version control
   - Rotated regularly

2. **Data Encryption**
   - TLS for Redis connections
   - HTTPS for all API calls
   - Multipass tokens encrypted

3. **PII Handling**
   - Phone numbers hashed in logs
   - Email addresses only in Shopify (not our DB)
   - OTP codes never logged

### Compliance

- **GDPR**: Customer data stored in Shopify (GDPR compliant)
- **PCI DSS**: No payment data handled by our app
- **SMS Regulations**: Opt-in required, unsubscribe supported

## Deployment Architecture

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Environment                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Load Balancer (HTTPS)                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│         ┌────────────────┴────────────────┐                 │
│         ▼                                  ▼                 │
│  ┌─────────────┐                   ┌─────────────┐         │
│  │  App Server │                   │  App Server │         │
│  │  (Node.js)  │                   │  (Node.js)  │         │
│  │  - API      │                   │  - API      │         │
│  │  - Workers  │                   │  - Workers  │         │
│  └─────────────┘                   └─────────────┘         │
│         │                                  │                 │
│         └────────────────┬─────────────────┘                │
│                          ▼                                   │
│                   ┌─────────────┐                           │
│                   │    Redis    │                           │
│                   │  (Cluster)  │                           │
│                   └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Strategy

1. **Containerization**: Docker containers for consistent environments
2. **Orchestration**: Kubernetes or similar for scaling and health checks
3. **CI/CD**: Automated testing and deployment pipeline
4. **Monitoring**: Application performance monitoring (APM)
5. **Logging**: Centralized logging (e.g., ELK stack)

### Scaling Considerations

1. **Horizontal Scaling**: Multiple app server instances behind load balancer
2. **Redis Clustering**: Redis cluster for high availability
3. **Queue Workers**: Separate worker processes for SMS queue
4. **Caching**: Redis caching for Shopify API responses
5. **CDN**: Static assets served via CDN

### Environment Configuration

**Development:**
- Local Redis instance
- Shopify development store
- SMS provider test mode
- Mock OAuth providers

**Staging:**
- Staging Redis cluster
- Shopify partner test store
- SMS provider test mode
- Real OAuth providers (test apps)

**Production:**
- Production Redis cluster
- Live Shopify stores
- SMS provider production mode
- Real OAuth providers (production apps)

## Performance Considerations

### Response Time Targets

- OTP send request: < 200ms (before queue)
- OTP verification: < 100ms
- OAuth initiation: < 100ms
- Multipass token generation: < 50ms
- Admin UI load: < 500ms

### Optimization Strategies

1. **Caching**
   - Shop configuration cached in Redis (5 min TTL)
   - Customer lookup results cached (1 min TTL)
   - OAuth provider configs cached in memory

2. **Async Processing**
   - SMS sending via queue (non-blocking)
   - DLR webhook processing async
   - Logging async

3. **Connection Pooling**
   - Redis connection pool
   - HTTP client connection reuse
   - Shopify API client pooling

4. **Database Optimization**
   - Redis pipelining for batch operations
   - Appropriate TTLs to prevent memory bloat

### Monitoring Metrics

- Request latency (p50, p95, p99)
- Error rates by endpoint
- SMS delivery success rate
- Queue depth and processing time
- Redis memory usage
- External API response times

## Future Enhancements

### Phase 2 Features

1. **Additional OAuth Providers**
   - Apple Sign In
   - Facebook Login
   - Twitter OAuth

2. **Additional SMS Providers**
   - Twilio
   - Vonage (Nexmo)
   - AWS SNS

3. **Biometric Authentication**
   - WebAuthn support
   - Fingerprint/Face ID

4. **Advanced Security**
   - 2FA for high-value accounts
   - Device fingerprinting
   - Anomaly detection

### Extensibility Points

1. **Provider System**: Easy to add new SMS and OAuth providers
2. **Webhook System**: Extensible webhook handlers
3. **UI Customization**: Theme-able components
4. **Event System**: Hooks for custom logic (e.g., post-login actions)

## Appendix

### API Endpoints Reference

```
POST   /api/auth/send-otp
POST   /api/auth/verify-otp
POST   /api/auth/email-login
GET    /api/auth/oauth/:provider
POST   /api/auth/oauth/:provider/callback
POST   /api/auth/session/restore
POST   /api/webhooks/sms-dlr
POST   /api/webhooks/shopify/:topic
GET    /api/admin/settings
PUT    /api/admin/settings
```

### Environment Variables

```bash
# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_MULTIPASS_SECRET=
SHOPIFY_SCOPES=read_customers,write_customers,read_orders,write_orders

# SMS Providers
SMS_TO_API_KEY=
SMS_TO_SENDER_ID=

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Redis
REDIS_URL=
REDIS_TLS_ENABLED=true

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Shopify App Configuration

```toml
# shopify.app.toml
name = "SMS Authentication"
client_id = "..."
application_url = "https://your-app.com"
embedded = true

[access_scopes]
scopes = "read_customers,write_customers,read_orders,write_orders"

[auth]
redirect_urls = [
  "https://your-app.com/api/auth/callback"
]

[webhooks]
api_version = "2024-01"

[[webhooks.subscriptions]]
topics = ["customers/create", "customers/update"]
uri = "/api/webhooks/shopify/customers"

[[webhooks.subscriptions]]
topics = ["orders/create"]
uri = "/api/webhooks/shopify/orders"
```
