/**
 * Property-based tests for GoogleOAuthProvider
 */

import axios from 'axios';
import fc from 'fast-check';
import { GoogleOAuthProvider } from '../GoogleOAuthProvider.js';
import { UserProfile } from '../IOAuthProvider.js';

// Mock axios and logger
jest.mock('axios');
jest.mock('../../config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoogleOAuthProvider Property Tests', () => {
  let provider: GoogleOAuthProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleOAuthProvider('test-client-id', 'test-client-secret');
  });
  
  /**
   * Feature: shopify-sms-auth, Property 10: OAuth user profile normalization
   * Validates: Requirements 14.4
   * 
   * For any OAuth provider returning a user profile, the data should be normalized 
   * into a consistent format with email, firstName, lastName fields
   */
  describe('Property 10: OAuth user profile normalization', () => {
    it('should normalize all Google API responses into consistent UserProfile format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate various Google API response formats
            id: fc.string({ minLength: 1 }),
            email: fc.emailAddress(),
            given_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
            family_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
            picture: fc.option(fc.webUrl(), { nil: undefined }),
            verified_email: fc.boolean()
          }),
          async (googleResponse) => {
            // Setup: Mock axios to return the Google API response
            mockedAxios.get.mockResolvedValueOnce({
              data: googleResponse
            });
            
            // Execute: Get user profile
            const profile: UserProfile = await provider.getUserProfile('test-access-token');
            
            // Verify: Profile has consistent structure
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('email');
            expect(profile).toHaveProperty('firstName');
            expect(profile).toHaveProperty('lastName');
            expect(profile).toHaveProperty('avatar');
            expect(profile).toHaveProperty('emailVerified');
            
            // Verify: Required fields are correctly mapped
            expect(profile.id).toBe(googleResponse.id);
            expect(profile.email).toBe(googleResponse.email);
            expect(profile.emailVerified).toBe(googleResponse.verified_email);
            
            // Verify: Optional fields are correctly mapped (or undefined)
            expect(profile.firstName).toBe(googleResponse.given_name);
            expect(profile.lastName).toBe(googleResponse.family_name);
            expect(profile.avatar).toBe(googleResponse.picture);
            
            // Verify: Profile structure is consistent regardless of input
            const keys = Object.keys(profile).sort();
            expect(keys).toEqual(['avatar', 'email', 'emailVerified', 'firstName', 'id', 'lastName', 'phone'].sort());
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle missing optional fields gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Only required fields
            id: fc.string({ minLength: 1 }),
            email: fc.emailAddress()
          }),
          async (googleResponse) => {
            // Setup: Mock axios to return minimal Google API response
            mockedAxios.get.mockResolvedValueOnce({
              data: googleResponse
            });
            
            // Execute: Get user profile
            const profile: UserProfile = await provider.getUserProfile('test-access-token');
            
            // Verify: Profile has all expected fields even if some are undefined
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('email');
            expect(profile).toHaveProperty('firstName');
            expect(profile).toHaveProperty('lastName');
            expect(profile).toHaveProperty('avatar');
            expect(profile).toHaveProperty('emailVerified');
            
            // Verify: Required fields are present
            expect(profile.id).toBe(googleResponse.id);
            expect(profile.email).toBe(googleResponse.email);
            
            // Verify: Missing optional fields default to undefined or false
            expect(profile.firstName).toBeUndefined();
            expect(profile.lastName).toBeUndefined();
            expect(profile.avatar).toBeUndefined();
            expect(profile.emailVerified).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should produce consistent profile structure for different providers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            // Generate two different Google API responses
            fc.record({
              id: fc.string({ minLength: 1 }),
              email: fc.emailAddress(),
              given_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              family_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              picture: fc.option(fc.webUrl(), { nil: undefined }),
              verified_email: fc.boolean()
            }),
            fc.record({
              id: fc.string({ minLength: 1 }),
              email: fc.emailAddress(),
              given_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              family_name: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
              picture: fc.option(fc.webUrl(), { nil: undefined }),
              verified_email: fc.boolean()
            })
          ),
          async ([response1, response2]) => {
            // Setup: Mock axios for first call
            mockedAxios.get.mockResolvedValueOnce({
              data: response1
            });
            
            // Execute: Get first profile
            const profile1: UserProfile = await provider.getUserProfile('token1');
            
            // Setup: Mock axios for second call
            mockedAxios.get.mockResolvedValueOnce({
              data: response2
            });
            
            // Execute: Get second profile
            const profile2: UserProfile = await provider.getUserProfile('token2');
            
            // Verify: Both profiles have the same structure (same keys)
            const keys1 = Object.keys(profile1).sort();
            const keys2 = Object.keys(profile2).sort();
            expect(keys1).toEqual(keys2);
            
            // Verify: Both profiles have all required fields
            for (const profile of [profile1, profile2]) {
              expect(profile).toHaveProperty('id');
              expect(profile).toHaveProperty('email');
              expect(profile).toHaveProperty('firstName');
              expect(profile).toHaveProperty('lastName');
              expect(profile).toHaveProperty('avatar');
              expect(profile).toHaveProperty('emailVerified');
              expect(profile).toHaveProperty('phone');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
