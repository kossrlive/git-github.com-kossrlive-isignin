/**
 * Redis client configuration for server-side use
 * Provides a singleton Redis instance for the app
 */

import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

let redis: Redis | null = null;

/**
 * Get or create Redis client instance
 * Uses singleton pattern to ensure only one connection
 */
export function getRedis(): Redis {
  if (redis) {
    return redis;
  }

  // Get Redis configuration from environment variables
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  logger.info('Initializing Redis connection', { redisUrl: redisUrl.replace(/:[^:]*@/, ':***@') });

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis connection retry', { attempt: times, delay });
        return delay;
      },
      reconnectOnError(err) {
        logger.error('Redis connection error', { error: err.message });
        // Reconnect on READONLY errors
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      }
    });

    redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redis.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return redis;
  } catch (error) {
    logger.error('Failed to initialize Redis', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Failed to initialize Redis connection');
  }
}

/**
 * Close Redis connection
 * Should be called when shutting down the application
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    logger.info('Closing Redis connection');
    await redis.quit();
    redis = null;
  }
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return redis !== null && redis.status === 'ready';
}
