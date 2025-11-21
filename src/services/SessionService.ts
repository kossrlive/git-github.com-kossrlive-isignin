/**
 * Session Service
 * Manages customer session tokens with Redis storage
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { randomBytes } from 'crypto';
import type { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

// Default configuration values
const DEFAULT_SESSION_TTL = 86400; // 24 hours in seconds

export interface SessionData {
  sessionId: string;
  shop: string;
  customerId: string;
  customerEmail: string;
  createdAt: number;
  expiresAt: number;
}

export class SessionService {
  private readonly redis: Redis;
  private readonly sessionTTL: number;

  constructor(redis: Redis, config?: {
    sessionTTL?: number;
  }) {
    this.redis = redis;
    this.sessionTTL = config?.sessionTTL || DEFAULT_SESSION_TTL;
  }

  /**
   * Generate a secure session token
   * Requirement 13.1: Generate session tokens
   */
  generateSessionToken(): string {
    // Generate 32 bytes (256 bits) of random data
    const token = randomBytes(32).toString('hex');
    return token;
  }

  /**
   * Create a new session for authenticated customer
   * Requirement 13.1: Create session token stored in Redis
   * Requirement 13.2: Set expiration time of 24 hours
   */
  async createSession(
    shop: string,
    customerId: string,
    customerEmail: string
  ): Promise<string> {
    const sessionId = this.generateSessionToken();
    const now = Date.now();
    const expiresAt = now + (this.sessionTTL * 1000);

    const sessionData: SessionData = {
      sessionId,
      shop,
      customerId,
      customerEmail,
      createdAt: now,
      expiresAt
    };

    const key = this.getSessionKey(sessionId);

    try {
      // Store session in Redis with TTL
      await this.redis.setex(
        key,
        this.sessionTTL,
        JSON.stringify(sessionData)
      );

      logger.info('Session created', {
        sessionId,
        shop,
        customerId,
        customerEmail: this.maskEmail(customerEmail),
        ttl: this.sessionTTL
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create session', {
        shop,
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to create session');
    }
  }

  /**
   * Validate session token
   * Requirement 13.3: Validate session tokens
   */
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getSessionKey(sessionId);

    try {
      const sessionDataStr = await this.redis.get(key);

      if (!sessionDataStr) {
        logger.warn('Session not found or expired', {
          sessionId
        });
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);

      // Double-check expiration (Redis TTL should handle this, but be defensive)
      if (sessionData.expiresAt < Date.now()) {
        logger.warn('Session expired', {
          sessionId,
          expiresAt: new Date(sessionData.expiresAt).toISOString()
        });
        // Clean up expired session
        await this.invalidateSession(sessionId);
        return null;
      }

      logger.info('Session validated', {
        sessionId,
        customerId: sessionData.customerId,
        shop: sessionData.shop
      });

      return sessionData;
    } catch (error) {
      logger.error('Failed to validate session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Invalidate session on logout
   * Requirement 13.5: Logout invalidates session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);

    try {
      await this.redis.del(key);

      logger.info('Session invalidated', {
        sessionId
      });
    } catch (error) {
      logger.error('Failed to invalidate session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to invalidate session');
    }
  }

  /**
   * Get session data without validation
   * Useful for debugging or admin purposes
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getSessionKey(sessionId);

    try {
      const sessionDataStr = await this.redis.get(key);

      if (!sessionDataStr) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);
      return sessionData;
    } catch (error) {
      logger.error('Failed to get session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Refresh session TTL (extend expiration)
   * Useful for "remember me" functionality
   */
  async refreshSession(sessionId: string): Promise<boolean> {
    const key = this.getSessionKey(sessionId);

    try {
      const sessionData = await this.getSession(sessionId);

      if (!sessionData) {
        logger.warn('Cannot refresh non-existent session', {
          sessionId
        });
        return false;
      }

      // Update expiration time
      sessionData.expiresAt = Date.now() + (this.sessionTTL * 1000);

      // Reset TTL in Redis
      await this.redis.setex(
        key,
        this.sessionTTL,
        JSON.stringify(sessionData)
      );

      logger.info('Session refreshed', {
        sessionId,
        newExpiresAt: new Date(sessionData.expiresAt).toISOString()
      });

      return true;
    } catch (error) {
      logger.error('Failed to refresh session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get all active sessions for a customer
   * Useful for "logout all devices" functionality
   */
  async getCustomerSessions(customerId: string): Promise<SessionData[]> {
    try {
      // Scan for all session keys
      const pattern = this.getSessionKey('*');
      const keys = await this.scanKeys(pattern);

      const sessions: SessionData[] = [];

      for (const key of keys) {
        const sessionDataStr = await this.redis.get(key);
        if (sessionDataStr) {
          const sessionData: SessionData = JSON.parse(sessionDataStr);
          if (sessionData.customerId === customerId) {
            sessions.push(sessionData);
          }
        }
      }

      logger.info('Retrieved customer sessions', {
        customerId,
        sessionCount: sessions.length
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get customer sessions', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Invalidate all sessions for a customer
   * Useful for "logout all devices" functionality
   */
  async invalidateCustomerSessions(customerId: string): Promise<number> {
    try {
      const sessions = await this.getCustomerSessions(customerId);

      let invalidatedCount = 0;
      for (const session of sessions) {
        await this.invalidateSession(session.sessionId);
        invalidatedCount++;
      }

      logger.info('Invalidated all customer sessions', {
        customerId,
        count: invalidatedCount
      });

      return invalidatedCount;
    } catch (error) {
      logger.error('Failed to invalidate customer sessions', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to invalidate customer sessions');
    }
  }

  /**
   * Scan Redis keys with pattern
   * Helper method to find keys matching a pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get Redis key for session
   */
  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Mask email for logging (PII protection)
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) {
      return '***';
    }
    const maskedLocal = localPart.length > 2
      ? localPart[0] + '***' + localPart[localPart.length - 1]
      : '***';
    return `${maskedLocal}@${domain}`;
  }
}
