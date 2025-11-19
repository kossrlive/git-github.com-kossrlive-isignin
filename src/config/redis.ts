import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger.js';

/**
 * Redis configuration with TLS support
 * Requirements: 9.4 - Secure connection (TLS) for Redis
 */
export const createRedisClient = (): Redis => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const useTLS = process.env.REDIS_TLS === 'true';

  const config: RedisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  };

  // Add TLS configuration if enabled
  if (useTLS) {
    config.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  const redis = new Redis(redisUrl, config);

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('ready', () => {
    logger.info('Redis client ready');
  });

  redis.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  redis.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  return redis;
};

// Singleton instance
let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client closed');
  }
};
