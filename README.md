# Shopify SMS Authentication App

Multi-channel customer authentication for Shopify stores with SMS, email/password, and OAuth support.

## 📚 Documentation

**Complete documentation is available in the [`docs/`](./docs/) folder:**

- **[📖 Documentation Index](./docs/README.md)** - Start here for all documentation
- **[🔌 API Documentation](./docs/API.md)** - Complete API reference with examples
- **[🚀 Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[👤 User Guide](./docs/USER_GUIDE.md)** - Installation and configuration for merchants
- **[🔧 Troubleshooting Guide](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[📮 Postman Collection](./docs/postman/)** - API testing collection
- **[📋 OpenAPI Spec](./docs/openapi/)** - OpenAPI 3.0 specification

## Features

- **SMS Authentication**: One-time password (OTP) via SMS using sms.to
- **Email/Password**: Traditional authentication method
- **OAuth Integration**: Google sign-in (extensible for Apple, Facebook)
- **Multipass Integration**: Secure Shopify Plus customer sessions
- **Multi-Provider SMS**: Automatic fallback between sms.to and Twilio
- **Order Confirmation**: SMS-based order verification
- **Admin Panel**: Configure authentication methods and customize UI
- **Session Persistence**: Automatic session restoration

## Tech Stack

- **Backend**: Node.js 18+, TypeScript, Express.js
- **Queue**: Bull with Redis
- **Frontend**: React, Shopify Polaris
- **Infrastructure**: Redis 7+, Docker
- **Testing**: Jest, fast-check (property-based testing)

## Quick Start

### Prerequisites

- Node.js 18+
- Redis 7+
- Shopify Plus account with Multipass enabled
- SMS provider account (sms.to and/or Twilio)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd shopify-sms-auth-app

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure environment variables
nano .env

# Build application
npm run build

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required configuration. Key variables:

```bash
# Shopify
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_API_KEY=your_api_key
SHOPIFY_MULTIPASS_SECRET=your_multipass_secret

# SMS Providers
SMS_TO_API_KEY=your_sms_to_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# Redis
REDIS_URL=redis://localhost:6379
```

**For complete environment variable documentation, see [Deployment Guide - Environment Variables](./docs/DEPLOYMENT.md#environment-variables)**

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint

# Start development server
npm run dev

# Start admin panel dev server
npm run dev:admin
```

## Project Structure

```
├── src/
│   ├── config/          # Configuration and infrastructure
│   ├── errors/          # Custom error classes
│   ├── middleware/      # Express middleware
│   ├── providers/       # SMS and OAuth provider implementations
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── workers/         # Background job workers
│   └── index.ts         # Application entry point
├── admin/               # React admin panel
├── extensions/          # Shopify app extensions
├── docs/                # Documentation
└── tests/               # Test files
```

## API Endpoints

### Authentication

- `POST /api/auth/send-otp` - Send OTP to phone number
- `POST /api/auth/verify-otp` - Verify OTP and authenticate
- `POST /api/auth/email-login` - Email/password authentication
- `GET /api/auth/oauth/:provider` - Initiate OAuth flow
- `POST /api/auth/oauth/:provider/callback` - OAuth callback
- `POST /api/auth/session/restore` - Restore session

### Admin

- `GET /api/admin/settings` - Get app settings
- `PUT /api/admin/settings` - Update app settings
- `POST /api/admin/upload-logo` - Upload logo

### Webhooks

- `POST /api/webhooks/sms-dlr` - SMS delivery receipt
- `POST /api/webhooks/shopify/orders/create` - Order created
- `POST /api/webhooks/shopify/orders/confirm` - Confirm order

**For complete API documentation with examples, see [API Documentation](./docs/API.md)**

## Testing

The project uses Jest for unit testing and fast-check for property-based testing.

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/__tests__/OTPService.test.ts

# Run with coverage
npm test -- --coverage

# Run property-based tests
npm test -- --testNamePattern="Property"
```

## Deployment

**See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed deployment instructions.**

### Quick Deploy with Docker

```bash
# Build image
docker build -t shopify-sms-auth:latest .

# Run container
docker run -d \
  --name shopify-sms-auth \
  --env-file .env.production \
  -p 3000:3000 \
  shopify-sms-auth:latest
```

### Deploy with PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

## Configuration

### SMS Providers

Configure one or both providers for redundancy:

**sms.to (Primary)**

- Sign up at https://sms.to
- Get API key from dashboard
- Configure `SMS_TO_API_KEY` and `SMS_TO_SENDER_ID`

**Twilio (Secondary)**

- Sign up at https://www.twilio.com
- Get Account SID and Auth Token
- Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

### OAuth Providers

**Google OAuth**

- Create project in Google Cloud Console
- Enable Google+ API
- Create OAuth 2.0 credentials
- Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**For detailed configuration instructions, see [User Guide](./docs/USER_GUIDE.md)**

## Monitoring

Key metrics to monitor:

- Request latency (p50, p95, p99)
- Error rate by endpoint
- SMS delivery success rate
- Queue depth and processing time
- Redis memory usage

Recommended tools:

- APM: New Relic, Datadog, AppDynamics
- Logging: ELK Stack, CloudWatch
- Uptime: UptimeRobot, Pingdom

**For monitoring setup instructions, see [Deployment Guide - Monitoring](./docs/DEPLOYMENT.md#monitoring-and-logging)**

## Security

- HTTPS enforcement for all endpoints
- Rate limiting (10 requests/minute per IP)
- OTP expiration (5 minutes)
- Account blocking after failed attempts
- Password hashing with bcrypt (cost factor 12)
- HMAC validation for webhooks
- PII masking in logs

**For security best practices, see [Deployment Guide - Security](./docs/DEPLOYMENT.md#security-checklist)**

## Troubleshooting

**For detailed troubleshooting, see [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)**

### Quick Diagnostics

```bash
# Check application health
curl https://your-app-url.com/health

# Check Redis connection
redis-cli ping

# Check queue status
redis-cli LLEN bull:sms:wait
redis-cli LLEN bull:sms:failed

# View logs
pm2 logs shopify-sms-auth --lines 100
```

### Common Issues

- **SMS not sending**: Check provider credentials and account balance
- **Redis connection failed**: Verify Redis is running and credentials are correct
- **Multipass token invalid**: Ensure Multipass is enabled and secret is correct
- **OAuth fails**: Verify redirect URI matches Google Console configuration

**For complete troubleshooting steps, see [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)**

## Getting Help

### Documentation

- **[📖 Documentation Index](./docs/README.md)** - Complete documentation overview
- **[🔌 API Documentation](./docs/API.md)** - API reference
- **[🚀 Deployment Guide](./docs/DEPLOYMENT.md)** - Deployment instructions
- **[👤 User Guide](./docs/USER_GUIDE.md)** - User instructions
- **[🔧 Troubleshooting Guide](./docs/TROUBLESHOOTING.md)** - Problem solving

### Support

- **Email**: support@your-app-domain.com
- **Documentation**: https://docs.your-app-domain.com
- **Status Page**: https://status.your-app-domain.com
- **GitHub Issues**: https://github.com/your-org/shopify-sms-auth/issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## License

Proprietary - All rights reserved

---

**For complete documentation, visit the [`docs/`](./docs/) folder or start with the [Documentation Index](./docs/README.md)**
