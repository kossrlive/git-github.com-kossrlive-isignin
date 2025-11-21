/**
 * Order Service
 * Manages order OTP generation and verification for order confirmation
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { LATEST_API_VERSION, Session, shopifyApi } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { SendSMSParams } from '../providers/ISMSProvider.js';
import { OTPService } from './OTPService.js';
import { SMSService } from './SMSService.js';

export interface ShopifyOrder {
  id: string;
  order_number: string;
  customer?: {
    id: string;
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
  total_price: string;
  created_at: string;
  financial_status?: string;
  fulfillment_status?: string;
}

export class OrderService {
  private redis: Redis;
  private otpService: OTPService;
  private smsService: SMSService;
  private shopify: ReturnType<typeof shopifyApi>;
  private session: Session;
  private orderOTPTTL: number = 600; // 10 minutes

  constructor(redis: Redis, otpService: OTPService, smsService: SMSService) {
    this.redis = redis;
    this.otpService = otpService;
    this.smsService = smsService;

    // Initialize Shopify API client
    this.shopify = shopifyApi({
      apiKey: config.shopify.apiKey,
      apiSecretKey: config.shopify.apiSecret,
      scopes: config.shopify.scopes.split(','),
      hostName: config.shopify.shopDomain.replace('https://', '').replace('http://', ''),
      apiVersion: LATEST_API_VERSION,
      isEmbeddedApp: true,
    });

    // Create a session for API calls
    this.session = new Session({
      id: `offline_${config.shopify.shopDomain}`,
      shop: config.shopify.shopDomain,
      state: 'online',
      isOnline: false,
      accessToken: config.shopify.apiSecret,
    });
  }

  /**
   * Generate unique OTP for order confirmation
   * Requirement 8.1: Generate unique OTP for order
   */
  async generateOrderOTP(orderId: string, orderNumber: string, phone: string): Promise<string> {
    try {
      // Generate a 6-digit OTP
      const otp = this.otpService.generateOTP(6);

      // Store OTP with order ID in Redis (10 min TTL)
      // Requirement 8.1: Store OTP with order ID in Redis (10 min TTL)
      await this.storeOrderOTP(orderId, otp);

      logger.info('Order OTP generated', {
        orderId,
        orderNumber,
        phone: this.maskPhone(phone),
        ttl: this.orderOTPTTL
      });

      // Queue SMS with order number
      // Requirement 8.2: Queue SMS with order number
      await this.sendOrderOTPSMS(phone, otp, orderNumber);

      return otp;
    } catch (error) {
      logger.error('Failed to generate order OTP', {
        orderId,
        orderNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate order OTP');
    }
  }

  /**
   * Store order OTP in Redis with order ID
   * Requirement 8.1: Store OTP with order ID in Redis (10 min TTL)
   */
  private async storeOrderOTP(orderId: string, otp: string): Promise<void> {
    const key = this.getOrderOTPKey(orderId);

    try {
      await this.redis.setex(key, this.orderOTPTTL, otp);

      logger.info('Order OTP stored in Redis', {
        orderId,
        ttl: this.orderOTPTTL
      });
    } catch (error) {
      logger.error('Failed to store order OTP in Redis', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to store order OTP');
    }
  }

  /**
   * Send order OTP via SMS
   * Requirement 8.2: Queue SMS with order number
   */
  private async sendOrderOTPSMS(phone: string, otp: string, orderNumber: string): Promise<void> {
    try {
      const message = `Your order #${orderNumber} confirmation code is: ${otp}. This code expires in 10 minutes.`;

      const params: SendSMSParams = {
        to: phone,
        message,
        callbackUrl: `${config.shopify.appUrl}/api/webhooks/sms-dlr`
      };

      // Send SMS (this will use the queue internally via SMSService)
      const result = await this.smsService.sendSMS(params);

      if (!result.success) {
        logger.error('Failed to send order OTP SMS', {
          phone: this.maskPhone(phone),
          orderNumber,
          error: result.error
        });
        throw new Error('Failed to send order OTP SMS');
      }

      logger.info('Order OTP SMS sent', {
        phone: this.maskPhone(phone),
        orderNumber,
        messageId: result.messageId,
        provider: result.provider
      });
    } catch (error) {
      logger.error('Failed to send order OTP SMS', {
        phone: this.maskPhone(phone),
        orderNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Verify order OTP
   * Requirement 8.3: Verify OTP matches order ID
   */
  async verifyOrderOTP(orderId: string, otp: string): Promise<boolean> {
    const key = this.getOrderOTPKey(orderId);

    try {
      const storedOTP = await this.redis.get(key);

      if (!storedOTP) {
        logger.warn('Order OTP not found or expired', {
          orderId
        });
        return false;
      }

      const isValid = storedOTP === otp;

      if (isValid) {
        logger.info('Order OTP verified successfully', {
          orderId
        });

        // Delete OTP after successful use
        // Requirement 8.3: Delete OTP after use
        await this.deleteOrderOTP(orderId);
      } else {
        logger.warn('Invalid order OTP provided', {
          orderId
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Failed to verify order OTP', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to verify order OTP');
    }
  }

  /**
   * Delete order OTP after use
   * Requirement 8.3: Delete OTP after use
   */
  private async deleteOrderOTP(orderId: string): Promise<void> {
    const key = this.getOrderOTPKey(orderId);

    try {
      await this.redis.del(key);

      logger.info('Order OTP deleted after successful verification', {
        orderId
      });
    } catch (error) {
      logger.error('Failed to delete order OTP', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - OTP will expire anyway
    }
  }

  /**
   * Update order status in Shopify after verification
   * Requirement 8.4: Update order status in Shopify
   */
  async confirmOrder(orderId: string): Promise<void> {
    try {
      logger.info('Confirming order in Shopify', {
        orderId
      });

      const client = new this.shopify.clients.Rest({ session: this.session });

      // Add a note to the order indicating it was confirmed via OTP
      await client.post({
        path: `orders/${orderId}/note`,
        data: {
          note: {
            note: `Order confirmed via SMS OTP at ${new Date().toISOString()}`
          }
        }
      });

      // You could also add a tag or update custom attributes
      // depending on your specific requirements

      logger.info('Order confirmed successfully', {
        orderId
      });
    } catch (error) {
      logger.error('Failed to confirm order in Shopify', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to confirm order');
    }
  }

  /**
   * Get order details from Shopify
   */
  async getOrder(orderId: string): Promise<ShopifyOrder | null> {
    try {
      logger.info('Fetching order from Shopify', {
        orderId
      });

      const client = new this.shopify.clients.Rest({ session: this.session });

      const response = await client.get({
        path: `orders/${orderId}`
      });

      const order = (response.body as { order: ShopifyOrder }).order;

      logger.info('Order fetched successfully', {
        orderId,
        orderNumber: order.order_number
      });

      return order;
    } catch (error) {
      logger.error('Failed to fetch order from Shopify', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Send order confirmation OTP (wrapper for webhook handler)
   * Requirement 8.1: Generate and send OTP for order confirmation
   */
  async sendOrderConfirmationOTP(
    orderId: string,
    orderNumber: string,
    phone: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.generateOrderOTP(orderId, orderNumber, phone);
      return { success: true };
    } catch (error) {
      logger.error('Failed to send order confirmation OTP', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP'
      };
    }
  }

  /**
   * Verify and confirm order
   * Requirements: 8.3, 8.4: Verify OTP and update order status
   */
  async verifyAndConfirmOrder(
    orderId: string,
    otp: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify OTP
      const isValid = await this.verifyOrderOTP(orderId, otp);

      if (!isValid) {
        return {
          success: false,
          error: 'Invalid or expired OTP'
        };
      }

      // Confirm order in Shopify
      await this.confirmOrder(orderId);

      return { success: true };
    } catch (error) {
      logger.error('Failed to verify and confirm order', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm order'
      };
    }
  }

  /**
   * Check if order requires confirmation
   * This can be customized based on business logic
   */
  requiresConfirmation(_order: ShopifyOrder): boolean {
    // Example logic: require confirmation for orders over a certain amount
    // or for first-time customers, etc.
    // For now, we'll require confirmation for all orders
    return true;
  }

  // Redis key helper
  private getOrderOTPKey(orderId: string): string {
    return `order:otp:${orderId}`;
  }

  // Mask phone number for logging (PII protection)
  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }
}
