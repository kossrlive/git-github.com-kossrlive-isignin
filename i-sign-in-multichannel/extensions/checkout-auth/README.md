# Checkout Authentication Extension

This checkout UI extension provides an authentication modal for customers who are not logged in when they reach checkout.

## Features

- **SMS Authentication**: Send and verify OTP codes via SMS
- **Email Authentication**: Traditional email/password login
- **OAuth Authentication**: Login with Google, Apple, or Facebook
- **Guest Checkout**: Allow customers to dismiss the modal and continue as guests

## Installation

The extension is automatically deployed with the app. Merchants can configure authentication methods in the app admin panel.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Configuration

Authentication methods and styling are configured through the main app's admin panel at `/app/settings`.
