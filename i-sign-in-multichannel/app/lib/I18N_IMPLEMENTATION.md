# Multi-Language Support Implementation

## Overview

This document describes the multi-language (i18n) support implementation for the Shopify authentication app. The system supports English, Spanish, French, and German translations for all user-facing text.

## Requirements Addressed

- **Requirement 17.1**: Detect browser language
- **Requirement 17.2**: Load translations for supported languages (en, es, fr, de)
- **Requirement 17.3**: Default to English for unsupported languages
- **Requirement 17.4**: Translate SMS message templates
- **Requirement 17.5**: Allow merchants to customize text for each language

## Implementation Details

### 1. Localization Utility (`app/lib/i18n.server.ts`)

The core localization module provides:

- **Supported Languages**: English (en), Spanish (es), French (fr), German (de)
- **Translation Structure**: Organized into categories:
  - `loginForm`: UI labels and buttons
  - `errors`: Error messages
  - `sms`: SMS message templates
  - `success`: Success messages

**Key Functions**:

```typescript
// Detect language from Accept-Language header
detectLanguage(acceptLanguageHeader?: string): SupportedLanguage

// Get translations for a language
getTranslations(language: string): Translations

// Format SMS messages with localization
formatOTPMessage(code: string, language: string): string
formatOrderConfirmationMessage(orderNumber: string, total: string, language: string): string
```

### 2. Error Messages Localization (`app/lib/errors.server.ts`)

All error response functions now accept a `language` parameter:

```typescript
invalidPhoneNumberError(language: string = 'en', requestId?: string)
invalidOTPError(language: string = 'en', requestId?: string)
expiredOTPError(language: string = 'en', requestId?: string)
rateLimitError(cooldownSeconds?: number, language: string = 'en', requestId?: string)
smsProviderError(language: string = 'en', requestId?: string)
internalError(error?: Error, language: string = 'en', requestId?: string)
invalidCredentialsError(language: string = 'en', requestId?: string)
accountBlockedError(language: string = 'en', requestId?: string)
missingFieldError(fieldName: string, language: string = 'en', requestId?: string)
```

### 3. Database Schema Updates

Added to `ShopSettings` model:

```prisma
defaultLanguage String? @default("en")
customTranslations String? // JSON string for custom translations per language
```

### 4. Translation Configuration Component (`app/components/TranslationConfig.tsx`)

Admin UI component that allows merchants to:

- Select a language to customize
- Override default translations for any text field
- Reset to default translations
- Save custom translations per language

The component displays:
- Login form labels and buttons
- Error messages
- SMS message templates

### 5. Settings Page Integration

The settings page (`app/routes/app.settings.tsx`) now includes:

- Translation configuration component
- Action handler for saving translations (`saveTranslations`)
- Storage of custom translations in the database

## Usage

### Server-Side (API Routes)

```typescript
import { detectLanguage, getTranslations, formatOTPMessage } from '../lib/i18n.server';

// Detect language from request
const language = detectLanguage(request.headers.get('Accept-Language'));

// Get translations
const t = getTranslations(language);

// Use in error responses
return invalidOTPError(language);

// Format SMS messages
const message = formatOTPMessage(otpCode, language);
```

### Client-Side (Theme Extension)

The theme extension can detect browser language using JavaScript:

```javascript
const browserLanguage = navigator.language.split('-')[0]; // e.g., 'en', 'es', 'fr', 'de'
```

Then pass this language to API endpoints via query parameters or headers.

### Merchant Customization

Merchants can customize translations through the admin panel:

1. Navigate to Settings
2. Scroll to "Translation Configuration"
3. Select a language from the dropdown
4. Override any text fields with custom translations
5. Click "Save Translations"

Custom translations are stored as JSON in the database:

```json
{
  "es": {
    "loginForm.title": "Mi Título Personalizado",
    "errors.invalidCode": "Código incorrecto personalizado"
  },
  "fr": {
    "loginForm.title": "Mon Titre Personnalisé"
  }
}
```

## Translation Coverage

### Login Form
- Title, labels, placeholders
- Button text
- OAuth provider buttons
- Instructions and help text

### Error Messages
- Invalid code/credentials
- Expired codes
- Rate limiting
- SMS failures
- Validation errors

### SMS Messages
- OTP verification codes
- Order confirmations

### Success Messages
- Code sent confirmation
- Login success

## Default Translations

All default translations are defined in `app/lib/i18n.server.ts`. The system includes:

- **English (en)**: Base language
- **Spanish (es)**: Full translation
- **French (fr)**: Full translation
- **German (de)**: Full translation

## Fallback Behavior

1. If a custom translation exists for a field, use it
2. If no custom translation, use the default translation for the language
3. If the language is not supported, default to English
4. If a translation key is missing, fall back to English

## Testing

To test localization:

1. **Browser Language Detection**: Change browser language settings and verify the correct translations are used
2. **Custom Translations**: Set custom translations in admin panel and verify they appear in the UI
3. **SMS Messages**: Send test SMS in different languages and verify the message content
4. **Error Messages**: Trigger errors with different language settings and verify localized messages

## Future Enhancements

Potential improvements:

1. Add more languages (Italian, Portuguese, Japanese, etc.)
2. Support for RTL languages (Arabic, Hebrew)
3. Date/time localization
4. Currency formatting per locale
5. Pluralization rules
6. Translation management UI with bulk import/export
7. Professional translation service integration
