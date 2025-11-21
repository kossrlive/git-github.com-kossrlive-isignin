/**
 * SMS Send OTP API Route
 * Handles sending OTP codes via SMS
 * Requirements: 5.1, 5.2, 5.3, 5.8
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { logger } from "../config/logger";
import prisma from "../db.server";
import { getSMSQueue } from "../lib/queue.server";
import { getRedis } from "../lib/redis.server";
import { OTPService } from "../services/OTPService";

interface SendSMSRequest {
  phoneNumber: string;
  shop: string;
}

interface SendSMSResponse {
  success: boolean;
  message: string;
  cooldownSeconds?: number;
}

/**
 * POST /api/auth/sms/send
 * Send OTP code to phone number via SMS
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Parse request body
    const body = await request.json() as SendSMSRequest;
    const { phoneNumber, shop } = body;

    // Validate required fields
    if (!phoneNumber) {
      return missingFieldError("Phone number");
    }

    if (!shop) {
      return missingFieldError("Shop domain");
    }

    // Requirement 5.1: Validate phone number format (E.164)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      logger.warn("Invalid phone number format", {
        phone: maskPhone(phoneNumber),
        shop,
      });
      return invalidPhoneNumberError();
    }

    // Initialize services
    const redis = getRedis();
    const smsQueue = getSMSQueue();
    const otpService = new OTPService(redis);

    // Check if phone is blocked from verification attempts
    if (await otpService.isBlocked(phoneNumber)) {
      logger.warn("OTP send attempted for blocked phone", {
        phone: maskPhone(phoneNumber),
        shop,
      });
      // Requirement 15.4: "Too many attempts. Please try again later."
      return rateLimitError();
    }

    // Check if phone is blocked from sending
    if (await otpService.isSendBlocked(phoneNumber)) {
      logger.warn("OTP send attempted for send-blocked phone", {
        phone: maskPhone(phoneNumber),
        shop,
      });
      // Requirement 15.4: "Too many attempts. Please try again later."
      return rateLimitError();
    }

    // Requirement 5.8: Check resend cooldown (30 seconds)
    const canResend = await otpService.canResendOTP(phoneNumber);
    if (!canResend.allowed) {
      logger.warn("OTP resend attempted too soon", {
        phone: maskPhone(phoneNumber),
        shop,
        retryAfter: canResend.retryAfter,
      });
      // Requirement 15.4: "Too many attempts. Please try again later."
      return rateLimitError(canResend.retryAfter);
    }

    // Track send attempt (rate limiting)
    const sendAllowed = await otpService.trackSendAttempt(phoneNumber);
    if (!sendAllowed.allowed) {
      logger.warn("Too many send attempts", {
        phone: maskPhone(phoneNumber),
        shop,
        retryAfter: sendAllowed.retryAfter,
      });
      // Requirement 15.4: "Too many attempts. Please try again later."
      return rateLimitError(sendAllowed.retryAfter);
    }

    // Requirement 5.2: Generate OTP code
    const otp = otpService.generateOTP();
    await otpService.storeOTP(phoneNumber, otp);

    logger.info("OTP generated and stored", {
      phone: maskPhone(phoneNumber),
      shop,
    });

    // Record send time for cooldown tracking
    await otpService.recordSendTime(phoneNumber);

    // Requirement 5.3: Queue SMS sending job
    const message = `Your verification code is: ${otp}. Valid for 5 minutes.`;
    const callbackUrl = `${
      process.env.SHOPIFY_APP_URL || "http://localhost:3000"
    }/api/webhooks/sms-dlr`;

    await smsQueue.add({
      phone: phoneNumber,
      message,
      attemptNumber: 0,
      callbackUrl,
    });

    logger.info("SMS job queued successfully", {
      phone: maskPhone(phoneNumber),
      shop,
    });

    // Track analytics
    try {
      const shopRecord = await prisma.shop.findUnique({
        where: { domain: shop },
      });

      if (shopRecord) {
        await prisma.analytics.create({
          data: {
            shopId: shopRecord.id,
            eventType: "sms_sent",
            method: "sms",
            metadata: JSON.stringify({
              phone: maskPhone(phoneNumber),
            }),
          },
        });
      }
    } catch (error) {
      // Don't fail the request if analytics tracking fails
      logger.error("Failed to track analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return json<SendSMSResponse>({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    logger.error("Failed to send OTP", {
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
