/**
 * Email Login API Route
 * Handles email/password authentication
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import * as bcrypt from "bcrypt";
import { logger } from "../config/logger";
import prisma from "../db.server";
import { getRedis } from "../lib/redis.server";
import { CustomerService } from "../services/CustomerService";
import type { CustomerData } from "../services/MultipassService";
import { MultipassService } from "../services/MultipassService";

interface EmailLoginRequest {
  email: string;
  password: string;
  shop: string;
  returnTo?: string;
}

interface EmailLoginResponse {
  success: boolean;
  multipassUrl?: string;
  error?: string;
}

/**
 * POST /api/auth/email/login
 * Authenticate with email and password
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Parse request body
    const body = await request.json() as EmailLoginRequest;
    const { email, password, shop, returnTo } = body;

    // Requirement 6.1: Validate email and password are non-empty
    if (!email || email.trim() === "") {
      return json<EmailLoginResponse>(
        {
          success: false,
          error: "Email is required",
        },
        { status: 400 }
      );
    }

    if (!password || password.trim() === "") {
      return json<EmailLoginResponse>(
        {
          success: false,
          error: "Password is required",
        },
        { status: 400 }
      );
    }

    if (!shop) {
      return json<EmailLoginResponse>(
        {
          success: false,
          error: "Shop domain is required",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn("Invalid email format", { email, shop });
      return json<EmailLoginResponse>(
        {
          success: false,
          error: "Invalid email format",
        },
        { status: 400 }
      );
    }

    // Initialize services
    const redis = getRedis();
    const multipassService = new MultipassService(prisma);
    const customerService = new CustomerService();

    // Requirement 6.6: Check for account blocking
    const blockKey = `email:blocked:${email}`;
    const isBlocked = await redis.exists(blockKey);

    if (isBlocked) {
      const ttl = await redis.ttl(blockKey);
      logger.warn("Login attempted for blocked email", {
        email,
        shop,
        ttl,
      });

      return json<EmailLoginResponse>(
        {
          success: false,
          error: "Too many failed attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Requirement 6.2: Check if customer exists using GraphQL
    let customer = await customerService.findByEmail(email);

    if (!customer) {
      // Customer doesn't exist - create new customer with hashed password
      logger.info("Customer not found, creating new customer", {
        email,
        shop,
      });

      // Requirement 6.3: Hash password using bcrypt
      const hashedPassword = await bcrypt.hash(password, 12);

      // Store password hash in customer metafield
      customer = await customerService.create({
        email,
        password: hashedPassword,
        tags: ["email-auth"],
      });

      // Store password hash in Redis for future verification
      // (In production, you might want to use a separate database)
      const passwordKey = `email:password:${email}`;
      await redis.set(passwordKey, hashedPassword);

      logger.info("New customer created with email", {
        customerId: customer.id,
        email,
        shop,
      });
    } else {
      // Customer exists - verify password
      logger.info("Existing customer found, verifying password", {
        customerId: customer.id,
        email,
        shop,
      });

      // Get stored password hash from Redis
      const passwordKey = `email:password:${email}`;
      const storedHash = await redis.get(passwordKey);

      if (!storedHash) {
        // No password stored - this might be a customer created through other means
        // Requirement 6.5: Don't reveal whether email or password was incorrect
        logger.warn("No password hash found for customer", {
          customerId: customer.id,
          email,
          shop,
        });

        await trackFailedAttempt(redis, email, shop);

        return json<EmailLoginResponse>(
          {
            success: false,
            error: "Invalid email or password",
          },
          { status: 401 }
        );
      }

      // Requirement 6.3: Verify password using bcrypt
      const isValidPassword = await bcrypt.compare(password, storedHash);

      if (!isValidPassword) {
        logger.warn("Invalid password provided", {
          customerId: customer.id,
          email,
          shop,
        });

        await trackFailedAttempt(redis, email, shop);

        // Track failed authentication
        try {
          const shopRecord = await prisma.shop.findUnique({
            where: { domain: shop },
          });

          if (shopRecord) {
            await prisma.analytics.create({
              data: {
                shopId: shopRecord.id,
                eventType: "auth_failure",
                method: "email",
                metadata: JSON.stringify({
                  email,
                  reason: "invalid_password",
                }),
              },
            });
          }
        } catch (error) {
          logger.error("Failed to track analytics", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Requirement 6.5: Don't reveal whether email or password was incorrect
        return json<EmailLoginResponse>(
          {
            success: false,
            error: "Invalid email or password",
          },
          { status: 401 }
        );
      }

      // Password is valid - reset failed attempts
      const attemptsKey = `email:attempts:${email}`;
      await redis.del(attemptsKey);
    }

    // Update customer metafields
    await customerService.setAuthMethod(customer.id, "email");
    await customerService.setLastLogin(customer.id);

    // Requirement 6.4: Generate Multipass token on success
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

    logger.info("Email authentication successful", {
      customerId: customer.id,
      email,
      shop,
    });

    // Track successful authentication
    try {
      const shopRecord = await prisma.shop.findUnique({
        where: { domain: shop },
      });

      if (shopRecord) {
        await prisma.analytics.create({
          data: {
            shopId: shopRecord.id,
            eventType: "auth_success",
            method: "email",
            metadata: JSON.stringify({
              email,
              customerId: customer.id,
            }),
          },
        });
      }
    } catch (error) {
      logger.error("Failed to track analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return json<EmailLoginResponse>({
      success: true,
      multipassUrl,
    });
  } catch (error) {
    logger.error("Failed to authenticate with email", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return json<EmailLoginResponse>(
      {
        success: false,
        error: "Authentication failed. Please try again.",
      },
      { status: 500 }
    );
  }
};

/**
 * Track failed login attempt and block account if necessary
 * Requirement 6.6: Block account after 5 failed attempts for 15 minutes
 */
async function trackFailedAttempt(
  redis: any,
  email: string,
  shop: string
): Promise<void> {
  const attemptsKey = `email:attempts:${email}`;
  const blockKey = `email:blocked:${email}`;
  const maxAttempts = 5;
  const blockDuration = 15 * 60; // 15 minutes in seconds

  try {
    const attempts = await redis.incr(attemptsKey);

    // Set TTL on first attempt
    if (attempts === 1) {
      await redis.expire(attemptsKey, blockDuration);
    }

    logger.info("Failed login attempt tracked", {
      email,
      shop,
      attempts,
      maxAttempts,
    });

    // Block account if max attempts reached
    if (attempts >= maxAttempts) {
      await redis.setex(blockKey, blockDuration, "1");

      logger.warn("Account blocked due to too many failed attempts", {
        email,
        shop,
        attempts,
        blockDuration,
      });
    }
  } catch (error) {
    logger.error("Failed to track failed attempt", {
      email,
      shop,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
