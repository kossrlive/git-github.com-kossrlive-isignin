import {
    BlockStack,
    Button,
    InlineStack,
    Text,
    TextField,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';
import type { CustomStyling } from '../utils/styling';

interface SMSAuthProps {
  shop: string;
  onSuccess: (multipassUrl: string) => void;
  onBack: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  customStyling: CustomStyling | null;
}

export function SMSAuth({ shop, onSuccess, onBack, isLoading, setIsLoading, customStyling }: SMSAuthProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const handleSendOTP = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`https://${shop}/api/auth/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          shop,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOtpSent(true);
        if (data.cooldownSeconds) {
          setCooldownSeconds(data.cooldownSeconds);
          // Start countdown
          const interval = setInterval(() => {
            setCooldownSeconds((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } else {
        setError(data.error || 'Failed to send SMS. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`https://${shop}/api/auth/sms/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          code: otpCode,
          shop,
        }),
      });

      const data = await response.json();

      if (data.success && data.multipassUrl) {
        onSuccess(data.multipassUrl);
      } else {
        setError(data.error || 'Invalid code. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
      setIsLoading(false);
    }
  };

  return (
    <BlockStack spacing="base">
      {!otpSent ? (
        <>
          <Text>Enter your phone number to receive a verification code.</Text>
          
          <TextField
            label="Phone Number"
            value={phoneNumber}
            onChange={setPhoneNumber}
            type="tel"
            placeholder="+1234567890"
            disabled={isLoading}
            accessibilityLabel="Enter your phone number in international format"
          />

          {error && (
            <Text appearance="critical">{error}</Text>
          )}

          <BlockStack spacing="tight">
            <Button
              kind="primary"
              onPress={handleSendOTP}
              disabled={isLoading || !phoneNumber || cooldownSeconds > 0}
              accessibilityLabel={cooldownSeconds > 0 ? `Wait ${cooldownSeconds} seconds before requesting another code` : 'Send verification code to your phone'}
            >
              {cooldownSeconds > 0
                ? `Wait ${cooldownSeconds}s`
                : 'Send Code'}
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
        </>
      ) : (
        <>
          <Text>Enter the 6-digit code sent to {phoneNumber}</Text>
          
          <TextField
            label="Verification Code"
            value={otpCode}
            onChange={setOtpCode}
            type="number"
            placeholder="123456"
            disabled={isLoading}
            accessibilityLabel="Enter the 6-digit verification code from SMS"
          />

          {error && (
            <Text appearance="critical">{error}</Text>
          )}

          <BlockStack spacing="tight">
            <Button
              kind="primary"
              onPress={handleVerifyOTP}
              disabled={isLoading || otpCode.length !== 6}
              accessibilityLabel="Verify the entered code and sign in"
            >
              Verify Code
            </Button>
            
            <InlineStack spacing="tight">
              <Button
                kind="plain"
                onPress={() => {
                  setOtpSent(false);
                  setOtpCode('');
                  setError('');
                }}
                disabled={isLoading || cooldownSeconds > 0}
                accessibilityLabel={cooldownSeconds > 0 ? `Resend code in ${cooldownSeconds} seconds` : 'Request a new verification code'}
              >
                {cooldownSeconds > 0
                  ? `Resend in ${cooldownSeconds}s`
                  : 'Resend Code'}
              </Button>
              
              <Button
                kind="plain"
                onPress={onBack}
                disabled={isLoading}
                accessibilityLabel="Go back to authentication method selection"
              >
                Back
              </Button>
            </InlineStack>
          </BlockStack>
        </>
      )}
    </BlockStack>
  );
}
