import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AuthenticationError } from '../errors/index.js';

/**
 * HMAC validation middleware for Shopify requests
 * Requirements: 11.5 - Validate HMAC signature for Shopify requests
 */

interface HMACValidationOptions {
  secret: string;
  headerName?: string;
  queryParamName?: string;
}

/**
 * Validates HMAC signature from Shopify
 * Can validate from query parameter or header
 */
export const createHMACValidator = (options: HMACValidationOptions) => {
  const { secret, headerName = 'x-shopify-hmac-sha256', queryParamName = 'hmac' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Get HMAC from header or query parameter
      const hmacFromHeader = req.headers[headerName] as string;
      const hmacFromQuery = req.query[queryParamName] as string;
      const providedHmac = hmacFromHeader || hmacFromQuery;

      if (!providedHmac) {
        req.logger?.warn('HMAC validation failed: No HMAC provided', {
          path: req.path,
          ip: req.ip,
        });
        throw new AuthenticationError('Missing HMAC signature');
      }

      // For query parameter HMAC (OAuth callback, webhooks via GET)
      if (hmacFromQuery) {
        const isValid = validateQueryHMAC(req, secret, hmacFromQuery);
        
        if (!isValid) {
          req.logger?.warn('HMAC validation failed: Invalid query HMAC', {
            path: req.path,
            ip: req.ip,
          });
          throw new AuthenticationError('Invalid HMAC signature');
        }
      }
      
      // For header HMAC (webhooks via POST)
      if (hmacFromHeader) {
        const isValid = validateHeaderHMAC(req, secret, hmacFromHeader);
        
        if (!isValid) {
          req.logger?.warn('HMAC validation failed: Invalid header HMAC', {
            path: req.path,
            ip: req.ip,
          });
          throw new AuthenticationError('Invalid HMAC signature');
        }
      }

      req.logger?.info('HMAC validation successful', {
        path: req.path,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate HMAC from query parameters (OAuth, GET webhooks)
 * Shopify calculates HMAC on all query params except 'hmac' and 'signature'
 */
function validateQueryHMAC(req: Request, secret: string, providedHmac: string): boolean {
  try {
    // Get all query parameters except hmac and signature
    const params = { ...req.query };
    delete params.hmac;
    delete params.signature;

    // Sort parameters alphabetically and create query string
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    // Calculate HMAC
    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(sortedParams)
      .digest('hex');

    // Compare HMACs (timing-safe comparison)
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(providedHmac)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Validate HMAC from header (POST webhooks)
 * Shopify calculates HMAC on the raw request body
 */
function validateHeaderHMAC(req: Request, secret: string, providedHmac: string): boolean {
  try {
    // Get raw body (must be available - use express.raw() middleware for webhook routes)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Calculate HMAC
    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    // Compare HMACs (timing-safe comparison)
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(providedHmac)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Middleware to capture raw body for HMAC validation
 * Must be used before express.json() middleware
 */
export const captureRawBody = (req: Request, res: Response, next: NextFunction): void => {
  const chunks: Buffer[] = [];
  
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks).toString('utf8');
    next();
  });
};

/**
 * Default HMAC validator using Shopify API secret from environment
 */
export const shopifyHMACValidator = () => {
  const secret = process.env.SHOPIFY_API_SECRET;
  
  if (!secret) {
    throw new Error('SHOPIFY_API_SECRET environment variable is required for HMAC validation');
  }
  
  return createHMACValidator({ secret });
};
