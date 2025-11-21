/**
 * Service exports
 * Central export point for all services
 */

export { AuthService } from './AuthService';
export { CustomerService } from './CustomerService';
export { MultipassService } from './MultipassService';
export { OAuthService } from './OAuthService';
export { OrderService } from './OrderService';
export { OTPService } from './OTPService';
export { SessionService } from './SessionService';
export { SettingsService } from './SettingsService';
export { SMSService } from './SMSService';

// Export types
export type { AuthResult } from './AuthService';
export type { CreateCustomerData, ShopifyCustomer, UpdateCustomerData } from './CustomerService';
export type { CustomerData } from './MultipassService';
export type { ShopifyOrder } from './OrderService';
export type { SessionData } from './SessionService';
export type { AuthSettings } from './SettingsService';

