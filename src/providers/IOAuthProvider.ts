/**
 * OAuth Provider Interface
 * Defines the contract for all OAuth provider implementations
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
}

export interface IOAuthProvider {
  readonly name: string;
  readonly scopes: string[];
  
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokens>;
  getUserProfile(accessToken: string): Promise<UserProfile>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
}
