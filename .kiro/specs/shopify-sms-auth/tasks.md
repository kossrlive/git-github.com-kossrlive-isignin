# Implementation Plan

- [x] 1. Initialize Shopify App project structure
  - Run `npm init @shopify/app@latest` to create base project
  - Configure app in Shopify Dev Dashboard with required scopes (read_customers, write_customers, read_orders, write_orders)
  - Set up TypeScript configuration with strict mode
  - Configure environment variables for Shopify API credentials and Multipass secret
  - _Requirements: 11.1, 11.2, 9.1_

- [x] 2. Set up core infrastructure and dependencies
  - Install and configure Redis client (ioredis) with TLS support
  - Install and configure Bull queue for job processing
  - Set up Express.js server with HTTPS enforcement
  - Configure logging framework (Winston or Pino) with request ID tracking
  - Install testing frameworks (Jest, fast-check, supertest)
  - _Requirements: 9.4, 9.5, 10.1, 7.5_

- [ ] 3. Implement provider interfaces and base implementations
- [ ] 3.1 Create ISMSProvider interface
  - Define interface with sendSMS, checkDeliveryStatus, and handleWebhook methods
  - Define SendSMSParams, SendSMSResult, DeliveryStatus, and DeliveryReceipt types
  - _Requirements: 13.4_

- [ ] 3.2 Create IOAuthProvider interface
  - Define interface with getAuthorizationUrl, exchangeCodeForToken, getUserProfile, and refreshToken methods
  - Define OAuthTokens and UserProfile types
  - _Requirements: 14.1_

- [ ] 3.3 Implement SmsToProvider
  - Implement ISMSProvider for sms.to API
  - Handle API authentication with API key
  - Implement sendSMS with proper error handling
  - Implement DLR webhook parsing
  - _Requirements: 1.3, 5.1_

- [ ] 3.4 Write property test for SmsToProvider
  - **Property 31: Provider error logging**
  - **Validates: Requirements 13.5**

- [ ] 3.5 Implement GoogleOAuthProvider
  - Implement IOAuthProvider for Google OAuth 2.0
  - Generate authorization URL with proper scopes
  - Exchange authorization code for tokens
  - Fetch user profile from Google API
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3.6 Write property test for OAuth profile normalization
  - **Property 10: OAuth user profile normalization**
  - **Validates: Requirements 14.4**

- [ ] 4. Implement core services
- [ ] 4.1 Implement OTPService
  - Generate 6-digit OTP codes
  - Store OTP in Redis with 5-minute TTL
  - Verify OTP against stored value
  - Track failed attempts counter in Redis
  - Implement phone blocking logic (5 attempts = 15 min block)
  - Delete OTP after successful use
  - _Requirements: 1.2, 1.4, 6.1, 6.2, 6.4_

- [ ] 4.2 Write property tests for OTPService
  - **Property 2: OTP generation format**
  - **Property 3: OTP verification correctness**
  - **Property 14: Failed attempt counter**
  - **Property 15: Phone blocking after failures**
  - **Property 17: OTP deletion after use**
  - **Validates: Requirements 1.2, 1.4, 6.1, 6.2, 6.4**

- [ ] 4.3 Implement MultipassService
  - Generate Multipass tokens with customer data
  - Encrypt and sign tokens using Multipass secret
  - Include email, created_at, and return_to in token payload
  - Generate redirect URL with token
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 4.4 Write property tests for MultipassService
  - **Property 7: Multipass token generation**
  - **Property 8: Multipass token contents**
  - **Validates: Requirements 4.1, 4.2**

- [ ] 4.5 Implement SMSService with provider management
  - Load SMS provider configuration with priorities
  - Implement provider selection logic
  - Implement fallback mechanism (try next provider on failure)
  - Implement provider rotation for resend requests
  - Track SMS delivery in Redis
  - _Requirements: 13.1, 13.2, 13.3, 5.1_

- [ ] 4.6 Write property tests for SMSService
  - **Property 29: SMS provider fallback**
  - **Property 30: Provider rotation on resend**
  - **Validates: Requirements 13.2, 13.3**

- [ ] 4.7 Implement OAuthService
  - Register OAuth providers in a map
  - Implement provider lookup by name
  - Initiate OAuth flow with state parameter
  - Handle OAuth callback and exchange code for profile
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 4.8 Write property test for OAuth provider interface compliance
  - **Property 32: OAuth provider interface compliance**
  - **Validates: Requirements 14.1**

- [ ] 4.9 Implement CustomerService
  - Find customer by email using Shopify Admin API
  - Find customer by phone using Shopify Admin API
  - Create new customer with provided data
  - Update customer metafields (auth_method, phone_verified, last_login)
  - Handle Shopify API errors with retry logic
  - _Requirements: 1.5, 2.2, 2.4, 3.4, 3.5_

- [ ] 4.10 Write property test for customer creation
  - **Property 4: Customer creation or retrieval**
  - **Validates: Requirements 1.5**

- [ ] 5. Implement AuthService orchestration
- [ ] 5.1 Implement phone authentication flow
  - Validate phone number format (E.164)
  - Generate and store OTP
  - Queue SMS sending job
  - Verify OTP and find/create customer
  - Generate Multipass token
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 5.2 Write property tests for phone authentication
  - **Property 1: Phone number validation consistency**
  - **Validates: Requirements 1.1**

- [ ] 5.3 Implement email/password authentication flow
  - Validate email format
  - Find customer in Shopify
  - Verify password with bcrypt
  - Create new customer if not exists (with hashed password)
  - Generate Multipass token
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 5.4 Write property tests for email authentication
  - **Property 5: Email validation consistency**
  - **Property 6: Password hashing security**
  - **Validates: Requirements 2.1, 9.3**

- [ ] 5.5 Implement OAuth authentication flow
  - Generate OAuth authorization URL
  - Handle OAuth callback
  - Exchange code for tokens
  - Fetch user profile
  - Normalize profile data
  - Find/create customer in Shopify
  - Generate Multipass token
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.6 Write property test for OAuth authorization URL
  - **Property 9: OAuth authorization URL format**
  - **Validates: Requirements 3.1**

- [ ] 6. Implement rate limiting and security
- [ ] 6.1 Implement rate limiting middleware
  - Track requests per IP in Redis with 1-minute TTL
  - Block requests after 10 requests per minute
  - Return 429 status with retry-after header
  - _Requirements: 6.3_

- [ ] 6.2 Write property test for IP rate limiting
  - **Property 16: IP rate limiting**
  - **Validates: Requirements 6.3**

- [ ] 6.3 Implement OTP resend rate limiting
  - Check last send time in Redis
  - Reject if less than 30 seconds since last send
  - Track send attempts (3 per 10 minutes)
  - Block phone after 3 attempts for 10 minutes
  - _Requirements: 5.4, 5.5_

- [ ] 6.4 Write property tests for OTP rate limiting
  - **Property 12: Rate limiting for resend**
  - **Property 13: Send attempt blocking**
  - **Validates: Requirements 5.4, 5.5**

- [ ] 6.5 Implement HMAC validation middleware
  - Validate HMAC signature for Shopify requests
  - Reject requests with invalid signatures
  - _Requirements: 11.5_

- [ ] 6.6 Write property test for HMAC validation
  - **Property 26: HMAC validation**
  - **Validates: Requirements 11.5**

- [ ] 7. Implement Bull queue for SMS processing
- [ ] 7.1 Set up Bull queue with Redis
  - Create SMS queue with Redis connection
  - Configure queue options (attempts, backoff)
  - _Requirements: 10.1_

- [ ] 7.2 Implement SMS job processor
  - Process SMS jobs from queue
  - Call SMSService to send SMS
  - Implement retry logic with exponential backoff (3 attempts)
  - Move failed jobs to failed queue after all attempts
  - _Requirements: 10.3, 10.4, 10.5_

- [ ] 7.3 Write property tests for queue processing
  - **Property 23: Queue job creation**
  - **Property 24: SMS retry with exponential backoff**
  - **Property 25: Failed job handling**
  - **Validates: Requirements 10.1, 10.2, 10.4, 10.5**

- [ ] 8. Implement API routes
- [ ] 8.1 Implement POST /api/auth/send-otp
  - Validate phone number
  - Check rate limits
  - Generate OTP
  - Queue SMS job
  - Return success response immediately
  - _Requirements: 1.1, 1.2, 1.3, 5.4, 5.5_

- [ ] 8.2 Implement POST /api/auth/verify-otp
  - Validate OTP format
  - Verify OTP with OTPService
  - Find/create customer
  - Generate Multipass token
  - Return Multipass URL
  - _Requirements: 1.4, 1.5, 4.1, 4.3_

- [ ] 8.3 Implement POST /api/auth/email-login
  - Validate email and password
  - Authenticate with CustomerService
  - Generate Multipass token
  - Return Multipass URL
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 8.4 Implement GET /api/auth/oauth/:provider
  - Get OAuth provider
  - Generate authorization URL
  - Return redirect to OAuth provider
  - _Requirements: 3.1_

- [ ] 8.5 Implement POST /api/auth/oauth/:provider/callback
  - Get OAuth provider
  - Exchange code for tokens
  - Fetch user profile
  - Find/create customer
  - Generate Multipass token
  - Return Multipass URL
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ] 8.6 Implement POST /api/auth/session/restore
  - Validate session data from localStorage/cookies
  - Restore session via Multipass
  - Return Multipass URL
  - _Requirements: 15.3_

- [ ] 8.7 Write property test for session restoration
  - **Property 33: Session restoration from storage**
  - **Validates: Requirements 15.3**

- [ ] 8.8 Implement POST /api/webhooks/sms-dlr
  - Parse DLR webhook from SMS provider
  - Update delivery status in Redis
  - Log delivery status
  - _Requirements: 5.2_

- [ ] 8.9 Write property test for DLR webhook handling
  - **Property 11: SMS delivery tracking**
  - **Validates: Requirements 5.1**

- [ ] 9. Implement error handling and logging
- [ ] 9.1 Create error classes
  - ValidationError (400)
  - AuthenticationError (401)
  - RateLimitError (429)
  - ExternalServiceError (502/503)
  - InternalError (500)
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 9.2 Implement global error handler middleware
  - Catch all errors
  - Log error details with request ID
  - Return appropriate error response
  - Send alerts for critical errors
  - Sanitize error messages for external service errors
  - _Requirements: 7.1, 7.2, 7.4_

- [ ] 9.3 Write property tests for error handling
  - **Property 18: Error message safety**
  - **Property 19: Validation error specificity**
  - **Validates: Requirements 7.2, 7.3**

- [ ] 9.4 Implement request logging middleware
  - Generate request ID
  - Log request start with method, path, IP
  - Log request completion with status, duration, auth method
  - _Requirements: 7.5_

- [ ] 9.5 Write property test for request logging
  - **Property 20: Request logging completeness**
  - **Validates: Requirements 7.5**

- [ ] 10. Implement order confirmation feature
- [ ] 10.1 Implement order OTP generation
  - Generate unique OTP for order
  - Store OTP with order ID in Redis (10 min TTL)
  - Queue SMS with order number
  - _Requirements: 8.1, 8.2_

- [ ] 10.2 Write property test for order OTP
  - **Property 21: Order OTP uniqueness**
  - **Validates: Requirements 8.1**

- [ ] 10.3 Implement order OTP verification
  - Verify OTP matches order ID
  - Update order status in Shopify
  - Delete OTP after use
  - _Requirements: 8.3, 8.4_

- [ ] 10.4 Write property test for order OTP verification
  - **Property 22: Order OTP verification**
  - **Validates: Requirements 8.3**

- [ ] 10.5 Implement Shopify order webhook handler
  - Listen for orders/create webhook
  - Trigger OTP generation for orders requiring confirmation
  - _Requirements: 8.1_

- [ ] 11. Create admin UI for app configuration
- [ ] 11.1 Set up React admin panel with Shopify Polaris
  - Create admin page component
  - Set up Shopify App Bridge
  - Implement navigation
  - _Requirements: 12.1_

- [ ] 11.2 Implement settings form
  - Form for enabling/disabling auth methods (SMS, email, Google)
  - Color picker for form customization
  - Logo upload field
  - Save button
  - _Requirements: 12.1, 12.4, 14.5_

- [ ] 11.3 Implement settings API endpoints
  - GET /api/admin/settings - fetch current settings from shop metafields
  - PUT /api/admin/settings - save settings to shop metafields
  - _Requirements: 12.2_

- [ ] 11.4 Write property tests for settings
  - **Property 27: Settings persistence**
  - **Property 28: Dynamic auth method availability**
  - **Validates: Requirements 12.2, 12.4**

- [ ] 11.5 Implement real-time settings updates
  - Use Shopify App Bridge to detect settings changes
  - Update UI without page reload
  - _Requirements: 12.5_

- [ ] 11.6 Write property test for settings reactivity
  - **Property 25: Settings reactivity** (note: this is a typo, should be a new property number)
  - **Validates: Requirements 12.5**

- [ ] 12. Create storefront App Extension
- [ ] 12.1 Initialize App Extension
  - Create checkout UI extension using Shopify CLI
  - Configure extension in shopify.app.toml
  - _Requirements: 11.4_

- [ ] 12.2 Implement login form component
  - Create form with phone, email, and OAuth options
  - Fetch enabled methods from settings
  - Apply custom styles from settings
  - Handle form submission
  - _Requirements: 12.3, 12.4_

- [ ] 12.3 Implement checkout interceptor
  - Listen for checkout button click
  - Check authentication status
  - Show login form if not authenticated
  - Check localStorage/cookies for session data
  - _Requirements: 15.1, 15.2_

- [ ] 12.4 Implement session persistence
  - Save session data to localStorage after successful auth
  - Set secure cookies with session token
  - Implement session expiration
  - _Requirements: 15.2, 15.3_

- [ ] 12.5 Implement post-auth redirect
  - Redirect to checkout after successful authentication
  - Preserve cart contents
  - Pass return_to URL to Multipass
  - _Requirements: 15.5_

- [ ] 12.6 Write property test for checkout redirect
  - **Property 34: Post-auth checkout redirect**
  - **Validates: Requirements 15.5**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Add secondary SMS provider support
- [ ] 14.1 Implement TwilioProvider (or another provider)
  - Implement ISMSProvider for Twilio API
  - Configure as secondary provider with priority 2
  - _Requirements: 13.4_

- [ ] 14.2 Update SMSService configuration
  - Load multiple providers from config
  - Test fallback mechanism with both providers
  - _Requirements: 13.1, 13.2_

- [ ] 15. Integration testing
- [ ] 15.1 Write integration tests for full auth flows
  - Test SMS authentication end-to-end
  - Test email authentication end-to-end
  - Test OAuth authentication end-to-end
  - Test provider fallback
  - Test rate limiting
  - Test order confirmation flow

- [ ] 15.2 Write integration tests for admin UI
  - Test settings save and load
  - Test settings applied to storefront

- [ ] 16. Documentation and deployment preparation
- [ ] 16.1 Write API documentation
  - Document all API endpoints
  - Include request/response examples
  - Document error codes

- [ ] 16.2 Write deployment guide
  - Document environment variables
  - Document infrastructure requirements
  - Document deployment steps

- [ ] 16.3 Write user guide
  - Document app installation process
  - Document admin configuration
  - Document customer experience

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
