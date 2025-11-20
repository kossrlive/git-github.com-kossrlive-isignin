import { NextFunction, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { getRedisClient } from '../config/redis.js';
import { RateLimitError } from '../errors/index.js';

/**
 * IP-based rate limiting middleware
 * Requirements: 6.3 - Rate limiting (10 requests per minute per IP)
 */

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyPrefix?: string;    // Redis key prefix
  redis?: Redis;         // Optional Redis client (for testing)
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 10,       // 10 requests per minute
  keyPrefix: 'ratelimit',
};

/**
 * Creates a rate limiting middleware
 * Tracks requests per IP in Redis with TTL
 * Blocks requests after threshold is exceeded
 */
export const createRateLimiter = (options: Partial<RateLimitOptions> = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = config.redis || getRedisClient();
      
      // Get client IP address
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Create Redis key for this IP and endpoint
      const endpoint = req.path;
      const key = `${config.keyPrefix}:${ip}:${endpoint}`;
      
      // Get current request count
      const currentCount = await redis.get(key);
      const requestCount = currentCount ? parseInt(currentCount, 10) : 0;
      
      // Check if rate limit exceeded
      if (requestCount >= config.maxRequests) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000);
        
        req.logger?.warn('Rate limit exceeded', {
          ip,
          endpoint,
          requestCount,
          limit: config.maxRequests,
        });
        
        // Set Retry-After header
        res.setHeader('Retry-After', retryAfter.toString());
        res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', (Date.now() + retryAfter * 1000).toString());
        
        throw new RateLimitError(
          'Too many requests, please try again later',
          retryAfter
        );
      }
      
      // Increment request count
      const newCount = await redis.incr(key);
      
      // Set TTL on first request
      if (newCount === 1) {
        await redis.pexpire(key, config.windowMs);
      }
      
      // Set rate limit headers
      const remaining = Math.max(0, config.maxRequests - newCount);
      const ttl = await redis.pttl(key);
      const resetTime = Date.now() + (ttl > 0 ? ttl : config.windowMs);
      
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toString());
      
      next();
    } catch (error) {
      // If it's already a RateLimitError, pass it through
      if (error instanceof RateLimitError) {
        next(error);
        return;
      }
      
      // Log Redis errors but don't block requests
      req.logger?.error('Rate limiter error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Allow request to proceed if Redis fails
      next();
    }
  };
};

/**
 * Default rate limiter with standard settings
 * 10 requests per minute per IP
 */
export const rateLimiter = createRateLimiter();
