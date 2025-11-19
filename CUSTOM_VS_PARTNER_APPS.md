# Custom Apps vs Partner Apps

Understanding the difference between Shopify Custom Apps and Partner Apps.

## Custom Apps (What We're Building)

**Created in**: Shopify Admin Dashboard (Settings → Apps and sales channels → Develop apps)

**Best for**:
- Private apps for your own store
- Internal tools and integrations
- Development and testing
- Single-store solutions

**Authentication**:
- Admin API access token (starts with `shpat_`)
- Direct API access with token
- No OAuth flow needed
- Token revealed once during installation

**Development**:
- Standard Node.js/Express server
- No Shopify CLI required (though we removed it from dependencies)
- Direct API calls using access token
- Hot-reload with `tsx` or similar tools

**Limitations**:
- Only works on the store where it's created
- Cannot be distributed to other stores
- Cannot be listed in Shopify App Store
- No OAuth flow

**Advantages**:
- Simpler setup
- No OAuth complexity
- Direct API access
- Perfect for custom integrations

## Partner Apps

**Created in**: Shopify Partners Dashboard

**Best for**:
- Public apps for distribution
- Apps to be listed in Shopify App Store
- Multi-store solutions
- Commercial apps

**Authentication**:
- OAuth 2.0 flow
- Client ID and Client Secret
- Per-store installation tokens
- Requires merchant authorization

**Development**:
- Shopify CLI (`shopify app dev`)
- OAuth flow implementation
- Webhook verification
- App Bridge for embedded apps

**Advantages**:
- Can be distributed to multiple stores
- Can be listed in App Store
- Professional app infrastructure
- Supports embedded apps

**Limitations**:
- More complex setup
- Requires Partners account
- OAuth flow implementation
- More security considerations

## Our Project Setup

Since you're building a **Custom App**, we've configured the project to:

1. ✅ Use Admin API access token authentication
2. ✅ Run a standard Express server (no Shopify CLI)
3. ✅ Use `tsx` for TypeScript hot-reloading
4. ✅ Make direct API calls with the access token
5. ✅ Removed unnecessary Shopify CLI dependencies

## Migration Path

If you later want to convert this to a Partner App for distribution:

1. Create a Partners account
2. Create a new app in Partners Dashboard
3. Implement OAuth flow
4. Update authentication to use OAuth tokens
5. Add Shopify CLI back to dependencies
6. Update `shopify.app.toml` with client credentials
7. Implement app installation flow

## Key Takeaways

- **Custom Apps** = Simple, single-store, direct API access
- **Partner Apps** = Complex, multi-store, OAuth flow
- Our project is optimized for **Custom Apps**
- You can always migrate to Partner App later if needed

## References

- [Custom Apps Documentation](https://help.shopify.com/en/manual/apps/custom-apps)
- [Partner Apps Documentation](https://shopify.dev/docs/apps)
- [Admin API Authentication](https://shopify.dev/docs/api/admin-rest#authentication)
