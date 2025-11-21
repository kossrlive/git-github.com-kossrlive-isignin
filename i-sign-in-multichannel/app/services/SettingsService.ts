/**
 * Settings Service
 * Manages app configuration settings stored in Prisma database
 * Requirements: 12.2
 */

import type { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

export interface AuthSettings {
  enabledMethods: {
    sms: boolean;
    email: boolean;
    google: boolean;
  };
  smsProvider: {
    primary: 'sms.to' | 'twilio';
    smsTo: {
      apiKey: string;
      senderId: string;
    };
    twilio: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    };
  };
  oauthProviders: {
    google: {
      clientId: string;
      clientSecret: string;
      enabled: boolean;
    };
  };
  uiCustomization: {
    primaryColor: string;
    buttonStyle: 'rounded' | 'square';
    logoUrl: string;
  };
  orderConfirmation: {
    enabled: boolean;
    messageTemplate: string;
  };
  multipassSecret?: string;
}

export class SettingsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get current settings for a shop
   * Requirement 12.2: Fetch settings from Prisma database
   */
  async getSettings(shopDomain: string): Promise<AuthSettings | null> {
    try {
      // Find shop by domain
      const shop = await this.prisma.shop.findUnique({
        where: { domain: shopDomain },
        include: { settings: true }
      });

      if (!shop || !shop.settings) {
        logger.info('No settings found for shop', { shopDomain });
        return null;
      }

      const settings = shop.settings;

      // Map Prisma model to AuthSettings interface
      const authSettings: AuthSettings = {
        enabledMethods: {
          sms: settings.smsAuthEnabled,
          email: settings.emailAuthEnabled,
          google: settings.googleEnabled
        },
        smsProvider: {
          primary: (settings.smsPrimary as 'sms.to' | 'twilio') || 'sms.to',
          smsTo: {
            apiKey: settings.smsToApiKey || '',
            senderId: settings.smsToSenderId || ''
          },
          twilio: {
            accountSid: settings.twilioAccountSid || '',
            authToken: settings.twilioAuthToken || '',
            fromNumber: settings.twilioFromNumber || ''
          }
        },
        oauthProviders: {
          google: {
            clientId: settings.googleClientId || '',
            clientSecret: settings.googleClientSecret || '',
            enabled: settings.googleEnabled
          }
        },
        uiCustomization: {
          primaryColor: settings.primaryColor,
          buttonStyle: settings.buttonStyle as 'rounded' | 'square',
          logoUrl: settings.logoUrl || ''
        },
        orderConfirmation: {
          enabled: settings.orderConfirmationEnabled,
          messageTemplate: settings.orderConfirmationMessage || "Thank you for your order! Order #{order.number} - Total: ${order.total}. We'll notify you when it ships."
        },
        multipassSecret: settings.multipassSecret || undefined
      };

      logger.info('Settings retrieved successfully', { shopDomain });
      return authSettings;
    } catch (error) {
      logger.error('Failed to get settings', {
        shopDomain,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get settings');
    }
  }

  /**
   * Save settings for a shop
   * Requirement 12.2: Save settings to Prisma database
   */
  async saveSettings(shopDomain: string, settings: AuthSettings): Promise<AuthSettings> {
    try {
      // Validate settings structure
      this.validateSettings(settings);

      // Find or create shop
      let shop = await this.prisma.shop.findUnique({
        where: { domain: shopDomain }
      });

      if (!shop) {
        // Create shop if it doesn't exist
        shop = await this.prisma.shop.create({
          data: {
            domain: shopDomain,
            accessToken: '' // Will be set during OAuth
          }
        });
      }

      // Upsert settings
      await this.prisma.shopSettings.upsert({
        where: { shopId: shop.id },
        create: {
          shopId: shop.id,
          smsPrimary: settings.smsProvider.primary,
          smsToApiKey: settings.smsProvider.smsTo.apiKey,
          smsToSenderId: settings.smsProvider.smsTo.senderId,
          twilioAccountSid: settings.smsProvider.twilio.accountSid,
          twilioAuthToken: settings.smsProvider.twilio.authToken,
          twilioFromNumber: settings.smsProvider.twilio.fromNumber,
          googleClientId: settings.oauthProviders.google.clientId,
          googleClientSecret: settings.oauthProviders.google.clientSecret,
          googleEnabled: settings.oauthProviders.google.enabled,
          primaryColor: settings.uiCustomization.primaryColor,
          buttonStyle: settings.uiCustomization.buttonStyle,
          logoUrl: settings.uiCustomization.logoUrl,
          multipassSecret: settings.multipassSecret,
          smsAuthEnabled: settings.enabledMethods.sms,
          emailAuthEnabled: settings.enabledMethods.email,
          oauthAuthEnabled: settings.enabledMethods.google,
          orderConfirmationEnabled: settings.orderConfirmation.enabled,
          orderConfirmationMessage: settings.orderConfirmation.messageTemplate
        },
        update: {
          smsPrimary: settings.smsProvider.primary,
          smsToApiKey: settings.smsProvider.smsTo.apiKey,
          smsToSenderId: settings.smsProvider.smsTo.senderId,
          twilioAccountSid: settings.smsProvider.twilio.accountSid,
          twilioAuthToken: settings.smsProvider.twilio.authToken,
          twilioFromNumber: settings.smsProvider.twilio.fromNumber,
          googleClientId: settings.oauthProviders.google.clientId,
          googleClientSecret: settings.oauthProviders.google.clientSecret,
          googleEnabled: settings.oauthProviders.google.enabled,
          primaryColor: settings.uiCustomization.primaryColor,
          buttonStyle: settings.uiCustomization.buttonStyle,
          logoUrl: settings.uiCustomization.logoUrl,
          multipassSecret: settings.multipassSecret,
          smsAuthEnabled: settings.enabledMethods.sms,
          emailAuthEnabled: settings.enabledMethods.email,
          oauthAuthEnabled: settings.enabledMethods.google,
          orderConfirmationEnabled: settings.orderConfirmation.enabled,
          orderConfirmationMessage: settings.orderConfirmation.messageTemplate
        }
      });

      logger.info('Settings saved successfully', {
        shopDomain,
        enabledMethods: settings.enabledMethods
      });

      return settings;
    } catch (error) {
      logger.error('Failed to save settings', {
        shopDomain,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get enabled authentication methods
   * Requirement 12.4: Dynamic auth method availability
   */
  async getEnabledMethods(shopDomain: string): Promise<string[]> {
    const settings = await this.getSettings(shopDomain);
    if (!settings) {
      return [];
    }

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
  async isMethodEnabled(shopDomain: string, method: 'sms' | 'email' | 'google'): Promise<boolean> {
    const settings = await this.getSettings(shopDomain);
    if (!settings) {
      return false;
    }
    return settings.enabledMethods[method];
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
