/**
 * Service exports
 * Central export point for all services
 */

export { AuthService } from './AuthService.js';
export { CustomerService } from './CustomerService.js';
export { MultipassService } from './MultipassService.js';
export { OAuthService } from './OAuthService.js';
export { OrderService } from './OrderService.js';
export { OTPService } from './OTPService.js';
export { SettingsService } from './SettingsService.js';
export { SMSService } from './SMSService.js';

// Export types
export type { AuthResult } from './AuthService.js';
export type { CreateCustomerData, ShopifyCustomer, UpdateCustomerData } from './CustomerService.js';
export type { CustomerData } from './MultipassService.js';
export type { ShopifyOrder } from './OrderService.js';
export type { AuthSettings } from './SettingsService.js';

