import {
    BlockStack,
    Button,
    Text,
    TextField,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';
import type { CustomStyling } from '../utils/styling';

interface EmailAuthProps {
  shop: string;
  onSuccess: (multipassUrl: string) => void;
  onBack: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  customStyling: CustomStyling | null;
}

export function EmailAuth({ shop, onSuccess, onBack, isLoading, setIsLoading, customStyling }: EmailAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`https://${shop}/api/auth/email/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          shop,
        }),
      });

      const data = await response.json();

      if (data.success && data.multipassUrl) {
        onSuccess(data.multipassUrl);
      } else {
        setError(data.error || 'Invalid email or password. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
      setIsLoading(false);
    }
  };

  return (
    <BlockStack spacing="base">
      <Text>Sign in with your email and password.</Text>
      
      <TextField
        label="Email"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="your@email.com"
        disabled={isLoading}
        accessibilityLabel="Enter your email address"
      />

      <TextField
        label="Password"
        value={password}
        onChange={setPassword}
        type="password"
        placeholder="••••••••"
        disabled={isLoading}
        accessibilityLabel="Enter your password"
      />

      {error && (
        <Text appearance="critical">{error}</Text>
      )}

      <BlockStack spacing="tight">
        <Button
          kind="primary"
          onPress={handleLogin}
          disabled={isLoading || !email || !password}
          accessibilityLabel="Sign in with email and password"
        >
          Sign In
        </Button>
        
        <Button
          kind="plain"
          onPress={onBack}
          disabled={isLoading}
          accessibilityLabel="Go back to authentication method selection"
        >
          Back
        </Button>
      </BlockStack>
    </BlockStack>
  );
}
