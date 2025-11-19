/**
 * Google OAuth Provider Implementation
 * Implements IOAuthProvider for Google OAuth 2.0
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../config/logger.js';
import {
    IOAuthProvider,
    OAuthTokens,
    UserProfile
} from './IOAuthProvider.js';

export class GoogleOAuthProvider implements IOAuthProvider {
  readonly name = 'google';
  readonly scopes = ['openid', 'email', 'profile'];
  
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenEndpoint = 'https://oauth2.googleapis.com/token';
  private readonly userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';
  
  constructor(clientId: string, clientSecret: string) {
    if (!clientId) {
      throw new Error('Google OAuth client ID is required');
    }
    if (!clientSecret) {
      throw new Error('Google OAuth client secret is required');
    }
    
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
  
  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });
    
    const url = `${this.authorizationEndpoint}?${params.toString()}`;
    
    logger.info('Generated Google OAuth authorization URL', {
      provider: this.name,
      state,
      redirectUri
    });
    
    return url;
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokens> {
    try {
      logger.info('Exchanging authorization code for tokens', {
        provider: this.name,
        redirectUri
      });
      
      const response = await axios.post(
        this.tokenEndpoint,
        {
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );
      
      const tokens: OAuthTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };
      
      logger.info('Successfully exchanged code for tokens', {
        provider: this.name,
        hasRefreshToken: !!tokens.refreshToken
      });
      
      return tokens;
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to exchange authorization code for tokens', {
        provider: this.name,
        error: axiosError.message,
        statusCode: axiosError.response?.status,
        responseData: axiosError.response?.data
      });
      
      throw new Error(`Failed to exchange authorization code: ${axiosError.message}`);
    }
  }
  
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    try {
      logger.info('Fetching user profile from Google', {
        provider: this.name
      });
      
      const response = await axios.get(
        this.userInfoEndpoint,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          timeout: 10000
        }
      );
      
      const profile: UserProfile = {
        id: response.data.id,
        email: response.data.email,
        firstName: response.data.given_name,
        lastName: response.data.family_name,
        phone: response.data.phone,
        avatar: response.data.picture,
        emailVerified: response.data.verified_email || false
      };
      
      logger.info('Successfully fetched user profile from Google', {
        provider: this.name,
        userId: profile.id,
        email: profile.email,
        emailVerified: profile.emailVerified
      });
      
      return profile;
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to fetch user profile from Google', {
        provider: this.name,
        error: axiosError.message,
        statusCode: axiosError.response?.status
      });
      
      throw new Error(`Failed to fetch user profile: ${axiosError.message}`);
    }
  }
  
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      logger.info('Refreshing access token', {
        provider: this.name
      });
      
      const response = await axios.post(
        this.tokenEndpoint,
        {
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );
      
      const tokens: OAuthTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken, // Google may not return new refresh token
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      };
      
      logger.info('Successfully refreshed access token', {
        provider: this.name
      });
      
      return tokens;
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to refresh access token', {
        provider: this.name,
        error: axiosError.message,
        statusCode: axiosError.response?.status
      });
      
      throw new Error(`Failed to refresh access token: ${axiosError.message}`);
    }
  }
}
