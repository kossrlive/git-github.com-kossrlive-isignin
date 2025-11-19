/**
 * Multipass Service
 * Handles Multipass token generation for Shopify Plus
 * Requirements: 4.1, 4.2, 4.3
 */

import crypto from 'crypto';
import { config } from '../config/index.js';
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
  private readonly multipassSecret: string;
  private readonly encryptionKey: Buffer;
  private readonly signingKey: Buffer;

  constructor(multipassSecret?: string) {
    this.multipassSecret = multipassSecret || config.shopify.multipassSecret;
    
    if (!this.multipassSecret) {
      throw new Error('Multipass secret is required');
    }

    // Derive encryption and signing keys from the Multipass secret
    // Shopify uses SHA256 hash of the secret, split into two 16-byte keys
    const hash = crypto.createHash('sha256').update(this.multipassSecret).digest();
    this.encryptionKey = hash.slice(0, 16); // First 16 bytes for encryption
    this.signingKey = hash.slice(16, 32);   // Last 16 bytes for signing
  }

  /**
   * Generate Multipass token with customer data
   * Requirement 4.1: Generate Multipass tokens with customer data
   */
  generateToken(customer: CustomerData, returnTo?: string): string {
    try {
      // Add return_to if provided
      const customerData = {
        ...customer,
        ...(returnTo && { return_to: returnTo })
      };

      logger.info('Generating Multipass token', {
        email: customer.email,
        hasReturnTo: !!returnTo
      });

      // Encrypt and sign the customer data
      const token = this.encryptAndSign(customerData);

      logger.info('Multipass token generated successfully', {
        email: customer.email
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate Multipass token', {
        email: customer.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate Multipass token');
    }
  }

  /**
   * Encrypt and sign customer data using Multipass secret
   * Requirement 4.2: Encrypt and sign tokens using Multipass secret
   */
  encryptAndSign(data: object): string {
    try {
      // Convert customer data to JSON
      const customerDataJSON = JSON.stringify(data);

      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Encrypt the customer data using AES-128-CBC
      const cipher = crypto.createCipheriv('aes-128-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(customerDataJSON, 'utf8', 'binary');
      encrypted += cipher.final('binary');

      // Concatenate IV and encrypted data
      const encryptedData = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'binary')
      ]);

      // Sign the encrypted data using HMAC-SHA256
      const hmac = crypto.createHmac('sha256', this.signingKey);
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
  generateMultipassUrl(customer: CustomerData, returnTo?: string): string {
    const token = this.generateToken(customer, returnTo);
    const shopDomain = config.shopify.shopDomain;

    if (!shopDomain) {
      throw new Error('Shop domain is not configured');
    }

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
