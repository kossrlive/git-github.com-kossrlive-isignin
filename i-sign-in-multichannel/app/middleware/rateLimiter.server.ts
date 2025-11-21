/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP address
 * Requirements: 9.1, 9.2
 */

import type { Redis } from 'ioredis';
import { logger } from '../config/logger';

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  keyPrefix?: string;  // Redis key prefix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Rate limiter class for managing request limits per IP
 */
export class RateLimiter {
  private readonly redis: Redis;
  private readonly config: Required<RateLimitConfig>;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix || 'ratelimit',
    };
  }

  /**
   * Check if request is allowed and increment counter
   * Requirement 9.1: Enforce rate limits per IP address
   */
  async checkLimit(identifier: string, endpoint: string): Promise<RateLimitResult> {
    const key = this.getRateLimitKey(identifier, endpoint);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove old entries outside the time window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count requests in current window
      pipeline.zcard(key);
      
      // Add current request timestamp
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration on the key
      pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      // Get count before adding current request
      const count = (results[1][1] as number) || 0;
      const allowed = count < this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - count - 1);
      const resetAt = now + this.config.windowMs;

      if (!allowed) {
        // Calculate retry after in seconds
        const retryAfter = Math.ceil(this.config.windowMs / 1000);
        
        logger.warn('Rate limit exceeded', {
          identifier: this.maskIdentifier(identifier),
          endpoint,
          count: count + 1,
          maxRequests: this.config.maxRequests,
          retryAfter,
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      logger.debug('Rate limit check passed', {
        identifier: this.maskIdentifier(identifier),
        endpoint,
        count: count + 1,
        remaining,
      });

      return {
        allowed: true,
        remaining,
        resetAt,
      };
    } catch (error) {
      logger.error('Rate limit check failed', {
        identifier: this.maskIdentifier(identifier),
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: now + this.config.windowMs,
      };
    }
  }

  /**
   * Get current request count for an identifier
   */
  async getCount(identifier: string, endpoint: string): Promise<number> {
    const key = this.getRateLimitKey(identifier, endpoint);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Count requests in current window
      const count = await this.redis.zcount(key, windowStart, now);
      return count;
    } catch (error) {
      logger.error('Failed to get rate limit count', {
        identifier: this.maskIdentifier(identifier),
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, endpoint: string): Promise<void> {
    const key = this.getRateLimitKey(identifier, endpoint);

    try {
      await this.redis.del(key);
      
      logger.info('Rate limit reset', {
        identifier: this.maskIdentifier(identifier),
        endpoint,
      });
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        identifier: this.maskIdentifier(identifier),
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate Redis key for rate limiting
   */
  private getRateLimitKey(identifier: string, endpoint: string): string {
    return `${this.config.keyPrefix}:${endpoint}:${identifier}`;
  }

  /**
   * Mask identifier for logging (PII protection)
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.includes('.')) {
      // IP address - mask middle octets
      const parts = identifier.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.***.***.${parts[3]}`;
      }
    }
    
    // Generic masking
    if (identifier.length <= 4) {
      return '****';
    }
    return identifier.slice(0, 2) + '****' + identifier.slice(-2);
  }
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(request: Request): string {
  // Check common headers for IP address (in order of preference)
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',  // Cloudflare
    'x-client-ip',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip) {
        return ip;
      }
    }
  }

  // Fallback to 'unknown' if no IP found
  return 'unknown';
}

/**
 * Create rate limit response with appropriate headers
 * Requirement 9.2: Return 429 Too Many Requests when limit exceeded
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': String(result.remaining + 1),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  });

  if (result.retryAfter) {
    headers.set('Retry-After', String(result.retryAfter));
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
      },
    }),
    {
      status: 429,
      headers,
    }
  );
}
