/**
 * Property-Based Tests for MultipassService
 * Feature: shopify-sms-auth
 * Validates: Requirements 4.1, 4.2
 */

import crypto from 'crypto';
import fc from 'fast-check';
import { CustomerData, MultipassService } from '../MultipassService.js';

describe('MultipassService Property-Based Tests', () => {
  let multipassService: MultipassService;
  const testSecret = 'test-multipass-secret-key-for-testing';

  beforeEach(() => {
    multipassService = new MultipassService(testSecret);
  });

  /**
   * Feature: shopify-sms-auth, Property 7: Multipass token generation
   * Validates: Requirements 4.1
   */
  describe('Property 7: Multipass token generation', () => {
    it('should generate a valid Multipass token for any successfully authenticated user', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          fc.option(fc.webUrl(), { nil: undefined }),
          (email, createdAt, firstName, lastName, returnTo) => {
            const customerData: CustomerData = {
              email,
              created_at: createdAt.toISOString(),
              first_name: firstName,
              last_name: lastName
            };

            const token = multipassService.generateToken(customerData, returnTo);

            // Token should be a non-empty string
            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
            expect(token.length).toBeGreaterThan(0);

            // Token should be URL-safe Base64 (no +, /, or =)
            expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different tokens for different customers', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.emailAddress(),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          (email1, email2, createdAt) => {
            // Skip if emails are the same
            fc.pre(email1 !== email2);

            const customer1: CustomerData = {
              email: email1,
              created_at: createdAt.toISOString()
            };

            const customer2: CustomerData = {
              email: email2,
              created_at: createdAt.toISOString()
            };

            const token1 = multipassService.generateToken(customer1);
            const token2 = multipassService.generateToken(customer2);

            // Different customers should produce different tokens
            expect(token1).not.toBe(token2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 8: Multipass token contents
   * Validates: Requirements 4.2
   */
  describe('Property 8: Multipass token contents', () => {
    it('should include email, created_at, and return_to in token payload', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          fc.option(fc.webUrl(), { nil: undefined }),
          (email, createdAt, returnTo) => {
            const customerData: CustomerData = {
              email,
              created_at: createdAt.toISOString()
            };

            const token = multipassService.generateToken(customerData, returnTo);

            // Decode the token to verify contents
            // Token structure: [IV (16 bytes)][Encrypted Data][Signature (32 bytes)]
            const tokenBuffer = Buffer.from(
              token.replace(/-/g, '+').replace(/_/g, '/'),
              'base64'
            );

            // Token should be at least IV + some data + signature
            expect(tokenBuffer.length).toBeGreaterThan(48); // 16 + 1 + 32

            // Extract components
            const iv = tokenBuffer.slice(0, 16);
            const signature = tokenBuffer.slice(-32);
            const encryptedData = tokenBuffer.slice(0, -32);

            // Verify IV is 16 bytes
            expect(iv.length).toBe(16);

            // Verify signature is 32 bytes
            expect(signature.length).toBe(32);

            // Verify encrypted data contains IV + actual encrypted content
            expect(encryptedData.length).toBeGreaterThan(16);

            // Decrypt and verify contents
            const hash = crypto.createHash('sha256').update(testSecret).digest();
            const encryptionKey = hash.slice(0, 16);
            const signingKey = hash.slice(16, 32);

            // Verify HMAC signature
            const hmac = crypto.createHmac('sha256', signingKey);
            hmac.update(encryptedData);
            const expectedSignature = hmac.digest();
            expect(signature.equals(expectedSignature)).toBe(true);

            // Decrypt the data
            const actualEncrypted = encryptedData.slice(16);
            const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
            let decrypted = decipher.update(actualEncrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            const decryptedData = JSON.parse(decrypted.toString('utf8'));

            // Verify required fields are present
            expect(decryptedData.email).toBe(email);
            expect(decryptedData.created_at).toBe(createdAt.toISOString());

            // Verify return_to if provided
            if (returnTo) {
              expect(decryptedData.return_to).toBe(returnTo);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should properly encrypt data so it cannot be read without the secret', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          (email, createdAt) => {
            const customerData: CustomerData = {
              email,
              created_at: createdAt.toISOString()
            };

            const token = multipassService.generateToken(customerData);

            // The token should not contain the email in plaintext
            expect(token).not.toContain(email);
            expect(token).not.toContain(createdAt.toISOString());

            // Attempting to decode without proper decryption should fail
            const tokenBuffer = Buffer.from(
              token.replace(/-/g, '+').replace(/_/g, '/'),
              'base64'
            );

            // The raw buffer should not contain readable email
            const bufferString = tokenBuffer.toString('utf8');
            expect(bufferString).not.toContain(email);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
