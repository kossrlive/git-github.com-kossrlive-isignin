/**
 * OAuth Initiation API Route
 * Handles OAuth flow initiation and redirects to provider
 * Requirements: 7.1
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import crypto from "crypto";
import { logger } from "../config/logger";
import prisma from "../db.server";
import { getRedis } from "../lib/redis.server";
import { GoogleOAuthProvider } from "../providers/GoogleOAuthProvider";
import { OAuthService } from "../services/OAuthService";

/**
 * GET /api/auth/oauth/:provider
 * Initiate OAuth flow by redirecting to provider's authorization URL
 */
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    // Requirement 7.1: Get OAuth provider from URL params
    const provider = params.provider;

    if (!provider) {
      logger.error("OAuth provider not specified");
      throw new Response("OAuth provider is required", { status: 400 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const returnTo = url.searchParams.get("returnTo");

    if (!shop) {
      logger.error("Shop domain not specified");
      throw new Response("Shop domain is required", { status: 400 });
    }

    // Get shop settings to retrieve OAuth credentials
    const shopRecord = await prisma.shop.findUnique({
      where: { domain: shop },
      include: { settings: true },
    });

    if (!shopRecord || !shopRecord.settings) {
      logger.error("Shop settings not found", { shop });
      throw new Response("Shop not configured", { status: 404 });
    }

    const settings = shopRecord.settings;

    // Initialize OAuth service
    const oauthService = new OAuthService();

    // Register provider based on settings
    if (provider === "google") {
      if (!settings.googleEnabled) {
        logger.error("Google OAuth not enabled", { shop });
        throw new Response("Google OAuth is not enabled", { status: 403 });
      }

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
      if (!settings.appleEnabled) {
        logger.error("Apple OAuth not enabled", { shop });
        throw new Response("Apple OAuth is not enabled", { status: 403 });
      }

      // Apple OAuth would be implemented similarly
      logger.error("Apple OAuth not yet implemented", { shop });
      throw new Response("Apple OAuth is not yet implemented", { status: 501 });
    } else if (provider === "facebook") {
      if (!settings.facebookEnabled) {
        logger.error("Facebook OAuth not enabled", { shop });
        throw new Response("Facebook OAuth is not enabled", { status: 403 });
      }

      // Facebook OAuth would be implemented similarly
      logger.error("Facebook OAuth not yet implemented", { shop });
      throw new Response("Facebook OAuth is not yet implemented", { status: 501 });
    } else {
      logger.error("Unsupported OAuth provider", { provider, shop });
      throw new Response(`Unsupported OAuth provider: ${provider}`, {
        status: 400,
      });
    }

    // Requirement 7.1: Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // Store state in Redis with shop and returnTo information
    const redis = getRedis();
    const stateKey = `oauth:state:${state}`;
    const stateData = {
      shop,
      provider,
      returnTo,
      createdAt: Date.now(),
    };

    // Store state for 10 minutes
    await redis.setex(stateKey, 600, JSON.stringify(stateData));

    logger.info("OAuth state stored", {
      provider,
      shop,
      state: state.substring(0, 8) + "...",
    });

    // Construct callback URL
    const callbackUrl = `${
      process.env.SHOPIFY_APP_URL || "http://localhost:3000"
    }/api/auth/oauth/${provider}/callback`;

    // Requirement 7.1: Get OAuth authorization URL from provider
    const authUrl = await oauthService.initiateOAuth(
      provider,
      callbackUrl,
      state
    );

    logger.info("Redirecting to OAuth provider", {
      provider,
      shop,
      callbackUrl,
    });

    // Redirect to OAuth provider
    return redirect(authUrl);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logger.error("Failed to initiate OAuth", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw new Response("Failed to initiate OAuth. Please try again.", {
      status: 500,
    });
  }
};
