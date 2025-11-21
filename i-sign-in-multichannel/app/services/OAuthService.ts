/**
 * OAuth Service
 * Manages OAuth providers and orchestrates OAuth authentication flow
 */

import { logger } from '../config/logger.js';
import {
    IOAuthProvider,
    OAuthTokens,
    UserProfile
} from '../providers/IOAuthProvider.js';

export class OAuthService {
  private providers: Map<string, IOAuthProvider>;
  
  constructor() {
    this.providers = new Map();
    
    logger.info('OAuthService initialized');
  }
  
  /**
   * Register an OAuth provider
   * @param name - Provider name (e.g., 'google', 'apple', 'facebook')
   * @param provider - Provider implementation
   */
  registerProvider(name: string, provider: IOAuthProvider): void {
    if (!name) {
      throw new Error('Provider name is required');
    }
    
    if (!provider) {
      throw new Error('Provider implementation is required');
    }
    
    if (this.providers.has(name)) {
      logger.warn('Overwriting existing OAuth provider', { provider: name });
    }
    
    this.providers.set(name, provider);
    
    logger.info('OAuth provider registered', {
      provider: name,
      scopes: provider.scopes
    });
  }
  
  /**
   * Get an OAuth provider by name
   * @param name - Provider name
   * @returns Provider implementation or undefined if not found
   */
  getProvider(name: string): IOAuthProvider | undefined {
    const provider = this.providers.get(name);
    
    if (!provider) {
      logger.warn('OAuth provider not found', { provider: name });
    }
    
    return provider;
  }
  
  /**
   * Get all registered provider names
   * @returns Array of provider names
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Initiate OAuth flow by generating authorization URL
   * @param providerName - Name of the OAuth provider
   * @param redirectUri - Redirect URI after authorization
   * @param state - State parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   * @throws Error if provider not found
   */
  async initiateOAuth(
    providerName: string,
    redirectUri: string,
    state?: string
  ): Promise<string> {
    logger.info('Initiating OAuth flow', {
      provider: providerName,
      redirectUri
    });
    
    const provider = this.getProvider(providerName);
    
    if (!provider) {
      logger.error('Cannot initiate OAuth: provider not found', {
        provider: providerName
      });
      throw new Error(`OAuth provider '${providerName}' not found`);
    }
    
    // Generate state parameter if not provided (for CSRF protection)
    const stateParam = state || this.generateState();
    
    try {
      const authUrl = provider.getAuthorizationUrl(stateParam, redirectUri);
      
      logger.info('OAuth authorization URL generated', {
        provider: providerName,
        state: stateParam
      });
      
      return authUrl;
      
    } catch (error) {
      logger.error('Failed to generate OAuth authorization URL', {
        provider: providerName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error(
        `Failed to initiate OAuth with ${providerName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  
  /**
   * Handle OAuth callback by exchanging code for tokens and fetching user profile
   * @param providerName - Name of the OAuth provider
   * @param code - Authorization code from OAuth provider
   * @param redirectUri - Redirect URI used in the initial request
   * @returns User profile from OAuth provider
   * @throws Error if provider not found or exchange fails
   */
  async handleCallback(
    providerName: string,
    code: string,
    redirectUri: string
  ): Promise<UserProfile> {
    logger.info('Handling OAuth callback', {
      provider: providerName,
      redirectUri
    });
    
    const provider = this.getProvider(providerName);
    
    if (!provider) {
      logger.error('Cannot handle OAuth callback: provider not found', {
        provider: providerName
      });
      throw new Error(`OAuth provider '${providerName}' not found`);
    }
    
    try {
      // Step 1: Exchange authorization code for tokens
      logger.info('Exchanging authorization code for tokens', {
        provider: providerName
      });
      
      const tokens: OAuthTokens = await provider.exchangeCodeForToken(
        code,
        redirectUri
      );
      
      logger.info('Successfully obtained OAuth tokens', {
        provider: providerName,
        hasRefreshToken: !!tokens.refreshToken
      });
      
      // Step 2: Fetch user profile using access token
      logger.info('Fetching user profile', {
        provider: providerName
      });
      
      const profile: UserProfile = await provider.getUserProfile(
        tokens.accessToken
      );
      
      logger.info('Successfully fetched user profile', {
        provider: providerName,
        userId: profile.id,
        email: profile.email,
        emailVerified: profile.emailVerified
      });
      
      return profile;
      
    } catch (error) {
      logger.error('Failed to handle OAuth callback', {
        provider: providerName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error(
        `Failed to complete OAuth with ${providerName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  
  /**
   * Generate a random state parameter for CSRF protection
   * @returns Random state string
   */
  private generateState(): string {
    // Generate a random 32-character hex string
    const randomBytes = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
    );
    
    return randomBytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
