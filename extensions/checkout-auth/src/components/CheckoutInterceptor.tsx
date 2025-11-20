import {
    BlockStack,
    Modal,
    Text,
    useExtensionApi,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';
import { createSessionData } from '../utils/session';
import { LoginForm } from './LoginForm';
import { useSessionManager } from './SessionManager';

export function CheckoutInterceptor() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const api = useExtensionApi();

  const {
    session,
    isRestoring,
    isAuthenticated,
    updateSession,
  } = useSessionManager({
    onSessionRestored: () => {
      // Session restored successfully
      setShowLoginModal(false);
    },
    onSessionExpired: () => {
      // Session expired, show login
      setShowLoginModal(true);
    },
    onSessionError: () => {
      // Session error, show login
      setShowLoginModal(true);
    },
  });

  useEffect(() => {
    // Save checkout state when component mounts
    import('../utils/redirect').then(({ saveCheckoutState }) => {
      saveCheckoutState();
    });
  }, []);

  useEffect(() => {
    // Show login modal if not authenticated after restoration check
    if (!isRestoring && !isAuthenticated) {
      setShowLoginModal(true);
    }
  }, [isRestoring, isAuthenticated]);

  async function handleAuthSuccess(multipassUrl: string) {
    // Extract session data from multipass URL if needed
    // For now, we'll create a basic session
    const sessionData = createSessionData(
      'temp-customer-id', // This should come from the auth response
      'temp@email.com',   // This should come from the auth response
      'temp-token'        // This should come from the auth response
    );
    
    updateSession(sessionData);
    setShowLoginModal(false);

    // Redirect to checkout with cart preservation
    const { redirectToCheckout } = await import('../utils/redirect');
    await redirectToCheckout(multipassUrl, {
      preserveCart: true,
    });
  }

  function handleCancel() {
    // User cancelled login, they can't proceed to checkout
    setShowLoginModal(false);
    // Optionally redirect back to cart or show message
  }

  // Block checkout progress until authenticated
  useEffect(() => {
    if (!isAuthenticated && !isRestoring) {
      // Block checkout
      api.checkout.block({
        reason: 'Authentication required',
      });
    } else if (isAuthenticated) {
      // Unblock checkout
      api.checkout.unblock();
    }
  }, [isAuthenticated, isRestoring, api]);

  if (isRestoring) {
    return (
      <BlockStack spacing="base">
        <Text>Checking authentication...</Text>
      </BlockStack>
    );
  }

  return (
    <>
      {showLoginModal && (
        <Modal
          title="Sign in to continue"
          onClose={handleCancel}
        >
          <LoginForm
            onAuthSuccess={handleAuthSuccess}
            onCancel={handleCancel}
          />
        </Modal>
      )}

      {isAuthenticated && session && (
        <BlockStack spacing="base">
          <Text appearance="success">
            ✓ Signed in as {session.email}
          </Text>
        </BlockStack>
      )}
    </>
  );
}
