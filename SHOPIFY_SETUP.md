# Shopify App Configuration Guide

This guide walks you through configuring your Shopify app directly from your Shopify admin dashboard.

## Step 1: Create a Shopify App

1. Log in to your Shopify admin dashboard
2. Navigate to **Settings** → **Apps and sales channels**
3. Click **"Develop apps"** (or **"App development"**)
4. If this is your first time, click **"Allow custom app development"** and confirm
5. Click **"Create an app"**
6. Enter app name: "SMS Authentication App"
7. Click **"Create app"**

## Step 2: Configure Admin API Scopes

1. In your app page, click on **"Configuration"** tab
2. Under **"Admin API integration"**, click **"Configure Admin API scopes"**
3. Select the following scopes:
   - ✅ `read_customers` - Read customer data
   - ✅ `write_customers` - Create and update customers
   - ✅ `read_orders` - Read order information
   - ✅ `write_orders` - Update order status
4. Click **"Save"**

## Step 3: Install App and Reveal Access Token

1. After saving scopes, click **"Install app"** button at the top right
2. Review the permissions and click **"Install app"** to confirm
3. After installation, you'll see the **"API credentials"** section
4. Click **"Reveal token once"** to display your Admin API access token
5. **Important**: Copy this token immediately - you can only see it once!
6. The token starts with `shpat_` and looks like: `shpat_xxxxxxxxxxxxxxxxxxxxx`
7. Save this token to your `.env` file as both `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`

**Note**: For custom apps, the Admin API access token is used for authentication. Unlike Partner apps, you don't get separate client ID/secret credentials.

## Step 4: Get Your Shop Domain

1. Your shop domain is in the format: `your-store.myshopify.com`
2. You can find it in your browser's address bar when logged into your Shopify admin
3. Example: If your admin URL is `https://my-awesome-store.myshopify.com/admin`, your shop domain is `my-awesome-store.myshopify.com`
4. Copy this to your `.env` file as `SHOPIFY_SHOP_DOMAIN`

## Step 5: Enable Multipass (Shopify Plus Required)

1. Log in to your Shopify admin
2. Go to "Settings" → "Checkout"
3. Scroll to "Customer accounts" section
4. Enable "Multipass"
5. Copy the Multipass secret to your `.env` file as `SHOPIFY_MULTIPASS_SECRET`

**Note**: Multipass is only available for Shopify Plus stores.

## Step 6: Configure Webhooks (Optional)

If you want to receive order creation webhooks:

1. In your app page, go to **"Configuration"** tab
2. Scroll to **"Webhooks"** section
3. Click **"Add webhook"** or **"Subscribe to webhook events"**
4. Configure:
   - **Event**: `orders/create`
   - **URL**: `https://your-app-url.com/api/webhooks/orders/create`
   - **API version**: Latest (2024-01 or newer)
5. Click **"Save"**

## Step 7: Update Your Environment Variables

Update your `.env` file with the credentials:

```bash
# Your shop domain
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com

# Admin API access token from Step 3
SHOPIFY_API_KEY=shpat_xxxxxxxxxxxxxxxxxxxxx

# For custom apps, you can use the same token
SHOPIFY_API_SECRET=shpat_xxxxxxxxxxxxxxxxxxxxx
```

## Step 8: Test the Configuration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Your app should now be running on `http://localhost:3000`
3. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```
   
   You should see:
   ```json
   {"status":"ok","timestamp":"2024-11-19T..."}
   ```

**Note**: Custom apps don't use the Shopify CLI dev server. We're using a standard Node.js/Express server with `tsx` for TypeScript hot-reloading.

## Troubleshooting

### "Invalid API key or access token"
- Verify your Admin API access token is correct
- Make sure you copied the full token including the `shpat_` prefix
- Ensure there are no extra spaces or quotes in your `.env` file
- The token should start with `shpat_` for custom apps
- **Lost your token?** You can only reveal it once. If you didn't save it, you'll need to:
  1. Uninstall the app (Configuration → Uninstall)
  2. Reinstall it (Install app button)
  3. Reveal the new token

### "Multipass token invalid"
- Verify your `SHOPIFY_MULTIPASS_SECRET` is correct
- Ensure Multipass is enabled in your Shopify admin (Settings → Checkout)
- Multipass is only available for Shopify Plus stores

### "Insufficient permissions"
- Verify all required scopes are enabled in your app configuration
- Go back to Configuration → Admin API integration and check the scopes
- After changing scopes, you may need to reinstall the app

### "App not found" or "Connection refused"
- Verify your `SHOPIFY_SHOP_DOMAIN` is correct (format: `your-store.myshopify.com`)
- Make sure your app is installed on the store
- Check that your API token hasn't been revoked

## Additional Resources

- [Shopify App Development Documentation](https://shopify.dev/docs/apps)
- [Shopify Admin API Reference](https://shopify.dev/docs/api/admin)
- [Multipass Documentation](https://shopify.dev/docs/api/multipass)
