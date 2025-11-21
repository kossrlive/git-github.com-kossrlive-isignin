# User Guide

## Overview

Welcome to the Shopify SMS Authentication App! This guide will help you install, configure, and use the app to provide your customers with multiple authentication options including SMS, email/password, and social login (Google).

## Table of Contents

- [For Merchants](#for-merchants)
  - [Installation](#installation)
  - [Initial Setup](#initial-setup)
  - [Admin Configuration](#admin-configuration)
  - [Customizing the Login Form](#customizing-the-login-form)
  - [Managing Authentication Methods](#managing-authentication-methods)
- [For Customers](#for-customers)
  - [SMS Authentication](#sms-authentication)
  - [Email/Password Authentication](#emailpassword-authentication)
  - [Google Sign-In](#google-sign-in)
  - [Session Management](#session-management)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## For Merchants

### Installation

#### Prerequisites

Before installing the app, ensure you have:

1. **Shopify Plus Account** - This app requires Shopify Plus with Multipass enabled
2. **Admin Access** - You need admin permissions to install apps
3. **SMS Provider Account** - Sign up for sms.to or Twilio (or both for redundancy)
4. **Google OAuth Credentials** (optional) - If you want to enable Google sign-in

#### Installation Steps

1. **Access the App**
   - Go to your Shopify Admin panel
   - Navigate to **Apps** > **App and sales channel settings**
   - Click **Develop apps** (or contact your developer for the app installation link)

2. **Install the App**
   - Click **Install app**
   - Review the permissions requested:
     - Read and write customers
     - Read and write orders
   - Click **Install**

3. **Grant Permissions**
   - The app will request access to your store data
   - Review and approve the permissions
   - You'll be redirected to the app's admin panel

4. **Verify Installation**
   - Check that the app appears in your **Apps** list
   - You should see "SMS Authentication" in your installed apps

---

### Initial Setup

After installation, you need to configure the app with your credentials.

#### Step 1: Configure SMS Provider

**Option A: Using sms.to (Recommended Primary)**

1. **Sign up for sms.to**
   - Go to [https://sms.to](https://sms.to)
   - Create an account
   - Verify your email

2. **Get API Credentials**
   - Log in to sms.to dashboard
   - Navigate to **Settings** > **API**
   - Copy your **API Key**
   - Note your **Sender ID** (your brand name or phone number)

3. **Configure in App**
   - In the app admin panel, go to **Settings** > **SMS Providers**
   - Enter your sms.to API Key
   - Enter your Sender ID
   - Click **Save**

**Option B: Using Twilio (Recommended Secondary)**

1. **Sign up for Twilio**
   - Go to [https://www.twilio.com](https://www.twilio.com)
   - Create an account
   - Complete phone verification

2. **Get API Credentials**
   - From Twilio Console, copy:
     - Account SID
     - Auth Token
   - Purchase a phone number or use your existing one

3. **Configure in App**
   - In the app admin panel, go to **Settings** > **SMS Providers**
   - Enter your Twilio Account SID
   - Enter your Twilio Auth Token
   - Enter your Twilio phone number (E.164 format: +1234567890)
   - Click **Save**

**Best Practice:** Configure both providers for automatic fallback if one fails.

#### Step 2: Configure Google OAuth (Optional)

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one
   - Enable **Google+ API**

2. **Create OAuth Credentials**
   - Navigate to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth 2.0 Client ID**
   - Select **Web application**
   - Add authorized redirect URI:
     ```
     https://your-store.myshopify.com/apps/sms-auth/oauth/callback
     ```
   - Click **Create**
   - Copy the **Client ID** and **Client Secret**

3. **Configure in App**
   - In the app admin panel, go to **Settings** > **OAuth Providers**
   - Enter your Google Client ID
   - Enter your Google Client Secret
   - Click **Save**

#### Step 3: Enable Multipass

Multipass must be enabled in your Shopify Plus store:

1. **Go to Shopify Admin** > **Settings** > **Checkout**
2. **Scroll to Customer Accounts**
3. **Enable Multipass**
4. **Copy the Multipass Secret**
5. **Provide to Developer** - Your developer needs this secret to configure the app

---

### Admin Configuration

Access the admin panel to configure authentication methods and customize the login form.

#### Accessing Admin Panel

1. Go to **Shopify Admin** > **Apps**
2. Click **SMS Authentication**
3. You'll see the admin configuration panel

#### Admin Panel Overview

The admin panel has three main sections:

1. **Authentication Methods** - Enable/disable SMS, email, and OAuth
2. **UI Customization** - Customize colors, buttons, and logo
3. **Settings** - View configuration status and test connections

---

### Customizing the Login Form

Make the login form match your brand identity.

#### Changing Colors

1. **In Admin Panel**, go to **UI Customization**
2. **Primary Color**
   - Click the color picker
   - Select your brand color
   - Or enter a hex code (e.g., #FF5733)
3. **Preview** - See changes in real-time
4. **Click Save**

**Example Color Schemes:**
- **Modern Dark**: `#000000` (black)
- **Vibrant Blue**: `#0066FF`
- **Elegant Purple**: `#6B46C1`
- **Fresh Green**: `#10B981`

#### Changing Button Style

1. **In Admin Panel**, go to **UI Customization**
2. **Button Style** dropdown
3. **Select a style:**
   - **Rounded** - Slightly rounded corners (default)
   - **Square** - Sharp corners
   - **Pill** - Fully rounded ends
4. **Click Save**

#### Uploading Your Logo

1. **In Admin Panel**, go to **UI Customization**
2. **Click "Upload Logo"**
3. **Select your logo file**
   - Supported formats: PNG, JPG, SVG
   - Maximum size: 5MB
   - Recommended dimensions: 200x60px
4. **Preview** - See how it looks
5. **Click Save**

**Logo Best Practices:**
- Use transparent background (PNG)
- Keep it simple and recognizable
- Ensure good contrast with background
- Test on mobile devices

---

### Managing Authentication Methods

Control which authentication methods are available to your customers.

#### Enabling/Disabling Methods

1. **In Admin Panel**, go to **Authentication Methods**
2. **Toggle each method:**
   - **SMS Authentication** - Customers log in with phone number and OTP
   - **Email/Password** - Traditional email and password login
   - **Google Sign-In** - One-click login with Google account
3. **Click Save**

**Important:** At least one method must be enabled at all times.

#### SMS Authentication Settings

**When to Use:**
- Fast checkout experience
- Customers without email
- Mobile-first audience
- High security requirements

**Configuration:**
- **Cooldown Period**: 30 seconds between OTP requests
- **Max Attempts**: 3 send attempts per 10 minutes
- **OTP Validity**: 5 minutes
- **Max Verification Attempts**: 5 attempts before 15-minute block

#### Email/Password Settings

**When to Use:**
- Traditional e-commerce audience
- Customers who prefer passwords
- B2B customers

**Configuration:**
- **Password Requirements**: Minimum 8 characters
- **Password Storage**: Securely hashed with bcrypt
- **Account Creation**: Automatic on first login

#### Google Sign-In Settings

**When to Use:**
- Reduce friction in signup
- Target tech-savvy audience
- Improve conversion rates

**Configuration:**
- **Scopes**: Email, profile, openid
- **Account Linking**: Automatic by email
- **Profile Data**: Name and email imported

---

### Testing the Configuration

Before going live, test each authentication method:

#### Test SMS Authentication

1. **Open your storefront** in incognito/private mode
2. **Add item to cart** and proceed to checkout
3. **Click "Login with Phone"**
4. **Enter your phone number** (use your own for testing)
5. **Check your phone** for the OTP code
6. **Enter the code** and verify you're logged in
7. **Complete checkout** to ensure cart is preserved

#### Test Email/Password

1. **Open your storefront** in incognito/private mode
2. **Proceed to checkout**
3. **Click "Login with Email"**
4. **Enter test email and password**
5. **Verify login** and checkout flow

#### Test Google Sign-In

1. **Open your storefront** in incognito/private mode
2. **Proceed to checkout**
3. **Click "Sign in with Google"**
4. **Authorize with Google account**
5. **Verify redirect** back to your store
6. **Check that you're logged in**

---

## For Customers

### SMS Authentication

The fastest way to log in using your phone number.

#### How to Log In with SMS

1. **Go to Checkout** or **Account Login**
2. **Click "Login with Phone"**
3. **Enter your phone number**
   - Use international format (e.g., +1 234 567 8900)
   - Include country code
4. **Click "Send Code"**
5. **Check your phone** for a 6-digit code
6. **Enter the code** within 5 minutes
7. **Click "Verify"**
8. **You're logged in!**

#### SMS Login Tips

**Didn't receive the code?**
- Wait 30 seconds and click "Resend Code"
- Check your phone's message filters
- Verify your phone number is correct
- Try a different phone number

**Code expired?**
- Request a new code
- Codes are valid for 5 minutes only

**Too many attempts?**
- Wait 15 minutes if you entered wrong codes 5 times
- Wait 10 minutes if you requested codes 3 times in 10 minutes

---

### Email/Password Authentication

Traditional login method using your email and password.

#### First Time Login

1. **Go to Checkout** or **Account Login**
2. **Click "Login with Email"**
3. **Enter your email address**
4. **Create a password** (minimum 8 characters)
5. **Click "Sign Up"**
6. **Your account is created!**

#### Returning Customer Login

1. **Go to Checkout** or **Account Login**
2. **Click "Login with Email"**
3. **Enter your email and password**
4. **Click "Log In"**
5. **You're logged in!**

#### Password Requirements

- Minimum 8 characters
- Can include letters, numbers, and symbols
- Case-sensitive

#### Forgot Password?

1. **Click "Forgot Password?"**
2. **Enter your email**
3. **Check your email** for reset link
4. **Click the link** and create new password
5. **Log in** with new password

---

### Google Sign-In

One-click login using your Google account.

#### How to Sign In with Google

1. **Go to Checkout** or **Account Login**
2. **Click "Sign in with Google"**
3. **Select your Google account**
4. **Authorize the app** (first time only)
5. **You're logged in!**

#### What Information is Shared?

When you sign in with Google, we access:
- Your email address
- Your name
- Your profile picture (optional)

We **never** access:
- Your Google password
- Your Gmail messages
- Your Google Drive files
- Any other Google services

#### Linking Accounts

If you previously created an account with email/password using the same email address, signing in with Google will link to that existing account.

---

### Session Management

#### Staying Logged In

Your session is automatically saved:
- **Duration**: 30 days
- **Storage**: Secure browser storage
- **Auto-restore**: Automatic on return visits

#### Logging Out

1. **Go to your Account page**
2. **Click "Log Out"**
3. **Your session is cleared**

#### Multiple Devices

You can be logged in on multiple devices simultaneously. Each device maintains its own session.

#### Security Tips

- Don't share your password
- Log out on shared computers
- Use strong, unique passwords
- Enable two-factor authentication (if available)

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Invalid phone number format"

**Solution:**
- Use international format with country code
- Example: +1 234 567 8900 (US)
- Example: +44 20 7123 4567 (UK)
- Remove spaces, dashes, or parentheses
- Include the + symbol

#### Issue: "SMS not received"

**Possible Causes:**
1. **Wrong phone number** - Double-check the number
2. **Network delay** - Wait up to 2 minutes
3. **Carrier blocking** - Check spam/blocked messages
4. **Number not supported** - Some VoIP numbers may not work

**Solutions:**
- Try resending after 30 seconds
- Check your phone's message filters
- Try a different phone number
- Contact merchant support

#### Issue: "Code expired"

**Solution:**
- OTP codes expire after 5 minutes
- Request a new code
- Enter the code immediately after receiving it

#### Issue: "Too many attempts"

**Solution:**
- Wait 15 minutes if you entered wrong codes 5 times
- Wait 10 minutes if you requested codes 3 times
- Clear your browser cache
- Try a different authentication method

#### Issue: "Email already exists"

**Solution:**
- Use "Login" instead of "Sign Up"
- Try "Forgot Password" if you don't remember it
- Use a different email address
- Contact merchant support to recover account

#### Issue: "Google sign-in failed"

**Possible Causes:**
1. **Pop-up blocked** - Allow pop-ups for this site
2. **Third-party cookies disabled** - Enable cookies
3. **Google account issue** - Try different account

**Solutions:**
- Allow pop-ups in browser settings
- Enable third-party cookies
- Try incognito/private mode
- Use a different browser
- Try email/password instead

#### Issue: "Session expired"

**Solution:**
- Sessions expire after 30 days of inactivity
- Simply log in again
- Your cart and account data are preserved

#### Issue: "Can't complete checkout"

**Solution:**
- Ensure you're logged in (check top right corner)
- Clear browser cache and cookies
- Try a different browser
- Contact merchant support

---

## FAQ

### General Questions

**Q: Is my data secure?**

A: Yes! We use industry-standard security:
- Passwords are encrypted with bcrypt
- All connections use HTTPS/TLS
- OTP codes expire after 5 minutes
- No sensitive data is logged
- Compliant with GDPR and privacy regulations

**Q: Which authentication method should I use?**

A: Choose based on your preference:
- **SMS**: Fastest, no password to remember
- **Email/Password**: Traditional, works everywhere
- **Google**: One-click, uses existing account

**Q: Can I use multiple methods?**

A: Yes! You can log in with any enabled method. Your account is linked by email or phone number.

**Q: Do I need to create a new account?**

A: Not if you've shopped before! The app automatically finds or creates your customer account.

**Q: What if I change my phone number?**

A: Contact the merchant to update your account information, or log in with email/password and update in your account settings.

### For Merchants

**Q: How much does SMS cost?**

A: SMS costs vary by provider:
- **sms.to**: ~$0.04-0.10 per message (varies by country)
- **Twilio**: ~$0.0075-0.10 per message (varies by country)

Check your provider's pricing for your target countries.

**Q: Can I use my own SMS provider?**

A: The app supports sms.to and Twilio out of the box. Custom providers require development work.

**Q: What happens if SMS provider is down?**

A: If you configured multiple providers, the app automatically falls back to the secondary provider. Customers can also use email/password or Google sign-in.

**Q: Can I customize the messages?**

A: Currently, OTP messages use a standard format. Custom message templates require development work.

**Q: Does this work with Shopify Basic/Standard?**

A: No, this app requires Shopify Plus with Multipass enabled.

**Q: Can I track authentication metrics?**

A: Yes! Check your app admin panel for:
- Authentication method usage
- Success/failure rates
- SMS delivery rates
- Popular login times

**Q: What about Apple Sign-In or Facebook Login?**

A: The app is designed to support additional OAuth providers. Contact your developer to add Apple or Facebook.

**Q: Can I disable SMS for certain countries?**

A: This requires custom development. Contact your developer for country-specific rules.

**Q: How do I handle customer support issues?**

A: Common support scenarios:
- **Can't receive SMS**: Verify phone number, check provider status
- **Forgot password**: Use Shopify's built-in password reset
- **Account locked**: Wait for block period to expire (15 minutes)
- **Wrong phone number**: Update in Shopify customer admin

---

## Best Practices

### For Merchants

1. **Enable Multiple Methods**
   - Offer SMS, email, and Google for maximum flexibility
   - Customers appreciate having options

2. **Test Regularly**
   - Test all authentication methods monthly
   - Verify SMS delivery in your target countries
   - Check that webhooks are working

3. **Monitor Costs**
   - Track SMS usage and costs
   - Set up billing alerts with your SMS provider
   - Consider SMS costs in your pricing

4. **Communicate Clearly**
   - Add instructions on your checkout page
   - Explain authentication options
   - Provide support contact information

5. **Optimize for Mobile**
   - Most customers will authenticate on mobile
   - Test the experience on various devices
   - Ensure buttons are easy to tap

### For Customers

1. **Save Your Session**
   - Allow the site to remember you
   - You won't need to log in every time

2. **Use Strong Passwords**
   - If using email/password, choose a strong password
   - Don't reuse passwords from other sites

3. **Keep Contact Info Updated**
   - Ensure your phone number is current
   - Keep your email accessible

4. **Clear Cache if Issues**
   - If experiencing problems, clear browser cache
   - Try incognito/private mode

---

## Getting Help

### For Merchants

**Technical Support:**
- Email: support@your-app-domain.com
- Documentation: https://docs.your-app-domain.com
- Status Page: https://status.your-app-domain.com

**What to Include in Support Requests:**
- Store URL
- Error message (screenshot if possible)
- Steps to reproduce the issue
- Browser and device information
- Request ID (from error message)

### For Customers

**Contact the Merchant:**
- Use the store's contact page
- Email the store's support email
- Call the store's support phone number

**Include in Your Message:**
- Your email or phone number
- What you were trying to do
- Error message you received
- Device and browser you're using

---

## Appendix

### Supported Countries for SMS

The app supports SMS delivery to 200+ countries. Check with your SMS provider for specific country availability and pricing.

**Popular Countries:**
- United States
- Canada
- United Kingdom
- Australia
- Germany
- France
- Spain
- Italy
- Japan
- India
- Brazil
- Mexico

### Supported Browsers

**Desktop:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Mobile:**
- iOS Safari 14+
- Chrome Mobile 90+
- Samsung Internet 14+

### Phone Number Formats

**E.164 Format Examples:**
- US: +1 234 567 8900
- UK: +44 20 7123 4567
- Australia: +61 2 1234 5678
- Germany: +49 30 12345678
- France: +33 1 23 45 67 89

**Format Rules:**
- Start with + and country code
- No spaces, dashes, or parentheses in input
- Maximum 15 digits total

---

## Changelog

### Version 1.0.0 (January 2024)
- Initial release
- SMS authentication with sms.to
- Email/password authentication
- Google OAuth integration
- Admin configuration panel
- UI customization options
- Multi-provider SMS support (Twilio)
- Session persistence
- Order confirmation via SMS

---

## Feedback

We'd love to hear from you!

**For Merchants:**
- Feature requests: features@your-app-domain.com
- Bug reports: bugs@your-app-domain.com
- General feedback: feedback@your-app-domain.com

**For Customers:**
- Contact the merchant directly for store-specific feedback

---

Thank you for using the Shopify SMS Authentication App! We're committed to providing a secure, fast, and user-friendly authentication experience for your customers.
