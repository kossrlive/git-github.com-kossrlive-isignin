/**
 * AuthService Tests
 * Property-based and unit tests for authentication orchestration
 */

import { Queue } from 'bull';
import fc from 'fast-check';
import { SMSJobData } from '../../config/queue.js';
import { AuthService } from '../AuthService.js';
import { CustomerService } from '../CustomerService.js';
import { MultipassService } from '../MultipassService.js';
import { OAuthService } from '../OAuthService.js';
import { OTPService } from '../OTPService.js';
import { SMSService } from '../SMSService.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockMultipassService: jest.Mocked<MultipassService>;
  let mockCustomerService: jest.Mocked<CustomerService>;
  let mockOTPService: jest.Mocked<OTPService>;
  let mockSMSService: jest.Mocked<SMSService>;
  let mockOAuthService: jest.Mocked<OAuthService>;
  let mockSMSQueue: jest.Mocked<Queue<SMSJobData>>;

  beforeEach(() => {
    // Create mocks
    mockMultipassService = {
      generateToken: jest.fn(),
      encryptAndSign: jest.fn(),
      generateMultipassUrl: jest.fn(),
      validateCustomerData: jest.fn()
    } as any;

    mockCustomerService = {
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setAuthMethod: jest.fn(),
      setPhoneVerified: jest.fn(),
      setLastLogin: jest.fn()
    } as any;

    mockOTPService = {
      generateOTP: jest.fn(),
      storeOTP: jest.fn(),
      verifyOTP: jest.fn(),
      isBlocked: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      blockPhone: jest.fn(),
      deleteOTP: jest.fn()
    } as any;

    mockSMSService = {
      sendSMS: jest.fn(),
      sendWithFallback: jest.fn(),
      getNextProvider: jest.fn()
    } as any;

    mockOAuthService = {
      registerProvider: jest.fn(),
      getProvider: jest.fn(),
      initiateOAuth: jest.fn(),
      handleCallback: jest.fn()
    } as any;

    mockSMSQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' })
    } as any;

    authService = new AuthService(
      mockMultipassService,
      mockCustomerService,
      mockOTPService,
      mockSMSService,
      mockOAuthService,
      mockSMSQueue
    );
  });

  describe('Property 1: Phone number validation consistency', () => {
    /**
     * Feature: shopify-sms-auth, Property 1: Phone number validation consistency
     * Validates: Requirements 1.1
     * 
     * For any string input, the phone validator should consistently classify it
     * as valid or invalid based on E.164 format rules
     */
    it('should consistently validate phone numbers according to E.164 format', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          // Call validation twice with same input
          const result1 = authService.validatePhoneNumber(input);
          const result2 = authService.validatePhoneNumber(input);
          
          // Results should be identical (consistency)
          expect(result1).toBe(result2);
          
          // If valid, must match E.164 format
          if (result1) {
            // Must start with +
            expect(input).toMatch(/^\+/);
            // Must have 8-15 digits after +
            expect(input).toMatch(/^\+[1-9]\d{1,14}$/);
            // Must not start with +0
            expect(input).not.toMatch(/^\+0/);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept valid E.164 phone numbers', () => {
      // Generate valid E.164 phone numbers
      const validE164Generator = fc.tuple(
        fc.integer({ min: 1, max: 9 }), // First digit (1-9)
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 7, maxLength: 13 }) // Remaining digits
      ).map(([first, rest]) => `+${first}${rest.join('')}`);

      fc.assert(
        fc.property(validE164Generator, (phone) => {
          const result = authService.validatePhoneNumber(phone);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '', // Empty
        'abc', // No digits
        '1234567890', // No +
        '+0123456789', // Starts with +0
        '+', // Just +
        '+1', // Too short
        '+12345678901234567', // Too long (>15 digits)
        '++1234567890', // Double +
        '+1 234 567 890', // Contains spaces
        '+1-234-567-890', // Contains dashes
        '+1(234)567890', // Contains parentheses
      ];

      invalidPhones.forEach(phone => {
        expect(authService.validatePhoneNumber(phone)).toBe(false);
      });
    });
  });

  describe('sendOTP', () => {
    it('should validate phone number before sending OTP', async () => {
      const invalidPhone = '1234567890'; // Missing +

      await expect(authService.sendOTP(invalidPhone)).rejects.toThrow(
        'Invalid phone number format'
      );

      expect(mockOTPService.generateOTP).not.toHaveBeenCalled();
      expect(mockSMSQueue.add).not.toHaveBeenCalled();
    });

    it('should reject OTP send for blocked phone', async () => {
      const phone = '+1234567890';
      mockOTPService.isBlocked.mockResolvedValue(true);

      await expect(authService.sendOTP(phone)).rejects.toThrow(
        'Too many failed attempts'
      );

      expect(mockOTPService.generateOTP).not.toHaveBeenCalled();
      expect(mockSMSQueue.add).not.toHaveBeenCalled();
    });

    it('should generate OTP, store it, and queue SMS job', async () => {
      const phone = '+1234567890';
      const otp = '123456';

      mockOTPService.isBlocked.mockResolvedValue(false);
      mockOTPService.generateOTP.mockReturnValue(otp);
      mockOTPService.storeOTP.mockResolvedValue();

      await authService.sendOTP(phone);

      expect(mockOTPService.generateOTP).toHaveBeenCalled();
      expect(mockOTPService.storeOTP).toHaveBeenCalledWith(phone, otp);
      expect(mockSMSQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          message: expect.stringContaining(otp),
          attemptNumber: 0
        })
      );
    });
  });

  describe('authenticateWithPhone', () => {
    it('should return error for invalid OTP', async () => {
      const phone = '+1234567890';
      const otp = '123456';

      mockOTPService.verifyOTP.mockResolvedValue(false);

      const result = await authService.authenticateWithPhone(phone, otp);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
      expect(mockCustomerService.findByPhone).not.toHaveBeenCalled();
    });

    it('should find existing customer and generate Multipass URL', async () => {
      const phone = '+1234567890';
      const otp = '123456';
      const customer = {
        id: 'cust-123',
        phone,
        email: 'test@example.com',
        created_at: new Date().toISOString()
      };
      const multipassUrl = 'https://shop.myshopify.com/account/login/multipass/token';

      mockOTPService.verifyOTP.mockResolvedValue(true);
      mockCustomerService.findByPhone.mockResolvedValue(customer as any);
      mockCustomerService.setAuthMethod.mockResolvedValue();
      mockCustomerService.setPhoneVerified.mockResolvedValue();
      mockCustomerService.setLastLogin.mockResolvedValue();
      mockMultipassService.validateCustomerData.mockReturnValue(true);
      mockMultipassService.generateMultipassUrl.mockReturnValue(multipassUrl);

      const result = await authService.authenticateWithPhone(phone, otp);

      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBe(multipassUrl);
      expect(result.customer).toEqual(customer);
      expect(mockCustomerService.findByPhone).toHaveBeenCalledWith(phone);
      expect(mockCustomerService.setAuthMethod).toHaveBeenCalledWith(customer.id, 'sms');
      expect(mockCustomerService.setPhoneVerified).toHaveBeenCalledWith(customer.id, true);
    });

    it('should create new customer if not found', async () => {
      const phone = '+1234567890';
      const otp = '123456';
      const newCustomer = {
        id: 'cust-new',
        phone,
        created_at: new Date().toISOString()
      };
      const multipassUrl = 'https://shop.myshopify.com/account/login/multipass/token';

      mockOTPService.verifyOTP.mockResolvedValue(true);
      mockCustomerService.findByPhone.mockResolvedValue(null);
      mockCustomerService.create.mockResolvedValue(newCustomer as any);
      mockCustomerService.setAuthMethod.mockResolvedValue();
      mockCustomerService.setPhoneVerified.mockResolvedValue();
      mockCustomerService.setLastLogin.mockResolvedValue();
      mockMultipassService.validateCustomerData.mockReturnValue(true);
      mockMultipassService.generateMultipassUrl.mockReturnValue(multipassUrl);

      const result = await authService.authenticateWithPhone(phone, otp);

      expect(result.success).toBe(true);
      expect(mockCustomerService.create).toHaveBeenCalledWith({
        phone,
        tags: ['sms-auth']
      });
      expect(mockCustomerService.setAuthMethod).toHaveBeenCalledWith(newCustomer.id, 'sms');
    });
  });

  describe('Property 5: Email validation consistency', () => {
    /**
     * Feature: shopify-sms-auth, Property 5: Email validation consistency
     * Validates: Requirements 2.1
     * 
     * For any string input, the email validator should consistently classify it
     * as valid or invalid based on RFC 5322 format rules
     */
    it('should consistently validate email addresses', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          // Call validation twice with same input
          const result1 = authService.validateEmail(input);
          const result2 = authService.validateEmail(input);
          
          // Results should be identical (consistency)
          expect(result1).toBe(result2);
          
          // If valid, must contain @ and domain
          if (result1) {
            expect(input).toContain('@');
            expect(input).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test123@test-domain.com',
        'a@b.c',
      ];

      validEmails.forEach(email => {
        expect(authService.validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '', // Empty
        'notanemail', // No @
        '@example.com', // No local part
        'user@', // No domain
        'user @example.com', // Space in local part
        'user@example', // No TLD
        'user@@example.com', // Double @
        'user@.com', // Missing domain name
      ];

      invalidEmails.forEach(email => {
        expect(authService.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Property 6: Password hashing security', () => {
    /**
     * Feature: shopify-sms-auth, Property 6: Password hashing security
     * Validates: Requirements 2.3, 9.3
     * 
     * For any password being stored, it should be hashed using bcrypt
     * with a cost factor of at least 12
     */
    it('should hash passwords with bcrypt cost factor >= 12', async () => {
      // Generate random passwords
      const passwordGenerator = fc.string({ minLength: 8, maxLength: 50 });

      await fc.assert(
        fc.asyncProperty(passwordGenerator, async (password) => {
          const hashedPassword = await authService.hashPassword(password);
          
          // Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
          expect(hashedPassword).toMatch(/^\$2[aby]\$/);
          
          // Extract cost factor from hash (format: $2a$12$...)
          const costMatch = hashedPassword.match(/^\$2[aby]\$(\d+)\$/);
          expect(costMatch).not.toBeNull();
          
          if (costMatch) {
            const costFactor = parseInt(costMatch[1], 10);
            // Cost factor should be at least 12
            expect(costFactor).toBeGreaterThanOrEqual(12);
          }
          
          // Verify that the hash can be used to verify the original password
          const isValid = await authService.verifyPassword(password, hashedPassword);
          expect(isValid).toBe(true);
          
          // Verify that a different password fails verification
          if (password.length > 0) {
            const wrongPassword = password + 'x';
            const isInvalid = await authService.verifyPassword(wrongPassword, hashedPassword);
            expect(isInvalid).toBe(false);
          }
        }),
        { numRuns: 10 } // Reduced runs since bcrypt is slow
      );
    }, 30000); // 30 second timeout for bcrypt operations

    it('should produce different hashes for the same password', async () => {
      const password = 'testPassword123';
      
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      // Hashes should be different due to random salt
      expect(hash1).not.toBe(hash2);
      
      // But both should verify the same password
      expect(await authService.verifyPassword(password, hash1)).toBe(true);
      expect(await authService.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('authenticateWithEmail', () => {
    it('should return error for invalid email format', async () => {
      const invalidEmail = 'notanemail';
      const password = 'password123';

      const result = await authService.authenticateWithEmail(invalidEmail, password);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
      expect(mockCustomerService.findByEmail).not.toHaveBeenCalled();
    });

    it('should find existing customer and generate Multipass URL', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const customer = {
        id: 'cust-123',
        email,
        created_at: new Date().toISOString()
      };
      const multipassUrl = 'https://shop.myshopify.com/account/login/multipass/token';

      mockCustomerService.findByEmail.mockResolvedValue(customer as any);
      mockCustomerService.setAuthMethod.mockResolvedValue();
      mockCustomerService.setLastLogin.mockResolvedValue();
      mockMultipassService.validateCustomerData.mockReturnValue(true);
      mockMultipassService.generateMultipassUrl.mockReturnValue(multipassUrl);

      const result = await authService.authenticateWithEmail(email, password);

      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBe(multipassUrl);
      expect(result.customer).toEqual(customer);
      expect(mockCustomerService.findByEmail).toHaveBeenCalledWith(email);
      expect(mockCustomerService.setAuthMethod).toHaveBeenCalledWith(customer.id, 'email');
    });

    it('should create new customer if not found', async () => {
      const email = 'newuser@example.com';
      const password = 'password123';
      const newCustomer = {
        id: 'cust-new',
        email,
        created_at: new Date().toISOString()
      };
      const multipassUrl = 'https://shop.myshopify.com/account/login/multipass/token';

      mockCustomerService.findByEmail.mockResolvedValue(null);
      mockCustomerService.create.mockResolvedValue(newCustomer as any);
      mockCustomerService.setAuthMethod.mockResolvedValue();
      mockCustomerService.setLastLogin.mockResolvedValue();
      mockMultipassService.validateCustomerData.mockReturnValue(true);
      mockMultipassService.generateMultipassUrl.mockReturnValue(multipassUrl);

      const result = await authService.authenticateWithEmail(email, password);

      expect(result.success).toBe(true);
      expect(mockCustomerService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          tags: ['email-auth']
        })
      );
      expect(mockCustomerService.setAuthMethod).toHaveBeenCalledWith(newCustomer.id, 'email');
    });
  });

  describe('Property 9: OAuth authorization URL format', () => {
    /**
     * Feature: shopify-sms-auth, Property 9: OAuth authorization URL format
     * Validates: Requirements 3.1
     * 
     * For any OAuth provider and state parameter, the generated authorization URL
     * should contain all required parameters (client_id, redirect_uri, scope, state)
     */
    it('should generate valid OAuth authorization URLs with required parameters', async () => {
      // Mock OAuth provider
      const mockProvider = {
        name: 'google',
        scopes: ['openid', 'email', 'profile'],
        getAuthorizationUrl: jest.fn((state: string, redirectUri: string) => {
          return `https://accounts.google.com/o/oauth2/v2/auth?client_id=test&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${state}&response_type=code`;
        }),
        exchangeCodeForToken: jest.fn(),
        getUserProfile: jest.fn(),
        refreshToken: jest.fn()
      };

      mockOAuthService.initiateOAuth.mockImplementation(async (providerName, redirectUri, state) => {
        return mockProvider.getAuthorizationUrl(state || 'default-state', redirectUri);
      });

      // Generate random redirect URIs and state parameters
      // Filter out URLs that would be normalized (e.g., trailing spaces)
      const redirectUriGenerator = fc.webUrl().filter(url => {
        try {
          const normalized = new URL(url);
          // Only use URLs that don't change when normalized
          return normalized.href === url;
        } catch {
          return false;
        }
      });
      const stateGenerator = fc.hexaString({ minLength: 16, maxLength: 64 });

      await fc.assert(
        fc.asyncProperty(
          redirectUriGenerator,
          stateGenerator,
          async (redirectUri, state) => {
            const authUrl = await authService.initiateOAuth('google', redirectUri, state);

            // Parse URL
            const url = new URL(authUrl);

            // Should have required query parameters
            expect(url.searchParams.has('client_id')).toBe(true);
            expect(url.searchParams.has('redirect_uri')).toBe(true);
            expect(url.searchParams.has('scope')).toBe(true);
            expect(url.searchParams.has('state')).toBe(true);

            // State should match what was provided
            expect(url.searchParams.get('state')).toBe(state);

            // Redirect URI should be present and properly encoded
            const encodedRedirectUri = url.searchParams.get('redirect_uri');
            expect(encodedRedirectUri).toBeTruthy();
            
            // When decoded, it should match the original redirect URI
            // Note: URL encoding/decoding may normalize the URI
            const decodedRedirectUri = decodeURIComponent(encodedRedirectUri || '');
            // Normalize both URIs for comparison (handle trailing slashes, encoding differences)
            const normalizeUri = (uri: string) => {
              try {
                const parsed = new URL(uri);
                // URL constructor normalizes trailing spaces and other whitespace
                // This is correct behavior per URL spec
                return parsed.href;
              } catch {
                return uri;
              }
            };
            
            // Both URIs should normalize to the same value
            // This handles cases where URL encoding normalizes whitespace
            const normalizedOriginal = normalizeUri(redirectUri);
            const normalizedDecoded = normalizeUri(decodedRedirectUri);
            
            // They should either match exactly, or the decoded version should be
            // a normalized version of the original (e.g., trailing spaces removed)
            expect(normalizedDecoded).toBe(normalizedOriginal);

            // Should have response_type parameter (OAuth 2.0 requirement)
            expect(url.searchParams.has('response_type')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different URLs for different state parameters', async () => {
      const mockProvider = {
        name: 'google',
        scopes: ['openid', 'email', 'profile'],
        getAuthorizationUrl: jest.fn((state: string, redirectUri: string) => {
          return `https://accounts.google.com/o/oauth2/v2/auth?client_id=test&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20email%20profile&state=${state}&response_type=code`;
        }),
        exchangeCodeForToken: jest.fn(),
        getUserProfile: jest.fn(),
        refreshToken: jest.fn()
      };

      mockOAuthService.initiateOAuth.mockImplementation(async (providerName, redirectUri, state) => {
        return mockProvider.getAuthorizationUrl(state || 'default-state', redirectUri);
      });

      const redirectUri = 'https://example.com/callback';
      const state1 = 'state-123';
      const state2 = 'state-456';

      const url1 = await authService.initiateOAuth('google', redirectUri, state1);
      const url2 = await authService.initiateOAuth('google', redirectUri, state2);

      // URLs should be different
      expect(url1).not.toBe(url2);

      // But should differ only in state parameter
      const parsedUrl1 = new URL(url1);
      const parsedUrl2 = new URL(url2);

      expect(parsedUrl1.searchParams.get('state')).toBe(state1);
      expect(parsedUrl2.searchParams.get('state')).toBe(state2);
    });
  });

  describe('authenticateWithOAuth', () => {
    it('should find existing customer and generate Multipass URL', async () => {
      const providerName = 'google';
      const code = 'auth-code-123';
      const redirectUri = 'https://example.com/callback';
      const profile = {
        id: 'google-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true
      };
      const customer = {
        id: 'cust-123',
        email: profile.email,
        created_at: new Date().toISOString()
      };
      const multipassUrl = 'https://shop.myshopify.com/account/login/multipass/token';

      mockOAuthService.handleCallback.mockResolvedValue(profile as any);
      mockCustomerService.findByEmail.mockResolvedValue(customer as any);
      mockCustomerService.setAuthMethod.mockResolvedValue();
      mockCustomerService.setLastLogin.mockResolvedValue();
      mockMultipassService.validateCustomerData.mockReturnValue(true);
      mockMultipassService.generateMultipassUrl.mockReturnValue(multipassUrl);

      const result = await authService.authenticateWithOAuth(providerName, code, redirectUri);

      expect(result.success).toBe(true);
      expect(result.multipassUrl).toBe(multipassUrl);
      expect(result.customer).toEqual(customer);
      expect(mockOAuthService.handleCallback).toHaveBeenCalledWith(providerName, code, redirectUri);
      expect(mockCustomerService.findByEmail).toHaveBeenCalledWith(profile.email);
      expect(mockCustomerService.setAuthMethod).toHaveBeenCalledWith(customer.id, providerName);
    });

    it('should create new customer from OAuth profile if not found', async () => {
      const providerName = 'google';
      const code = 'auth-code-123';
      const redirectUri = 'https://example.com/callback';
      const profile = {
        id: 'google-123',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        phone: '+1234567890',
        emailVerified: true
      };
      const newCustomer = {
        id: 'cust-new',
        email: profile.email,
        created_at: new Date().toISOString()
      };
      const multipassUrl = 'https://shop.myshopify.com/account/login/multipass/token';

      mockOAuthService.handleCallback.mockResolvedValue(profile as any);
      mockCustomerService.findByEmail.mockResolvedValue(null);
      mockCustomerService.create.mockResolvedValue(newCustomer as unknown);
      mockCustomerService.setAuthMethod.mockResolvedValue();
      mockCustomerService.setLastLogin.mockResolvedValue();
      mockMultipassService.validateCustomerData.mockReturnValue(true);
      mockMultipassService.generateMultipassUrl.mockReturnValue(multipassUrl);

      const result = await authService.authenticateWithOAuth(providerName, code, redirectUri);

      expect(result.success).toBe(true);
      expect(mockCustomerService.create).toHaveBeenCalledWith({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        tags: [`${providerName}-auth`]
      });
      expect(mockCustomerService.setAuthMethod).toHaveBeenCalledWith(newCustomer.id, providerName);
    });

    it('should return error if OAuth callback fails', async () => {
      const providerName = 'google';
      const code = 'invalid-code';
      const redirectUri = 'https://example.com/callback';

      mockOAuthService.handleCallback.mockRejectedValue(new Error('Invalid authorization code'));

      const result = await authService.authenticateWithOAuth(providerName, code, redirectUri);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid authorization code');
      expect(mockCustomerService.findByEmail).not.toHaveBeenCalled();
    });
  });
});
