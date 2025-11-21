# Requirements Document

## Introduction

This document outlines the requirements for a modern Shopify app that provides seamless multi-channel authentication (SMS, Email, Google OAuth) for customers at checkout. The app will be built using the Shopify CLI (`npm init @shopify/app@latest`) with proper app extensions, embedded admin UI, and checkout UI extensions for Hydrogen/Liquid themes.

**Note:** This project will migrate and reuse existing backend services that have already been implemented:
- SMSService with SmsToProvider and TwilioProvider
- OTPService for OTP generation and verification
- MultipassService for Shopify authentication
- GoogleOAuthProvider for OAuth integration
- AuthService, CustomerService, OrderService, and SettingsService

The focus will be on creating the proper Shopify app structure, embedded admin UI, and theme/checkout extensions while integrating these existing services.

## Glossary

- **Shopify App**: A modern Shopify application built using Shopify CLI with proper OAuth and embedded app architecture
- **Checkout UI Extension**: A Shopify extension that renders custom UI components in the checkout flow
- **App Embed**: A theme extension that can be enabled/disabled in the theme editor
- **Multipass**: Shopify Plus feature for seamless SSO authentication
- **OTP**: One-Time Password sent via SMS for authentication
- **Admin Embedded UI**: React-based admin interface embedded within Shopify Admin using App Bridge
- **SMS Provider**: External service (sms.to or Twilio) for sending SMS messages
- **OAuth Provider**: Third-party authentication service (Google, Apple, Facebook)

## Requirements

### Requirement 1: Modern Shopify App Architecture with Service Migration

**User Story:** As a developer, I want to build a proper Shopify app using modern architecture while reusing existing backend services, so that it follows Shopify's best practices without duplicating work.

#### Acceptance Criteria

1. WHEN the app is initialized THEN the system SHALL use `npm init @shopify/app@latest` with Remix app template
2. WHEN the app is configured THEN the system SHALL use proper OAuth flow with Shopify App Bridge
3. WHEN the app is deployed THEN the system SHALL be installable from Shopify App Store or custom installation URL
4. WHERE the app requires admin configuration THEN the system SHALL provide an embedded admin UI using Shopify Polaris and App Bridge
5. WHEN merchants install the app THEN the system SHALL request appropriate API scopes (read_customers, write_customers, read_orders, write_orders)
6. WHEN migrating existing code THEN the system SHALL reuse existing services (SMSService, OTPService, MultipassService, GoogleOAuthProvider, etc.)
7. WHEN integrating existing services THEN the system SHALL adapt them to work with the new Remix app structure

### Requirement 2: Embedded Admin Configuration Panel

**User Story:** As a merchant, I want to configure authentication settings from within my Shopify Admin, so that I can easily manage the app without leaving Shopify.

#### Acceptance Criteria

1. WHEN a merchant clicks the app in Shopify Admin THEN the system SHALL display an embedded configuration interface
2. WHEN configuring SMS providers THEN the system SHALL allow input of API credentials for sms.to and Twilio
3. WHEN configuring OAuth providers THEN the system SHALL allow input of Google, Apple, and Facebook OAuth credentials
4. WHEN configuring UI customization THEN the system SHALL allow selection of colors, button styles, and logo upload
5. WHEN saving configuration THEN the system SHALL persist settings to app metafields or database
6. WHEN viewing configuration status THEN the system SHALL display connection status for each provider (connected/disconnected)

### Requirement 3: Theme App Extension for Login UI

**User Story:** As a merchant, I want to enable a login form in my theme, so that customers can authenticate before accessing restricted content.

#### Acceptance Criteria

1. WHEN the app is installed THEN the system SHALL create a theme app extension that can be enabled in the theme editor
2. WHEN the extension is enabled THEN the system SHALL render a login form with SMS, Email, and OAuth options
3. WHEN a customer selects SMS login THEN the system SHALL display a phone number input field
4. WHEN a customer selects Email login THEN the system SHALL display email and password input fields
5. WHEN a customer selects OAuth login THEN the system SHALL display buttons for Google, Apple, and Facebook
6. WHEN the login form is rendered THEN the system SHALL apply merchant's custom styling (colors, logo, button style)

### Requirement 4: Checkout UI Extension for Authentication

**User Story:** As a customer, I want to authenticate at checkout if I'm not logged in, so that I can complete my purchase with my account benefits.

#### Acceptance Criteria

1. WHEN a customer reaches checkout while not authenticated THEN the system SHALL display an authentication modal
2. WHEN the authentication modal is displayed THEN the system SHALL show SMS, Email, and OAuth login options
3. WHEN a customer completes authentication THEN the system SHALL close the modal and continue checkout with authenticated session
4. WHEN a customer dismisses the modal THEN the system SHALL allow guest checkout to proceed
5. WHEN checkout is on a Hydrogen storefront THEN the system SHALL render the authentication UI using Checkout UI Extension API

### Requirement 5: SMS OTP Authentication Flow

**User Story:** As a customer, I want to log in using my phone number and SMS code, so that I can authenticate without remembering a password.

#### Acceptance Criteria

1. WHEN a customer enters a phone number THEN the system SHALL validate the phone number format
2. WHEN a valid phone number is submitted THEN the system SHALL generate a 6-digit OTP code
3. WHEN an OTP is generated THEN the system SHALL send it via SMS using the configured provider (sms.to or Twilio)
4. WHEN an SMS fails to send THEN the system SHALL automatically retry with the fallback provider
5. WHEN a customer enters the OTP THEN the system SHALL verify it matches the generated code
6. WHEN OTP verification succeeds THEN the system SHALL create a Multipass token and authenticate the customer
7. WHEN an OTP expires (5 minutes) THEN the system SHALL reject the code and require a new one
8. WHEN a customer requests a new code THEN the system SHALL enforce a 30-second cooldown period

### Requirement 6: Email/Password Authentication Flow

**User Story:** As a customer, I want to log in using my email and password, so that I can use traditional authentication if I prefer.

#### Acceptance Criteria

1. WHEN a customer enters email and password THEN the system SHALL validate both fields are non-empty
2. WHEN credentials are submitted THEN the system SHALL verify the email exists in Shopify customers
3. WHEN the email exists THEN the system SHALL verify the password hash matches using bcrypt
4. WHEN authentication succeeds THEN the system SHALL create a Multipass token and authenticate the customer
5. WHEN authentication fails THEN the system SHALL display an error message without revealing which field was incorrect
6. WHEN a customer fails authentication 5 times THEN the system SHALL temporarily block the account for 15 minutes

### Requirement 7: OAuth Authentication Flow

**User Story:** As a customer, I want to log in using my Google, Apple, or Facebook account, so that I can authenticate quickly without creating a new password.

#### Acceptance Criteria

1. WHEN a customer clicks an OAuth provider button THEN the system SHALL redirect to the provider's OAuth consent screen
2. WHEN OAuth consent is granted THEN the system SHALL receive an authorization code from the provider
3. WHEN an authorization code is received THEN the system SHALL exchange it for an access token
4. WHEN an access token is obtained THEN the system SHALL fetch the customer's email from the provider
5. WHEN the email is retrieved THEN the system SHALL find or create a Shopify customer with that email
6. WHEN the customer is found or created THEN the system SHALL create a Multipass token and authenticate the customer
7. WHEN OAuth flow fails THEN the system SHALL display an error message and allow the customer to try another method

### Requirement 8: Multipass Token Generation and Authentication

**User Story:** As the system, I want to generate secure Multipass tokens, so that customers can be seamlessly authenticated into Shopify.

#### Acceptance Criteria

1. WHEN a customer successfully authenticates THEN the system SHALL generate a Multipass token with customer email
2. WHEN generating a Multipass token THEN the system SHALL encrypt it using the merchant's Multipass secret
3. WHEN a Multipass token is generated THEN the system SHALL include customer metadata (name, phone, tags)
4. WHEN a Multipass token is created THEN the system SHALL redirect the customer to the Shopify Multipass URL
5. WHEN Shopify receives the Multipass token THEN the system SHALL decrypt and authenticate the customer automatically

### Requirement 9: Rate Limiting and Security

**User Story:** As a system administrator, I want to prevent abuse of authentication endpoints, so that the system remains secure and available.

#### Acceptance Criteria

1. WHEN authentication requests are received THEN the system SHALL enforce rate limits per IP address
2. WHEN rate limits are exceeded THEN the system SHALL return a 429 Too Many Requests error
3. WHEN OTP codes are generated THEN the system SHALL store them with expiration timestamps in Redis
4. WHEN customer data is logged THEN the system SHALL mask sensitive information (phone numbers, emails)
5. WHEN API requests are made THEN the system SHALL validate HMAC signatures for webhook requests

### Requirement 10: SMS Provider Failover and Queue Management

**User Story:** As a system administrator, I want automatic failover between SMS providers, so that SMS delivery is reliable even if one provider fails.

#### Acceptance Criteria

1. WHEN an SMS send request is made THEN the system SHALL attempt to send via the primary provider (sms.to)
2. WHEN the primary provider fails THEN the system SHALL automatically retry with the secondary provider (Twilio)
3. WHEN both providers fail THEN the system SHALL log the error and notify the merchant
4. WHEN SMS jobs are queued THEN the system SHALL use Bull queue with Redis for job management
5. WHEN SMS jobs fail THEN the system SHALL retry up to 3 times with exponential backoff

### Requirement 11: App Installation and Onboarding

**User Story:** As a merchant, I want a smooth installation and setup process, so that I can start using the app quickly.

#### Acceptance Criteria

1. WHEN a merchant installs the app THEN the system SHALL complete OAuth authorization flow
2. WHEN installation is complete THEN the system SHALL redirect to an onboarding wizard
3. WHEN the onboarding wizard is displayed THEN the system SHALL guide the merchant through SMS provider setup
4. WHEN SMS provider is configured THEN the system SHALL test the connection and display success/failure
5. WHEN onboarding is complete THEN the system SHALL display instructions for enabling the theme extension

### Requirement 12: Theme Extension Enablement

**User Story:** As a merchant, I want clear instructions for enabling the login form in my theme, so that customers can see the authentication UI.

#### Acceptance Criteria

1. WHEN the app is installed THEN the system SHALL automatically create a theme app extension
2. WHEN viewing the admin panel THEN the system SHALL display instructions for enabling the extension in the theme editor
3. WHEN the merchant navigates to theme editor THEN the system SHALL show the app extension as an available block
4. WHEN the extension is enabled THEN the system SHALL render the login form on the storefront
5. WHEN the extension is disabled THEN the system SHALL hide the login form from the storefront

### Requirement 13: Customer Session Management

**User Story:** As a customer, I want my login session to persist across page loads, so that I don't have to re-authenticate frequently.

#### Acceptance Criteria

1. WHEN a customer authenticates THEN the system SHALL create a session token stored in Redis
2. WHEN a session token is created THEN the system SHALL set an expiration time of 24 hours
3. WHEN a customer makes subsequent requests THEN the system SHALL validate the session token
4. WHEN a session token expires THEN the system SHALL require re-authentication
5. WHEN a customer logs out THEN the system SHALL invalidate the session token immediately

### Requirement 14: Order Confirmation SMS

**User Story:** As a customer, I want to receive SMS confirmation when I place an order, so that I have immediate confirmation of my purchase.

#### Acceptance Criteria

1. WHEN an order is created THEN the system SHALL receive a webhook from Shopify
2. WHEN the order webhook is received THEN the system SHALL extract customer phone number and order details
3. WHEN customer phone number exists THEN the system SHALL format an order confirmation message
4. WHEN the message is formatted THEN the system SHALL queue an SMS job to send the confirmation
5. WHEN the SMS is sent successfully THEN the system SHALL log the delivery status

### Requirement 15: Error Handling and User Feedback

**User Story:** As a customer, I want clear error messages when authentication fails, so that I know what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN authentication fails THEN the system SHALL display a user-friendly error message
2. WHEN an OTP is invalid THEN the system SHALL display "Invalid code. Please try again."
3. WHEN an OTP expires THEN the system SHALL display "Code expired. Request a new one."
4. WHEN rate limits are exceeded THEN the system SHALL display "Too many attempts. Please try again later."
5. WHEN SMS fails to send THEN the system SHALL display "Unable to send SMS. Please try another method."

### Requirement 16: Analytics and Monitoring

**User Story:** As a merchant, I want to see authentication analytics, so that I can understand how customers are using the app.

#### Acceptance Criteria

1. WHEN customers authenticate THEN the system SHALL track authentication method used (SMS, Email, OAuth)
2. WHEN authentication attempts occur THEN the system SHALL track success and failure rates
3. WHEN viewing the admin panel THEN the system SHALL display authentication statistics
4. WHEN SMS messages are sent THEN the system SHALL track delivery success rates
5. WHEN errors occur THEN the system SHALL log them with appropriate severity levels

### Requirement 17: Multi-Language Support

**User Story:** As a customer, I want to see authentication UI in my preferred language, so that I can understand the interface.

#### Acceptance Criteria

1. WHEN the login form is rendered THEN the system SHALL detect the customer's browser language
2. WHEN a supported language is detected THEN the system SHALL display UI text in that language
3. WHEN an unsupported language is detected THEN the system SHALL default to English
4. WHEN SMS messages are sent THEN the system SHALL use the customer's preferred language for message content
5. WHERE the merchant configures custom text THEN the system SHALL allow translation for each supported language

### Requirement 18: Code Migration and Reuse

**User Story:** As a developer, I want to migrate existing backend services into the new app structure, so that I don't have to rebuild functionality that already works.

#### Acceptance Criteria

1. WHEN setting up the new app THEN the system SHALL migrate existing service files (SMSService, OTPService, MultipassService, etc.)
2. WHEN migrating providers THEN the system SHALL reuse SmsToProvider, TwilioProvider, and GoogleOAuthProvider implementations
3. WHEN integrating with Remix THEN the system SHALL create API routes that call existing service methods
4. WHEN existing services use Redis THEN the system SHALL maintain the same Redis connection and data structures
5. WHEN existing services use Bull queues THEN the system SHALL maintain the same queue structure for SMS jobs
6. WHEN migrating configuration THEN the system SHALL adapt environment variables to work with Shopify app structure
7. WHEN existing tests exist THEN the system SHALL migrate and update them to work with the new structure

### Requirement 19: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for authentication flows, so that I can ensure the system works correctly.

#### Acceptance Criteria

1. WHEN authentication code is written THEN the system SHALL include unit tests for each authentication method
2. WHEN SMS provider integration is implemented THEN the system SHALL include integration tests with mock providers
3. WHEN Multipass token generation is implemented THEN the system SHALL include tests for token encryption/decryption
4. WHEN rate limiting is implemented THEN the system SHALL include tests for rate limit enforcement
5. WHEN the checkout extension is built THEN the system SHALL include end-to-end tests for the authentication flow
