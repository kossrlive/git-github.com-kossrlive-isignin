/**
 * Integration Tests for Admin UI
 * Tests settings save/load workflow and auth method management
 * Requirements: 12.2, 12.4, 12.5
 */

import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { AuthSettings, SettingsService } from '../../services/SettingsService.js';

describe('Admin UI Integration Tests', () => {
  let redis: Redis;
  let settingsService: SettingsService;

  beforeEach(() => {
    // Use real Redis mock for integration tests
    redis = new RedisMock();
    settingsService = new SettingsService(redis);
  });

  afterEach(async () => {
    // Clean up Redis
    await redis.flushall();
    await redis.quit();
  });

  describe('Settings Save and Load Workflow', () => {
    it('should save and load settings successfully', async () => {
      const newSettings: AuthSettings = {
        enabledMethods: {
          sms: true,
          email: true,
          google: true,
        },
        uiCustomization: {
          primaryColor: '#FF5733',
          buttonStyle: 'pill',
          logoUrl: 'https://example.com/logo.png',
        },
      };

      // Save settings
      const savedSettings = await settingsService.saveSettings(newSettings);

      // Verify saved settings match input
      expect(savedSettings).toEqual(newSettings);

      // Load settings
      const loadedSettings = await settingsService.getSettings();

      // Verify loaded settings match saved settings
      expect(loadedSettings).toEqual(newSettings);
      expect(loadedSettings.enabledMethods.sms).toBe(true);
      expect(loadedSettings.enabledMethods.email).toBe(true);
      expect(loadedSettings.enabledMethods.google).toBe(true);
      expect(loadedSettings.uiCustomization.primaryColor).toBe('#FF5733');
      expect(loadedSettings.uiCustomization.buttonStyle).toBe('pill');
      expect(loadedSettings.uiCustomization.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should return default settings when none exist', async () => {
      // Load settings without saving any
      const settings = await settingsService.getSettings();

      // Should return default settings
      expect(settings).toBeDefined();
      expect(settings.enabledMethods).toBeDefined();
      expect(settings.uiCustomization).toBeDefined();
      expect(settings.enabledMethods.sms).toBe(true);
      expect(settings.enabledMethods.email).toBe(true);
      expect(settings.enabledMethods.google).toBe(false);
      expect(settings.uiCustomization.primaryColor).toBe('#000000');
      expect(settings.uiCustomization.buttonStyle).toBe('rounded');
    });

    it('should cache settings for performance', async () => {
      const newSettings: AuthSettings = {
        enabledMethods: {
          sms: true,
          email: false,
          google: true,
        },
        uiCustomization: {
          primaryColor: '#123456',
          buttonStyle: 'square',
          logoUrl: '',
        },
      };

      // Save settings
      await settingsService.saveSettings(newSettings);

      // First load - should fetch from storage
      const firstLoad = await settingsService.getSettings();
      expect(firstLoad).toEqual(newSettings);

      // Second load - should fetch from cache
      const secondLoad = await settingsService.getSettings();
      expect(secondLoad).toEqual(newSettings);

      // Verify cache exists
      const cached = await redis.get('app:settings');
      expect(cached).toBeTruthy();
      expect(JSON.parse(cached!)).toEqual(newSettings);
    });

    it('should invalidate cache when settings are updated', async () => {
      const initialSettings: AuthSettings = {
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

      // Save initial settings
      await settingsService.saveSettings(initialSettings);

      // Load to populate cache
      await settingsService.getSettings();

      // Update settings
      const updatedSettings: AuthSettings = {
        ...initialSettings,
        enabledMethods: {
          sms: false,
          email: true,
          google: true,
        },
      };

      await settingsService.saveSettings(updatedSettings);

      // Load settings again - should get updated settings, not cached
      const loadedSettings = await settingsService.getSettings();
      expect(loadedSettings.enabledMethods.sms).toBe(false);
      expect(loadedSettings.enabledMethods.google).toBe(true);
    });

    it('should validate settings structure on save', async () => {
      const invalidSettings = {
        enabledMethods: 'invalid', // Should be an object
        uiCustomization: {
          primaryColor: '#000000',
          buttonStyle: 'rounded',
          logoUrl: '',
        },
      } as any;

      // Should throw validation error
      await expect(settingsService.saveSettings(invalidSettings)).rejects.toThrow('Invalid enabledMethods structure');
    });

    it('should require at least one auth method to be enabled', async () => {
      const invalidSettings: AuthSettings = {
        enabledMethods: {
          sms: false,
          email: false,
          google: false,
        },
        uiCustomization: {
          primaryColor: '#000000',
          buttonStyle: 'rounded',
          logoUrl: '',
        },
      };

      // Should throw validation error
      await expect(settingsService.saveSettings(invalidSettings)).rejects.toThrow(
        'At least one authentication method must be enabled'
      );
    });
  });

  describe('Settings Changes Reflected on Storefront', () => {
    it('should reflect enabled methods changes', async () => {
      // Initial state: SMS and email enabled
      const initialSettings: AuthSettings = {
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

      await settingsService.saveSettings(initialSettings);

      // Get enabled methods
      let enabledMethods = await settingsService.getEnabledMethods();
      expect(enabledMethods).toContain('sms');
      expect(enabledMethods).toContain('email');
      expect(enabledMethods).not.toContain('google');

      // Update settings: disable SMS, enable Google
      const updatedSettings: AuthSettings = {
        ...initialSettings,
        enabledMethods: {
          sms: false,
          email: true,
          google: true,
        },
      };

      await settingsService.saveSettings(updatedSettings);

      // Get enabled methods again
      enabledMethods = await settingsService.getEnabledMethods();
      expect(enabledMethods).not.toContain('sms');
      expect(enabledMethods).toContain('email');
      expect(enabledMethods).toContain('google');
    });

    it('should reflect UI customization changes', async () => {
      // Initial customization
      const initialSettings: AuthSettings = {
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

      await settingsService.saveSettings(initialSettings);

      // Get settings
      let settings = await settingsService.getSettings();
      expect(settings.uiCustomization.primaryColor).toBe('#000000');
      expect(settings.uiCustomization.buttonStyle).toBe('rounded');
      expect(settings.uiCustomization.logoUrl).toBe('');

      // Update UI customization
      const updatedSettings: AuthSettings = {
        ...initialSettings,
        uiCustomization: {
          primaryColor: '#FF5733',
          buttonStyle: 'pill',
          logoUrl: 'https://cdn.example.com/logo.png',
        },
      };

      await settingsService.saveSettings(updatedSettings);

      // Get settings again
      settings = await settingsService.getSettings();
      expect(settings.uiCustomization.primaryColor).toBe('#FF5733');
      expect(settings.uiCustomization.buttonStyle).toBe('pill');
      expect(settings.uiCustomization.logoUrl).toBe('https://cdn.example.com/logo.png');
    });

    it('should immediately reflect changes without page reload', async () => {
      // Save initial settings
      const initialSettings: AuthSettings = {
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

      await settingsService.saveSettings(initialSettings);

      // Simulate multiple clients checking settings
      const client1Settings = await settingsService.getSettings();
      const client2Settings = await settingsService.getSettings();

      expect(client1Settings).toEqual(initialSettings);
      expect(client2Settings).toEqual(initialSettings);

      // Update settings
      const updatedSettings: AuthSettings = {
        ...initialSettings,
        enabledMethods: {
          sms: false,
          email: true,
          google: true,
        },
      };

      await settingsService.saveSettings(updatedSettings);

      // Both clients should see updated settings immediately
      const client1Updated = await settingsService.getSettings();
      const client2Updated = await settingsService.getSettings();

      expect(client1Updated.enabledMethods.sms).toBe(false);
      expect(client1Updated.enabledMethods.google).toBe(true);
      expect(client2Updated.enabledMethods.sms).toBe(false);
      expect(client2Updated.enabledMethods.google).toBe(true);
    });
  });

  describe('Enabling/Disabling Auth Methods', () => {
    it('should enable and disable SMS authentication', async () => {
      const settings: AuthSettings = {
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

      await settingsService.saveSettings(settings);

      // Check SMS is enabled
      let isSmsEnabled = await settingsService.isMethodEnabled('sms');
      expect(isSmsEnabled).toBe(true);

      // Disable SMS
      settings.enabledMethods.sms = false;
      await settingsService.saveSettings(settings);

      // Check SMS is disabled
      isSmsEnabled = await settingsService.isMethodEnabled('sms');
      expect(isSmsEnabled).toBe(false);
    });

    it('should enable and disable email authentication', async () => {
      const settings: AuthSettings = {
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

      await settingsService.saveSettings(settings);

      // Check email is enabled
      let isEmailEnabled = await settingsService.isMethodEnabled('email');
      expect(isEmailEnabled).toBe(true);

      // Disable email
      settings.enabledMethods.email = false;
      await settingsService.saveSettings(settings);

      // Check email is disabled
      isEmailEnabled = await settingsService.isMethodEnabled('email');
      expect(isEmailEnabled).toBe(false);
    });

    it('should enable and disable Google OAuth', async () => {
      const settings: AuthSettings = {
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

      await settingsService.saveSettings(settings);

      // Check Google is disabled
      let isGoogleEnabled = await settingsService.isMethodEnabled('google');
      expect(isGoogleEnabled).toBe(false);

      // Enable Google
      settings.enabledMethods.google = true;
      await settingsService.saveSettings(settings);

      // Check Google is enabled
      isGoogleEnabled = await settingsService.isMethodEnabled('google');
      expect(isGoogleEnabled).toBe(true);
    });

    it('should allow toggling multiple methods independently', async () => {
      const settings: AuthSettings = {
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

      await settingsService.saveSettings(settings);

      // Toggle SMS off, Google on
      settings.enabledMethods.sms = false;
      settings.enabledMethods.google = true;
      await settingsService.saveSettings(settings);

      // Verify changes
      const isSmsEnabled = await settingsService.isMethodEnabled('sms');
      const isEmailEnabled = await settingsService.isMethodEnabled('email');
      const isGoogleEnabled = await settingsService.isMethodEnabled('google');

      expect(isSmsEnabled).toBe(false);
      expect(isEmailEnabled).toBe(true); // Unchanged
      expect(isGoogleEnabled).toBe(true);
    });

    it('should return correct list of enabled methods', async () => {
      // Test with all methods enabled
      let settings: AuthSettings = {
        enabledMethods: {
          sms: true,
          email: true,
          google: true,
        },
        uiCustomization: {
          primaryColor: '#000000',
          buttonStyle: 'rounded',
          logoUrl: '',
        },
      };

      await settingsService.saveSettings(settings);
      let enabledMethods = await settingsService.getEnabledMethods();
      expect(enabledMethods).toHaveLength(3);
      expect(enabledMethods).toContain('sms');
      expect(enabledMethods).toContain('email');
      expect(enabledMethods).toContain('google');

      // Test with only one method enabled
      settings = {
        enabledMethods: {
          sms: false,
          email: true,
          google: false,
        },
        uiCustomization: {
          primaryColor: '#000000',
          buttonStyle: 'rounded',
          logoUrl: '',
        },
      };

      await settingsService.saveSettings(settings);
      enabledMethods = await settingsService.getEnabledMethods();
      expect(enabledMethods).toHaveLength(1);
      expect(enabledMethods).toContain('email');
      expect(enabledMethods).not.toContain('sms');
      expect(enabledMethods).not.toContain('google');
    });
  });

  describe('Settings Persistence', () => {
    it('should persist settings across service instances', async () => {
      const settings: AuthSettings = {
        enabledMethods: {
          sms: true,
          email: false,
          google: true,
        },
        uiCustomization: {
          primaryColor: '#ABCDEF',
          buttonStyle: 'square',
          logoUrl: 'https://example.com/logo.png',
        },
      };

      // Save with first instance
      await settingsService.saveSettings(settings);

      // Create new service instance (simulating app restart)
      const newSettingsService = new SettingsService(redis);

      // Load settings with new instance
      const loadedSettings = await newSettingsService.getSettings();

      // Should match saved settings
      expect(loadedSettings).toEqual(settings);
    });

    it('should handle concurrent updates correctly', async () => {
      const settings1: AuthSettings = {
        enabledMethods: {
          sms: true,
          email: true,
          google: false,
        },
        uiCustomization: {
          primaryColor: '#111111',
          buttonStyle: 'rounded',
          logoUrl: '',
        },
      };

      const settings2: AuthSettings = {
        enabledMethods: {
          sms: false,
          email: true,
          google: true,
        },
        uiCustomization: {
          primaryColor: '#222222',
          buttonStyle: 'pill',
          logoUrl: 'https://example.com/logo.png',
        },
      };

      // Save both settings concurrently
      await Promise.all([
        settingsService.saveSettings(settings1),
        settingsService.saveSettings(settings2),
      ]);

      // Load settings - should have one of the two (last write wins)
      const loadedSettings = await settingsService.getSettings();
      expect(loadedSettings).toBeDefined();
      
      // Should be either settings1 or settings2
      const matchesSettings1 = JSON.stringify(loadedSettings) === JSON.stringify(settings1);
      const matchesSettings2 = JSON.stringify(loadedSettings) === JSON.stringify(settings2);
      expect(matchesSettings1 || matchesSettings2).toBe(true);
    });
  });
});
