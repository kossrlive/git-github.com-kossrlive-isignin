import {
    BlockStack,
    Button,
    InlineStack,
    Modal,
    Text,
    useExtensionApi
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';
import type { CustomStyling } from '../utils/styling';
import { fetchCustomStyling } from '../utils/styling';
import { EmailAuth } from './EmailAuth';
import { OAuthAuth } from './OAuthAuth';
import { SMSAuth } from './SMSAuth';

type AuthMethod = 'sms' | 'email' | 'oauth' | null;

export function AuthModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customStyling, setCustomStyling] = useState<CustomStyling | null>(null);
  const { shop } = useExtensionApi();

  // Fetch custom styling on mount
  useEffect(() => {
    fetchCustomStyling(shop.myshopifyDomain).then(setCustomStyling);
  }, [shop.myshopifyDomain]);

  const handleAuthSuccess = (multipassUrl: string) => {
    setIsLoading(true);
    // Redirect to Multipass URL to authenticate the customer
    window.location.href = multipassUrl;
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  const handleBack = () => {
    setSelectedMethod(null);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      id="auth-modal"
      title={selectedMethod ? 'Sign In' : 'Sign in to continue'}
      onClose={handleDismiss}
    >
      <BlockStack spacing="base">
        {!selectedMethod && (
          <>
            {customStyling?.logoUrl && (
              <Image
                source={customStyling.logoUrl}
                accessibilityDescription="Store logo"
              />
            )}
            
            <Text>
              Sign in to access your account benefits and faster checkout.
            </Text>
            
            <BlockStack spacing="tight">
              <Button
                kind="primary"
                onPress={() => setSelectedMethod('sms')}
                disabled={isLoading}
                accessibilityLabel="Sign in with SMS verification"
              >
                Sign in with SMS
              </Button>
              
              <Button
                onPress={() => setSelectedMethod('email')}
                disabled={isLoading}
                accessibilityLabel="Sign in with email and password"
              >
                Sign in with Email
              </Button>
              
              <Button
                onPress={() => setSelectedMethod('oauth')}
                disabled={isLoading}
                accessibilityLabel="Sign in with social account"
              >
                Sign in with Social Account
              </Button>
            </BlockStack>

            <InlineStack spacing="tight">
              <Text size="small" appearance="subdued">
                or
              </Text>
            </InlineStack>

            <Button
              kind="plain"
              onPress={handleDismiss}
              disabled={isLoading}
              accessibilityLabel="Continue checkout as guest without signing in"
            >
              Continue as guest
            </Button>
          </>
        )}

        {selectedMethod === 'sms' && (
          <SMSAuth
            shop={shop.myshopifyDomain}
            onSuccess={handleAuthSuccess}
            onBack={handleBack}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            customStyling={customStyling}
          />
        )}

        {selectedMethod === 'email' && (
          <EmailAuth
            shop={shop.myshopifyDomain}
            onSuccess={handleAuthSuccess}
            onBack={handleBack}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            customStyling={customStyling}
          />
        )}

        {selectedMethod === 'oauth' && (
          <OAuthAuth
            shop={shop.myshopifyDomain}
            onSuccess={handleAuthSuccess}
            onBack={handleBack}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            customStyling={customStyling}
          />
        )}
      </BlockStack>
    </Modal>
  );
}
