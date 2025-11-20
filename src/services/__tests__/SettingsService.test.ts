/**
 * Property-Based Tests for SettingsService
 * Tests settings persistence and dynamic auth method availability
 * Requirements: 12.2, 12.4
 */

import fc from 'fast-check';
import Redis from 'ioredis-mock';
import { AuthSettings, SettingsService } from '../SettingsService.js';

describe('SettingsService Property Tests', () => {
  let redis: Redis;
  let settingsService: SettingsService;

  beforeEach(() => {
    redis = new Redis();
    settingsService = new SettingsService(redis);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  /**
   * Feature: shopify-sms-auth, Property 27: Settings persistence
   * Validates: Requirements 12.2
   * 
   * For any valid settings object, saving and then retrieving should return
   * the same settings
   */
  describe('Property 27: Settings persistence', () => {
    it('should persist and retrieve settings correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid settings
          fc.record({
            enabledMethods: fc.record({
              sms: fc.boolean(),
              email: fc.boolean(),
              google: fc.boolean(),
            }).filter(methods => methods.sms || methods.email || methods.google), // At least one must be true
            uiCustomization: fc.record({
              primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
              buttonStyle: fc.constantFrom('rounded', 'square', 'pill'),
              logoUrl: fc.oneof(
                fc.constant(''),
                fc.webUrl()
              ),
            }),
          }),
          async (settings: AuthSettings) => {
            // Save settings
            const saved = await settingsService.saveSettings(settings);

            // Retrieve settings
            const retrieved = await settingsService.getSettings();

            // Settings should match
            expect(retrieved).toEqual(saved);
            expect(retrieved.enabledMethods).toEqual(settings.enabledMethods);
            expect(retrieved.uiCustomization.primaryColor).toBe(settings.uiCustomization.primaryColor);
            expect(retrieved.uiCustomization.buttonStyle).toBe(settings.uiCustomization.buttonStyle);
            expect(retrieved.uiCustomization.logoUrl).toBe(settings.uiCustomization.logoUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cache invalidation correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enabledMethods: fc.record({
              sms: fc.boolean(),
              email: fc.boolean(),
              google: fc.boolean(),
            }).filter(methods => methods.sms || methods.email || methods.google),
            uiCustomization: fc.record({
              primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
              buttonStyle: fc.constantFrom('rounded', 'square', 'pill'),
              logoUrl: fc.constant(''),
            }),
          }),
          fc.record({
            enabledMethods: fc.record({
              sms: fc.boolean(),
              email: fc.boolean(),
              google: fc.boolean(),
            }).filter(methods => methods.sms || methods.email || methods.google),
            uiCustomization: fc.record({
              primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
              buttonStyle: fc.constantFrom('rounded', 'square', 'pill'),
              logoUrl: fc.constant(''),
            }),
          }),
          async (settings1: AuthSettings, settings2: AuthSettings) => {
            // Save first settings
            await settingsService.saveSettings(settings1);
            const retrieved1 = await settingsService.getSettings();
            expect(retrieved1).toEqual(settings1);

            // Save second settings (should invalidate cache)
            await settingsService.saveSettings(settings2);
            const retrieved2 = await settingsService.getSettings();
            
            // Should get the new settings, not cached old ones
            expect(retrieved2).toEqual(settings2);
            expect(retrieved2).not.toEqual(settings1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: shopify-sms-auth, Property 28: Dynamic auth method availability
   * Validates: Requirements 12.4
   * 
   * For any settings configuration, only the enabled methods should be
   * returned by getEnabledMethods
   */
  describe('Property 28: Dynamic auth method availability', () => {
    it('should return only enabled authentication methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enabledMethods: fc.record({
              sms: fc.boolean(),
              email: fc.boolean(),
              google: fc.boolean(),
            }).filter(methods => methods.sms || methods.email || methods.google),
            uiCustomization: fc.record({
              primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
              buttonStyle: fc.constantFrom('rounded', 'square', 'pill'),
              logoUrl: fc.constant(''),
            }),
          }),
          async (settings: AuthSettings) => {
            // Save settings
            await settingsService.saveSettings(settings);

            // Get enabled methods
            const enabledMethods = await settingsService.getEnabledMethods();

            // Build expected array
            const expected: string[] = [];
            if (settings.enabledMethods.sms) expected.push('sms');
            if (settings.enabledMethods.email) expected.push('email');
            if (settings.enabledMethods.google) expected.push('google');

            // Should match exactly
            expect(enabledMethods.sort()).toEqual(expected.sort());

            // Verify each method individually
            expect(await settingsService.isMethodEnabled('sms')).toBe(settings.enabledMethods.sms);
            expect(await settingsService.isMethodEnabled('email')).toBe(settings.enabledMethods.email);
            expect(await settingsService.isMethodEnabled('google')).toBe(settings.enabledMethods.google);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always have at least one method enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enabledMethods: fc.record({
              sms: fc.boolean(),
              email: fc.boolean(),
              google: fc.boolean(),
            }).filter(methods => methods.sms || methods.email || methods.google),
            uiCustomization: fc.record({
              primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
              buttonStyle: fc.constantFrom('rounded', 'square', 'pill'),
              logoUrl: fc.constant(''),
            }),
          }),
          async (settings: AuthSettings) => {
            await settingsService.saveSettings(settings);
            const enabledMethods = await settingsService.getEnabledMethods();

            // At least one method must be enabled
            expect(enabledMethods.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject settings with no enabled methods', async () => {
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

      await expect(settingsService.saveSettings(invalidSettings)).rejects.toThrow(
        'At least one authentication method must be enabled'
      );
    });
  });

  /**
   * Additional property tests for settings validation
   */
  describe('Settings validation properties', () => {
    it('should validate primary color format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.hexaString({ minLength: 6, maxLength: 6 }),
          async (hexColor: string) => {
            const settings: AuthSettings = {
              enabledMethods: {
                sms: true,
                email: false,
                google: false,
              },
              uiCustomization: {
                primaryColor: `#${hexColor}`,
                buttonStyle: 'rounded',
                logoUrl: '',
              },
            };

            // Should save successfully with valid hex color
            await expect(settingsService.saveSettings(settings)).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate button style options', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('rounded', 'square', 'pill'),
          async (buttonStyle: 'rounded' | 'square' | 'pill') => {
            const settings: AuthSettings = {
              enabledMethods: {
                sms: true,
                email: false,
                google: false,
              },
              uiCustomization: {
                primaryColor: '#000000',
                buttonStyle,
                logoUrl: '',
              },
            };

            // Should save successfully with valid button style
            const saved = await settingsService.saveSettings(settings);
            expect(saved.uiCustomization.buttonStyle).toBe(buttonStyle);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge case tests
   */
  describe('Edge cases', () => {
    it('should handle empty logo URL', async () => {
      const settings: AuthSettings = {
        enabledMethods: {
          sms: true,
          email: false,
          google: false,
        },
        uiCustomization: {
          primaryColor: '#000000',
          buttonStyle: 'rounded',
          logoUrl: '',
        },
      };

      const saved = await settingsService.saveSettings(settings);
      expect(saved.uiCustomization.logoUrl).toBe('');
    });

    it('should return default settings when none exist', async () => {
      const settings = await settingsService.getSettings();
      
      // Should return default settings
      expect(settings.enabledMethods.sms).toBe(true);
      expect(settings.enabledMethods.email).toBe(true);
      expect(settings.enabledMethods.google).toBe(false);
    });

    it('should handle all methods enabled', async () => {
      const settings: AuthSettings = {
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

      await settingsService.saveSettings(settings);
      const enabledMethods = await settingsService.getEnabledMethods();
      
      expect(enabledMethods).toHaveLength(3);
      expect(enabledMethods).toContain('sms');
      expect(enabledMethods).toContain('email');
      expect(enabledMethods).toContain('google');
    });

    it('should handle only one method enabled', async () => {
      const methods = ['sms', 'email', 'google'] as const;
      
      for (const method of methods) {
        const settings: AuthSettings = {
          enabledMethods: {
            sms: method === 'sms',
            email: method === 'email',
            google: method === 'google',
          },
          uiCustomization: {
            primaryColor: '#000000',
            buttonStyle: 'rounded',
            logoUrl: '',
          },
        };

        await settingsService.saveSettings(settings);
        const enabledMethods = await settingsService.getEnabledMethods();
        
        expect(enabledMethods).toHaveLength(1);
        expect(enabledMethods[0]).toBe(method);
      }
    });
  });
});
