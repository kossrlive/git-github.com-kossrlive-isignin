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

- [x] 3. Implement provider interfaces and base implementations
- [x] 3.1 Create ISMSProvider interface
  - Define interface with sendSMS, checkDeliveryStatus, and handleWebhook methods
  - Define SendSMSParams, SendSMSResult, DeliveryStatus, and DeliveryReceipt types
  - _Requirements: 13.4_

- [x] 3.2 Create IOAuthProvider interface
  - Define interface with getAuthorizationUrl, exchangeCodeForToken, getUserProfile, and refreshToken methods
  - Define OAuthTokens and UserProfile types
  - _Requirements: 14.1_

- [x] 3.3 Implement SmsToProvider
  - Implement ISMSProvider for sms.to API
  - Handle API authentication with API key
  - Implement sendSMS with proper error handling
  - Implement DLR webhook parsing
  - _Requirements: 1.3, 5.1_

- [x] 3.4 Write property test for SmsToProvider
  - **Property 31: Provider error logging**
  - **Validates: Requirements 13.5**

- [x] 3.5 Implement GoogleOAuthProvider
  - Implement IOAuthProvider for Google OAuth 2.0
  - Generate authorization URL with proper scopes
  - Exchange authorization code for tokens
  - Fetch user profile from Google API
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3.6 Write property test for OAuth profile normalization
  - **Property 10: OAuth user profile normalization**
  - **Validates: Requirements 14.4**

- [x] 4. Implement core services
- [x] 4.1 Implement OTPService
  - Generate 6-digit OTP codes
  - Store OTP in Redis with 5-minute TTL
  - Verify OTP against stored value
  - Track failed attempts counter in Redis
  - Implement phone blocking logic (5 attempts = 15 min block)
  - Delete OTP after successful use
  - _Requirements: 1.2, 1.4, 6.1, 6.2, 6.4_

- [x] 4.2 Write property tests for OTPService
  - **Property 2: OTP generation format**
  - **Property 3: OTP verification correctness**
  - **Property 14: Failed attempt counter**
  - **Property 15: Phone blocking after failures**
  - **Property 17: OTP deletion after use**
  - **Validates: Requirements 1.2, 1.4, 6.1, 6.2, 6.4**

- [x] 4.3 Implement MultipassService
  - Generate Multipass tokens with customer data
  - Encrypt and sign tokens using Multipass secret
  - Include email, created_at, and return_to in token payload
  - Generate redirect URL with token
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.4 Write property tests for MultipassService
  - **Property 7: Multipass token generation**
  - **Property 8: Multipass token contents**
  - **Validates: Requirements 4.1, 4.2**

- [x] 4.5 Implement SMSService with provider management
  - Load SMS provider configuration with priorities
  - Implement provider selection logic
  - Implement fallback mechanism (try next provider on failure)
  - Implement provider rotation for resend requests
  - Track SMS delivery in Redis
  - _Requirements: 13.1, 13.2, 13.3, 5.1_

- [x] 4.6 Write property tests for SMSService
  - **Property 29: SMS provider fallback**
  - **Property 30: Provider rotation on resend**
  - **Validates: Requirements 13.2, 13.3**

- [x] 4.7 Implement OAuthService
  - Register OAuth providers in a map
  - Implement provider lookup by name
  - Initiate OAuth flow with state parameter
  - Handle OAuth callback and exchange code for profile
  - _Requirements: 14.1, 14.2, 14.3_

- [x] 4.8 Write property test for OAuth provider interface compliance
  - **Property 32: OAuth provider interface compliance**
  - **Validates: Requirements 14.1**

- [x] 4.9 Implement CustomerService
  - Find customer by email using Shopify Admin API
  - Find customer by phone using Shopify Admin API
  - Create new customer with provided data
  - Update customer metafields (auth_method, phone_verified, last_login)
  - Handle Shopify API errors with retry logic
  - _Requirements: 1.5, 2.2, 2.4, 3.4, 3.5_

- [x] 4.10 Write property test for customer creation
  - **Property 4: Customer creation or retrieval**
  - **Validates: Requirements 1.5**

- [x] 5. Implement AuthService orchestration
- [x] 5.1 Implement phone authentication flow
  - Validate phone number format (E.164)
  - Generate and store OTP
  - Queue SMS sending job
  - Verify OTP and find/create customer
  - Generate Multipass token
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5.2 Write property tests for phone authentication
  - **Property 1: Phone number validation consistency**
  - **Validates: Requirements 1.1**

- [x] 5.3 Implement email/password authentication flow
  - Validate email format
  - Find customer in Shopify
  - Verify password with bcrypt
  - Create new customer if not exists (with hashed password)
  - Generate Multipass token
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5.4 Write property tests for email authentication
  - **Property 5: Email validation consistency**
  - **Property 6: Password hashing security**
  - **Validates: Requirements 2.1, 9.3**

- [x] 5.5 Implement OAuth authentication flow
  - Generate OAuth authorization URL
  - Handle OAuth callback
  - Exchange code for tokens
  - Fetch user profile
  - Normalize profile data
  - Find/create customer in Shopify
  - Generate Multipass token
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.6 Write property test for OAuth authorization URL
  - **Property 9: OAuth authorization URL format**
  - **Validates: Requirements 3.1**

- [x] 6. Implement rate limiting and security
- [x] 6.1 Implement rate limiting middleware
  - Track requests per IP in Redis with 1-minute TTL
  - Block requests after 10 requests per minute
  - Return 429 status with retry-after header
  - _Requirements: 6.3_

- [x] 6.2 Write property test for IP rate limiting
  - **Property 16: IP rate limiting**
  - **Validates: Requirements 6.3**

- [x] 6.3 Implement OTP resend rate limiting
  - Check last send time in Redis
  - Reject if less than 30 seconds since last send
  - Track send attempts (3 per 10 minutes)
  - Block phone after 3 attempts for 10 minutes
  - _Requirements: 5.4, 5.5_

- [x] 6.4 Write property tests for OTP rate limiting
  - **Property 12: Rate limiting for resend**
  - **Property 13: Send attempt blocking**
  - **Validates: Requirements 5.4, 5.5**

- [x] 6.5 Implement HMAC validation middleware
  - Validate HMAC signature for Shopify requests
  - Reject requests with invalid signatures
  - _Requirements: 11.5_

- [x] 6.6 Write property test for HMAC validation
  - **Property 26: HMAC validation**
  - **Validates: Requirements 11.5**

- [x] 7. Implement Bull queue for SMS processing
- [x] 7.1 Set up Bull queue with Redis
  - Create SMS queue with Redis connection
  - Configure queue options (attempts, backoff)
  - _Requirements: 10.1_

- [x] 7.2 Implement SMS job processor
  - Process SMS jobs from queue
  - Call SMSService to send SMS
  - Implement retry logic with exponential backoff (3 attempts)
  - Move failed jobs to failed queue after all attempts
  - _Requirements: 10.3, 10.4, 10.5_

- [x] 7.3 Write property tests for queue processing
  - **Property 23: Queue job creation**
  - **Property 24: SMS retry with exponential backoff**
  - **Property 25: Failed job handling**
  - **Validates: Requirements 10.1, 10.2, 10.4, 10.5**

- [x] 8. Implement API routes
- [x] 8.1 Implement POST /api/auth/send-otp
  - Validate phone number
  - Check rate limits
  - Generate OTP
  - Queue SMS job
  - Return success response immediately
  - _Requirements: 1.1, 1.2, 1.3, 5.4, 5.5_

- [x] 8.2 Implement POST /api/auth/verify-otp
  - Validate OTP format
  - Verify OTP with OTPService
  - Find/create customer
  - Generate Multipass token
  - Return Multipass URL
  - _Requirements: 1.4, 1.5, 4.1, 4.3_

- [x] 8.3 Implement POST /api/auth/email-login
  - Validate email and password
  - Authenticate with CustomerService
  - Generate Multipass token
  - Return Multipass URL
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8.4 Implement GET /api/auth/oauth/:provider
  - Get OAuth provider
  - Generate authorization URL
  - Return redirect to OAuth provider
  - _Requirements: 3.1_

- [x] 8.5 Implement POST /api/auth/oauth/:provider/callback
  - Get OAuth provider
  - Exchange code for tokens
  - Fetch user profile
  - Find/create customer
  - Generate Multipass token
  - Return Multipass URL
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 8.6 Implement POST /api/auth/session/restore
  - Validate session data from localStorage/cookies
  - Restore session via Multipass
  - Return Multipass URL
  - _Requirements: 15.3_

- [x] 8.7 Write property test for session restoration
  - **Property 33: Session restoration from storage**
  - **Validates: Requirements 15.3**

- [x] 8.8 Implement POST /api/webhooks/sms-dlr
  - Parse DLR webhook from SMS provider
  - Update delivery status in Redis
  - Log delivery status
  - _Requirements: 5.2_

- [x] 8.9 Write property test for DLR webhook handling
  - **Property 11: SMS delivery tracking**
  - **Validates: Requirements 5.1**

- [x] 9. Implement error handling and logging
- [x] 9.1 Create error classes
  - ValidationError (400)
  - AuthenticationError (401)
  - RateLimitError (429)
  - ExternalServiceError (502/503)
  - InternalError (500)
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 9.2 Implement global error handler middleware
  - Catch all errors
  - Log error details with request ID
  - Return appropriate error response
  - Send alerts for critical errors
  - Sanitize error messages for external service errors
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 9.3 Write property tests for error handling
  - **Property 18: Error message safety**
  - **Property 19: Validation error specificity**
  - **Validates: Requirements 7.2, 7.3**

- [x] 9.4 Implement request logging middleware
  - Generate request ID
  - Log request start with method, path, IP
  - Log request completion with status, duration, auth method
  - _Requirements: 7.5_

- [x] 9.5 Write property test for request logging
  - **Property 20: Request logging completeness**
  - **Validates: Requirements 7.5**

- [x] 10. Implement order confirmation feature
- [x] 10.1 Implement order OTP generation
  - Generate unique OTP for order
  - Store OTP with order ID in Redis (10 min TTL)
  - Queue SMS with order number
  - _Requirements: 8.1, 8.2_

- [x] 10.2 Write property test for order OTP
  - **Property 21: Order OTP uniqueness**
  - **Validates: Requirements 8.1**

- [x] 10.3 Implement order OTP verification
  - Verify OTP matches order ID
  - Update order status in Shopify
  - Delete OTP after use
  - _Requirements: 8.3, 8.4_

- [x] 10.4 Write property test for order OTP verification
  - **Property 22: Order OTP verification**
  - **Validates: Requirements 8.3**

- [x] 10.5 Implement Shopify order webhook handler
  - Listen for orders/create webhook
  - Trigger OTP generation for orders requiring confirmation
  - _Requirements: 8.1_

- [x] 11. Checkpoint - Backend implementation complete
  - All backend services, routes, and tests are implemented
  - Core authentication flows (SMS, email, OAuth) are working
  - Order confirmation feature is implemented
  - All property-based tests are passing

- [ ] 12. Create admin UI for app configuration
- [ ] 12.1 Set up React admin panel with Shopify Polaris
  - Initialize React app in `admin/` directory
  - Install @shopify/polaris and @shopify/app-bridge-react
  - Create admin page component with Shopify App Bridge
  - Set up routing and navigation
  - _Requirements: 12.1_

- [ ] 12.2 Implement settings form UI
  - Create form for enabling/disabling auth methods (SMS, email, Google)
  - Add color picker for form customization (primary color, button style)
  - Add logo upload field with preview
  - Add save button with loading state
  - _Requirements: 12.1, 12.4, 14.5_

- [ ] 12.3 Implement settings API endpoints
  - Create GET /api/admin/settings endpoint to fetch settings from shop metafields
  - Create PUT /api/admin/settings endpoint to save settings to shop metafields
  - Add validation for settings data
  - _Requirements: 12.2_

- [ ] 12.4 Write property tests for settings persistence
  - **Property 27: Settings persistence**
  - **Property 28: Dynamic auth method availability**
  - **Validates: Requirements 12.2, 12.4**

- [ ] 12.5 Implement real-time settings updates
  - Use Shopify App Bridge to detect settings changes
  - Update admin UI without page reload when settings change
  - Show success/error notifications
  - _Requirements: 12.5_

- [ ] 13. Create storefront App Extension
- [ ] 13.1 Initialize App Extension
  - Run `npm run shopify app generate extension` to create checkout UI extension
  - Configure extension in shopify.app.toml
  - Set up extension build process
  - _Requirements: 11.4_

- [ ] 13.2 Implement login form component
  - Create form with phone input, email/password inputs, and OAuth buttons
  - Fetch enabled auth methods from settings API
  - Apply custom styles (colors, logo) from settings
  - Handle form submission and validation
  - _Requirements: 12.3, 12.4_

- [ ] 13.3 Implement checkout interceptor
  - Listen for checkout button click event
  - Check authentication status before allowing checkout
  - Show login form modal if user is not authenticated
  - Check localStorage/cookies for existing session data
  - _Requirements: 15.1, 15.2_

- [ ] 13.4 Implement session persistence in extension
  - Save session data to localStorage after successful authentication
  - Set secure cookies with session token
  - Implement session expiration (30 days)
  - Auto-restore session on page load
  - _Requirements: 15.2, 15.3_

- [ ] 13.5 Implement post-auth redirect flow
  - Redirect to checkout after successful authentication
  - Preserve cart contents during auth flow
  - Pass return_to URL to Multipass for proper redirect
  - Handle edge cases (empty cart, expired cart)
  - _Requirements: 15.5_

- [ ] 13.6 Write property test for checkout redirect
  - **Property 34: Post-auth checkout redirect**
  - **Validates: Requirements 15.5**

- [ ] 14. Checkpoint - Frontend implementation complete
  - Ensure all tests pass, ask the user if questions arise
  - Admin UI is functional and can save/load settings
  - Storefront extension displays login form correctly
  - Checkout interception works properly

- [ ] 15. Add secondary SMS provider support
- [ ] 15.1 Implement TwilioProvider
  - Create TwilioProvider class implementing ISMSProvider
  - Implement sendSMS method using Twilio API
  - Implement checkDeliveryStatus method
  - Implement handleWebhook for Twilio DLR format
  - Configure as secondary provider with priority 2
  - _Requirements: 13.4_

- [ ] 15.2 Update SMSService configuration
  - Load multiple providers from environment config
  - Test fallback mechanism with both sms.to and Twilio
  - Verify provider rotation works correctly
  - _Requirements: 13.1, 13.2_

- [ ] 16. Integration testing
- [ ] 16.1 Write integration tests for full auth flows
  - Test SMS authentication end-to-end (send OTP → verify → Multipass redirect)
  - Test email authentication end-to-end (login → verify → Multipass redirect)
  - Test OAuth authentication end-to-end (initiate → callback → Multipass redirect)
  - Test SMS provider fallback (primary fails → secondary succeeds)
  - Test rate limiting across multiple requests
  - Test order confirmation flow (webhook → OTP → verify → status update)

- [ ] 16.2 Write integration tests for admin UI
  - Test settings save and load workflow
  - Test settings changes reflected on storefront
  - Test enabling/disabling auth methods

- [ ] 17. Documentation and deployment preparation
- [ ] 17.1 Write API documentation
  - Document all API endpoints with request/response examples
  - Document authentication requirements
  - Document error codes and messages
  - Create Postman/OpenAPI collection

- [ ] 17.2 Write deployment guide
  - Document all environment variables with descriptions
  - Document infrastructure requirements (Redis, Node.js version)
  - Document deployment steps for production
  - Document monitoring and logging setup

- [ ] 17.3 Write user guide
  - Document app installation process for merchants
  - Document admin configuration steps with screenshots
  - Document customer authentication experience
  - Create troubleshooting guide

- [ ] 18. Final checkpoint - Production readiness
  - Ensure all tests pass (unit, property-based, integration)
  - Verify all documentation is complete
  - Confirm all environment variables are documented
  - Review security considerations
