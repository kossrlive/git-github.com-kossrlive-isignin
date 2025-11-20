# Checkout Auth Extension

This is a Shopify checkout UI extension that provides authentication functionality before checkout.

## Features

- SMS authentication with OTP
- Email/password login
- OAuth authentication (Google, etc.)
- Session persistence
- Checkout interception

## Development

```bash
cd extensions/checkout-auth
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Configuration

The extension fetches configuration from the backend API at `/api/admin/settings` to determine:
- Enabled authentication methods
- UI customization (colors, logo)
- Session settings
