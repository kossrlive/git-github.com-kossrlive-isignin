/**
 * Settings Service
 * Manages app configuration settings stored in Shopify shop metafields
 * Requirements: 12.2
 */

import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

export interface AuthSettings {
  enabledMethods: {
    sms: boolean;
    email: boolean;
    google: boolean;
  };
  uiCustomization: {
    primaryColor: string;
    buttonStyle: 'rounded' | 'square' | 'pill';
    logoUrl: string;
  };
}

const DEFAULT_SETTINGS: AuthSettings = {
  enabledMethods: {
    sms: true,
    email: true,
    google: false,
  },
  uiCustomization: {
    primaryColor: '#000000',
    buttonStyle: 'rounded',
    logoUrl: '',
  },
};

const SETTINGS_CACHE_KEY = 'app:settings';
const SETTINGS_CACHE_TTL = 300; // 5 minutes

export class SettingsService {
  constructor(private redis: Redis) {}

  /**
   * Get current settings
   * Requirement 12.2: Fetch settings from shop metafields (cached in Redis)
   */
  async getSettings(): Promise<AuthSettings> {
    try {
      // Try to get from cache first
      const cached = await this.redis.get(SETTINGS_CACHE_KEY);
      if (cached) {
        logger.debug('Settings retrieved from cache');
        return JSON.parse(cached);
      }

      // In a real implementation, this would fetch from Shopify Admin API metafields
      // For now, we'll use Redis as the primary storage
      // Key: shop:metafields:auth_app_config
      const settingsData = await this.redis.get('shop:metafields:auth_app_config');
      
      if (settingsData) {
        const settings = JSON.parse(settingsData);
        
        // Cache the settings
        await this.redis.setex(
          SETTINGS_CACHE_KEY,
          SETTINGS_CACHE_TTL,
          JSON.stringify(settings)
        );
        
        return settings;
      }

      // Return default settings if none exist
      logger.info('No settings found, returning defaults');
      return DEFAULT_SETTINGS;
    } catch (error) {
      logger.error('Failed to get settings', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return default settings on error
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings
   * Requirement 12.2: Save settings to shop metafields
   */
  async saveSettings(settings: AuthSettings): Promise<AuthSettings> {
    try {
      // Validate settings structure
      this.validateSettings(settings);

      // In a real implementation, this would save to Shopify Admin API metafields
      // For now, we'll use Redis as the primary storage
      await this.redis.set(
        'shop:metafields:auth_app_config',
        JSON.stringify(settings)
      );

      // Update cache
      await this.redis.setex(
        SETTINGS_CACHE_KEY,
        SETTINGS_CACHE_TTL,
        JSON.stringify(settings)
      );

      logger.info('Settings saved successfully', {
        enabledMethods: settings.enabledMethods,
        buttonStyle: settings.uiCustomization.buttonStyle
      });

      return settings;
    } catch (error) {
      logger.error('Failed to save settings', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get enabled authentication methods
   * Requirement 12.4: Dynamic auth method availability
   */
  async getEnabledMethods(): Promise<string[]> {
    const settings = await this.getSettings();
    const methods: string[] = [];

    if (settings.enabledMethods.sms) {
      methods.push('sms');
    }
    if (settings.enabledMethods.email) {
      methods.push('email');
    }
    if (settings.enabledMethods.google) {
      methods.push('google');
    }

    return methods;
  }

  /**
   * Check if a specific auth method is enabled
   */
  async isMethodEnabled(method: 'sms' | 'email' | 'google'): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.enabledMethods[method];
  }

  /**
   * Invalidate settings cache
   * Used when settings are updated to ensure fresh data
   */
  async invalidateCache(): Promise<void> {
    await this.redis.del(SETTINGS_CACHE_KEY);
    logger.debug('Settings cache invalidated');
  }

  /**
   * Validate settings structure
   */
  private validateSettings(settings: AuthSettings): void {
    if (!settings.enabledMethods || typeof settings.enabledMethods !== 'object') {
      throw new Error('Invalid enabledMethods structure');
    }

    if (!settings.uiCustomization || typeof settings.uiCustomization !== 'object') {
      throw new Error('Invalid uiCustomization structure');
    }

    // Ensure at least one method is enabled
    const { sms, email, google } = settings.enabledMethods;
    if (!sms && !email && !google) {
      throw new Error('At least one authentication method must be enabled');
    }
  }
}
