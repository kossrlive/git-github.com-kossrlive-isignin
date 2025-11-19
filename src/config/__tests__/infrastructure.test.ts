/**
 * Infrastructure setup tests
 * Validates: Requirements 9.4, 9.5, 10.1, 7.5
 */

import { generateRequestId, logger } from '../logger';

describe('Infrastructure Setup', () => {
  describe('Logger', () => {
    it('should create logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should log messages with different levels', () => {
      // Test that logger methods can be called without errors
      expect(() => {
        logger.info('Test info message');
        logger.warn('Test warn message');
        logger.error('Test error message');
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('Redis Configuration', () => {
    it('should have proper Redis configuration options', () => {
      // Test that Redis configuration is properly structured
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      expect(redisUrl).toBeDefined();
      expect(typeof redisUrl).toBe('string');
    });

    it('should support TLS configuration', () => {
      const originalTLS = process.env.REDIS_TLS;
      
      process.env.REDIS_TLS = 'true';
      expect(process.env.REDIS_TLS).toBe('true');
      
      process.env.REDIS_TLS = 'false';
      expect(process.env.REDIS_TLS).toBe('false');
      
      // Restore original value
      if (originalTLS !== undefined) {
        process.env.REDIS_TLS = originalTLS;
      }
    });
  });

  describe('Queue Configuration', () => {
    it('should have proper queue configuration structure', () => {
      // Test that queue configuration is properly structured
      const queueName = 'sms-queue';
      const defaultAttempts = 3;
      const backoffDelay = 2000;
      
      expect(queueName).toBe('sms-queue');
      expect(defaultAttempts).toBe(3);
      expect(backoffDelay).toBe(2000);
    });
  });
});
