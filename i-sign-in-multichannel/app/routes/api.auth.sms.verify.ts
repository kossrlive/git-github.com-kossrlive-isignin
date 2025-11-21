/**
 * SMS Verify OTP API Route
 * Handles OTP verification and Multipass token generation
 * Requirements: 5.5, 5.6, 5.7
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { logger } from "../config/logger";
import prisma from "../db.server";
import { getRedis } from "../lib/redis.server";
import { CustomerService } from "../services/CustomerService";
import type { CustomerData } from "../services/MultipassService";
import { MultipassService } from "../services/MultipassService";
import { OTPService } from "../services/OTPService";

interface VerifySMSRequest {
  phoneNumber: string;
  code: string;
  shop: string;
  returnTo?: string;
}

interface VerifySMSResponse {
  success: boolean;
  multipassUrl?: string;
  error?: string;
}

/**
 * POST /api/auth/sms/verify
 * Verify OTP code and generate Multipass token
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Parse request body
    const body = await request.json() as VerifySMSRequest;
    const { phoneNumber, code, shop, returnTo } = body;

    // Validate required fields
    if (!phoneNumber) {
      return json<VerifySMSResponse>(
        {
          success: false,
          error: "Phone number is required",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return json<VerifySMSResponse>(
        {
          success: false,
          error: "Verification code is required",
        },
        { status: 400 }
      );
    }

    if (!shop) {
      return json<VerifySMSResponse>(
        {
          success: false,
          error: "Shop domain is required",
        },
        { status: 400 }
      );
    }

    // Requirement 5.5: Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(code)) {
      logger.warn("Invalid OTP format", {
        phone: maskPhone(phoneNumber),
        shop,
      });
      return json<VerifySMSResponse>(
        {
          success: false,
          error: "Invalid verification code format",
        },
        { status: 400 }
      );
    }

    // Initialize services
    const redis = getRedis();
    const otpService = new OTPService(redis);
    const multipassService = new MultipassService(prisma);
    const customerService = new CustomerService();

    // Check if phone is blocked
    if (await otpService.isBlocked(phoneNumber)) {
      logger.warn("OTP verification attempted for blocked phone", {
        phone: maskPhone(phoneNumber),
        shop,
      });
      return json<VerifySMSResponse>(
        {
          success: false,
          error: "Too many failed attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Requirement 5.5, 5.7: Verify OTP (checks expiration automatically)
    const isValid = await otpService.verifyOTP(phoneNumber, code);

    if (!isValid) {
      logger.warn("Invalid or expired OTP", {
        phone: maskPhone(phoneNumber),
        shop,
      });

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
              method: "sms",
              metadata: JSON.stringify({
                phone: maskPhone(phoneNumber),
                reason: "invalid_otp",
              }),
            },
          });
        }
      } catch (error) {
        logger.error("Failed to track analytics", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return json<VerifySMSResponse>(
        {
          success: false,
          error: "Invalid or expired verification code",
        },
        { status: 401 }
      );
    }

    logger.info("OTP verified successfully", {
      phone: maskPhone(phoneNumber),
      shop,
    });

    // Find or create customer
    let customer = await customerService.findByPhone(phoneNumber);

    if (!customer) {
      logger.info("Customer not found, creating new customer", {
        phone: maskPhone(phoneNumber),
        shop,
      });

      customer = await customerService.create({
        phone: phoneNumber,
        tags: ["sms-auth"],
      });

      logger.info("New customer created", {
        customerId: customer.id,
        phone: maskPhone(phoneNumber),
        shop,
      });
    }

    // Update customer metafields
    await customerService.setAuthMethod(customer.id, "sms");
    await customerService.setPhoneVerified(customer.id, true);
    await customerService.setLastLogin(customer.id);

    // Requirement 5.6: Generate Multipass token
    const customerData: CustomerData = {
      email: customer.email || `${phoneNumber.replace(/\+/g, "")}@phone.local`,
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

    logger.info("SMS authentication successful", {
      customerId: customer.id,
      phone: maskPhone(phoneNumber),
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
            method: "sms",
            metadata: JSON.stringify({
              phone: maskPhone(phoneNumber),
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

    return json<VerifySMSResponse>({
      success: true,
      multipassUrl,
    });
  } catch (error) {
    logger.error("Failed to verify OTP", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return json<VerifySMSResponse>(
      {
        success: false,
        error: "Failed to verify code. Please try again.",
      },
      { status: 500 }
    );
  }
};

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return "****";
  }
  return phone.slice(0, -4).replace(/./g, "*") + phone.slice(-4);
}
