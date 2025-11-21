# API Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the Shopify SMS Authentication App. The API enables multi-channel customer authentication through SMS, email/password, and OAuth providers.

**Base URL**: `https://your-app-url.com`

**API Version**: 1.0.0

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Admin Endpoints](#admin-endpoints)
  - [Webhook Endpoints](#webhook-endpoints)

---

## Authentication

Most endpoints do not require authentication as they are used for the authentication flow itself. Admin endpoints may require Shopify session authentication in production.

### Request Headers

All requests should include:

```
Content-Type: application/json
```

For webhook endpoints from Shopify:

```
X-Shopify-Hmac-Sha256: <hmac_signature>
X-Shopify-Shop-Domain: <shop_domain>
X-Shopify-Topic: <webhook_topic>
```

---

## Error Handling

All errors follow a consistent format:

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "fieldName",
      "message": "Specific field error"
    },
    "requestId": "uuid-request-id"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data or format |
| `AUTHENTICATION_ERROR` | 401 | Invalid credentials or expired token |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `EXTERNAL_SERVICE_ERROR` | 502/503 | External service (Shopify, SMS provider) error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Example Error Responses

**Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format. Please use E.164 format (e.g., +1234567890)",
    "details": {
      "field": "phone",
      "message": "Invalid phone number format. Must be in E.164 format"
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Rate Limit Error:**
```json
{
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Please wait 30 seconds before requesting another code",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Authentication Error:**
```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid verification code",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Rate Limiting

The API implements multiple layers of rate limiting to prevent abuse:

### IP-Based Rate Limiting

- **Limit**: 10 requests per minute per IP address
- **Response**: 429 Too Many Requests
- **Header**: `Retry-After` (seconds until retry allowed)

### Phone-Based Rate Limiting

**OTP Send Requests:**
- **Cooldown**: 30 seconds between requests
- **Max Attempts**: 3 send attempts per 10 minutes
- **Block Duration**: 10 minutes after exceeding attempts

**OTP Verification:**
- **Max Attempts**: 5 failed attempts
- **Block Duration**: 15 minutes after exceeding attempts

---

## Endpoints

### Authentication Endpoints

#### 1. Send OTP

Send a one-time password to a phone number via SMS.

**Endpoint**: `POST /api/auth/send-otp`

**Requirements**: 1.1, 1.2, 1.3, 5.4, 5.5

**Request Body**:
```json
{
  "phone": "+1234567890",
  "resend": false
}
```

**Parameters**:
- `phone` (string, required): Phone number in E.164 format (e.g., +1234567890)
- `resend` (boolean, optional): Whether this is a resend request (default: false)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Verification code sent successfully",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid phone number format
- `429 RATE_LIMIT_ERROR`: Too many requests or cooldown period active

**Example cURL**:
```bash
curl -X POST https://your-app-url.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "resend": false
  }'
```

---

#### 2. Verify OTP

Verify the OTP code and authenticate the user.

**Endpoint**: `POST /api/auth/verify-otp`

**Requirements**: 1.4, 1.5, 4.1, 4.3

**Request Body**:
```json
{
  "phone": "+1234567890",
  "otp": "123456",
  "returnTo": "/checkout"
}
```

**Parameters**:
- `phone` (string, required): Phone number in E.164 format
- `otp` (string, required): 6-digit verification code
- `returnTo` (string, optional): URL to redirect after authentication (default: "/")

**Success Response** (200 OK):
```json
{
  "success": true,
  "multipassUrl": "https://your-store.myshopify.com/account/login/multipass/...",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid OTP format or phone number
- `401 AUTHENTICATION_ERROR`: Invalid or expired OTP
- `429 RATE_LIMIT_ERROR`: Too many failed attempts

**Example cURL**:
```bash
curl -X POST https://your-app-url.com/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "otp": "123456",
    "returnTo": "/checkout"
  }'
```

---

#### 3. Email Login

Authenticate with email and password.

**Endpoint**: `POST /api/auth/email-login`

**Requirements**: 2.1, 2.2, 2.3, 2.4, 2.5

**Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "securePassword123",
  "returnTo": "/account"
}
```

**Parameters**:
- `email` (string, required): Customer email address
- `password` (string, required): Password (minimum 8 characters)
- `returnTo` (string, optional): URL to redirect after authentication

**Success Response** (200 OK):
```json
{
  "success": true,
  "multipassUrl": "https://your-store.myshopify.com/account/login/multipass/...",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid email format or password too short
- `401 AUTHENTICATION_ERROR`: Invalid credentials

**Example cURL**:
```bash
curl -X POST https://your-app-url.com/api/auth/email-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "securePassword123",
    "returnTo": "/account"
  }'
```

---

#### 4. Initiate OAuth

Start OAuth authentication flow with a provider.

**Endpoint**: `GET /api/auth/oauth/:provider`

**Requirements**: 3.1

**URL Parameters**:
- `provider` (string, required): OAuth provider name (e.g., "google")

**Query Parameters**:
- `returnTo` (string, optional): URL to redirect after authentication

**Success Response** (302 Redirect):
Redirects to OAuth provider's authorization page.

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid or unsupported provider
- `502 EXTERNAL_SERVICE_ERROR`: OAuth provider unavailable

**Example**:
```
GET https://your-app-url.com/api/auth/oauth/google?returnTo=/checkout
```

---

#### 5. OAuth Callback

Handle OAuth provider callback.

**Endpoint**: `GET /api/auth/oauth/:provider/callback`

**Endpoint**: `POST /api/auth/oauth/:provider/callback`

**Requirements**: 3.2, 3.3, 3.4, 3.5

**URL Parameters**:
- `provider` (string, required): OAuth provider name

**Query Parameters (GET)**:
- `code` (string, required): Authorization code from OAuth provider
- `state` (string, optional): State parameter for CSRF protection

**Request Body (POST)**:
```json
{
  "code": "authorization_code_from_provider",
  "state": "base64_encoded_state"
}
```

**Success Response** (200 OK for POST, 302 Redirect for GET):
```json
{
  "success": true,
  "multipassUrl": "https://your-store.myshopify.com/account/login/multipass/...",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Missing authorization code
- `401 AUTHENTICATION_ERROR`: Invalid authorization code
- `502 EXTERNAL_SERVICE_ERROR`: OAuth provider error

---

#### 6. Restore Session

Restore a session from stored credentials.

**Endpoint**: `POST /api/auth/session/restore`

**Requirements**: 15.3

**Request Body**:
```json
{
  "sessionData": {
    "email": "customer@example.com",
    "password": "securePassword123",
    "timestamp": 1234567890000
  },
  "returnTo": "/checkout"
}
```

**Parameters**:
- `sessionData` (object, required): Stored session data
  - `email` or `phone` (string, required): Customer identifier
  - `password` or `otp` (string, required): Credentials
  - `timestamp` (number, optional): Session creation timestamp
- `returnTo` (string, optional): URL to redirect after restoration

**Success Response** (200 OK):
```json
{
  "success": true,
  "multipassUrl": "https://your-store.myshopify.com/account/login/multipass/...",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid session data structure
- `401 AUTHENTICATION_ERROR`: Session expired or invalid credentials

**Example cURL**:
```bash
curl -X POST https://your-app-url.com/api/auth/session/restore \
  -H "Content-Type: application/json" \
  -d '{
    "sessionData": {
      "email": "customer@example.com",
      "password": "securePassword123",
      "timestamp": 1234567890000
    },
    "returnTo": "/checkout"
  }'
```

---

### Admin Endpoints

#### 7. Get Settings

Fetch current app settings.

**Endpoint**: `GET /api/admin/settings`

**Requirements**: 12.2

**Success Response** (200 OK):
```json
{
  "enabledMethods": {
    "sms": true,
    "email": true,
    "google": true
  },
  "uiCustomization": {
    "primaryColor": "#000000",
    "buttonStyle": "rounded",
    "logoUrl": "/uploads/logos/logo-123456.png"
  }
}
```

**Error Responses**:
- `500 INTERNAL_ERROR`: Failed to fetch settings

**Example cURL**:
```bash
curl -X GET https://your-app-url.com/api/admin/settings \
  -H "Content-Type: application/json"
```

---

#### 8. Update Settings

Save app settings.

**Endpoint**: `PUT /api/admin/settings`

**Requirements**: 12.2

**Request Body**:
```json
{
  "enabledMethods": {
    "sms": true,
    "email": true,
    "google": false
  },
  "uiCustomization": {
    "primaryColor": "#FF5733",
    "buttonStyle": "pill",
    "logoUrl": "/uploads/logos/logo-123456.png"
  }
}
```

**Parameters**:
- `enabledMethods` (object, required): Authentication methods configuration
  - `sms` (boolean): Enable SMS authentication
  - `email` (boolean): Enable email/password authentication
  - `google` (boolean): Enable Google OAuth
- `uiCustomization` (object, required): UI customization settings
  - `primaryColor` (string): Hex color code (e.g., "#FF5733")
  - `buttonStyle` (string): Button style ("rounded", "square", or "pill")
  - `logoUrl` (string, optional): URL to uploaded logo

**Success Response** (200 OK):
```json
{
  "success": true,
  "settings": {
    "enabledMethods": {
      "sms": true,
      "email": true,
      "google": false
    },
    "uiCustomization": {
      "primaryColor": "#FF5733",
      "buttonStyle": "pill",
      "logoUrl": "/uploads/logos/logo-123456.png"
    }
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid settings structure or values
- `500 INTERNAL_ERROR`: Failed to save settings

**Example cURL**:
```bash
curl -X PUT https://your-app-url.com/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enabledMethods": {
      "sms": true,
      "email": true,
      "google": false
    },
    "uiCustomization": {
      "primaryColor": "#FF5733",
      "buttonStyle": "pill"
    }
  }'
```

---

#### 9. Upload Logo

Upload a logo file for UI customization.

**Endpoint**: `POST /api/admin/upload-logo`

**Content-Type**: `multipart/form-data`

**Form Data**:
- `logo` (file, required): Image file (max 5MB, image formats only)

**Success Response** (200 OK):
```json
{
  "success": true,
  "url": "/uploads/logos/logo-1234567890-123456789.png",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: No file provided or invalid file type
- `413 PAYLOAD_TOO_LARGE`: File exceeds 5MB limit

**Example cURL**:
```bash
curl -X POST https://your-app-url.com/api/admin/upload-logo \
  -F "logo=@/path/to/logo.png"
```

---

### Webhook Endpoints

#### 10. SMS Delivery Receipt

Handle SMS delivery status updates from SMS providers.

**Endpoint**: `POST /api/webhooks/sms-dlr`

**Requirements**: 5.2

**Request Body** (varies by provider):

**sms.to format**:
```json
{
  "message_id": "msg_123456",
  "status": "delivered",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Twilio format**:
```json
{
  "MessageSid": "SM123456",
  "MessageStatus": "delivered",
  "EventType": "delivered"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "messageId": "msg_123456",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Note**: This endpoint always returns 200 OK to prevent webhook retries.

---

#### 11. Shopify Order Created

Handle new order webhooks from Shopify.

**Endpoint**: `POST /api/webhooks/shopify/orders/create`

**Requirements**: 8.1

**Headers**:
```
X-Shopify-Hmac-Sha256: <hmac_signature>
X-Shopify-Shop-Domain: your-store.myshopify.com
X-Shopify-Topic: orders/create
```

**Request Body** (Shopify order object):
```json
{
  "id": 1234567890,
  "order_number": 1001,
  "name": "#1001",
  "total_price": "150.00",
  "customer": {
    "id": 9876543210,
    "email": "customer@example.com",
    "phone": "+1234567890"
  }
}
```

**Success Response** (200 OK):
```json
{
  "success": true
}
```

**Note**: If order requires confirmation (e.g., value > $100), an OTP will be automatically sent to the customer's phone.

---

#### 12. Confirm Order

Confirm an order using OTP.

**Endpoint**: `POST /api/webhooks/shopify/orders/confirm`

**Requirements**: 8.3, 8.4

**Request Body**:
```json
{
  "orderId": "1234567890",
  "otp": "123456"
}
```

**Parameters**:
- `orderId` (string, required): Shopify order ID
- `otp` (string, required): 6-digit confirmation code

**Success Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:
- `400 VALIDATION_ERROR`: Missing orderId or OTP
- `401 AUTHENTICATION_ERROR`: Invalid or expired OTP

**Example cURL**:
```bash
curl -X POST https://your-app-url.com/api/webhooks/shopify/orders/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "1234567890",
    "otp": "123456"
  }'
```

---

## Health Check

#### Health Check Endpoint

Check if the service is running.

**Endpoint**: `GET /health`

**Success Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Postman Collection

A Postman collection with all endpoints and example requests is available at:

`docs/postman/Shopify-SMS-Auth-API.postman_collection.json`

Import this collection into Postman to quickly test all API endpoints.

---

## OpenAPI Specification

An OpenAPI 3.0 specification is available at:

`docs/openapi/openapi.yaml`

This can be used with tools like Swagger UI, Redoc, or API clients that support OpenAPI.

---

## Support

For issues or questions about the API:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the [User Guide](./USER_GUIDE.md)
3. Contact support at your-support-email@example.com

---

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial API release
- SMS authentication endpoints
- Email/password authentication
- Google OAuth integration
- Admin configuration endpoints
- Webhook handlers for SMS DLR and Shopify orders
