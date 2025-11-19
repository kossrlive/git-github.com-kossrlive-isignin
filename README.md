# Shopify SMS Authentication App

Multi-channel customer authentication app for Shopify with SMS (via sms.to), email/password, and OAuth (Google) support.

## Features

- 📱 SMS authentication with OTP codes
- 📧 Email/password authentication
- 🔐 OAuth authentication (Google, with extensibility for Apple, Facebook)
- 🔒 Shopify Plus Multipass integration for secure sessions
- 🚀 Queue-based SMS delivery with fallback providers
- 🛡️ Rate limiting and security features
- 📊 Delivery tracking and monitoring

## Prerequisites

- Node.js 18+
- Redis 7+
- Shopify Plus account (for Multipass)
- sms.to account (or other SMS provider)
- Google OAuth credentials (optional)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   - Shopify API credentials
   - Multipass secret
   - SMS provider credentials
   - OAuth provider credentials
   - Redis connection

5. Configure the app in Shopify Dev Dashboard:
   - Create a new app
   - Set required scopes: `read_customers`, `write_customers`, `read_orders`, `write_orders`
   - Configure redirect URLs
   - Copy API key and secret to `.env`

## Development

Start the development server with hot-reload:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Run the production build:
```bash
npm start
```

Run tests:
```bash
npm test
```

Run type checking:
```bash
npm run typecheck
```

Run linting:
```bash
npm run lint
```

## Project Structure

```
src/
├── config/          # Configuration and environment variables
├── services/        # Core business logic services
├── providers/       # SMS and OAuth provider implementations
├── routes/          # API route handlers
├── middleware/      # Express middleware
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── test/            # Test setup and utilities
```

## Required Scopes

The app requires the following Shopify API scopes:
- `read_customers` - Read customer data
- `write_customers` - Create and update customers
- `read_orders` - Read order information
- `write_orders` - Update order status

## Environment Variables

See `.env.example` for a complete list of required environment variables.

## License

MIT
