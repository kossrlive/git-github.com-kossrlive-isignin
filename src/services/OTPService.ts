/**
 * OTP Service
 * Manages OTP generation, storage, validation, and rate limiting
 * Requirements: 1.2, 1.4, 6.1, 6.2, 6.4
 */

import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export class OTPService {
  private readonly redis: Redis;
  private readonly otpLength: number;
  private readonly otpTTL: number;
  private readonly maxAttempts: number;
  private readonly blockDuration: number;

  constructor(redis: Redis) {
    this.redis = redis;
    this.otpLength = config.otp.length;
    this.otpTTL = config.otp.ttlSeconds;
    this.maxAttempts = config.otp.maxAttempts;
    this.blockDuration = config.otp.blockDurationSeconds;
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
   * Store OTP in Redis with TTL
   * Requirement 1.2: Store OTP in Redis with 5-minute TTL
   */
  async storeOTP(phone: string, otp: string, ttl: number = this.otpTTL): Promise<void> {
    const key = this.getOTPKey(phone);
    
    try {
      await this.redis.setex(key, ttl, otp);
      
      logger.info('OTP stored in Redis', {
        phone: this.maskPhone(phone),
        ttl
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
      const storedOTP = await this.redis.get(key);
      
      if (!storedOTP) {
        logger.warn('OTP not found or expired', {
          phone: this.maskPhone(phone)
        });
        await this.incrementFailedAttempts(phone);
        return false;
      }
      
      const isValid = storedOTP === otp;
      
      if (isValid) {
        logger.info('OTP verified successfully', {
          phone: this.maskPhone(phone)
        });
        // Delete OTP after successful use (Requirement 6.4)
        await this.deleteOTP(phone);
        // Reset failed attempts counter
        await this.resetFailedAttempts(phone);
      } else {
        logger.warn('Invalid OTP provided', {
          phone: this.maskPhone(phone)
        });
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

  // Mask phone number for logging (PII protection)
  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }
}
