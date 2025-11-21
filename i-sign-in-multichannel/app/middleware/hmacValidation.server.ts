/**
 * HMAC Validation Middleware
 * Validates webhook signatures from Shopify
 * Requirement 9.5: Validate HMAC signatures for webhook requests
 */

import * as crypto from 'crypto';
import { logger } from '../config/logger';

/**
 * Validate Shopify webhook HMAC signature
 * Requirement 9.5: Use app client secret for validation
 */
export async function validateWebhookHmac(
  request: Request,
  apiSecret: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get HMAC from header
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    
    if (!hmacHeader) {
      logger.warn('Webhook HMAC validation failed: Missing HMAC header');
      return {
        valid: false,
        error: 'Missing HMAC signature',
      };
    }

    // Get raw body
    const body = await request.text();
    
    if (!body) {
      logger.warn('Webhook HMAC validation failed: Empty body');
      return {
        valid: false,
        error: 'Empty request body',
      };
    }

    // Calculate expected HMAC
    const hash = crypto
      .createHmac('sha256', apiSecret)
      .update(body, 'utf8')
      .digest('base64');

    // Compare HMACs using timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(hash)
    );

    if (!isValid) {
      logger.warn('Webhook HMAC validation failed: Signature mismatch', {
        receivedHmac: hmacHeader.slice(0, 10) + '...',
        expectedHmac: hash.slice(0, 10) + '...',
      });
      
      return {
        valid: false,
        error: 'Invalid HMAC signature',
      };
    }

    logger.debug('Webhook HMAC validation successful');
    
    return { valid: true };
  } catch (error) {
    logger.error('Webhook HMAC validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return {
      valid: false,
      error: 'HMAC validation failed',
    };
  }
}

/**
 * Create a response for invalid HMAC
 * Requirement 9.5: Reject requests with invalid signatures
 */
export function createInvalidHmacResponse(error?: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'INVALID_HMAC',
        message: error || 'Invalid webhook signature',
      },
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Middleware function to validate webhook HMAC
 * Usage in route handlers:
 * 
 * export async function action({ request }: ActionFunctionArgs) {
 *   const validation = await validateWebhookHmac(request, process.env.SHOPIFY_API_SECRET!);
 *   if (!validation.valid) {
 *     return createInvalidHmacResponse(validation.error);
 *   }
 *   // Process webhook...
 * }
 */
export async function requireValidHmac(
  request: Request,
  apiSecret: string
): Promise<Response | null> {
  const validation = await validateWebhookHmac(request, apiSecret);
  
  if (!validation.valid) {
    return createInvalidHmacResponse(validation.error);
  }
  
  return null;
}
