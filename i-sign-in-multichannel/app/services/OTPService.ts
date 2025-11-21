/**
 * OTP Service
 * Manages OTP generation, storage, validation, and rate limiting
 * Requirements: 1.2, 1.4, 6.1, 6.2, 6.4
 */

import type { Redis } from 'ioredis';
import { logger } from '../config/logger';

// Default configuration values
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_TTL = 300; // 5 minutes
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BLOCK_DURATION = 900; // 15 minutes

export class OTPService {
  private readonly redis: Redis;
  private readonly otpLength: number;
  private readonly otpTTL: number;
  private readonly maxAttempts: number;
  private readonly blockDuration: number;

  constructor(redis: Redis, config?: {
    otpLength?: number;
    otpTTL?: number;
    maxAttempts?: number;
    blockDuration?: number;
  }) {
    this.redis = redis;
    this.otpLength = config?.otpLength || DEFAULT_OTP_LENGTH;
    this.otpTTL = config?.otpTTL || DEFAULT_OTP_TTL;
    this.maxAttempts = config?.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    this.blockDuration = config?.blockDuration || DEFAULT_BLOCK_DURATION;
  }

  /**
   * Generate a random 6-digit OTP code
   * Requirement 1.2: Generate 6-digit OTP codes
   */
  generateOTP(length: number = this.otpLength): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * digits.length);
      otp += digits[randomIndex];
    }
    
    return otp;
  }

  /**
   * Store OTP in Redis with TTL and metadata
   * Requirement 9.3: Store OTP with expiration, attempts, and created timestamp
   */
  async storeOTP(phone: string, otp: string, ttl: number = this.otpTTL): Promise<void> {
    const key = this.getOTPKey(phone);
    
    try {
      // Store OTP with metadata as JSON
      const otpData = {
        code: otp,
        attempts: 0,
        createdAt: Date.now(),
      };
      
      await this.redis.setex(key, ttl, JSON.stringify(otpData));
      
      logger.info('OTP stored in Redis with metadata', {
        phone: this.maskPhone(phone),
        ttl,
        createdAt: otpData.createdAt,
      });
    } catch (error) {
      logger.error('Failed to store OTP in Redis', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to store OTP');
    }
  }

  /**
   * Verify OTP against stored value
   * Requirement 1.4: Verify OTP against stored value
   * Requirement 9.3: Track attempts in OTP metadata
   */
  async verifyOTP(phone: string, otp: string): Promise<boolean> {
    // Check if phone is blocked
    if (await this.isBlocked(phone)) {
      logger.warn('OTP verification attempted for blocked phone', {
        phone: this.maskPhone(phone)
      });
      return false;
    }

    const key = this.getOTPKey(phone);
    
    try {
      const storedData = await this.redis.get(key);
      
      if (!storedData) {
        logger.warn('OTP not found or expired', {
          phone: this.maskPhone(phone)
        });
        await this.incrementFailedAttempts(phone);
        return false;
      }
      
      // Parse OTP data from JSON
      let otpData: { code: string; attempts: number; createdAt: number };
      try {
        otpData = JSON.parse(storedData);
      } catch {
        // Fallback for old format (plain string)
        otpData = { code: storedData, attempts: 0, createdAt: Date.now() };
      }
      
      const isValid = otpData.code === otp;
      
      if (isValid) {
        logger.info('OTP verified successfully', {
          phone: this.maskPhone(phone),
          attempts: otpData.attempts,
          ageMs: Date.now() - otpData.createdAt,
        });
        // Delete OTP after successful use (Requirement 6.4)
        await this.deleteOTP(phone);
        // Reset failed attempts counter
        await this.resetFailedAttempts(phone);
      } else {
        // Increment attempts in metadata
        otpData.attempts += 1;
        
        logger.warn('Invalid OTP provided', {
          phone: this.maskPhone(phone),
          attempts: otpData.attempts,
        });
        
        // Update OTP data with incremented attempts
        const ttl = await this.redis.ttl(key);
        if (ttl > 0) {
          await this.redis.setex(key, ttl, JSON.stringify(otpData));
        }
        
        await this.incrementFailedAttempts(phone);
      }
      
      return isValid;
    } catch (error) {
      logger.error('Failed to verify OTP', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to verify OTP');
    }
  }

  /**
   * Increment failed attempts counter
   * Requirement 6.1: Track failed attempts counter in Redis
   */
  async incrementFailedAttempts(phone: string): Promise<number> {
    const key = this.getFailedAttemptsKey(phone);
    
    try {
      const attempts = await this.redis.incr(key);
      
      // Set TTL on first attempt
      if (attempts === 1) {
        await this.redis.expire(key, this.blockDuration);
      }
      
      logger.info('Failed OTP attempts incremented', {
        phone: this.maskPhone(phone),
        attempts
      });
      
      // Block phone if max attempts reached (Requirement 6.2)
      if (attempts >= this.maxAttempts) {
        await this.blockPhone(phone, this.blockDuration);
        logger.warn('Phone blocked due to too many failed attempts', {
          phone: this.maskPhone(phone),
          attempts,
          blockDuration: this.blockDuration
        });
      }
      
      return attempts;
    } catch (error) {
      logger.error('Failed to increment failed attempts', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to track failed attempts');
    }
  }

  /**
   * Check if phone is blocked
   * Requirement 6.2: Check if phone is blocked
   */
  async isBlocked(phone: string): Promise<boolean> {
    const key = this.getBlockedKey(phone);
    
    try {
      const blocked = await this.redis.exists(key);
      return blocked === 1;
    } catch (error) {
      logger.error('Failed to check if phone is blocked', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false; // Fail open to not block legitimate users
    }
  }

  /**
   * Block phone for specified duration
   * Requirement 6.2: Implement phone blocking logic (5 attempts = 15 min block)
   */
  async blockPhone(phone: string, duration: number = this.blockDuration): Promise<void> {
    const key = this.getBlockedKey(phone);
    
    try {
      await this.redis.setex(key, duration, '1');
      
      logger.warn('Phone blocked', {
        phone: this.maskPhone(phone),
        duration
      });
    } catch (error) {
      logger.error('Failed to block phone', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to block phone');
    }
  }

  /**
   * Delete OTP after successful use
   * Requirement 6.4: Delete OTP after successful use
   */
  async deleteOTP(phone: string): Promise<void> {
    const key = this.getOTPKey(phone);
    
    try {
      await this.redis.del(key);
      
      logger.info('OTP deleted after successful use', {
        phone: this.maskPhone(phone)
      });
    } catch (error) {
      logger.error('Failed to delete OTP', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw error here as OTP will expire anyway
    }
  }

  /**
   * Reset failed attempts counter
   */
  private async resetFailedAttempts(phone: string): Promise<void> {
    const key = this.getFailedAttemptsKey(phone);
    
    try {
      await this.redis.del(key);
      
      logger.info('Failed attempts counter reset', {
        phone: this.maskPhone(phone)
      });
    } catch (error) {
      logger.error('Failed to reset failed attempts', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get failed attempts count
   */
  async getFailedAttempts(phone: string): Promise<number> {
    const key = this.getFailedAttemptsKey(phone);
    
    try {
      const attempts = await this.redis.get(key);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      logger.error('Failed to get failed attempts count', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Check if resend is allowed (30 seconds cooldown)
   * Requirement 5.4: Check that at least 30 seconds passed since last send
   */
  async canResendOTP(phone: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = this.getLastSendKey(phone);
    
    try {
      const lastSendTime = await this.redis.get(key);
      
      if (!lastSendTime) {
        return { allowed: true };
      }
      
      const lastSend = parseInt(lastSendTime, 10);
      const now = Date.now();
      const timeSinceLastSend = now - lastSend;
      const minInterval = 30 * 1000; // 30 seconds
      
      if (timeSinceLastSend < minInterval) {
        const retryAfter = Math.ceil((minInterval - timeSinceLastSend) / 1000);
        
        logger.warn('OTP resend attempted too soon', {
          phone: this.maskPhone(phone),
          timeSinceLastSend: `${Math.floor(timeSinceLastSend / 1000)}s`,
          retryAfter: `${retryAfter}s`
        });
        
        return { allowed: false, retryAfter };
      }
      
      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check resend cooldown', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail open to not block legitimate users
      return { allowed: true };
    }
  }

  /**
   * Track send attempt and check if phone should be blocked
   * Requirement 5.5: Track send attempts (3 per 10 minutes), block after 3 attempts
   */
  async trackSendAttempt(phone: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = this.getSendAttemptsKey(phone);
    const maxSendAttempts = 3;
    const windowSeconds = 10 * 60; // 10 minutes
    const blockDurationSeconds = 10 * 60; // 10 minutes
    
    try {
      const attempts = await this.redis.incr(key);
      
      // Set TTL on first attempt
      if (attempts === 1) {
        await this.redis.expire(key, windowSeconds);
      }
      
      logger.info('Send attempt tracked', {
        phone: this.maskPhone(phone),
        attempts,
        maxAttempts: maxSendAttempts
      });
      
      if (attempts > maxSendAttempts) {
        // Block phone for 10 minutes
        const blockKey = this.getSendBlockedKey(phone);
        await this.redis.setex(blockKey, blockDurationSeconds, '1');
        
        const ttl = await this.redis.ttl(blockKey);
        
        logger.warn('Phone blocked due to too many send attempts', {
          phone: this.maskPhone(phone),
          attempts,
          blockDuration: blockDurationSeconds
        });
        
        return { allowed: false, retryAfter: ttl > 0 ? ttl : blockDurationSeconds };
      }
      
      return { allowed: true };
    } catch (error) {
      logger.error('Failed to track send attempt', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail open to not block legitimate users
      return { allowed: true };
    }
  }

  /**
   * Check if phone is blocked from sending
   * Requirement 5.5: Check if phone is blocked from sending
   */
  async isSendBlocked(phone: string): Promise<boolean> {
    const key = this.getSendBlockedKey(phone);
    
    try {
      const blocked = await this.redis.exists(key);
      return blocked === 1;
    } catch (error) {
      logger.error('Failed to check if phone is send-blocked', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false; // Fail open
    }
  }

  /**
   * Record the timestamp of OTP send
   * Requirement 5.4: Track last send time for rate limiting
   */
  async recordSendTime(phone: string): Promise<void> {
    const key = this.getLastSendKey(phone);
    const ttl = 60; // Keep for 1 minute (longer than 30s cooldown)
    
    try {
      await this.redis.setex(key, ttl, Date.now().toString());
      
      logger.info('Send time recorded', {
        phone: this.maskPhone(phone)
      });
    } catch (error) {
      logger.error('Failed to record send time', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - this is not critical
    }
  }

  // Redis key helpers
  private getOTPKey(phone: string): string {
    return `otp:${phone}`;
  }

  private getFailedAttemptsKey(phone: string): string {
    return `otp:attempts:${phone}`;
  }

  private getBlockedKey(phone: string): string {
    return `otp:blocked:${phone}`;
  }

  private getLastSendKey(phone: string): string {
    return `otp:lastsend:${phone}`;
  }

  private getSendAttemptsKey(phone: string): string {
    return `otp:sendattempts:${phone}`;
  }

  private getSendBlockedKey(phone: string): string {
    return `otp:sendblocked:${phone}`;
  }

  // Mask phone number for logging (PII protection)
  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }
}
