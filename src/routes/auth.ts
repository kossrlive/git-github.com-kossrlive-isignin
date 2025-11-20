/**
 * Authentication Routes
 * Handles all authentication endpoints (SMS, email, OAuth)
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5, 15.3
 */

import { NextFunction, Request, Response, Router } from 'express';
import { logger } from '../config/logger.js';
import { AuthenticationError, RateLimitError, ValidationError } from '../errors/index.js';
import { AuthService } from '../services/AuthService.js';
import { OTPService } from '../services/OTPService.js';
import { SMSService } from '../services/SMSService.js';

export function createAuthRouter(
  authService: AuthService,
  otpService: OTPService,
  smsService: SMSService
): Router {
  const router = Router();

  /**
   * POST /api/auth/send-otp
   * Send OTP to phone number
   * Requirements: 1.1, 1.2, 1.3, 5.4, 5.5
   */
  router.post('/send-otp', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { phone, resend } = req.body;

      // Validate phone number presence
      if (!phone) {
        throw new ValidationError('Phone number is required', {
          field: 'phone',
          message: 'Phone number is required'
        });
      }

      // Requirement 1.1: Validate phone number format
      if (!authService.validatePhoneNumber(phone)) {
        throw new ValidationError('Invalid phone number format. Please use E.164 format (e.g., +1234567890)', {
          field: 'phone',
          message: 'Invalid phone number format. Must be in E.164 format'
        });
      }

      // Requirement 5.4: Check resend cooldown (30 seconds)
      if (resend) {
        const canResend = await otpService.canResendOTP(phone);
        if (!canResend.allowed) {
          throw new RateLimitError(
            `Please wait ${canResend.retryAfter} seconds before requesting another code`,
            canResend.retryAfter || 30
          );
        }
      }

      // Requirement 5.5: Check send attempts (3 per 10 minutes)
      const sendAttempt = await otpService.trackSendAttempt(phone);
      if (!sendAttempt.allowed) {
        throw new RateLimitError(
          'Too many send attempts. Please try again later',
          sendAttempt.retryAfter || 600
        );
      }

      // Check if phone is blocked from verification failures
      if (await otpService.isBlocked(phone)) {
        throw new RateLimitError(
          'Too many failed verification attempts. Please try again later',
          900
        );
      }

      // Record send time for rate limiting
      await otpService.recordSendTime(phone);

      // Requirement 1.2, 1.3: Generate OTP and queue SMS job
      await authService.sendOTP(phone, resend || false);

      logger.info('OTP send request processed', {
        requestId,
        phone: maskPhone(phone),
        resend: resend || false
      });

      // Return success response immediately (non-blocking)
      res.status(200).json({
        success: true,
        message: 'Verification code sent successfully',
        requestId
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Verify OTP and authenticate user
   * Requirements: 1.4, 1.5, 4.1, 4.3
   */
  router.post('/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { phone, otp, returnTo } = req.body;

      // Validate required fields
      if (!phone) {
        throw new ValidationError('Phone number is required', {
          field: 'phone',
          message: 'Phone number is required'
        });
      }

      if (!otp) {
        throw new ValidationError('Verification code is required', {
          field: 'otp',
          message: 'Verification code is required'
        });
      }

      // Requirement 1.4: Validate OTP format (6 digits)
      if (!/^\d{6}$/.test(otp)) {
        throw new ValidationError('Invalid verification code format', {
          field: 'otp',
          message: 'Verification code must be 6 digits'
        });
      }

      // Validate phone number format
      if (!authService.validatePhoneNumber(phone)) {
        throw new ValidationError('Invalid phone number format', {
          field: 'phone',
          message: 'Invalid phone number format'
        });
      }

      // Requirement 1.4, 1.5, 4.1, 4.3: Verify OTP, find/create customer, generate Multipass token
      const result = await authService.authenticateWithPhone(phone, otp, returnTo);

      if (!result.success) {
        throw new AuthenticationError(result.error || 'Authentication failed');
      }

      logger.info('OTP verification successful', {
        requestId,
        phone: maskPhone(phone),
        customerId: result.customer?.id
      });

      // Return Multipass URL
      res.status(200).json({
        success: true,
        multipassUrl: result.multipassUrl,
        requestId
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/email-login
   * Authenticate with email and password
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  router.post('/email-login', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { email, password, returnTo } = req.body;

      // Validate required fields
      if (!email) {
        throw new ValidationError('Email is required', {
          field: 'email',
          message: 'Email is required'
        });
      }

      if (!password) {
        throw new ValidationError('Password is required', {
          field: 'password',
          message: 'Password is required'
        });
      }

      // Requirement 2.1: Validate email format
      if (!authService.validateEmail(email)) {
        throw new ValidationError('Invalid email format', {
          field: 'email',
          message: 'Invalid email format'
        });
      }

      // Validate password length
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters', {
          field: 'password',
          message: 'Password must be at least 8 characters'
        });
      }

      // Requirement 2.2, 2.3, 2.4, 2.5: Authenticate, find/create customer, generate Multipass token
      const result = await authService.authenticateWithEmail(email, password, returnTo);

      if (!result.success) {
        throw new AuthenticationError(result.error || 'Authentication failed');
      }

      logger.info('Email authentication successful', {
        requestId,
        email,
        customerId: result.customer?.id
      });

      // Return Multipass URL
      res.status(200).json({
        success: true,
        multipassUrl: result.multipassUrl,
        requestId
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/auth/oauth/:provider
   * Initiate OAuth flow
   * Requirements: 3.1
   */
  router.get('/oauth/:provider', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { provider } = req.params;
      const { returnTo } = req.query;

      // Validate provider
      if (!provider) {
        throw new ValidationError('OAuth provider is required', {
          field: 'provider',
          message: 'OAuth provider is required'
        });
      }

      // Generate state parameter for CSRF protection
      const state = Buffer.from(
        JSON.stringify({
          returnTo: returnTo || '/',
          timestamp: Date.now(),
          requestId
        })
      ).toString('base64');

      // Build redirect URI
      const redirectUri = `${process.env.SHOPIFY_APP_URL || 'http://localhost:3000'}/api/auth/oauth/${provider}/callback`;

      // Requirement 3.1: Generate OAuth authorization URL
      const authUrl = await authService.initiateOAuth(provider, redirectUri, state);

      logger.info('OAuth flow initiated', {
        requestId,
        provider,
        hasReturnTo: !!returnTo
      });

      // Redirect to OAuth provider
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/oauth/:provider/callback
   * Handle OAuth callback
   * Requirements: 3.2, 3.3, 3.4, 3.5
   */
  router.post('/oauth/:provider/callback', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { provider } = req.params;
      const { code, state } = req.body;

      // Validate required fields
      if (!code) {
        throw new ValidationError('Authorization code is required', {
          field: 'code',
          message: 'Authorization code is required'
        });
      }

      // Parse state parameter
      let returnTo = '/';
      if (state) {
        try {
          const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          returnTo = stateData.returnTo || '/';
        } catch (error) {
          logger.warn('Failed to parse state parameter', { requestId, error });
        }
      }

      // Build redirect URI
      const redirectUri = `${process.env.SHOPIFY_APP_URL || 'http://localhost:3000'}/api/auth/oauth/${provider}/callback`;

      // Requirement 3.2, 3.3, 3.4, 3.5: Exchange code, fetch profile, find/create customer, generate Multipass
      const result = await authService.authenticateWithOAuth(provider, code, redirectUri, returnTo);

      if (!result.success) {
        throw new AuthenticationError(result.error || 'OAuth authentication failed');
      }

      logger.info('OAuth authentication successful', {
        requestId,
        provider,
        customerId: result.customer?.id
      });

      // Return Multipass URL
      res.status(200).json({
        success: true,
        multipassUrl: result.multipassUrl,
        requestId
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/auth/oauth/:provider/callback
   * Handle OAuth callback (GET method for redirect-based flows)
   * Requirements: 3.2, 3.3, 3.4, 3.5
   */
  router.get('/oauth/:provider/callback', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { provider } = req.params;
      const { code, state } = req.query;

      // Validate required fields
      if (!code || typeof code !== 'string') {
        throw new ValidationError('Authorization code is required', {
          field: 'code',
          message: 'Authorization code is required'
        });
      }

      // Parse state parameter
      let returnTo = '/';
      if (state && typeof state === 'string') {
        try {
          const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          returnTo = stateData.returnTo || '/';
        } catch (error) {
          logger.warn('Failed to parse state parameter', { requestId, error });
        }
      }

      // Build redirect URI
      const redirectUri = `${process.env.SHOPIFY_APP_URL || 'http://localhost:3000'}/api/auth/oauth/${provider}/callback`;

      // Requirement 3.2, 3.3, 3.4, 3.5: Exchange code, fetch profile, find/create customer, generate Multipass
      const result = await authService.authenticateWithOAuth(provider, code, redirectUri, returnTo);

      if (!result.success) {
        throw new AuthenticationError(result.error || 'OAuth authentication failed');
      }

      logger.info('OAuth authentication successful', {
        requestId,
        provider,
        customerId: result.customer?.id
      });

      // Redirect to Multipass URL
      if (result.multipassUrl) {
        res.redirect(result.multipassUrl);
      } else {
        throw new Error('Failed to generate Multipass URL');
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/auth/session/restore
   * Restore session from localStorage/cookies
   * Requirements: 15.3
   */
  router.post('/session/restore', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const { sessionData, returnTo } = req.body;

      // Validate session data
      if (!sessionData) {
        throw new ValidationError('Session data is required', {
          field: 'sessionData',
          message: 'Session data is required'
        });
      }

      // Validate session data structure
      if (!sessionData.email && !sessionData.phone) {
        throw new ValidationError('Session data must contain email or phone', {
          field: 'sessionData',
          message: 'Invalid session data'
        });
      }

      // Validate session timestamp (sessions expire after 30 days)
      if (sessionData.timestamp) {
        const sessionAge = Date.now() - sessionData.timestamp;
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

        if (sessionAge > maxAge) {
          throw new AuthenticationError('Session expired');
        }
      }

      logger.info('Restoring session', {
        requestId,
        hasEmail: !!sessionData.email,
        hasPhone: !!sessionData.phone
      });

      // Requirement 15.3: Restore session via Multipass
      // Use the appropriate authentication method based on session data
      let result;
      if (sessionData.email && sessionData.password) {
        // Restore email session
        result = await authService.authenticateWithEmail(sessionData.email, sessionData.password, returnTo);
      } else if (sessionData.phone && sessionData.otp) {
        // Restore phone session (if OTP is still valid)
        result = await authService.authenticateWithPhone(sessionData.phone, sessionData.otp, returnTo);
      } else {
        throw new AuthenticationError('Insufficient session data for restoration');
      }

      if (!result.success) {
        throw new AuthenticationError(result.error || 'Session restoration failed');
      }

      logger.info('Session restored successfully', {
        requestId,
        customerId: result.customer?.id
      });

      res.status(200).json({
        success: true,
        multipassUrl: result.multipassUrl,
        requestId
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/webhooks/sms-dlr
   * Handle SMS delivery receipt webhook
   * Requirements: 5.2
   */
  router.post('/webhooks/sms-dlr', async (req: Request, res: Response) => {
    const requestId = req.requestId;

    try {
      const payload = req.body;

      logger.info('SMS DLR webhook received', {
        requestId,
        payload
      });

      // Requirement 5.2: Parse DLR webhook and update delivery status
      // The SMS provider will send delivery status updates
      // We need to extract the message ID and status from the payload

      // Note: The exact payload structure depends on the SMS provider
      // For sms.to, the webhook payload typically includes:
      // - message_id: The ID of the message
      // - status: delivered, failed, etc.
      // - timestamp: When the status changed

      const messageId = payload.message_id || payload.messageId || payload.id;
      const status = payload.status || payload.delivery_status;

      if (!messageId) {
        logger.warn('SMS DLR webhook missing message ID', {
          requestId,
          payload
        });
        // Return 200 to acknowledge receipt even if we can't process it
        return res.status(200).json({ received: true });
      }

      // Update delivery status in Redis
      await smsService.updateDeliveryStatus(messageId, status);

      logger.info('SMS delivery status updated', {
        requestId,
        messageId,
        status
      });

      // Acknowledge receipt
      return res.status(200).json({
        success: true,
        messageId,
        requestId
      });
    } catch (error) {
      logger.error('Failed to process SMS DLR webhook', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return 200 to prevent retries for unprocessable webhooks
      return res.status(200).json({ received: true });
    }
  });

  return router;
}

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return '****';
  }
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}
