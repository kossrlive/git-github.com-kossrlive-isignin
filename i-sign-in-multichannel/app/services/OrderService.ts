/**
 * Order Service
 * Handles order-related operations including confirmation SMS
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { logger } from '../config/logger.js';

export interface OrderData {
  id: string;
  number: string;
  total: string;
  currency: string;
  customer?: {
    phone?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  lineItems?: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  createdAt: string;
}

export interface OrderWebhookPayload {
  id: number;
  order_number: number;
  total_price: string;
  currency: string;
  customer?: {
    phone?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  line_items?: Array<{
    title: string;
    quantity: number;
    price: string;
  }>;
  created_at: string;
}

export class OrderService {
  /**
   * Extract order data from webhook payload
   * Requirement 14.2: Extract customer phone and order details
   */
  extractOrderData(payload: OrderWebhookPayload): OrderData {
    try {
      const orderData: OrderData = {
        id: payload.id.toString(),
        number: payload.order_number.toString(),
        total: payload.total_price,
        currency: payload.currency,
        createdAt: payload.created_at
      };

      // Extract customer data if available
      if (payload.customer) {
        orderData.customer = {
          phone: payload.customer.phone || undefined,
          email: payload.customer.email || undefined,
          firstName: payload.customer.first_name || undefined,
          lastName: payload.customer.last_name || undefined
        };
      }

      // Extract line items if available
      if (payload.line_items && payload.line_items.length > 0) {
        orderData.lineItems = payload.line_items.map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price
        }));
      }

      logger.info('Order data extracted successfully', {
        orderId: orderData.id,
        orderNumber: orderData.number,
        hasCustomer: !!orderData.customer,
        hasPhone: !!orderData.customer?.phone
      });

      return orderData;
    } catch (error) {
      logger.error('Failed to extract order data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload
      });
      throw new Error('Failed to extract order data from webhook payload');
    }
  }

  /**
   * Format order confirmation message with template variables
   * Requirement 14.3: Format order confirmation message
   * 
   * Supported template variables:
   * - {order.number} - Order number
   * - {order.id} - Order ID
   * - {order.total} - Order total with currency
   * - {customer.firstName} - Customer first name
   * - {customer.lastName} - Customer last name
   * - {customer.email} - Customer email
   */
  formatConfirmationMessage(template: string, orderData: OrderData): string {
    try {
      let message = template;

      // Replace order variables
      message = message.replace(/{order\.number}/g, orderData.number);
      message = message.replace(/{order\.id}/g, orderData.id);
      message = message.replace(/{order\.total}/g, `${orderData.currency} ${orderData.total}`);

      // Replace customer variables if available
      if (orderData.customer) {
        message = message.replace(/{customer\.firstName}/g, orderData.customer.firstName || '');
        message = message.replace(/{customer\.lastName}/g, orderData.customer.lastName || '');
        message = message.replace(/{customer\.email}/g, orderData.customer.email || '');
      } else {
        // Remove customer variables if no customer data
        message = message.replace(/{customer\.\w+}/g, '');
      }

      // Clean up any double spaces
      message = message.replace(/\s+/g, ' ').trim();

      logger.info('Order confirmation message formatted', {
        orderId: orderData.id,
        messageLength: message.length
      });

      return message;
    } catch (error) {
      logger.error('Failed to format confirmation message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        template,
        orderId: orderData.id
      });
      throw new Error('Failed to format order confirmation message');
    }
  }

  /**
   * Validate that order has required data for SMS confirmation
   */
  canSendConfirmation(orderData: OrderData): boolean {
    const hasPhone = !!orderData.customer?.phone;
    const hasOrderNumber = !!orderData.number;

    if (!hasPhone) {
      logger.warn('Cannot send order confirmation - no phone number', {
        orderId: orderData.id,
        orderNumber: orderData.number
      });
    }

    if (!hasOrderNumber) {
      logger.warn('Cannot send order confirmation - no order number', {
        orderId: orderData.id
      });
    }

    return hasPhone && hasOrderNumber;
  }

  /**
   * Normalize phone number to E.164 format
   * Ensures phone number is in correct format for SMS sending
   */
  normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code
      normalized = '+1' + normalized;
    }

    return normalized;
  }
}
