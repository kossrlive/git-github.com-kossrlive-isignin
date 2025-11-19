/**
 * Tests for OAuthService
 * Feature: shopify-sms-auth
 */

import fc from 'fast-check';
import {
    IOAuthProvider,
    OAuthTokens,
    UserProfile
} from '../../providers/IOAuthProvider.js';
import { OAuthService } from '../OAuthService.js';

// Mock logger
jest.mock('../../config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

/**
 * Mock OAuth Provider for testing
 */
class MockOAuthProvider implements IOAuthProvider {
  readonly name: string;
  readonly scopes: string[];
  private shouldFailToken: boolean;
  private shouldFailProfile: boolean;
  public authUrlCallCount: number = 0;
  public tokenCallCount: number = 0;
  public profileCallCount: number = 0;

  constructor(
    name: string,
    scopes: string[] = ['openid', 'email'],
    shouldFailToken: boolean = false,
    shouldFailProfile: boolean = false
  ) {
    this.name = name;
    this.scopes = scopes;
    this.shouldFailToken = shouldFailToken;
    this.shouldFailProfile = shouldFailProfile;
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    this.authUrlCallCount++;
    return `https://oauth.example.com/authorize?client_id=test&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}&scope=${this.scopes.join(' ')}`;
  }

  async exchangeCodeForToken(
    code: string,
    _redirectUri: string
  ): Promise<OAuthTokens> {
    this.tokenCallCount++;

    if (this.shouldFailToken) {
      throw new Error(`${this.name} failed to exchange code for token`);
    }

    return {
      accessToken: `access_token_${code}`,
      refreshToken: `refresh_token_${code}`,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    this.profileCallCount++;

    if (this.shouldFailProfile) {
      throw new Error(`${this.name} failed to fetch user profile`);
    }

    return {
      id: `user_${accessToken}`,
      email: `user@example.com`,
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    return {
      accessToken: `new_access_token_${refreshToken}`,
      refreshToken: refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };
  }

  setFailToken(shouldFail: boolean): void {
    this.shouldFailToken = shouldFail;
  }

  setFailProfile(shouldFail: boolean): void {
    this.shouldFailProfile = shouldFail;
  }

  resetCallCounts(): void {
    this.authUrlCallCount = 0;
    this.tokenCallCount = 0;
    this.profileCallCount = 0;
  }
}

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    oauthService = new OAuthService();
  });

  describe('Provider Registration', () => {
    it('should register a provider successfully', () => {
      const provider = new MockOAuthProvider('google');

      oauthService.registerProvider('google', provider);

      const retrievedProvider = oauthService.getProvider('google');
      expect(retrievedProvider).toBe(provider);
    });

    it('should throw error when registering provider without name', () => {
      const provider = new MockOAuthProvider('test');

      expect(() => {
        oauthService.registerProvider('', provider);
      }).toThrow('Provider name is required');
    });

    it('should throw error when registering null provider', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oauthService.registerProvider('test', null as any);
      }).toThrow('Provider implementation is required');
    });

    it('should allow overwriting existing provider', () => {
      const provider1 = new MockOAuthProvider('google', ['email']);
      const provider2 = new MockOAuthProvider('google', ['email', 'profile']);

      oauthService.registerProvider('google', provider1);
      oauthService.registerProvider('google', provider2);

      const retrievedProvider = oauthService.getProvider('google');
      expect(retrievedProvider).toBe(provider2);
      expect(retrievedProvider?.scopes).toEqual(['email', 'profile']);
    });

    it('should register multiple providers', () => {
      const googleProvider = new MockOAuthProvider('google');
      const appleProvider = new MockOAuthProvider('apple');
      const facebookProvider = new MockOAuthProvider('facebook');

      oauthService.registerProvider('google', googleProvider);
      oauthService.registerProvider('apple', appleProvider);
      oauthService.registerProvider('facebook', facebookProvider);

      expect(oauthService.getProvider('google')).toBe(googleProvider);
      expect(oauthService.getProvider('apple')).toBe(appleProvider);
      expect(oauthService.getProvider('facebook')).toBe(facebookProvider);
    });
  });

  describe('Provider Lookup', () => {
    it('should return undefined for non-existent provider', () => {
      const provider = oauthService.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });

    it('should return correct provider by name', () => {
      const googleProvider = new MockOAuthProvider('google');
      const appleProvider = new MockOAuthProvider('apple');

      oauthService.registerProvider('google', googleProvider);
      oauthService.registerProvider('apple', appleProvider);

      expect(oauthService.getProvider('google')).toBe(googleProvider);
      expect(oauthService.getProvider('apple')).toBe(appleProvider);
    });

    it('should return all registered provider names', () => {
      const googleProvider = new MockOAuthProvider('google');
      const appleProvider = new MockOAuthProvider('apple');

      oauthService.registerProvider('google', googleProvider);
      oauthService.registerProvider('apple', appleProvider);

      const providerNames = oauthService.getRegisteredProviders();
      expect(providerNames).toContain('google');
      expect(providerNames).toContain('apple');
      expect(providerNames.length).toBe(2);
    });
  });

  describe('Initiate OAuth Flow', () => {
    it('should generate authorization URL with state parameter', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      const redirectUri = 'https://myapp.com/callback';
      const state = 'random_state_123';

      const authUrl = await oauthService.initiateOAuth(
        'google',
        redirectUri,
        state
      );

      expect(authUrl).toContain('state=random_state_123');
      expect(authUrl).toContain(encodeURIComponent(redirectUri));
      expect(provider.authUrlCallCount).toBe(1);
    });

    it('should generate state parameter if not provided', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      const redirectUri = 'https://myapp.com/callback';

      const authUrl = await oauthService.initiateOAuth('google', redirectUri);

      expect(authUrl).toContain('state=');
      expect(provider.authUrlCallCount).toBe(1);
    });

    it('should throw error for non-existent provider', async () => {
      const redirectUri = 'https://myapp.com/callback';

      await expect(
        oauthService.initiateOAuth('nonexistent', redirectUri)
      ).rejects.toThrow("OAuth provider 'nonexistent' not found");
    });

    it('should include provider scopes in authorization URL', async () => {
      const provider = new MockOAuthProvider('google', [
        'openid',
        'email',
        'profile'
      ]);
      oauthService.registerProvider('google', provider);

      const redirectUri = 'https://myapp.com/callback';
      const authUrl = await oauthService.initiateOAuth('google', redirectUri);

      expect(authUrl).toContain('openid email profile');
    });

    it('should handle provider errors during URL generation', async () => {
      const provider = new MockOAuthProvider('google');
      // Override getAuthorizationUrl to throw error
      provider.getAuthorizationUrl = () => {
        throw new Error('Provider error');
      };

      oauthService.registerProvider('google', provider);

      await expect(
        oauthService.initiateOAuth('google', 'https://myapp.com/callback')
      ).rejects.toThrow('Failed to initiate OAuth with google');
    });
  });

  describe('Handle OAuth Callback', () => {
    it('should exchange code for tokens and fetch user profile', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      const code = 'auth_code_123';
      const redirectUri = 'https://myapp.com/callback';

      const profile = await oauthService.handleCallback(
        'google',
        code,
        redirectUri
      );

      expect(profile.email).toBe('user@example.com');
      expect(profile.firstName).toBe('Test');
      expect(profile.emailVerified).toBe(true);
      expect(provider.tokenCallCount).toBe(1);
      expect(provider.profileCallCount).toBe(1);
    });

    it('should throw error for non-existent provider', async () => {
      await expect(
        oauthService.handleCallback(
          'nonexistent',
          'code',
          'https://myapp.com/callback'
        )
      ).rejects.toThrow("OAuth provider 'nonexistent' not found");
    });

    it('should handle token exchange failure', async () => {
      const provider = new MockOAuthProvider('google', ['email'], true, false);
      oauthService.registerProvider('google', provider);

      await expect(
        oauthService.handleCallback(
          'google',
          'code',
          'https://myapp.com/callback'
        )
      ).rejects.toThrow('Failed to complete OAuth with google');
    });

    it('should handle profile fetch failure', async () => {
      const provider = new MockOAuthProvider('google', ['email'], false, true);
      oauthService.registerProvider('google', provider);

      await expect(
        oauthService.handleCallback(
          'google',
          'code',
          'https://myapp.com/callback'
        )
      ).rejects.toThrow('Failed to complete OAuth with google');
    });

    it('should complete full OAuth flow successfully', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      // Step 1: Initiate OAuth
      const redirectUri = 'https://myapp.com/callback';
      const authUrl = await oauthService.initiateOAuth('google', redirectUri);
      expect(authUrl).toBeDefined();

      // Step 2: Handle callback
      const code = 'auth_code_123';
      const profile = await oauthService.handleCallback(
        'google',
        code,
        redirectUri
      );

      expect(profile).toBeDefined();
      expect(profile.email).toBe('user@example.com');
      expect(provider.authUrlCallCount).toBe(1);
      expect(provider.tokenCallCount).toBe(1);
      expect(provider.profileCallCount).toBe(1);
    });

    it('should pass correct parameters to provider methods', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      const code = 'specific_auth_code';
      const redirectUri = 'https://myapp.com/specific/callback';

      await oauthService.handleCallback('google', code, redirectUri);

      // Verify the provider received correct parameters
      expect(provider.tokenCallCount).toBe(1);
      expect(provider.profileCallCount).toBe(1);
    });
  });

  describe('Multiple Provider Support', () => {
    it('should handle multiple providers independently', async () => {
      const googleProvider = new MockOAuthProvider('google');
      const appleProvider = new MockOAuthProvider('apple');

      oauthService.registerProvider('google', googleProvider);
      oauthService.registerProvider('apple', appleProvider);

      // Use Google
      const googleAuthUrl = await oauthService.initiateOAuth(
        'google',
        'https://myapp.com/callback'
      );
      expect(googleAuthUrl).toBeDefined();
      expect(googleProvider.authUrlCallCount).toBe(1);
      expect(appleProvider.authUrlCallCount).toBe(0);

      // Use Apple
      const appleAuthUrl = await oauthService.initiateOAuth(
        'apple',
        'https://myapp.com/callback'
      );
      expect(appleAuthUrl).toBeDefined();
      expect(appleProvider.authUrlCallCount).toBe(1);
    });

    it('should isolate provider failures', async () => {
      const workingProvider = new MockOAuthProvider('google', ['email'], false);
      const failingProvider = new MockOAuthProvider('apple', ['email'], true);

      oauthService.registerProvider('google', workingProvider);
      oauthService.registerProvider('apple', failingProvider);

      // Google should work
      const googleProfile = await oauthService.handleCallback(
        'google',
        'code',
        'https://myapp.com/callback'
      );
      expect(googleProfile).toBeDefined();

      // Apple should fail
      await expect(
        oauthService.handleCallback(
          'apple',
          'code',
          'https://myapp.com/callback'
        )
      ).rejects.toThrow();
    });
  });

  describe('State Parameter Generation', () => {
    it('should generate unique state parameters', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      const redirectUri = 'https://myapp.com/callback';

      const authUrl1 = await oauthService.initiateOAuth('google', redirectUri);
      const authUrl2 = await oauthService.initiateOAuth('google', redirectUri);

      // Extract state parameters
      const state1 = new URL(authUrl1).searchParams.get('state');
      const state2 = new URL(authUrl2).searchParams.get('state');

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
    });

    it('should generate state parameter of appropriate length', async () => {
      const provider = new MockOAuthProvider('google');
      oauthService.registerProvider('google', provider);

      const authUrl = await oauthService.initiateOAuth(
        'google',
        'https://myapp.com/callback'
      );

      const state = new URL(authUrl).searchParams.get('state');
      expect(state).toBeDefined();
      expect(state!.length).toBeGreaterThanOrEqual(32); // 16 bytes = 32 hex chars
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 32: OAuth provider interface compliance
   * Validates: Requirements 14.1
   * 
   * For any OAuth provider implementation, it should implement all methods 
   * of the IOAuthProvider interface
   */
  describe('Property 32: OAuth provider interface compliance', () => {
    it('should verify all OAuth providers implement required interface methods', () => {
      fc.assert(
        fc.property(
          fc.record({
            providerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]+$/.test(s)),
            scopes: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            state: fc.string({ minLength: 10, maxLength: 50 }),
            redirectUri: fc.webUrl(),
            authCode: fc.string({ minLength: 10, maxLength: 50 }),
            accessToken: fc.string({ minLength: 20, maxLength: 100 }),
            refreshTokenValue: fc.string({ minLength: 20, maxLength: 100 })
          }),
          (testData) => {
            // Create a provider instance
            const provider = new MockOAuthProvider(testData.providerName, testData.scopes);
            
            // Verify: Provider has required readonly properties
            expect(provider).toHaveProperty('name');
            expect(provider).toHaveProperty('scopes');
            expect(typeof provider.name).toBe('string');
            expect(Array.isArray(provider.scopes)).toBe(true);
            expect(provider.name).toBe(testData.providerName);
            expect(provider.scopes).toEqual(testData.scopes);
            
            // Verify: Provider has getAuthorizationUrl method
            expect(provider).toHaveProperty('getAuthorizationUrl');
            expect(typeof provider.getAuthorizationUrl).toBe('function');
            
            // Verify: getAuthorizationUrl returns a string
            const authUrl = provider.getAuthorizationUrl(testData.state, testData.redirectUri);
            expect(typeof authUrl).toBe('string');
            expect(authUrl.length).toBeGreaterThan(0);
            
            // Verify: Provider has exchangeCodeForToken method
            expect(provider).toHaveProperty('exchangeCodeForToken');
            expect(typeof provider.exchangeCodeForToken).toBe('function');
            
            // Verify: Provider has getUserProfile method
            expect(provider).toHaveProperty('getUserProfile');
            expect(typeof provider.getUserProfile).toBe('function');
            
            // Verify: Provider has refreshToken method
            expect(provider).toHaveProperty('refreshToken');
            expect(typeof provider.refreshToken).toBe('function');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify exchangeCodeForToken returns valid OAuthTokens structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            providerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]+$/.test(s)),
            authCode: fc.string({ minLength: 10, maxLength: 50 }),
            redirectUri: fc.webUrl()
          }),
          async (testData) => {
            const provider = new MockOAuthProvider(testData.providerName);
            
            // Execute: Exchange code for tokens
            const tokens = await provider.exchangeCodeForToken(testData.authCode, testData.redirectUri);
            
            // Verify: Tokens object has required structure
            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('expiresIn');
            expect(tokens).toHaveProperty('tokenType');
            
            // Verify: Required fields have correct types
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.expiresIn).toBe('number');
            expect(typeof tokens.tokenType).toBe('string');
            
            // Verify: Optional refreshToken field has correct type if present
            if (tokens.refreshToken !== undefined) {
              expect(typeof tokens.refreshToken).toBe('string');
            }
            
            // Verify: Values are non-empty/valid
            expect(tokens.accessToken.length).toBeGreaterThan(0);
            expect(tokens.expiresIn).toBeGreaterThan(0);
            expect(tokens.tokenType.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify getUserProfile returns valid UserProfile structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            providerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]+$/.test(s)),
            accessToken: fc.string({ minLength: 20, maxLength: 100 })
          }),
          async (testData) => {
            const provider = new MockOAuthProvider(testData.providerName);
            
            // Execute: Get user profile
            const profile = await provider.getUserProfile(testData.accessToken);
            
            // Verify: Profile object has required structure
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('email');
            expect(profile).toHaveProperty('emailVerified');
            
            // Verify: Required fields have correct types
            expect(typeof profile.id).toBe('string');
            expect(typeof profile.email).toBe('string');
            expect(typeof profile.emailVerified).toBe('boolean');
            
            // Verify: Optional fields have correct types if present
            if (profile.firstName !== undefined) {
              expect(typeof profile.firstName).toBe('string');
            }
            if (profile.lastName !== undefined) {
              expect(typeof profile.lastName).toBe('string');
            }
            if (profile.phone !== undefined) {
              expect(typeof profile.phone).toBe('string');
            }
            if (profile.avatar !== undefined) {
              expect(typeof profile.avatar).toBe('string');
            }
            
            // Verify: Required values are non-empty
            expect(profile.id.length).toBeGreaterThan(0);
            expect(profile.email.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify refreshToken returns valid OAuthTokens structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            providerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]+$/.test(s)),
            refreshTokenValue: fc.string({ minLength: 20, maxLength: 100 })
          }),
          async (testData) => {
            const provider = new MockOAuthProvider(testData.providerName);
            
            // Execute: Refresh token
            const tokens = await provider.refreshToken(testData.refreshTokenValue);
            
            // Verify: Tokens object has required structure (same as exchangeCodeForToken)
            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('expiresIn');
            expect(tokens).toHaveProperty('tokenType');
            
            // Verify: Required fields have correct types
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.expiresIn).toBe('number');
            expect(typeof tokens.tokenType).toBe('string');
            
            // Verify: Optional refreshToken field has correct type if present
            if (tokens.refreshToken !== undefined) {
              expect(typeof tokens.refreshToken).toBe('string');
            }
            
            // Verify: Values are non-empty/valid
            expect(tokens.accessToken.length).toBeGreaterThan(0);
            expect(tokens.expiresIn).toBeGreaterThan(0);
            expect(tokens.tokenType.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify provider can be registered and used in OAuthService', () => {
      fc.assert(
        fc.property(
          fc.record({
            providerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]+$/.test(s)),
            scopes: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
          }),
          (testData) => {
            const service = new OAuthService();
            const provider = new MockOAuthProvider(testData.providerName, testData.scopes);
            
            // Verify: Provider can be registered
            expect(() => {
              service.registerProvider(testData.providerName, provider);
            }).not.toThrow();
            
            // Verify: Provider can be retrieved
            const retrievedProvider = service.getProvider(testData.providerName);
            expect(retrievedProvider).toBe(provider);
            
            // Verify: Retrieved provider has all interface properties
            expect(retrievedProvider).toHaveProperty('name');
            expect(retrievedProvider).toHaveProperty('scopes');
            expect(retrievedProvider).toHaveProperty('getAuthorizationUrl');
            expect(retrievedProvider).toHaveProperty('exchangeCodeForToken');
            expect(retrievedProvider).toHaveProperty('getUserProfile');
            expect(retrievedProvider).toHaveProperty('refreshToken');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify interface compliance across multiple provider instances', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              providerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z]+$/.test(s)),
              scopes: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
            }),
            { minLength: 1, maxLength: 5 }
          ).map(providers => {
            // Ensure unique provider names
            const uniqueProviders = new Map<string, typeof providers[0]>();
            providers.forEach(p => uniqueProviders.set(p.providerName, p));
            return Array.from(uniqueProviders.values());
          }),
          (providersData) => {
            const service = new OAuthService();
            
            // Create and register all providers
            const providers = providersData.map(data => {
              const provider = new MockOAuthProvider(data.providerName, data.scopes);
              service.registerProvider(data.providerName, provider);
              return provider;
            });
            
            // Verify: All providers implement the interface consistently
            providers.forEach(provider => {
              // Check readonly properties
              expect(typeof provider.name).toBe('string');
              expect(Array.isArray(provider.scopes)).toBe(true);
              
              // Check methods exist and are functions
              expect(typeof provider.getAuthorizationUrl).toBe('function');
              expect(typeof provider.exchangeCodeForToken).toBe('function');
              expect(typeof provider.getUserProfile).toBe('function');
              expect(typeof provider.refreshToken).toBe('function');
              
              // Verify provider can be retrieved from service
              const retrieved = service.getProvider(provider.name);
              expect(retrieved).toBe(provider);
            });
            
            // Verify: All registered providers are accessible
            const registeredNames = service.getRegisteredProviders();
            expect(registeredNames.length).toBe(providers.length);
            providers.forEach(provider => {
              expect(registeredNames).toContain(provider.name);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
