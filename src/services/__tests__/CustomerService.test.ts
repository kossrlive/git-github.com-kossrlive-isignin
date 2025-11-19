/**
 * CustomerService Unit Tests
 * Tests for Shopify Admin API customer management
 */

import { shopifyApi } from '@shopify/shopify-api';
import * as fc from 'fast-check';
import { CreateCustomerData, CustomerService, UpdateCustomerData } from '../CustomerService';

// Mock the Shopify API
jest.mock('@shopify/shopify-api', () => ({
  shopifyApi: jest.fn(),
  Session: jest.fn().mockImplementation((data) => data),
  LATEST_API_VERSION: '2024-01',
}));

// Mock the config
jest.mock('../../config/index.js', () => ({
  config: {
    shopify: {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      scopes: 'read_customers,write_customers',
      shopDomain: 'test-shop.myshopify.com',
    },
  },
}));

// Mock the logger
jest.mock('../../config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('CustomerService', () => {
  let customerService: CustomerService;
  let mockRestClient: {
    get: jest.Mock;
    post: jest.Mock;
    put: jest.Mock;
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock REST client
    mockRestClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    };

    // Mock shopifyApi to return our mock client
    (shopifyApi as jest.Mock).mockReturnValue({
      clients: {
        Rest: jest.fn().mockImplementation(() => mockRestClient),
      },
    });

    customerService = new CustomerService();
  });

  describe('findByEmail', () => {
    it('should find customer by email', async () => {
      const mockCustomer = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };

      mockRestClient.get.mockResolvedValue({
        body: { customers: [mockCustomer] },
      });

      const result = await customerService.findByEmail('test@example.com');

      expect(result).toEqual(mockCustomer);
      expect(mockRestClient.get).toHaveBeenCalledWith({
        path: 'customers/search',
        query: { query: 'email:test@example.com' },
      });
    });

    it('should return null when customer not found', async () => {
      mockRestClient.get.mockResolvedValue({
        body: { customers: [] },
      });

      const result = await customerService.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should throw error on API failure', async () => {
      mockRestClient.get.mockRejectedValue(new Error('API Error'));

      await expect(
        customerService.findByEmail('test@example.com')
      ).rejects.toThrow('Failed to find customer by email');
    });
  });

  describe('findByPhone', () => {
    it('should find customer by phone', async () => {
      const mockCustomer = {
        id: '456',
        phone: '+1234567890',
        first_name: 'Test',
        last_name: 'User',
      };

      mockRestClient.get.mockResolvedValue({
        body: { customers: [mockCustomer] },
      });

      const result = await customerService.findByPhone('+1234567890');

      expect(result).toEqual(mockCustomer);
      expect(mockRestClient.get).toHaveBeenCalledWith({
        path: 'customers/search',
        query: { query: 'phone:+1234567890' },
      });
    });

    it('should return null when customer not found', async () => {
      mockRestClient.get.mockResolvedValue({
        body: { customers: [] },
      });

      const result = await customerService.findByPhone('+9999999999');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new customer with email', async () => {
      const customerData: CreateCustomerData = {
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        tags: ['sms-auth'],
        acceptsMarketing: false,
      };

      const mockCreatedCustomer = {
        id: '789',
        email: 'new@example.com',
        first_name: 'New',
        last_name: 'User',
      };

      mockRestClient.post.mockResolvedValue({
        body: { customer: mockCreatedCustomer },
      });

      const result = await customerService.create(customerData);

      expect(result).toEqual(mockCreatedCustomer);
      expect(mockRestClient.post).toHaveBeenCalledWith({
        path: 'customers',
        data: {
          customer: {
            email: 'new@example.com',
            phone: undefined,
            first_name: 'New',
            last_name: 'User',
            tags: 'sms-auth',
            accepts_marketing: false,
            verified_email: false,
          },
        },
      });
    });

    it('should create customer with password', async () => {
      const customerData: CreateCustomerData = {
        email: 'new@example.com',
        password: 'securePassword123',
      };

      const mockCreatedCustomer = {
        id: '790',
        email: 'new@example.com',
      };

      mockRestClient.post.mockResolvedValue({
        body: { customer: mockCreatedCustomer },
      });

      await customerService.create(customerData);

      expect(mockRestClient.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer: expect.objectContaining({
              password: 'securePassword123',
              password_confirmation: 'securePassword123',
            }),
          }),
        })
      );
    });

    it('should throw error on creation failure', async () => {
      mockRestClient.post.mockRejectedValue(new Error('Creation failed'));

      await expect(
        customerService.create({ email: 'test@example.com' })
      ).rejects.toThrow('Failed to create customer');
    });
  });

  describe('update', () => {
    it('should update customer data', async () => {
      const updateData: UpdateCustomerData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const mockUpdatedCustomer = {
        id: '123',
        first_name: 'Updated',
        last_name: 'Name',
      };

      mockRestClient.put.mockResolvedValue({
        body: { customer: mockUpdatedCustomer },
      });

      const result = await customerService.update('123', updateData);

      expect(result).toEqual(mockUpdatedCustomer);
      expect(mockRestClient.put).toHaveBeenCalledWith({
        path: 'customers/123',
        data: {
          customer: {
            id: '123',
            email: undefined,
            phone: undefined,
            first_name: 'Updated',
            last_name: 'Name',
            tags: undefined,
          },
        },
      });
    });

    it('should update customer with metafields', async () => {
      const updateData: UpdateCustomerData = {
        firstName: 'Updated',
        metafields: [
          {
            namespace: 'auth_app',
            key: 'auth_method',
            value: 'sms',
            type: 'single_line_text_field',
          },
        ],
      };

      const mockUpdatedCustomer = {
        id: '123',
        first_name: 'Updated',
      };

      mockRestClient.put.mockResolvedValue({
        body: { customer: mockUpdatedCustomer },
      });

      mockRestClient.post.mockResolvedValue({
        body: { metafield: {} },
      });

      await customerService.update('123', updateData);

      expect(mockRestClient.post).toHaveBeenCalledWith({
        path: 'customers/123/metafields',
        data: {
          metafield: {
            namespace: 'auth_app',
            key: 'auth_method',
            value: 'sms',
            type: 'single_line_text_field',
          },
        },
      });
    });
  });

  describe('updateMetafields', () => {
    it('should update customer metafields', async () => {
      const metafields = [
        {
          namespace: 'auth_app',
          key: 'auth_method',
          value: 'email',
          type: 'single_line_text_field',
        },
        {
          namespace: 'auth_app',
          key: 'phone_verified',
          value: 'true',
          type: 'boolean',
        },
      ];

      mockRestClient.post.mockResolvedValue({
        body: { metafield: {} },
      });

      await customerService.updateMetafields('123', metafields);

      expect(mockRestClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('addTag', () => {
    it('should add new tag to customer', async () => {
      mockRestClient.get.mockResolvedValue({
        body: {
          customer: {
            id: '123',
            tags: 'existing-tag',
          },
        },
      });

      mockRestClient.put.mockResolvedValue({
        body: { customer: {} },
      });

      await customerService.addTag('123', 'new-tag');

      expect(mockRestClient.put).toHaveBeenCalledWith({
        path: 'customers/123',
        data: {
          customer: {
            id: '123',
            tags: 'existing-tag, new-tag',
          },
        },
      });
    });

    it('should not add duplicate tag', async () => {
      mockRestClient.get.mockResolvedValue({
        body: {
          customer: {
            id: '123',
            tags: 'existing-tag',
          },
        },
      });

      await customerService.addTag('123', 'existing-tag');

      expect(mockRestClient.put).not.toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('should set auth method', async () => {
      mockRestClient.post.mockResolvedValue({
        body: { metafield: {} },
      });

      await customerService.setAuthMethod('123', 'google');

      expect(mockRestClient.post).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'customers/123/metafields',
          data: expect.objectContaining({
            metafield: expect.objectContaining({
              namespace: 'auth_app',
              key: 'auth_method',
              value: 'google',
            }),
          }),
        })
      );
    });

    it('should set phone verified status', async () => {
      mockRestClient.post.mockResolvedValue({
        body: { metafield: {} },
      });

      await customerService.setPhoneVerified('123', true);

      expect(mockRestClient.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metafield: expect.objectContaining({
              key: 'phone_verified',
              value: 'true',
              type: 'boolean',
            }),
          }),
        })
      );
    });

    it('should set last login timestamp', async () => {
      mockRestClient.post.mockResolvedValue({
        body: { metafield: {} },
      });

      await customerService.setLastLogin('123');

      expect(mockRestClient.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metafield: expect.objectContaining({
              key: 'last_login',
              type: 'date_time',
            }),
          }),
        })
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit error (429)', async () => {
      const error429 = {
        response: { statusCode: 429 },
        message: 'Rate limited',
      };

      mockRestClient.get
        .mockRejectedValueOnce(error429)
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({
          body: { customers: [{ id: '123' }] },
        });

      const result = await customerService.findByEmail('test@example.com');

      expect(result).toEqual({ id: '123' });
      expect(mockRestClient.get).toHaveBeenCalledTimes(3);
    });

    it('should retry on server error (500)', async () => {
      const error500 = {
        response: { statusCode: 500 },
        message: 'Server error',
      };

      mockRestClient.get
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({
          body: { customers: [{ id: '123' }] },
        });

      const result = await customerService.findByEmail('test@example.com');

      expect(result).toEqual({ id: '123' });
      expect(mockRestClient.get).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const error500 = {
        response: { statusCode: 500 },
        message: 'Server error',
      };

      mockRestClient.get.mockRejectedValue(error500);

      await expect(
        customerService.findByEmail('test@example.com')
      ).rejects.toThrow();

      // Should try 3 times (initial + 2 retries)
      expect(mockRestClient.get).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client error (400)', async () => {
      const error400 = {
        response: { statusCode: 400 },
        message: 'Bad request',
      };

      mockRestClient.get.mockRejectedValue(error400);

      await expect(
        customerService.findByEmail('test@example.com')
      ).rejects.toThrow();

      // Should only try once (no retries for 4xx errors)
      expect(mockRestClient.get).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 4: Customer creation or retrieval
   * Validates: Requirements 1.5
   */
  describe('Property 4: Customer creation or retrieval', () => {
    it('should either find existing customer or create new one for any identifier', async () => {
      // Test with a smaller sample to ensure it completes
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.emailAddress(),
            fc.string({ minLength: 10, maxLength: 15 }).map(s => '+' + s.replace(/\D/g, '').slice(0, 12))
          ),
          fc.boolean(),
          async (identifier, customerExists) => {
            // Create fresh service instance for each test to avoid state issues
            const freshMockClient = {
              get: jest.fn(),
              post: jest.fn(),
              put: jest.fn(),
            };

            (shopifyApi as jest.Mock).mockReturnValue({
              clients: {
                Rest: jest.fn().mockImplementation(() => freshMockClient),
              },
            });

            const freshService = new CustomerService();
            const isEmail = identifier.includes('@');

            if (customerExists) {
              // Customer exists - should find it
              const existingCustomer = {
                id: `existing-${identifier}`,
                ...(isEmail ? { email: identifier } : { phone: identifier }),
                first_name: 'Existing',
                last_name: 'User',
              };

              freshMockClient.get.mockResolvedValueOnce({
                body: { customers: [existingCustomer] },
              });

              const result = isEmail
                ? await freshService.findByEmail(identifier)
                : await freshService.findByPhone(identifier);

              // Verify customer was found
              expect(result).not.toBeNull();
              expect(result?.id).toBe(existingCustomer.id);
            } else {
              // Customer doesn't exist - should create it
              freshMockClient.get.mockResolvedValueOnce({
                body: { customers: [] },
              });

              const newCustomer = {
                id: `new-${identifier}`,
                ...(isEmail ? { email: identifier } : { phone: identifier }),
                first_name: 'New',
                last_name: 'User',
              };

              freshMockClient.post.mockResolvedValueOnce({
                body: { customer: newCustomer },
              });

              // Find returns null
              const findResult = isEmail
                ? await freshService.findByEmail(identifier)
                : await freshService.findByPhone(identifier);
              expect(findResult).toBeNull();

              // Create succeeds
              const createData = isEmail
                ? { email: identifier, firstName: 'New', lastName: 'User' }
                : { phone: identifier, firstName: 'New', lastName: 'User' };
              
              const createResult = await freshService.create(createData);
              expect(createResult).not.toBeNull();
              expect(createResult.id).toBe(newCustomer.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
