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

export const DEFAULT_SETTINGS: AuthSettings = {
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
