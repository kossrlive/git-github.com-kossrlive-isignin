/**
 * Customer Service
 * Interfaces with Shopify Admin API for customer management
 * Requirements: 1.5, 2.2, 2.4, 3.4, 3.5
 */

import { LATEST_API_VERSION, Session, shopifyApi } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export interface ShopifyCustomer {
  id: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  tags?: string;
  created_at?: string;
  updated_at?: string;
  verified_email?: boolean;
  metafields?: CustomerMetafield[];
}

export interface CustomerMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface CreateCustomerData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  acceptsMarketing?: boolean;
  password?: string;
}

export interface UpdateCustomerData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  metafields?: CustomerMetafield[];
}

export class CustomerService {
  private shopify: ReturnType<typeof shopifyApi>;
  private session: Session;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
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
    // In production, this would be created per-request with actual session data
    this.session = new Session({
      id: `offline_${config.shopify.shopDomain}`,
      shop: config.shopify.shopDomain,
      state: 'online',
      isOnline: false,
      accessToken: config.shopify.apiSecret, // This should be the actual access token
    });
  }

  /**
   * Find customer by email using Shopify Admin API
   * Requirement 1.5, 2.2: Find customer by email
   */
  async findByEmail(email: string): Promise<ShopifyCustomer | null> {
    try {
      logger.info('Finding customer by email', { email });

      const client = new this.shopify.clients.Rest({ session: this.session });
      
      const response = await this.retryWithBackoff(async () => {
        return await client.get({
          path: 'customers/search',
          query: { query: `email:${email}` },
        });
      });

      const customers = (response.body as { customers: ShopifyCustomer[] }).customers;

      if (customers && customers.length > 0) {
        logger.info('Customer found by email', { 
          email, 
          customerId: customers[0].id 
        });
        return customers[0];
      }

      logger.info('No customer found by email', { email });
      return null;
    } catch (error) {
      logger.error('Failed to find customer by email', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to find customer by email');
    }
  }

  /**
   * Find customer by phone using Shopify Admin API
   * Requirement 1.5: Find customer by phone
   */
  async findByPhone(phone: string): Promise<ShopifyCustomer | null> {
    try {
      logger.info('Finding customer by phone', { 
        phone: this.maskPhone(phone) 
      });

      const client = new this.shopify.clients.Rest({ session: this.session });
      
      const response = await this.retryWithBackoff(async () => {
        return await client.get({
          path: 'customers/search',
          query: { query: `phone:${phone}` },
        });
      });

      const customers = (response.body as { customers: ShopifyCustomer[] }).customers;

      if (customers && customers.length > 0) {
        logger.info('Customer found by phone', { 
          phone: this.maskPhone(phone),
          customerId: customers[0].id 
        });
        return customers[0];
      }

      logger.info('No customer found by phone', { 
        phone: this.maskPhone(phone) 
      });
      return null;
    } catch (error) {
      logger.error('Failed to find customer by phone', {
        phone: this.maskPhone(phone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to find customer by phone');
    }
  }

  /**
   * Create new customer with provided data
   * Requirement 2.4, 3.5: Create new customer
   */
  async create(data: CreateCustomerData): Promise<ShopifyCustomer> {
    try {
      logger.info('Creating new customer', {
        email: data.email,
        phone: data.phone ? this.maskPhone(data.phone) : undefined
      });

      const client = new this.shopify.clients.Rest({ session: this.session });

      // Prepare customer data for Shopify API
      const customerData: {
        customer: {
          email?: string;
          phone?: string;
          first_name?: string;
          last_name?: string;
          tags?: string;
          accepts_marketing: boolean;
          verified_email: boolean;
          password?: string;
          password_confirmation?: string;
        };
      } = {
        customer: {
          email: data.email,
          phone: data.phone,
          first_name: data.firstName,
          last_name: data.lastName,
          tags: data.tags?.join(', '),
          accepts_marketing: data.acceptsMarketing || false,
          verified_email: false,
        }
      };

      // Add password if provided
      if (data.password) {
        customerData.customer.password = data.password;
        customerData.customer.password_confirmation = data.password;
      }

      const response = await this.retryWithBackoff(async () => {
        return await client.post({
          path: 'customers',
          data: customerData,
        });
      });

      const customer = (response.body as { customer: ShopifyCustomer }).customer;

      logger.info('Customer created successfully', {
        customerId: customer.id,
        email: customer.email
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create customer', {
        email: data.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to create customer');
    }
  }

  /**
   * Update customer data
   * Requirement 3.4: Update customer with OAuth data
   */
  async update(id: string, data: UpdateCustomerData): Promise<ShopifyCustomer> {
    try {
      logger.info('Updating customer', { customerId: id });

      const client = new this.shopify.clients.Rest({ session: this.session });

      // Prepare update data
      const updateData = {
        customer: {
          id,
          email: data.email,
          phone: data.phone,
          first_name: data.firstName,
          last_name: data.lastName,
          tags: data.tags?.join(', '),
        }
      };

      const response = await this.retryWithBackoff(async () => {
        return await client.put({
          path: `customers/${id}`,
          data: updateData,
        });
      });

      const customer = (response.body as { customer: ShopifyCustomer }).customer;

      logger.info('Customer updated successfully', {
        customerId: customer.id
      });

      // Update metafields if provided
      if (data.metafields && data.metafields.length > 0) {
        await this.updateMetafields(id, data.metafields);
      }

      return customer;
    } catch (error) {
      logger.error('Failed to update customer', {
        customerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to update customer');
    }
  }

  /**
   * Update customer metafields (auth_method, phone_verified, last_login)
   * Requirement 2.4, 3.4: Update customer metafields
   */
  async updateMetafields(customerId: string, metafields: CustomerMetafield[]): Promise<void> {
    try {
      logger.info('Updating customer metafields', {
        customerId,
        metafieldCount: metafields.length
      });

      const client = new this.shopify.clients.Rest({ session: this.session });

      // Update each metafield
      for (const metafield of metafields) {
        await this.retryWithBackoff(async () => {
          return await client.post({
            path: `customers/${customerId}/metafields`,
            data: {
              metafield: {
                namespace: metafield.namespace,
                key: metafield.key,
                value: metafield.value,
                type: metafield.type,
              }
            },
          });
        });
      }

      logger.info('Customer metafields updated successfully', {
        customerId
      });
    } catch (error) {
      logger.error('Failed to update customer metafields', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to update customer metafields');
    }
  }

  /**
   * Add tag to customer
   * Helper method to add authentication method tags
   */
  async addTag(id: string, tag: string): Promise<void> {
    try {
      logger.info('Adding tag to customer', { customerId: id, tag });

      const client = new this.shopify.clients.Rest({ session: this.session });

      // Get current customer to retrieve existing tags
      const getResponse = await this.retryWithBackoff(async () => {
        return await client.get({
          path: `customers/${id}`,
        });
      });

      const customer = (getResponse.body as { customer: ShopifyCustomer }).customer;
      const existingTags = customer.tags ? customer.tags.split(', ') : [];

      // Add new tag if it doesn't exist
      if (!existingTags.includes(tag)) {
        existingTags.push(tag);

        await this.retryWithBackoff(async () => {
          return await client.put({
            path: `customers/${id}`,
            data: {
              customer: {
                id,
                tags: existingTags.join(', ')
              }
            },
          });
        });

        logger.info('Tag added to customer successfully', {
          customerId: id,
          tag
        });
      } else {
        logger.info('Tag already exists on customer', {
          customerId: id,
          tag
        });
      }
    } catch (error) {
      logger.error('Failed to add tag to customer', {
        customerId: id,
        tag,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to add tag to customer');
    }
  }

  /**
   * Set authentication method metafield
   */
  async setAuthMethod(customerId: string, authMethod: 'sms' | 'email' | 'google' | 'apple' | 'facebook'): Promise<void> {
    await this.updateMetafields(customerId, [{
      namespace: 'auth_app',
      key: 'auth_method',
      value: authMethod,
      type: 'single_line_text_field'
    }]);
  }

  /**
   * Set phone verified status
   */
  async setPhoneVerified(customerId: string, verified: boolean): Promise<void> {
    await this.updateMetafields(customerId, [{
      namespace: 'auth_app',
      key: 'phone_verified',
      value: verified.toString(),
      type: 'boolean'
    }]);
  }

  /**
   * Set last login timestamp
   */
  async setLastLogin(customerId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.updateMetafields(customerId, [{
      namespace: 'auth_app',
      key: 'last_login',
      value: now,
      type: 'date_time'
    }]);
  }

  /**
   * Retry logic with exponential backoff for Shopify API errors
   * Handles rate limiting and transient errors
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Check if we should retry
      const shouldRetry = this.shouldRetryError(error as Error & { response?: { statusCode?: number }; code?: string });
      
      if (shouldRetry && attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        
        logger.warn('Retrying Shopify API call', {
          attempt,
          maxRetries: this.maxRetries,
          delayMs: delay,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Wait before retrying
        await this.sleep(delay);
        
        return this.retryWithBackoff(operation, attempt + 1);
      }

      // Max retries reached or non-retryable error
      throw error;
    }
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetryError(error: Error & { response?: { statusCode?: number }; code?: string }): boolean {
    // Retry on rate limiting (429)
    if (error.response?.statusCode === 429) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error.response?.statusCode && error.response.statusCode >= 500) {
      return true;
    }

    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mask phone number for logging (PII protection)
   */
  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }
}
