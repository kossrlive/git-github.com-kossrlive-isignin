import {
    BlockStack,
    Button,
    Text,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';
import type { CustomStyling } from '../utils/styling';

interface OAuthAuthProps {
  shop: string;
  onSuccess: (multipassUrl: string) => void;
  onBack: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  customStyling: CustomStyling | null;
}

export function OAuthAuth({ shop, onBack, isLoading, setIsLoading, customStyling }: OAuthAuthProps) {
  const [error, setError] = useState('');

  const handleOAuthLogin = (provider: 'google' | 'apple' | 'facebook') => {
    setError('');
    setIsLoading(true);

    // Get current checkout URL to return to after authentication
    const returnUrl = window.location.href;
    
    // Redirect to OAuth provider
    const oauthUrl = `https://${shop}/api/auth/oauth/${provider}?shop=${shop}&returnUrl=${encodeURIComponent(returnUrl)}`;
    window.location.href = oauthUrl;
  };

  return (
    <BlockStack spacing="base">
      <Text>Choose a provider to sign in with your social account.</Text>
      
      <BlockStack spacing="tight">
        <Button
          kind="primary"
          onPress={() => handleOAuthLogin('google')}
          disabled={isLoading}
          accessibilityLabel="Sign in with your Google account"
        >
          Continue with Google
        </Button>
        
        <Button
          onPress={() => handleOAuthLogin('apple')}
          disabled={isLoading}
          accessibilityLabel="Sign in with your Apple account"
        >
          Continue with Apple
        </Button>
        
        <Button
          onPress={() => handleOAuthLogin('facebook')}
          disabled={isLoading}
          accessibilityLabel="Sign in with your Facebook account"
        >
          Continue with Facebook
        </Button>
      </BlockStack>

      {error && (
        <Text appearance="critical">{error}</Text>
      )}

      <Button
        kind="plain"
        onPress={onBack}
        disabled={isLoading}
        accessibilityLabel="Go back to authentication method selection"
      >
        Back
      </Button>
    </BlockStack>
  );
}
