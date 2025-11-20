import {
    Banner,
    BlockStack,
    Button,
    Divider,
    Image,
    InlineStack,
    Text,
    TextField,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';
import type { AppSettings } from '../types';
import { emailLogin, fetchSettings, initiateOAuth, sendOTP, verifyOTP } from '../utils/api';
import { validateEmail, validateOTP, validatePhone } from '../utils/validation';

interface LoginFormProps {
  onAuthSuccess: (multipassUrl: string) => void;
  onCancel?: () => void;
}

type AuthMode = 'select' | 'sms' | 'email' | 'otp';

export function LoginForm({ onAuthSuccess, onCancel }: LoginFormProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [mode, setMode] = useState<AuthMode>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // SMS/OTP state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load authentication settings');
    }
  }

  async function handleSendOTP() {
    if (!validatePhone(phone)) {
      setError('Please enter a valid phone number in E.164 format (e.g., +1234567890)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sendOTP(phone);
      if (result.success) {
        setMode('otp');
      } else {
        setError(result.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!validateOTP(otp)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await verifyOTP(phone, otp);
      if (result.success && result.multipassUrl) {
        onAuthSuccess(result.multipassUrl);
      } else {
        setError(result.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin() {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await emailLogin(email, password);
      if (result.success && result.multipassUrl) {
        onAuthSuccess(result.multipassUrl);
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthLogin(provider: string) {
    setLoading(true);
    setError('');

    try {
      const result = await initiateOAuth(provider);
      if (result.authUrl) {
        // Redirect to OAuth provider
        window.location.href = result.authUrl;
      }
    } catch (err) {
      setError(`Failed to initiate ${provider} login`);
      setLoading(false);
    }
  }

  if (!settings) {
    return (
      <BlockStack spacing="base">
        <Text>Loading...</Text>
      </BlockStack>
    );
  }

  const { enabledMethods, uiCustomization } = settings;
  const { primaryColor, logoUrl } = uiCustomization;

  // Apply custom styles
  const buttonStyle = {
    backgroundColor: primaryColor,
  };

  return (
    <BlockStack spacing="base">
      {logoUrl && (
        <InlineStack alignment="center">
          <Image source={logoUrl} alt="Store Logo" />
        </InlineStack>
      )}

      <Text size="large" emphasis="bold">
        Sign in to continue
      </Text>

      {error && (
        <Banner status="critical">
          {error}
        </Banner>
      )}

      {mode === 'select' && (
        <BlockStack spacing="base">
          {enabledMethods.includes('sms') && (
            <Button
              onPress={() => setMode('sms')}
              kind="primary"
              disabled={loading}
            >
              Sign in with Phone
            </Button>
          )}

          {enabledMethods.includes('email') && (
            <Button
              onPress={() => setMode('email')}
              kind="secondary"
              disabled={loading}
            >
              Sign in with Email
            </Button>
          )}

          {enabledMethods.includes('google') && (
            <Button
              onPress={() => handleOAuthLogin('google')}
              kind="secondary"
              disabled={loading}
            >
              Sign in with Google
            </Button>
          )}

          {enabledMethods.includes('apple') && (
            <Button
              onPress={() => handleOAuthLogin('apple')}
              kind="secondary"
              disabled={loading}
            >
              Sign in with Apple
            </Button>
          )}

          {enabledMethods.includes('facebook') && (
            <Button
              onPress={() => handleOAuthLogin('facebook')}
              kind="secondary"
              disabled={loading}
            >
              Sign in with Facebook
            </Button>
          )}

          {onCancel && (
            <>
              <Divider />
              <Button onPress={onCancel} kind="plain">
                Cancel
              </Button>
            </>
          )}
        </BlockStack>
      )}

      {mode === 'sms' && (
        <BlockStack spacing="base">
          <TextField
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            placeholder="+1234567890"
            type="tel"
          />
          <InlineStack spacing="base">
            <Button
              onPress={handleSendOTP}
              kind="primary"
              loading={loading}
              disabled={loading}
            >
              Send Code
            </Button>
            <Button
              onPress={() => setMode('select')}
              kind="plain"
              disabled={loading}
            >
              Back
            </Button>
          </InlineStack>
        </BlockStack>
      )}

      {mode === 'otp' && (
        <BlockStack spacing="base">
          <Text>
            Enter the 6-digit code sent to {phone}
          </Text>
          <TextField
            label="Verification Code"
            value={otp}
            onChange={setOtp}
            placeholder="000000"
            type="number"
          />
          <InlineStack spacing="base">
            <Button
              onPress={handleVerifyOTP}
              kind="primary"
              loading={loading}
              disabled={loading}
            >
              Verify
            </Button>
            <Button
              onPress={handleSendOTP}
              kind="plain"
              disabled={loading}
            >
              Resend Code
            </Button>
          </InlineStack>
          <Button
            onPress={() => {
              setMode('sms');
              setOtp('');
            }}
            kind="plain"
            disabled={loading}
          >
            Change Phone Number
          </Button>
        </BlockStack>
      )}

      {mode === 'email' && (
        <BlockStack spacing="base">
          <TextField
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="your@email.com"
            type="email"
          />
          <TextField
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            type="password"
          />
          <InlineStack spacing="base">
            <Button
              onPress={handleEmailLogin}
              kind="primary"
              loading={loading}
              disabled={loading}
            >
              Sign In
            </Button>
            <Button
              onPress={() => setMode('select')}
              kind="plain"
              disabled={loading}
            >
              Back
            </Button>
          </InlineStack>
        </BlockStack>
      )}
    </BlockStack>
  );
}
