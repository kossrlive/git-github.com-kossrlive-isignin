/**
 * OrderService Unit Tests
 * Tests order data extraction and message formatting
 */

import { describe, expect, it } from 'vitest';
import { OrderService, type OrderWebhookPayload } from '../OrderService';

describe('OrderService', () => {
  const orderService = new OrderService();

  describe('extractOrderData', () => {
    it('should extract basic order data from webhook payload', () => {
      const payload: OrderWebhookPayload = {
        id: 12345,
        order_number: 1001,
        total_price: '99.99',
        currency: 'USD',
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = orderService.extractOrderData(payload);

      expect(result.id).toBe('12345');
      expect(result.number).toBe('1001');
      expect(result.total).toBe('99.99');
      expect(result.currency).toBe('USD');
    });

    it('should extract customer data when available', () => {
      const payload: OrderWebhookPayload = {
        id: 12345,
        order_number: 1001,
        total_price: '99.99',
        currency: 'USD',
        customer: {
          phone: '+1234567890',
          email: 'customer@example.com',
          first_name: 'John',
          last_name: 'Doe'
        },
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = orderService.extractOrderData(payload);

      expect(result.customer?.phone).toBe('+1234567890');
      expect(result.customer?.email).toBe('customer@example.com');
      expect(result.customer?.firstName).toBe('John');
      expect(result.customer?.lastName).toBe('Doe');
    });

    it('should extract line items when available', () => {
      const payload: OrderWebhookPayload = {
        id: 12345,
        order_number: 1001,
        total_price: '99.99',
        currency: 'USD',
        line_items: [
          { title: 'Product 1', quantity: 2, price: '49.99' }
        ],
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = orderService.extractOrderData(payload);

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems?.[0].title).toBe('Product 1');
      expect(result.lineItems?.[0].quantity).toBe(2);
    });
  });

  describe('formatConfirmationMessage', () => {
    it('should replace order template variables', () => {
      const template = 'Order #{order.number} - Total: {order.total}';
      const orderData = {
        id: '12345',
        number: '1001',
        total: '99.99',
        currency: 'USD',
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = orderService.formatConfirmationMessage(template, orderData);

      expect(result).toBe('Order #1001 - Total: USD 99.99');
    });

    it('should replace customer template variables when available', () => {
      const template = 'Hi {customer.firstName}, your order #{order.number} is confirmed!';
      const orderData = {
        id: '12345',
        number: '1001',
        total: '99.99',
        currency: 'USD',
        customer: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        },
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = orderService.formatConfirmationMessage(template, orderData);

      expect(result).toBe('Hi John, your order #1001 is confirmed!');
    });

    it('should remove customer variables when customer data is not available', () => {
      const template = 'Hi {customer.firstName}, order #{order.number} confirmed';
      const orderData = {
        id: '12345',
        number: '1001',
        total: '99.99',
        currency: 'USD',
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = orderService.formatConfirmationMessage(template, orderData);

      expect(result).toBe('Hi , order #1001 confirmed');
    });
  });

  describe('canSendConfirmation', () => {
    it('should return true when order has phone number and order number', () => {
      const orderData = {
        id: '12345',
        number: '1001',
        total: '99.99',
        currency: 'USD',
        customer: {
          phone: '+1234567890'
        },
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = orderService.canSendConfirmation(orderData);

      expect(result).toBe(true);
    });

    it('should return false when order has no phone number', () => {
      const orderData = {
        id: '12345',
        number: '1001',
        total: '99.99',
        currency: 'USD',
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = orderService.canSendConfirmation(orderData);

      expect(result).toBe(false);
    });

    it('should return false when order has no order number', () => {
      const orderData = {
        id: '12345',
        number: '',
        total: '99.99',
        currency: 'USD',
        customer: {
          phone: '+1234567890'
        },
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = orderService.canSendConfirmation(orderData);

      expect(result).toBe(false);
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should keep phone numbers that already have country code', () => {
      const result = orderService.normalizePhoneNumber('+1234567890');
      expect(result).toBe('+1234567890');
    });

    it('should add +1 to phone numbers without country code', () => {
      const result = orderService.normalizePhoneNumber('2345678901');
      expect(result).toBe('+12345678901');
    });

    it('should remove non-digit characters except leading +', () => {
      const result = orderService.normalizePhoneNumber('+1 (234) 567-8901');
      expect(result).toBe('+12345678901');
    });

    it('should handle phone numbers with spaces and dashes', () => {
      const result = orderService.normalizePhoneNumber('234-567-8901');
      expect(result).toBe('+12345678901');
    });
  });
});
