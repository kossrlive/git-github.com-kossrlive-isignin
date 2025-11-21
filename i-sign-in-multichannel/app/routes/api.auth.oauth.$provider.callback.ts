/**
 * OAuth Callback API Route
 * Handles OAuth callback, token exchange, and Multipass generation
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { logger } from "../config/logger";
import prisma from "../db.server";
import { getRedis } from "../lib/redis.server";
import { GoogleOAuthProvider } from "../providers/GoogleOAuthProvider";
import { CustomerService } from "../services/CustomerService";
import type { CustomerData } from "../services/MultipassService";
import { MultipassService } from "../services/MultipassService";
import { OAuthService } from "../services/OAuthService";

/**
 * GET /api/auth/oauth/:provider/callback
 * Handle OAuth callback and complete authentication
 */
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    // Get OAuth provider from URL params
    const provider = params.provider;

    if (!provider) {
      logger.error("OAuth provider not specified in callback");
      throw new Response("OAuth provider is required", { status: 400 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      logger.error("OAuth provider returned error", {
        provider,
        error,
      });
      throw new Response(`OAuth error: ${error}`, { status: 400 });
    }

    if (!code) {
      logger.error("Authorization code not provided", { provider });
      throw new Response("Authorization code is required", { status: 400 });
    }

    if (!state) {
      logger.error("State parameter not provided", { provider });
      throw new Response("State parameter is required", { status: 400 });
    }

    // Requirement 7.2: Validate state token
    const redis = getRedis();
    const stateKey = `oauth:state:${state}`;
    const stateDataStr = await redis.get(stateKey);

    if (!stateDataStr) {
      logger.error("Invalid or expired state token", {
        provider,
        state: state.substring(0, 8) + "...",
      });
      throw new Response("Invalid or expired state token", { status: 400 });
    }

    // Parse state data
    const stateData = JSON.parse(stateDataStr);
    const { shop, returnTo } = stateData;

    // Delete state token (one-time use)
    await redis.del(stateKey);

    logger.info("OAuth state validated", {
      provider,
      shop,
      state: state.substring(0, 8) + "...",
    });

    // Get shop settings to retrieve OAuth credentials
    const shopRecord = await prisma.shop.findUnique({
      where: { domain: shop },
      include: { settings: true },
    });

    if (!shopRecord || !shopRecord.settings) {
      logger.error("Shop settings not found", { shop, provider });
      throw new Response("Shop not configured", { status: 404 });
    }

    const settings = shopRecord.settings;

    // Initialize OAuth service
    const oauthService = new OAuthService();

    // Register provider based on settings
    if (provider === "google") {
      if (!settings.googleClientId || !settings.googleClientSecret) {
        logger.error("Google OAuth credentials not configured", { shop });
        throw new Response("Google OAuth is not configured", { status: 500 });
      }

      const googleProvider = new GoogleOAuthProvider(
        settings.googleClientId,
        settings.googleClientSecret
      );
      oauthService.registerProvider("google", googleProvider);
    } else if (provider === "apple") {
      logger.error("Apple OAuth not yet implemented", { shop });
      throw new Response("Apple OAuth is not yet implemented", { status: 501 });
    } else if (provider === "facebook") {
      logger.error("Facebook OAuth not yet implemented", { shop });
      throw new Response("Facebook OAuth is not yet implemented", {
        status: 501,
      });
    } else {
      logger.error("Unsupported OAuth provider", { provider, shop });
      throw new Response(`Unsupported OAuth provider: ${provider}`, {
        status: 400,
      });
    }

    // Construct callback URL (must match the one used in initiation)
    const callbackUrl = `${
      process.env.SHOPIFY_APP_URL || "http://localhost:3000"
    }/api/auth/oauth/${provider}/callback`;

    // Requirement 7.3, 7.4: Exchange authorization code for access token and fetch user info
    logger.info("Handling OAuth callback", {
      provider,
      shop,
      callbackUrl,
    });

    const profile = await oauthService.handleCallback(
      provider,
      code,
      callbackUrl
    );

    logger.info("OAuth profile fetched", {
      provider,
      shop,
      userId: profile.id,
      email: profile.email,
    });

    // Initialize customer service
    const customerService = new CustomerService();

    // Requirement 7.5: Find or create Shopify customer
    let customer = await customerService.findByEmail(profile.email);

    if (!customer) {
      logger.info("Customer not found, creating new customer from OAuth", {
        provider,
        shop,
        email: profile.email,
      });

      customer = await customerService.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        tags: [`${provider}-auth`],
      });

      logger.info("New customer created from OAuth profile", {
        customerId: customer.id,
        provider,
        shop,
        email: profile.email,
      });
    } else {
      logger.info("Existing customer found for OAuth profile", {
        customerId: customer.id,
        provider,
        shop,
        email: profile.email,
      });
    }

    // Update customer metafields
    await customerService.setAuthMethod(
      customer.id,
      provider as "google" | "apple" | "facebook"
    );
    await customerService.setLastLogin(customer.id);

    // Requirement 7.6: Generate Multipass token
    const multipassService = new MultipassService(prisma);

    const customerData: CustomerData = {
      email: customer.email!,
      created_at: customer.created_at || new Date().toISOString(),
      first_name: customer.first_name,
      last_name: customer.last_name,
      identifier: customer.id,
      return_to: returnTo,
    };

    // Validate customer data
    multipassService.validateCustomerData(customerData);

    // Generate Multipass URL
    const multipassUrl = await multipassService.generateMultipassUrl(
      shop,
      customerData,
      returnTo
    );

    logger.info("OAuth authentication successful", {
      customerId: customer.id,
      provider,
      shop,
      email: profile.email,
    });

    // Track successful authentication
    try {
      await prisma.analytics.create({
        data: {
          shopId: shopRecord.id,
          eventType: "auth_success",
          method: provider,
          metadata: JSON.stringify({
            email: profile.email,
            customerId: customer.id,
          }),
        },
      });
    } catch (error) {
      logger.error("Failed to track analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Requirement 7.7: Redirect to Multipass URL
    logger.info("Redirecting to Multipass URL", {
      customerId: customer.id,
      provider,
      shop,
    });

    return redirect(multipassUrl);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logger.error("Failed to handle OAuth callback", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // In case of error, redirect to a generic error page or login page
    // For now, throw an error response
    throw new Response("OAuth authentication failed. Please try again.", {
      status: 500,
    });
  }
};
