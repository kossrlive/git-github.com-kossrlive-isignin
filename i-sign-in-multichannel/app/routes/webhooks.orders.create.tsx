/**
 * Order Creation Webhook Handler
 * Handles Shopify order creation webhooks and sends SMS confirmations
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { logger } from "../config/logger";
import db from "../db.server";
import { getSMSQueue } from "../lib/queue.server";
import { OrderService, type OrderWebhookPayload } from "../services/OrderService";
import { SettingsService } from "../services/SettingsService";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Requirement 14.1: Validate webhook HMAC
    const { shop, payload, topic } = await authenticate.webhook(request);

    logger.info(`Received ${topic} webhook for ${shop}`);

    // Parse the webhook payload
    const orderPayload = payload as OrderWebhookPayload;

    // Initialize services
    const orderService = new OrderService();
    const settingsService = new SettingsService(db);

    // Requirement 14.2: Extract customer phone and order details
    const orderData = orderService.extractOrderData(orderPayload);

    // Check if order confirmation SMS is enabled in settings
    const settings = await settingsService.getSettings(shop);
    
    if (!settings) {
      logger.warn('No settings found for shop, skipping order confirmation', { shop });
      return new Response(JSON.stringify({ success: true, message: 'No settings configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if order confirmation is enabled
    if (!settings.orderConfirmation.enabled) {
      logger.info('Order confirmation SMS is disabled', { shop, orderId: orderData.id });
      return new Response(JSON.stringify({ success: true, message: 'Order confirmation disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that we can send confirmation (has phone number)
    if (!orderService.canSendConfirmation(orderData)) {
      logger.warn('Cannot send order confirmation - missing required data', {
        shop,
        orderId: orderData.id,
        hasPhone: !!orderData.customer?.phone
      });
      return new Response(JSON.stringify({ success: true, message: 'Missing phone number' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Requirement 14.3: Format order confirmation message
    const messageTemplate = settings.orderConfirmation.messageTemplate;
    const message = orderService.formatConfirmationMessage(messageTemplate, orderData);

    // Normalize phone number
    const phoneNumber = orderService.normalizePhoneNumber(orderData.customer!.phone!);

    // Requirement 14.4: Queue SMS job
    const smsQueue = getSMSQueue();
    const job = await smsQueue.add({
      phone: phoneNumber,
      message: message,
      attemptNumber: 0
    });

    // Requirement 14.5: Log delivery status
    logger.info('Order confirmation SMS queued', {
      shop,
      orderId: orderData.id,
      orderNumber: orderData.number,
      jobId: job.id,
      phone: maskPhone(phoneNumber)
    });

    // Track analytics
    await db.analytics.create({
      data: {
        shopId: (await db.shop.findUnique({ where: { domain: shop } }))!.id,
        eventType: 'order_confirmation_queued',
        method: 'sms',
        metadata: JSON.stringify({
          orderId: orderData.id,
          orderNumber: orderData.number,
          jobId: job.id
        })
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order confirmation SMS queued',
      jobId: job.id 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Failed to process order webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return 200 to prevent Shopify from retrying
    // (we've logged the error for investigation)
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Mask phone number for logging (PII protection)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return '****';
  }
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}
