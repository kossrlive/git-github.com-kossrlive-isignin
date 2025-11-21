# Implementation Plan

- [x] 1. Initialize Modern Shopify App with React Router
  - Run `npm init @shopify/app@latest` with React Router template
  - Select Polaris web components for UI
  - Select GraphQL for API
  - Select Prisma for database
  - Configure app name and basic settings
  - _Requirements: 1.1, 1.2_

- [x] 2. Set up Prisma database schema and migrations
  - Create Prisma schema with Shop, ShopSettings, and Analytics models
  - Configure database connection (PostgreSQL or SQLite)
  - Run initial migration
  - Set up Prisma client
  - _Requirements: 2.5_

- [x] 3. Migrate existing backend services to new app structure
  - [x] 3.1 Copy existing service files to app/services/
    - Copy SMSService, OTPService, MultipassService
    - Copy AuthService, CustomerService, OrderService, SettingsService
    - _Requirements: 18.1, 18.2_
  
  - [x] 3.2 Copy existing provider files to app/providers/
    - Copy SmsToProvider, TwilioProvider, GoogleOAuthProvider
    - Copy provider interfaces (ISMSProvider, IOAuthProvider)
    - _Requirements: 18.2_
  
  - [x] 3.3 Update services to work with React Router and Prisma
    - Update SettingsService to use Prisma instead of direct database calls
    - Update MultipassService to accept shop parameter
    - Ensure all services export properly for React Router
    - _Requirements: 18.3_
  
  - [x] 3.4 Set up Redis connection for existing services
    - Configure Redis client in app/lib/redis.server.ts
    - Ensure OTPService and rate limiting use the same Redis instance
    - _Requirements: 18.4_
  
  - [x] 3.5 Set up Bull queue for SMS jobs
    - Configure Bull queue in app/lib/queue.server.ts
    - Ensure SMSService uses the queue for sending SMS
    - _Requirements: 18.5_

- [x] 4. Create admin UI routes and components
  - [x] 4.1 Create admin dashboard route (app/routes/app._index.tsx)
    - Display welcome message and quick stats
    - Show authentication method usage
    - Display SMS delivery rate
    - _Requirements: 2.1, 16.3_
  
  - [x] 4.2 Create settings page route (app/routes/app.settings.tsx)
    - Create settings form with Polaris components
    - Load current settings from Prisma
    - Handle form submission
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 4.3 Create SMS provider configuration component
    - Input fields for sms.to API key and sender ID
    - Input fields for Twilio credentials
    - Provider selection (primary/secondary)
    - Test connection button
    - _Requirements: 2.2, 2.6_
  
  - [x] 4.4 Create OAuth provider configuration component
    - Input fields for Google OAuth credentials
    - Input fields for Apple OAuth credentials
    - Input fields for Facebook OAuth credentials
    - Enable/disable toggles for each provider
    - _Requirements: 2.3, 2.6_
  
  - [x] 4.5 Create UI customization component
    - Color picker for primary color
    - Button style selector (rounded/square)
    - Logo upload field
    - Preview of login form with custom styling
    - _Requirements: 2.4_
  
  - [x] 4.6 Create analytics dashboard component
    - Chart showing authentication methods used
    - Chart showing success/failure rates
    - SMS delivery statistics
    - Recent authentication attempts table
    - _Requirements: 16.3_


- [x] 5. Create authentication API routes
  - [x] 5.1 Create SMS send OTP route (app/routes/api.auth.sms.send.ts)
    - Validate phone number format
    - Check rate limits
    - Generate OTP using OTPService
    - Send SMS using SMSService
    - Return success/error response
    - _Requirements: 5.1, 5.2, 5.3, 5.8_
  
  - [ ]* 5.2 Write property test for SMS send OTP
    - **Property 2: Phone Number Validation Consistency**
    - **Property 3: OTP Generation Format**
    - **Property 4: SMS Queueing Guarantee**
    - **Property 9: OTP Cooldown Enforcement**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.8**
  
  - [x] 5.3 Create SMS verify OTP route (app/routes/api.auth.sms.verify.ts)
    - Validate OTP format
    - Verify OTP using OTPService
    - Check if OTP is expired
    - Generate Multipass token on success
    - Return Multipass URL
    - _Requirements: 5.5, 5.6, 5.7_
  
  - [ ]* 5.4 Write property test for SMS verify OTP
    - **Property 6: OTP Verification Correctness**
    - **Property 7: Successful OTP Creates Multipass Token**
    - **Property 8: OTP Expiration Enforcement**
    - **Validates: Requirements 5.5, 5.6, 5.7**
  
  - [x] 5.5 Create email login route (app/routes/api.auth.email.login.ts)
    - Validate email and password are non-empty
    - Check if customer exists using GraphQL
    - Verify password using bcrypt
    - Check for account blocking
    - Generate Multipass token on success
    - Return Multipass URL
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 5.6 Write property test for email login
    - **Property 10: Empty Field Validation**
    - **Property 11: Customer Existence Check**
    - **Property 12: Password Verification Using Bcrypt**
    - **Property 13: Successful Email Auth Creates Multipass Token**
    - **Property 14: Authentication Error Message Ambiguity**
    - **Property 15: Account Blocking After Failed Attempts**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
  
  - [x] 5.7 Create OAuth initiation route (app/routes/api.auth.oauth.$provider.ts)
    - Get OAuth provider from URL params
    - Generate state token
    - Get OAuth authorization URL from provider
    - Redirect to OAuth provider
    - _Requirements: 7.1_
  
  - [x] 5.8 Create OAuth callback route (app/routes/api.auth.oauth.$provider.callback.ts)
    - Validate state token
    - Exchange authorization code for access token
    - Fetch user info from OAuth provider
    - Find or create Shopify customer
    - Generate Multipass token
    - Redirect to Multipass URL
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ]* 5.9 Write property test for OAuth authentication
    - **Property 16: OAuth Customer Find or Create**
    - **Property 17: OAuth Success Creates Multipass Token**
    - **Validates: Requirements 7.5, 7.6**

- [x] 6. Implement Multipass token generation
  - [x] 6.1 Update MultipassService for multi-shop support
    - Accept shop parameter in all methods
    - Fetch Multipass secret from shop settings
    - Generate token with customer data
    - Encrypt token using AES-256-CBC
    - Format Multipass URL
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 6.2 Write property test for Multipass token generation
    - **Property 18: Multipass Token Contains Customer Email**
    - **Property 19: Multipass Token Encryption**
    - **Property 20: Multipass Token Includes Metadata**
    - **Property 21: Multipass URL Format**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 7. Implement rate limiting and security
  - [x] 7.1 Create rate limiting middleware
    - Check request count per IP in Redis
    - Increment counter on each request
    - Return 429 if limit exceeded
    - Set TTL on rate limit keys
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 7.2 Write property test for rate limiting
    - **Property 22: Rate Limiting Per IP**
    - **Property 23: Rate Limit Response Code**
    - **Validates: Requirements 9.1, 9.2**
  
  - [x] 7.3 Implement OTP storage with expiration
    - Store OTP in Redis with phone number as key
    - Set TTL to 5 minutes (300 seconds)
    - Include metadata (attempts, created timestamp)
    - _Requirements: 9.3_
  
  - [ ]* 7.4 Write property test for OTP storage
    - **Property 24: OTP Storage With Expiration**
    - **Validates: Requirements 9.3**
  
  - [x] 7.5 Implement sensitive data masking in logs
    - Create logging utility that masks phone numbers
    - Mask email addresses in logs
    - Apply masking to all log statements
    - _Requirements: 9.4_
  
  - [ ]* 7.6 Write property test for data masking
    - **Property 25: Sensitive Data Masking in Logs**
    - **Validates: Requirements 9.4**
  
  - [x] 7.7 Implement webhook HMAC validation
    - Create middleware to validate HMAC signatures
    - Use app client secret for validation
    - Reject requests with invalid signatures
    - _Requirements: 9.5_
  
  - [ ]* 7.8 Write property test for HMAC validation
    - **Property 26: Webhook HMAC Validation**
    - **Validates: Requirements 9.5**

- [ ] 8. Implement SMS provider failover
  - [x] 8.1 Update SMSService with failover logic
    - Always try primary provider first
    - On failure, automatically try secondary provider
    - Log errors from both providers if both fail
    - Track which provider was used for analytics
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ]* 8.2 Write property test for SMS failover
    - **Property 5: SMS Provider Failover**
    - **Property 27: Primary Provider First Attempt**
    - **Property 28: Error Logging on Complete Failure**
    - **Validates: Requirements 5.4, 10.1, 10.2, 10.3**
  
  - [x] 8.3 Implement SMS job retry with exponential backoff
    - Configure Bull queue with retry settings
    - Set retry attempts to 3
    - Use exponential backoff (1s, 2s, 4s)
    - _Requirements: 10.5_
  
  - [ ]* 8.4 Write property test for SMS retry
    - **Property 29: SMS Job Retry With Exponential Backoff**
    - **Validates: Requirements 10.5**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 10. Create theme app extension for login form
  - [ ] 10.1 Initialize theme extension
    - Run `shopify app generate extension` and select "Theme app extension"
    - Name it "customer-login"
    - _Requirements: 3.1, 12.1_
  
  - [ ] 10.2 Create login form Liquid block
    - Create block schema with settings (show_sms, show_email, show_oauth)
    - Render login form HTML structure
    - Include phone number input for SMS
    - Include email/password inputs for email auth
    - Include OAuth provider buttons
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 10.3 Create login form JavaScript
    - Implement SMS authentication flow (send OTP, verify OTP)
    - Implement email authentication flow
    - Implement OAuth authentication flow
    - Handle API responses and errors
    - Show loading states
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 10.4 Create login form CSS with customization support
    - Apply merchant's custom primary color
    - Apply merchant's button style (rounded/square)
    - Display merchant's logo
    - Ensure responsive design
    - _Requirements: 3.6_
  
  - [ ] 10.5 Add instructions in admin panel for enabling extension
    - Display step-by-step instructions
    - Link to theme editor
    - Show preview of login form
    - _Requirements: 12.2, 12.4, 12.5_

- [ ] 11. Create checkout UI extension for authentication modal
  - [ ] 11.1 Initialize checkout UI extension
    - Run `shopify app generate extension` and select "Checkout UI extension"
    - Name it "checkout-auth"
    - _Requirements: 4.1_
  
  - [ ] 11.2 Create authentication modal component
    - Check if customer is authenticated
    - Display modal if not authenticated
    - Show SMS, Email, and OAuth options
    - Handle authentication completion
    - Allow dismissal for guest checkout
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 11.3 Implement authentication flows in checkout extension
    - Implement SMS authentication (send OTP, verify OTP)
    - Implement email authentication
    - Implement OAuth authentication
    - Close modal on success and continue checkout
    - _Requirements: 4.3_
  
  - [ ] 11.4 Style checkout extension to match theme
    - Use Shopify Checkout UI components
    - Apply merchant's custom styling
    - Ensure accessibility
    - _Requirements: 4.2_

- [ ] 12. Implement session management
  - [ ] 12.1 Create session service
    - Generate session tokens
    - Store sessions in Redis with 24-hour TTL
    - Validate session tokens
    - Invalidate sessions on logout
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ]* 12.2 Write property test for session management
    - **Property 30: Session Creation on Authentication**
    - **Property 31: Session Expiration Time**
    - **Property 32: Session Token Validation**
    - **Property 33: Expired Session Requires Re-authentication**
    - **Property 34: Logout Invalidates Session**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

- [ ] 13. Implement order confirmation SMS
  - [ ] 13.1 Create order webhook route (app/routes/webhooks.orders.create.ts)
    - Validate webhook HMAC
    - Extract customer phone and order details
    - Format order confirmation message
    - Queue SMS job
    - Log delivery status
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ]* 13.2 Write property test for order confirmation
    - **Property 35: Order Webhook Data Extraction**
    - **Property 36: Order Confirmation Message Formatting**
    - **Property 37: Order Confirmation SMS Queueing**
    - **Property 38: SMS Delivery Status Logging**
    - **Validates: Requirements 14.2, 14.3, 14.4, 14.5**
  
  - [ ] 13.3 Register order webhook in Shopify
    - Configure webhook subscription in app setup
    - Set webhook URL to /webhooks/orders/create
    - Test webhook delivery
    - _Requirements: 14.1_

- [ ] 14. Implement error handling and user feedback
  - [ ] 14.1 Create error response utility
    - Format error responses consistently
    - Include error codes and messages
    - Add request IDs for tracing
    - Never expose stack traces to users
    - _Requirements: 15.1_
  
  - [ ]* 14.2 Write property test for error messages
    - **Property 39: User-Friendly Error Messages**
    - **Validates: Requirements 15.1**
  
  - [ ] 14.3 Add specific error messages for common scenarios
    - "Invalid code. Please try again." for invalid OTP
    - "Code expired. Request a new one." for expired OTP
    - "Too many attempts. Please try again later." for rate limits
    - "Unable to send SMS. Please try another method." for SMS failures
    - _Requirements: 15.2, 15.3, 15.4, 15.5_

- [ ] 15. Implement analytics tracking
  - [ ] 15.1 Create analytics service
    - Track authentication method used
    - Track success/failure rates
    - Track SMS delivery rates
    - Store analytics in Prisma database
    - _Requirements: 16.1, 16.2, 16.4_
  
  - [ ]* 15.2 Write property test for analytics tracking
    - **Property 40: Authentication Method Tracking**
    - **Property 41: Authentication Success/Failure Rate Tracking**
    - **Property 42: SMS Delivery Rate Tracking**
    - **Validates: Requirements 16.1, 16.2, 16.4**
  
  - [ ] 15.3 Implement error logging with severity levels
    - Log errors with appropriate severity (info, warn, error, critical)
    - Include context and metadata
    - Mask sensitive data in logs
    - _Requirements: 16.5_
  
  - [ ]* 15.4 Write property test for error logging
    - **Property 43: Error Logging With Severity**
    - **Validates: Requirements 16.5**

- [ ] 16. Implement multi-language support
  - [ ] 16.1 Create localization utility
    - Detect browser language
    - Load translations for supported languages (en, es, fr, de)
    - Default to English for unsupported languages
    - _Requirements: 17.1, 17.2, 17.3_
  
  - [ ]* 16.2 Write property test for localization
    - **Property 44: Language-Based UI Text**
    - **Property 45: Unsupported Language Defaults to English**
    - **Validates: Requirements 17.2, 17.3**
  
  - [ ] 16.3 Add translations for UI text
    - Translate login form labels and buttons
    - Translate error messages
    - Translate SMS message templates
    - _Requirements: 17.2, 17.4_
  
  - [ ]* 16.4 Write property test for SMS localization
    - **Property 46: SMS Message Localization**
    - **Validates: Requirements 17.4**
  
  - [ ] 16.5 Add translation configuration in admin panel
    - Allow merchants to customize text for each language
    - Provide default translations
    - _Requirements: 17.5_

- [ ] 17. Create app installation and onboarding flow
  - [ ] 17.1 Create onboarding wizard route (app/routes/app.onboarding.tsx)
    - Welcome screen with app overview
    - SMS provider setup step
    - OAuth provider setup step (optional)
    - UI customization step
    - Completion screen with next steps
    - _Requirements: 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 17.2 Implement SMS provider connection test
    - Send test SMS to merchant's phone
    - Display success/failure message
    - Allow retry with different credentials
    - _Requirements: 11.4_
  
  - [ ] 17.3 Add OAuth installation flow
    - Handle OAuth authorization on app install
    - Request appropriate API scopes
    - Store access token in database
    - _Requirements: 11.1, 1.5_

- [ ] 18. Write unit tests for services
  - [ ]* 18.1 Write unit tests for SMSService
    - Test send methods
    - Test provider selection
    - Test error handling
  
  - [ ]* 18.2 Write unit tests for OTPService
    - Test OTP generation
    - Test OTP verification
    - Test expiration handling
  
  - [ ]* 18.3 Write unit tests for MultipassService
    - Test token generation
    - Test encryption
    - Test URL formatting
  
  - [ ]* 18.4 Write unit tests for AuthService
    - Test SMS authentication flow
    - Test email authentication flow
    - Test OAuth authentication flow
  
  - [ ]* 18.5 Write unit tests for CustomerService
    - Test customer lookup
    - Test customer creation
    - Test GraphQL queries

- [ ] 19. Write unit tests for API routes
  - [ ]* 19.1 Write unit tests for SMS authentication routes
    - Test send OTP endpoint
    - Test verify OTP endpoint
    - Test rate limiting
    - Test error responses
  
  - [ ]* 19.2 Write unit tests for email authentication route
    - Test successful login
    - Test failed login
    - Test account blocking
    - Test error responses
  
  - [ ]* 19.3 Write unit tests for OAuth routes
    - Test OAuth initiation
    - Test OAuth callback
    - Test error handling

- [ ] 20. Write unit tests for UI components
  - [ ]* 20.1 Write unit tests for SettingsForm component
    - Test rendering
    - Test form submission
    - Test validation
  
  - [ ]* 20.2 Write unit tests for analytics dashboard
    - Test data display
    - Test chart rendering
  
  - [ ]* 20.3 Write unit tests for provider configuration components
    - Test SMS provider config
    - Test OAuth provider config
    - Test connection testing

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Deploy and test in development store
  - Deploy app to hosting platform
  - Install app in Shopify Plus development store
  - Test complete authentication flows
  - Test theme extension
  - Test checkout extension
  - Test order confirmation SMS
  - Verify analytics tracking
