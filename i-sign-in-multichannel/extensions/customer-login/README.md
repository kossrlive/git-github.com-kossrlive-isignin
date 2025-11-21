# Customer Login Theme Extension

This theme app extension provides a modern, customizable login form for Shopify storefronts with support for multiple authentication methods.

## Features

### Authentication Methods
- **SMS Authentication**: One-time password (OTP) sent via SMS
- **Email/Password**: Traditional email and password login
- **OAuth Providers**: Google, Apple, and Facebook social login

### Customization Options
- Primary color customization
- Button style (rounded or square)
- Logo upload support
- Toggle individual authentication methods
- Enable/disable specific OAuth providers

### User Experience
- Responsive design for all screen sizes
- Tab-based interface for switching between auth methods
- Real-time validation and error messages
- Loading states for all async operations
- Cooldown timer for SMS resend
- Dark mode support

## File Structure

```
customer-login/
├── shopify.extension.toml       # Extension configuration
├── blocks/
│   └── login-form.liquid        # Main Liquid template with schema
├── assets/
│   ├── login-form.js            # JavaScript for auth flows
│   └── login-form.css           # Responsive styles
└── README.md                    # This file
```

## Installation

The extension is automatically installed with the app. To enable it on your storefront:

1. Go to your Shopify Admin
2. Navigate to Online Store > Themes
3. Click "Customize" on your active theme
4. Navigate to the page where you want the login form
5. Click "Add section" or "Add block"
6. Find "Customer Login" under Apps
7. Configure the settings and save

## Configuration

### Block Settings

Available in the theme editor:

- **Title**: Customize the heading text (default: "Sign In")
- **Show SMS Login**: Toggle SMS authentication
- **Show Email Login**: Toggle email/password authentication
- **Show OAuth Login**: Toggle social login options
- **Enable Google**: Show Google OAuth button
- **Enable Apple**: Show Apple OAuth button
- **Enable Facebook**: Show Facebook OAuth button
- **Primary Color**: Set the button and accent color
- **Button Style**: Choose between rounded or square buttons
- **Show Logo**: Display a logo above the form
- **Logo URL**: URL of the logo image

### API Endpoints

The extension communicates with these API routes:

- `POST /api/auth/sms/send` - Send OTP code
- `POST /api/auth/sms/verify` - Verify OTP code
- `POST /api/auth/email/login` - Email/password login
- `GET /api/auth/oauth/:provider` - OAuth initiation
- `GET /api/auth/oauth/:provider/callback` - OAuth callback

## Authentication Flows

### SMS Flow
1. Customer enters phone number
2. System validates format (E.164)
3. OTP is generated and sent via SMS
4. Customer enters 6-digit code
5. System verifies code
6. Multipass token is generated
7. Customer is redirected to authenticated session

### Email Flow
1. Customer enters email and password
2. System validates both fields
3. Customer existence is checked via Shopify API
4. Password is verified using bcrypt
5. Multipass token is generated
6. Customer is redirected to authenticated session

### OAuth Flow
1. Customer clicks OAuth provider button
2. System redirects to provider's consent screen
3. Customer grants permission
4. Provider returns authorization code
5. System exchanges code for access token
6. User info is fetched from provider
7. Customer is found or created in Shopify
8. Multipass token is generated
9. Customer is redirected to authenticated session

## Validation

### Phone Number
- Must be in E.164 format (e.g., +1234567890)
- Starts with + followed by country code
- 1-15 digits total

### Email
- Standard email format validation
- Must contain @ and domain

### OTP Code
- Exactly 6 numeric digits
- Auto-formatted on input
- Expires after 5 minutes

## Error Handling

User-friendly error messages are displayed for:
- Invalid phone number format
- Invalid email format
- Empty required fields
- Invalid OTP code
- Expired OTP code
- Rate limit exceeded
- SMS delivery failure
- Authentication failure
- Network errors

## Styling

The extension uses CSS custom properties for easy theming:

```css
--primary-color: Set via block settings
```

Button styles are applied via data attributes:
- `data-button-style="rounded"` - Rounded corners (24px)
- `data-button-style="square"` - Square corners (4px)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Responsive design for all screen sizes
- Graceful degradation for older browsers

## Security

- Phone numbers are validated before sending OTP
- OTP codes expire after 5 minutes
- Rate limiting prevents abuse
- Sensitive data is masked in logs
- HTTPS required for all API calls
- HMAC validation for webhooks

## Requirements

Before enabling the extension:

1. **SMS Provider**: Configure at least one SMS provider (sms.to or Twilio) in app settings
2. **Multipass**: Shopify Plus plan with Multipass enabled
3. **Multipass Secret**: Add your Multipass secret in app settings
4. **OAuth Credentials**: Configure OAuth providers if using social login

## Troubleshooting

### Login form not appearing
- Verify the extension is enabled in theme editor
- Check that the block is added to the correct page
- Ensure the app is installed and active

### SMS not sending
- Verify SMS provider credentials in settings
- Check SMS provider balance
- Review error logs in admin dashboard

### OAuth not working
- Verify OAuth credentials in settings
- Check redirect URLs are configured correctly
- Ensure OAuth providers are enabled in block settings

### Multipass errors
- Verify Multipass is enabled on your Shopify Plus plan
- Check Multipass secret is configured correctly
- Ensure customer email exists or can be created

## Support

For issues or questions:
1. Check the admin dashboard for error logs
2. Review analytics for authentication failures
3. Verify all settings are configured correctly
4. Contact support with specific error messages

## Version

Version: 1.0.0
API Version: 2026-01
