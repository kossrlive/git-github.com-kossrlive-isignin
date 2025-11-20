export interface AppSettings {
  enabledMethods: AuthMethod[];
  uiCustomization: {
    primaryColor: string;
    buttonStyle: 'rounded' | 'square';
    logoUrl?: string;
  };
}

export type AuthMethod = 'sms' | 'email' | 'google' | 'apple' | 'facebook';

export interface SessionData {
  customerId: string;
  email: string;
  expiresAt: number;
  token: string;
}

export interface AuthResponse {
  success: boolean;
  multipassUrl?: string;
  error?: string;
}

export interface OTPResponse {
  success: boolean;
  message?: string;
  error?: string;
}
