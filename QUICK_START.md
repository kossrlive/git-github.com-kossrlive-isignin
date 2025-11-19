# Quick Start Guide

## For Users Without Shopify Partners Account

If you're creating a custom app directly from your Shopify admin dashboard, follow these steps:

### 1. Create Custom App in Shopify Admin

1. Log in to your Shopify admin: `https://your-store.myshopify.com/admin`
2. Go to **Settings** → **Apps and sales channels**
3. Click **"Develop apps"** (you may need to enable custom app development first)
4. Click **"Create an app"**
5. Name it: "SMS Authentication App"
6. Click **"Create app"**

### 2. Configure API Scopes

1. Click **"Configuration"** tab
2. Under **"Admin API integration"**, click **"Configure Admin API scopes"**
3. Select these scopes:
   - ✅ `read_customers`
   - ✅ `write_customers`
   - ✅ `read_orders`
   - ✅ `write_orders`
4. Click **"Save"**

### 3. Install App and Get Access Token

1. After saving scopes, click **"Install app"** button at the top right
2. Review permissions and click **"Install app"** to confirm
3. Click **"Reveal token once"** to display your Admin API access token
4. **Copy the token immediately** - you can only see it once! (starts with `shpat_`)
5. Save it securely - you'll need it for your `.env` file

### 4. Configure Environment Variables

Edit your `.env` file:

```bash
# Your shop domain
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com

# Admin API access token (use the same token for both)
SHOPIFY_API_KEY=shpat_xxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_SECRET=shpat_xxxxxxxxxxxxxxxxxxxxx

# Multipass secret (from Settings → Checkout, Shopify Plus only)
SHOPIFY_MULTIPASS_SECRET=your_multipass_secret_here

# SMS Provider (get from sms.to)
SMS_TO_API_KEY=your_sms_to_api_key
SMS_TO_SENDER_ID=your_sender_id

# OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 5. Enable Multipass (Shopify Plus Only)

1. In Shopify admin, go to **Settings** → **Checkout**
2. Scroll to **"Customer accounts"** section
3. Enable **"Multipass"**
4. Copy the Multipass secret to your `.env` file

**Note**: Multipass is only available for Shopify Plus stores. If you don't have Shopify Plus, you'll need to use alternative authentication methods.

### 6. Start Development

```bash
npm run dev
```

Your app will start on `http://localhost:3000` with hot-reload enabled.

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

You should see:
```json
{"status":"ok","timestamp":"2024-11-19T..."}
```

**Note**: Custom apps use a standard Express server (not Shopify CLI). The `tsx` tool provides TypeScript hot-reloading for development.

### 7. Next Steps

Proceed to **Task 2** in the implementation plan:
- Set up Redis
- Configure Bull queue
- Set up logging
- Configure Express server

## Key Differences: Custom App vs Partner App

| Feature | Custom App (Admin) | Partner App |
|---------|-------------------|-------------|
| Creation | Shopify Admin Dashboard | Partners Dashboard |
| Authentication | Admin API access token | OAuth with client ID/secret |
| Token Format | `shpat_xxxxx` | Separate client credentials |
| Installation | Pre-installed on your store | Requires OAuth flow |
| Distribution | Single store only | Can be listed in App Store |

## Troubleshooting

### Can't find "Develop apps"?
- You may need to enable custom app development first
- Look for "Allow custom app development" button
- Only store owners can enable this feature

### Token doesn't work?
- Make sure you copied the full token including `shpat_` prefix
- Check for extra spaces or line breaks
- Verify the app is installed on your store
- Remember: You can only reveal the token once. If you lost it, you'll need to uninstall and reinstall the app

### Need help?
- See `SHOPIFY_SETUP.md` for detailed instructions
- Check Shopify's custom app documentation: https://help.shopify.com/en/manual/apps/custom-apps
