/**
 * Webhook Routes
 * Handles webhooks from Shopify and SMS providers
 * Requirements: 5.2, 8.1
 */

import { NextFunction, Request, Response, Router } from 'express';
import { logger } from '../config/logger.js';
import { OrderService } from '../services/OrderService.js';
import { SMSService } from '../services/SMSService.js';

export function createWebhookRouter(
  orderService: OrderService,
  _smsService: SMSService
): Router {
  const router = Router();

  /**
   * POST /api/webhooks/sms-dlr
   * Handle SMS delivery receipt webhook
   * Requirement 5.2: Handle DLR webhook from SMS provider
   */
  router.post('/sms-dlr', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dlrData = req.body;

      logger.info('Received SMS DLR webhook', {
        messageId: dlrData.messageId,
        status: dlrData.status
      });

      // Process DLR data
      // Note: Implementation depends on SMS provider's webhook format
      // For sms.to, the webhook payload typically includes:
      // - messageId: unique message identifier
      // - status: delivery status (delivered, failed, etc.)
      // - timestamp: delivery timestamp

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Failed to process SMS DLR webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  });

  /**
   * POST /api/webhooks/shopify/orders/create
   * Handle Shopify orders/create webhook
   * Requirement 8.1: Trigger OTP generation for orders requiring confirmation
   */
  router.post('/shopify/orders/create', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = req.body;

      logger.info('Received Shopify order webhook', {
        orderId: order.id,
        orderNumber: order.order_number,
        customer: order.customer?.phone
      });

      // Check if order requires confirmation
      // This could be based on order value, payment method, or other criteria
      const requiresConfirmation = shouldRequireConfirmation(order);

      if (requiresConfirmation && order.customer?.phone) {
        // Requirement 8.1: Generate and send order confirmation OTP
        const result = await orderService.sendOrderConfirmationOTP(
          order.id.toString(),
          order.order_number || order.name,
          order.customer.phone
        );

        if (result.success) {
          logger.info('Order confirmation OTP sent', {
            orderId: order.id,
            orderNumber: order.order_number
          });
        } else {
          logger.error('Failed to send order confirmation OTP', {
            orderId: order.id,
            error: result.error
          });
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Failed to process Shopify order webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  });

  /**
   * POST /api/webhooks/shopify/orders/confirm
   * Handle order confirmation via OTP
   * Requirements: 8.3, 8.4
   */
  router.post('/shopify/orders/confirm', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, otp } = req.body;

      if (!orderId || !otp) {
        return res.status(400).json({
          success: false,
          error: 'Order ID and OTP are required'
        });
      }

      logger.info('Confirming order with OTP', {
        orderId
      });

      // Requirement 8.3, 8.4: Verify OTP and update order status
      const result = await orderService.verifyAndConfirmOrder(orderId, otp);

      if (result.success) {
        logger.info('Order confirmed successfully', {
          orderId
        });
        return res.status(200).json({ success: true });
      }
      
      logger.warn('Order confirmation failed', {
        orderId,
        error: result.error
      });
      return res.status(400).json({
        success: false,
        error: result.error
      });
    } catch (error) {
      logger.error('Failed to confirm order', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return next(error);
    }
  });

  return router;
}

/**
 * Determine if an order requires confirmation
 * This is a placeholder function that can be customized based on business logic
 */
function shouldRequireConfirmation(order: { total_price?: string }): boolean {
  // Example criteria:
  // - High-value orders (e.g., > $500)
  // - First-time customers
  // - Specific payment methods
  // - Specific product categories
  
  // For now, we'll require confirmation for all orders over $100
  const orderTotal = parseFloat(order.total_price || '0');
  return orderTotal > 100;
}
