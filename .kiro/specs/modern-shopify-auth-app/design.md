# Design Document

## Overview

This design document outlines the architecture for migrating the existing SMS authentication backend services into a modern Shopify app structure. The app will use Shopify CLI with Remix, providing an embedded admin UI, theme app extension for login forms, and checkout UI extension for seamless authentication at checkout.

The design focuses on creating the proper Shopify app "wrapper" while reusing existing, well-tested backend services (SMSService, OTPService, MultipassService, OAuth providers, etc.).

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Shopify Admin                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Embedded Admin UI (Remix + Polaris)                       │ │
│  │  - SMS Provider Config                                     │ │
│  │  - OAuth Provider Config                                   │ │
│  │  - UI Customization                                        │ │
│  │  - Analytics Dashboard                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ App Bridge
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Shopify App Backend (Remix on Node.js)              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Remix Routes (app/routes/)                                 ││
│  │  - app._index.tsx (Admin Dashboard)                         ││
│  │  - app.settings.tsx (Settings Page)                         ││
│  │  - api.auth.sms.ts (SMS Auth API)                           ││
│  │  - api.auth.email.ts (Email Auth API)                       ││
│  │  - api.auth.oauth.$provider.ts (OAuth API)                  ││
│  │  - webhooks.orders.create.ts (Order Webhook)                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Existing Backend Services (Migrated)                       ││
│  │  - SMSService (sms.to + Twilio)                             ││
│  │  - OTPService (generation + verification)                   ││
│  │  - MultipassService (Shopify auth)                          ││
│  │  - GoogleOAuthProvider                                      ││
│  │  - AuthService, CustomerService, OrderService               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │  Redis           │        │  Bull Queue      │
        │  - OTP storage   │        │  - SMS jobs      │
        │  - Rate limiting │        │  - Retry logic   │
        │  - Sessions      │        │                  │
        └──────────────────┘        └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Shopify Storefront                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Theme App Extension (extensions/theme-extension/)          ││
│  │  - Login form block                                         ││
│  │  - SMS/Email/OAuth options                                  ││
│  │  - Custom styling                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Checkout UI Extension (extensions/checkout-ui/)            ││
│  │  - Authentication modal                                     ││
│  │  - Intercepts checkout                                      ││
│  │  - SMS/Email/OAuth options                                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React Router (routing framework)
- Shopify Polaris Web Components (UI components)
- Shopify App Bridge (embedded app integration)
- React (UI library)

**Backend:**
- Node.js 18+
- React Router (server-side rendering + API routes)
- GraphQL (Shopify Admin API)
- Prisma (database ORM)
- TypeScript

**Extensions:**
- Shopify CLI for extension development
- Liquid (theme app extension)
- React (checkout UI extension)

**Database & Storage:**
- Prisma (ORM for app data)
- PostgreSQL or SQLite (app database)
- Redis (session + OTP storage)
- Bull (SMS job queue)

**Authentication & Security:**
- bcrypt (password hashing)
- jsonwebtoken (session tokens)

**External Services:**
- sms.to (primary SMS provider)
- Twilio (fallback SMS provider)
- Google OAuth API
- Shopify Admin API
- Shopify Multipass


## Components and Interfaces

### 1. React Router App Structure

The app will follow Shopify's recommended React Router structure:

```
app/
├── routes/
│   ├── app._index.tsx              # Admin dashboard (embedded)
│   ├── app.settings.tsx            # Settings page
│   ├── app.analytics.tsx           # Analytics page
│   ├── api.auth.sms.send.ts        # Send SMS OTP
│   ├── api.auth.sms.verify.ts      # Verify SMS OTP
│   ├── api.auth.email.login.ts     # Email/password login
│   ├── api.auth.oauth.$provider.ts # OAuth callback
│   ├── api.multipass.generate.ts   # Generate Multipass token
│   └── webhooks.orders.create.ts   # Order webhook handler
├── services/                        # Migrated services
│   ├── SMSService.ts
│   ├── OTPService.ts
│   ├── MultipassService.ts
│   ├── AuthService.ts
│   ├── CustomerService.ts
│   └── OrderService.ts
├── providers/                       # Migrated providers
│   ├── SmsToProvider.ts
│   ├── TwilioProvider.ts
│   └── GoogleOAuthProvider.ts
├── components/                      # React components
│   ├── SettingsForm.tsx
│   ├── SMSProviderConfig.tsx
│   ├── OAuthProviderConfig.tsx
│   └── AnalyticsDashboard.tsx
└── shopify.server.ts               # Shopify API client

extensions/
├── theme-extension/                 # Theme app extension
│   ├── blocks/
│   │   └── login-form.liquid
│   ├── assets/
│   │   ├── login-form.js
│   │   └── login-form.css
│   └── snippets/
│       └── auth-modal.liquid
└── checkout-ui/                     # Checkout UI extension
    ├── src/
    │   ├── Checkout.tsx
    │   ├── AuthModal.tsx
    │   └── index.tsx
    └── shopify.extension.toml
```

### 2. Admin UI Components

#### SettingsForm Component
```typescript
interface SettingsFormProps {
  shop: string;
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
}

interface AppSettings {
  smsProvider: {
    primary: 'sms.to' | 'twilio';
    smsTo: { apiKey: string; senderId: string };
    twilio: { accountSid: string; authToken: string; fromNumber: string };
  };
  oauthProviders: {
    google: { clientId: string; clientSecret: string; enabled: boolean };
    apple: { clientId: string; teamId: string; keyId: string; enabled: boolean };
    facebook: { appId: string; appSecret: string; enabled: boolean };
  };
  uiCustomization: {
    primaryColor: string;
    buttonStyle: 'rounded' | 'square';
    logoUrl: string;
  };
  features: {
    smsAuth: boolean;
    emailAuth: boolean;
    oauthAuth: boolean;
    orderConfirmation: boolean;
  };
}
```


### 3. API Route Interfaces

#### SMS Authentication API

**POST /api/auth/sms/send**
```typescript
interface SendSMSRequest {
  phoneNumber: string;
  shop: string;
}

interface SendSMSResponse {
  success: boolean;
  message: string;
  cooldownSeconds?: number;
}
```

**POST /api/auth/sms/verify**
```typescript
interface VerifySMSRequest {
  phoneNumber: string;
  code: string;
  shop: string;
}

interface VerifySMSResponse {
  success: boolean;
  multipassUrl?: string;
  error?: string;
}
```

#### Email Authentication API

**POST /api/auth/email/login**
```typescript
interface EmailLoginRequest {
  email: string;
  password: string;
  shop: string;
}

interface EmailLoginResponse {
  success: boolean;
  multipassUrl?: string;
  error?: string;
}
```

#### OAuth API

**GET /api/auth/oauth/:provider**
```typescript
// Redirects to OAuth provider
// Query params: shop, returnUrl
```

**GET /api/auth/oauth/:provider/callback**
```typescript
interface OAuthCallbackQuery {
  code: string;
  state: string;
  shop: string;
}

// Redirects to multipassUrl on success
```

### 4. Theme App Extension Interface

The theme extension will render a login form block that merchants can add to any page:

```liquid
{% schema %}
{
  "name": "Customer Login",
  "target": "section",
  "settings": [
    {
      "type": "checkbox",
      "id": "show_sms",
      "label": "Show SMS Login",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_email",
      "label": "Show Email Login",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_oauth",
      "label": "Show OAuth Login",
      "default": true
    }
  ]
}
{% endschema %}
```

JavaScript interface for the login form:
```typescript
interface LoginFormAPI {
  sendSMS(phoneNumber: string): Promise<SendSMSResponse>;
  verifySMS(phoneNumber: string, code: string): Promise<VerifySMSResponse>;
  loginEmail(email: string, password: string): Promise<EmailLoginResponse>;
  loginOAuth(provider: 'google' | 'apple' | 'facebook'): void;
}
```


### 5. Checkout UI Extension Interface

The checkout extension will use Shopify's Checkout UI Extension API:

```typescript
import { extension, Banner, Modal, Button } from '@shopify/ui-extensions/checkout';

interface CheckoutExtensionAPI {
  // Check if customer is authenticated
  isAuthenticated(): boolean;
  
  // Show authentication modal
  showAuthModal(): void;
  
  // Handle authentication success
  onAuthSuccess(multipassUrl: string): void;
  
  // Handle authentication skip
  onAuthSkip(): void;
}
```

### 6. GraphQL Queries for Shopify Admin API

The app will use GraphQL to interact with Shopify's Admin API:

```graphql
# Get customer by email
query GetCustomer($email: String!) {
  customers(first: 1, query: $email) {
    edges {
      node {
        id
        email
        phone
        firstName
        lastName
        tags
      }
    }
  }
}

# Create customer
mutation CreateCustomer($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer {
      id
      email
      phone
      firstName
      lastName
    }
    userErrors {
      field
      message
    }
  }
}

# Update customer
mutation UpdateCustomer($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer {
      id
      email
      phone
    }
    userErrors {
      field
      message
    }
  }
}

# Get shop info
query GetShop {
  shop {
    id
    name
    email
    myshopifyDomain
    plan {
      displayName
    }
  }
}
```

### 7. Existing Services Integration

The existing services will be migrated with minimal changes:

**SMSService** - No changes needed, already has provider abstraction
```typescript
class SMSService {
  async sendSMS(phoneNumber: string, message: string): Promise<void>;
  async sendOTP(phoneNumber: string, code: string): Promise<void>;
}
```

**OTPService** - No changes needed
```typescript
class OTPService {
  async generateOTP(phoneNumber: string): Promise<string>;
  async verifyOTP(phoneNumber: string, code: string): Promise<boolean>;
  async invalidateOTP(phoneNumber: string): Promise<void>;
}
```

**MultipassService** - Add shop parameter
```typescript
class MultipassService {
  async generateToken(shop: string, customerData: CustomerData): Promise<string>;
  getMultipassUrl(shop: string, token: string): string;
}
```

**GoogleOAuthProvider** - No changes needed
```typescript
class GoogleOAuthProvider {
  getAuthUrl(state: string, redirectUri: string): string;
  async getAccessToken(code: string, redirectUri: string): Promise<string>;
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}
```


## Data Models

### Database Schema (Prisma)

The app will use Prisma to manage app data in a relational database:

```prisma
// schema.prisma

model Shop {
  id        String   @id @default(cuid())
  domain    String   @unique
  accessToken String
  settings  ShopSettings?
  analytics Analytics[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ShopSettings {
  id              String   @id @default(cuid())
  shop            Shop     @relation(fields: [shopId], references: [id])
  shopId          String   @unique
  
  // SMS Provider Config
  smsPrimary      String   @default("sms.to")
  smsToApiKey     String?
  smsToSenderId   String?
  twilioAccountSid String?
  twilioAuthToken String?
  twilioFromNumber String?
  
  // OAuth Provider Config
  googleClientId     String?
  googleClientSecret String?
  googleEnabled      Boolean @default(false)
  appleClientId      String?
  appleTeamId        String?
  appleKeyId         String?
  appleEnabled       Boolean @default(false)
  facebookAppId      String?
  facebookAppSecret  String?
  facebookEnabled    Boolean @default(false)
  
  // UI Customization
  primaryColor    String  @default("#000000")
  buttonStyle     String  @default("rounded")
  logoUrl         String?
  
  // Feature Flags
  smsAuthEnabled  Boolean @default(true)
  emailAuthEnabled Boolean @default(true)
  oauthAuthEnabled Boolean @default(true)
  orderConfirmationEnabled Boolean @default(true)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Analytics {
  id        String   @id @default(cuid())
  shop      Shop     @relation(fields: [shopId], references: [id])
  shopId    String
  
  eventType String   // "auth_success", "auth_failure", "sms_sent", "sms_failed"
  method    String?  // "sms", "email", "google", "apple", "facebook"
  metadata  Json?
  
  createdAt DateTime @default(now())
  
  @@index([shopId, eventType, createdAt])
}
```

### AppSettings Model

Stored in database via Prisma:

```typescript
interface AppSettings {
  shop: string;
  smsProvider: SMSProviderConfig;
  oauthProviders: OAuthProvidersConfig;
  uiCustomization: UICustomization;
  features: FeatureFlags;
  createdAt: Date;
  updatedAt: Date;
}

interface SMSProviderConfig {
  primary: 'sms.to' | 'twilio';
  smsTo: {
    apiKey: string;
    senderId: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
}

interface OAuthProvidersConfig {
  google: {
    clientId: string;
    clientSecret: string;
    enabled: boolean;
  };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    enabled: boolean;
  };
  facebook: {
    appId: string;
    appSecret: string;
    enabled: boolean;
  };
}

interface UICustomization {
  primaryColor: string;
  buttonStyle: 'rounded' | 'square';
  logoUrl: string;
}

interface FeatureFlags {
  smsAuth: boolean;
  emailAuth: boolean;
  oauthAuth: boolean;
  orderConfirmation: boolean;
}
```

### Session Model

Stored in Redis:

```typescript
interface Session {
  sessionId: string;
  shop: string;
  customerId: string;
  customerEmail: string;
  createdAt: number;
  expiresAt: number;
}

// Redis key: `session:${sessionId}`
// TTL: 24 hours
```

### OTP Model

Stored in Redis (existing structure):

```typescript
interface OTPData {
  code: string;
  phoneNumber: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
}

// Redis key: `otp:${phoneNumber}`
// TTL: 5 minutes
```

### Rate Limit Model

Stored in Redis (existing structure):

```typescript
interface RateLimitData {
  count: number;
  resetAt: number;
}

// Redis key: `ratelimit:${ip}:${endpoint}`
// TTL: 1 minute
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Settings Persistence Round Trip
*For any* valid AppSettings object, saving it and then retrieving it should return an equivalent settings object with all fields preserved.
**Validates: Requirements 2.5**

### Property 2: Phone Number Validation Consistency
*For any* string input, the phone number validation function should consistently accept or reject it based on international phone number format rules (E.164).
**Validates: Requirements 5.1**

### Property 3: OTP Generation Format
*For any* valid phone number, the generated OTP code should always be exactly 6 digits (numeric characters only).
**Validates: Requirements 5.2**

### Property 4: SMS Queueing Guarantee
*For any* valid phone number and OTP code, when an SMS send request is made, a job should be created in the Bull queue.
**Validates: Requirements 5.3**

### Property 5: SMS Provider Failover
*For any* SMS send request, when the primary provider fails, the system should automatically attempt to send via the secondary provider.
**Validates: Requirements 5.4, 10.2**

### Property 6: OTP Verification Correctness
*For any* phone number and code pair, OTP verification should return true if and only if the code matches the stored OTP for that phone number and has not expired.
**Validates: Requirements 5.5**

### Property 7: Successful OTP Creates Multipass Token
*For any* valid phone number with a verified OTP, the authentication flow should generate a Multipass token containing the customer's email.
**Validates: Requirements 5.6**

### Property 8: OTP Expiration Enforcement
*For any* OTP that was generated more than 5 minutes ago, verification attempts should be rejected regardless of whether the code is correct.
**Validates: Requirements 5.7**

### Property 9: OTP Cooldown Enforcement
*For any* phone number that has requested an OTP within the last 30 seconds, subsequent OTP requests should be rejected with a cooldown error.
**Validates: Requirements 5.8**

### Property 10: Empty Field Validation
*For any* email/password login attempt where either field is empty or contains only whitespace, the system should reject the request with a validation error.
**Validates: Requirements 6.1**

### Property 11: Customer Existence Check
*For any* email address submitted for login, the system should query Shopify's customer API to verify the customer exists before attempting password verification.
**Validates: Requirements 6.2**

### Property 12: Password Verification Using Bcrypt
*For any* email and password combination, the system should use bcrypt to compare the provided password with the stored hash.
**Validates: Requirements 6.3**

### Property 13: Successful Email Auth Creates Multipass Token
*For any* valid email and password combination that passes verification, the authentication flow should generate a Multipass token.
**Validates: Requirements 6.4**

### Property 14: Authentication Error Message Ambiguity
*For any* failed email/password authentication attempt, the error message should not reveal whether the email or password was incorrect.
**Validates: Requirements 6.5**

### Property 15: Account Blocking After Failed Attempts
*For any* email address, after 5 consecutive failed authentication attempts, the account should be blocked for 15 minutes.
**Validates: Requirements 6.6**

### Property 16: OAuth Customer Find or Create
*For any* email address retrieved from an OAuth provider, the system should either find an existing Shopify customer with that email or create a new one.
**Validates: Requirements 7.5**

### Property 17: OAuth Success Creates Multipass Token
*For any* successful OAuth authentication, the system should generate a Multipass token for the authenticated customer.
**Validates: Requirements 7.6**

### Property 18: Multipass Token Contains Customer Email
*For any* authenticated customer, the generated Multipass token should contain the customer's email address when decrypted.
**Validates: Requirements 8.1**

### Property 19: Multipass Token Encryption
*For any* customer data, the Multipass token should be encrypted using AES-256-CBC with the merchant's Multipass secret.
**Validates: Requirements 8.2**

### Property 20: Multipass Token Includes Metadata
*For any* customer, the Multipass token should include customer metadata (name, phone, tags) in addition to the email.
**Validates: Requirements 8.3**

### Property 21: Multipass URL Format
*For any* generated Multipass token and shop domain, the redirect URL should follow the format: `https://{shop}/account/login/multipass/{token}`.
**Validates: Requirements 8.4**

### Property 22: Rate Limiting Per IP
*For any* IP address, when the number of authentication requests exceeds the configured limit within the time window, subsequent requests should be rejected.
**Validates: Requirements 9.1**

### Property 23: Rate Limit Response Code
*For any* request that exceeds rate limits, the system should return HTTP status code 429 (Too Many Requests).
**Validates: Requirements 9.2**

### Property 24: OTP Storage With Expiration
*For any* generated OTP, the system should store it in Redis with a TTL of 5 minutes (300 seconds).
**Validates: Requirements 9.3**

### Property 25: Sensitive Data Masking in Logs
*For any* log entry containing customer data, phone numbers should be masked (showing only last 4 digits) and emails should be partially masked.
**Validates: Requirements 9.4**

### Property 26: Webhook HMAC Validation
*For any* incoming webhook request, the system should validate the HMAC signature using the app's client secret before processing the payload.
**Validates: Requirements 9.5**

### Property 27: Primary Provider First Attempt
*For any* SMS send request, the system should always attempt to send via the primary provider (sms.to) before trying the secondary provider.
**Validates: Requirements 10.1**

### Property 28: Error Logging on Complete Failure
*For any* SMS send request where both providers fail, the system should log an error with severity level "error" and include both failure reasons.
**Validates: Requirements 10.3**

### Property 29: SMS Job Retry With Exponential Backoff
*For any* failed SMS job, the system should retry up to 3 times with exponentially increasing delays (1s, 2s, 4s).
**Validates: Requirements 10.5**

### Property 30: Session Creation on Authentication
*For any* successful authentication (SMS, Email, or OAuth), the system should create a session token and store it in Redis.
**Validates: Requirements 13.1**

### Property 31: Session Expiration Time
*For any* created session, the Redis TTL should be set to exactly 24 hours (86400 seconds).
**Validates: Requirements 13.2**

### Property 32: Session Token Validation
*For any* session token, validation should return true if and only if the token exists in Redis and has not expired.
**Validates: Requirements 13.3**

### Property 33: Expired Session Requires Re-authentication
*For any* session token that has expired (TTL = 0 in Redis), subsequent requests using that token should be rejected with an authentication error.
**Validates: Requirements 13.4**

### Property 34: Logout Invalidates Session
*For any* valid session token, when logout is called, the token should be immediately removed from Redis.
**Validates: Requirements 13.5**

### Property 35: Order Webhook Data Extraction
*For any* valid order webhook payload, the system should successfully extract the customer phone number and order details (order number, total, items).
**Validates: Requirements 14.2**

### Property 36: Order Confirmation Message Formatting
*For any* order with customer phone number, the system should format a confirmation message containing the order number and total amount.
**Validates: Requirements 14.3**

### Property 37: Order Confirmation SMS Queueing
*For any* formatted order confirmation message, the system should queue an SMS job to send it to the customer's phone number.
**Validates: Requirements 14.4**

### Property 38: SMS Delivery Status Logging
*For any* SMS send attempt (success or failure), the system should log the delivery status with the phone number (masked), message ID, and provider used.
**Validates: Requirements 14.5**

### Property 39: User-Friendly Error Messages
*For any* authentication failure, the error message should be in plain language without technical jargon or stack traces.
**Validates: Requirements 15.1**

### Property 40: Authentication Method Tracking
*For any* successful authentication, the system should record which method was used (SMS, Email, Google, Apple, Facebook) in analytics.
**Validates: Requirements 16.1**

### Property 41: Authentication Success/Failure Rate Tracking
*For any* authentication attempt, the system should increment either the success or failure counter for analytics.
**Validates: Requirements 16.2**

### Property 42: SMS Delivery Rate Tracking
*For any* SMS send attempt, the system should track whether it was successfully delivered or failed for analytics.
**Validates: Requirements 16.4**

### Property 43: Error Logging With Severity
*For any* error that occurs, the system should log it with an appropriate severity level (info, warn, error, critical) based on the error type.
**Validates: Requirements 16.5**

### Property 44: Language-Based UI Text
*For any* supported language code (en, es, fr, de), when the login form is rendered with that language, all UI text should be displayed in that language.
**Validates: Requirements 17.2**

### Property 45: Unsupported Language Defaults to English
*For any* unsupported language code, the login form should display all UI text in English.
**Validates: Requirements 17.3**

### Property 46: SMS Message Localization
*For any* SMS message (OTP or order confirmation) sent to a customer with a preferred language, the message content should be in that language.
**Validates: Requirements 17.4**


## Error Handling

### Error Categories

**1. Validation Errors (400 Bad Request)**
- Invalid phone number format
- Empty email or password
- Invalid OTP code format
- Missing required fields

**2. Authentication Errors (401 Unauthorized)**
- Invalid OTP code
- Expired OTP
- Incorrect email/password
- Expired session token
- Account blocked due to failed attempts

**3. Rate Limiting Errors (429 Too Many Requests)**
- Too many OTP requests
- Too many authentication attempts
- Too many SMS sends

**4. External Service Errors (502 Bad Gateway)**
- SMS provider failure (both providers)
- Shopify API failure
- OAuth provider failure

**5. Internal Errors (500 Internal Server Error)**
- Redis connection failure
- Database errors
- Unexpected exceptions

### Error Response Format

All API errors will follow this format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
}
```

### Error Handling Strategy

**Retry Logic:**
- SMS sends: 3 retries with exponential backoff
- Shopify API calls: 2 retries with 1s delay
- OAuth token exchange: 1 retry

**Fallback Behavior:**
- SMS: Automatic failover to secondary provider
- Authentication: Allow alternative methods if one fails

**User Communication:**
- Display user-friendly error messages
- Provide actionable next steps
- Never expose technical details or stack traces

**Logging:**
- Log all errors with appropriate severity
- Include request ID for tracing
- Mask sensitive data in logs


## Testing Strategy

### Dual Testing Approach

This project will use both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests:**
- Verify specific examples and edge cases
- Test integration points between components
- Validate UI component rendering
- Test API route handlers

**Property-Based Tests:**
- Verify universal properties hold across all inputs
- Test with randomly generated data
- Catch edge cases that might be missed in unit tests
- Validate correctness properties from the design document

### Property-Based Testing Framework

We will use **fast-check** for property-based testing in TypeScript/JavaScript.

**Configuration:**
- Each property test should run a minimum of 100 iterations
- Use appropriate generators for each data type (phone numbers, emails, OTPs, etc.)
- Tag each property test with a comment referencing the design document property

**Tag Format:**
```typescript
// Feature: modern-shopify-auth-app, Property 1: Settings Persistence Round Trip
```

### Test Organization

```
app/
├── services/
│   ├── __tests__/
│   │   ├── SMSService.test.ts
│   │   ├── SMSService.property.test.ts
│   │   ├── OTPService.test.ts
│   │   ├── OTPService.property.test.ts
│   │   ├── MultipassService.test.ts
│   │   └── MultipassService.property.test.ts
│   └── ...
├── routes/
│   ├── __tests__/
│   │   ├── api.auth.sms.test.ts
│   │   ├── api.auth.email.test.ts
│   │   └── api.auth.oauth.test.ts
│   └── ...
└── components/
    ├── __tests__/
    │   ├── SettingsForm.test.tsx
    │   └── AuthModal.test.tsx
    └── ...
```

### Unit Test Coverage

**Services:**
- SMSService: Test send methods, provider selection, failover
- OTPService: Test generation, verification, expiration
- MultipassService: Test token generation, encryption, URL formatting
- AuthService: Test authentication flows for each method
- CustomerService: Test customer lookup and creation
- OrderService: Test webhook processing

**API Routes:**
- Test request validation
- Test successful responses
- Test error responses
- Test rate limiting

**Components:**
- Test rendering with different props
- Test user interactions
- Test form submissions
- Test error states

### Property-Based Test Coverage

Each correctness property from the design document will have a corresponding property-based test:

**Example Property Test:**
```typescript
// Feature: modern-shopify-auth-app, Property 3: OTP Generation Format
test('OTP codes are always 6 digits', () => {
  fc.assert(
    fc.property(
      fc.string().filter(isValidPhoneNumber),
      async (phoneNumber) => {
        const otp = await otpService.generateOTP(phoneNumber);
        expect(otp).toMatch(/^\d{6}$/);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

**Theme Extension:**
- Test login form rendering
- Test SMS authentication flow
- Test email authentication flow
- Test OAuth authentication flow

**Checkout Extension:**
- Test modal display for unauthenticated users
- Test authentication completion
- Test guest checkout fallback

**Admin UI:**
- Test settings form submission
- Test provider configuration
- Test analytics display

### End-to-End Testing

**Critical Flows:**
1. Merchant installs app → Configures SMS provider → Enables theme extension
2. Customer visits storefront → Clicks login → Authenticates with SMS → Redirected to account
3. Customer reaches checkout → Sees auth modal → Authenticates → Continues checkout
4. Customer places order → Receives SMS confirmation

### Test Data Generators

Create custom generators for property-based tests:

```typescript
// Phone number generator (E.164 format)
const phoneNumberGen = fc.string()
  .filter(s => /^\+[1-9]\d{1,14}$/.test(s));

// Email generator
const emailGen = fc.emailAddress();

// OTP generator
const otpGen = fc.integer({ min: 100000, max: 999999 })
  .map(n => n.toString());

// Customer data generator
const customerGen = fc.record({
  email: emailGen,
  phone: phoneNumberGen,
  firstName: fc.string(),
  lastName: fc.string(),
});
```

### Mocking Strategy

**External Services:**
- Mock SMS providers (sms.to, Twilio) for unit tests
- Mock Shopify Admin API for unit tests
- Mock OAuth providers for unit tests
- Use real services for integration tests (with test accounts)

**Redis:**
- Use ioredis-mock for unit tests
- Use real Redis for integration tests

**Bull Queue:**
- Mock queue for unit tests
- Use real queue for integration tests

### Continuous Integration

**Pre-commit:**
- Run linter (ESLint)
- Run type checker (TypeScript)
- Run unit tests

**CI Pipeline:**
- Run all unit tests
- Run all property-based tests
- Run integration tests
- Generate coverage report (target: 80%+)
- Build app and extensions

