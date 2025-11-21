/**
 * Multipass Service
 * Handles Multipass token generation for Shopify Plus
 * Requirements: 4.1, 4.2, 4.3
 */

import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../config/logger.js';

export interface CustomerData {
  email: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  tag_string?: string;
  identifier?: string;
  remote_ip?: string;
  return_to?: string;
}

export class MultipassService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get Multipass secret for a shop
   */
  private async getMultipassSecret(shopDomain: string): Promise<string> {
    // In production, this would fetch the Multipass secret from shop settings
    // For now, we'll use environment variable or throw error
    const secret = process.env.SHOPIFY_MULTIPASS_SECRET;
    
    if (!secret) {
      throw new Error(`Multipass secret not configured for shop: ${shopDomain}`);
    }
    
    return secret;
  }

  /**
   * Derive encryption and signing keys from Multipass secret
   */
  private deriveKeys(multipassSecret: string): { encryptionKey: Buffer; signingKey: Buffer } {
    // Shopify uses SHA256 hash of the secret, split into two 16-byte keys
    const hash = crypto.createHash('sha256').update(multipassSecret).digest();
    return {
      encryptionKey: hash.slice(0, 16), // First 16 bytes for encryption
      signingKey: hash.slice(16, 32)    // Last 16 bytes for signing
    };
  }

  /**
   * Generate Multipass token with customer data
   * Requirement 4.1: Generate Multipass tokens with customer data
   */
  async generateToken(shopDomain: string, customer: CustomerData, returnTo?: string): Promise<string> {
    try {
      // Get Multipass secret for this shop
      const multipassSecret = await this.getMultipassSecret(shopDomain);
      const { encryptionKey, signingKey } = this.deriveKeys(multipassSecret);

      // Add return_to if provided
      const customerData = {
        ...customer,
        ...(returnTo && { return_to: returnTo })
      };

      logger.info('Generating Multipass token', {
        email: customer.email,
        shopDomain,
        hasReturnTo: !!returnTo
      });

      // Encrypt and sign the customer data
      const token = this.encryptAndSign(customerData, encryptionKey, signingKey);

      logger.info('Multipass token generated successfully', {
        email: customer.email,
        shopDomain
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate Multipass token', {
        email: customer.email,
        shopDomain,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate Multipass token');
    }
  }

  /**
   * Encrypt and sign customer data using Multipass secret
   * Requirement 4.2: Encrypt and sign tokens using Multipass secret
   */
  private encryptAndSign(data: object, encryptionKey: Buffer, signingKey: Buffer): string {
    try {
      // Convert customer data to JSON
      const customerDataJSON = JSON.stringify(data);

      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Encrypt the customer data using AES-128-CBC
      const cipher = crypto.createCipheriv('aes-128-cbc', encryptionKey, iv);
      let encrypted = cipher.update(customerDataJSON, 'utf8', 'binary');
      encrypted += cipher.final('binary');

      // Concatenate IV and encrypted data
      const encryptedData = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'binary')
      ]);

      // Sign the encrypted data using HMAC-SHA256
      const hmac = crypto.createHmac('sha256', signingKey);
      hmac.update(encryptedData);
      const signature = hmac.digest();

      // Concatenate encrypted data and signature
      const token = Buffer.concat([encryptedData, signature]);

      // Encode as URL-safe Base64
      return token.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (error) {
      logger.error('Failed to encrypt and sign Multipass data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to encrypt and sign Multipass data');
    }
  }

  /**
   * Generate redirect URL with Multipass token
   * Requirement 4.3: Generate redirect URL with token
   */
  async generateMultipassUrl(shopDomain: string, customer: CustomerData, returnTo?: string): Promise<string> {
    const token = await this.generateToken(shopDomain, customer, returnTo);

    // Construct the Multipass URL
    const multipassUrl = `https://${shopDomain}/account/login/multipass/${token}`;

    logger.info('Multipass URL generated', {
      email: customer.email,
      shopDomain
    });

    return multipassUrl;
  }

  /**
   * Validate customer data before generating token
   */
  validateCustomerData(customer: CustomerData): boolean {
    if (!customer.email) {
      throw new Error('Customer email is required');
    }

    if (!customer.created_at) {
      throw new Error('Customer created_at timestamp is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      throw new Error('Invalid email format');
    }

    // Validate created_at is a valid ISO8601 timestamp
    const timestamp = new Date(customer.created_at);
    if (isNaN(timestamp.getTime())) {
      throw new Error('Invalid created_at timestamp');
    }

    return true;
  }
}
