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
      return missingFieldError("Phone number");
    }

    if (!code) {
      return missingFieldError("Verification code");
    }

    if (!shop) {
      return missingFieldError("Shop domain");
    }

    // Requirement 5.5: Validate OTP format (6 digits)
    const otpRegex = /^\d{6}$/;
    if (!otpRegex.test(code)) {
      logger.warn("Invalid OTP format", {
        phone: maskPhone(phoneNumber),
        shop,
      });
      return validationError("Invalid verification code format");
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
      // Requirement 15.4: "Too many attempts. Please try again later."
      return rateLimitError();
    }

    // Check if OTP exists to differentiate between expired and invalid
    const otpKey = `otp:${phoneNumber}`;
    const otpExists = await redis.exists(otpKey);

    // Requirement 5.5, 5.7: Verify OTP (checks expiration automatically)
    const isValid = await otpService.verifyOTP(phoneNumber, code);

    if (!isValid) {
      logger.warn("Invalid or expired OTP", {
        phone: maskPhone(phoneNumber),
        shop,
        otpExists: otpExists === 1,
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
                reason: otpExists === 1 ? "invalid_otp" : "expired_otp",
              }),
            },
          });
        }
      } catch (error) {
        logger.error("Failed to track analytics", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Requirement 15.2: "Invalid code. Please try again."
      // Requirement 15.3: "Code expired. Request a new one."
      if (otpExists === 0) {
        return expiredOTPError();
      } else {
        return invalidOTPError();
      }
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

    return internalError(error instanceof Error ? error : undefined);
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
