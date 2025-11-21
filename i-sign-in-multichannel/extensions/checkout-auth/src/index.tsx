import {
    BlockStack,
    reactExtension,
    useCustomer,
    useExtensionCapability,
} from '@shopify/ui-extensions-react/checkout';
import { AuthModal } from './components/AuthModal';

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />
);

function Extension() {
  const customer = useCustomer();
  const canBlockProgress = useExtensionCapability('block_progress');

  // Only show modal if customer is not authenticated and we can block progress
  const shouldShowModal = !customer && canBlockProgress;

  if (!shouldShowModal) {
    return null;
  }

  return (
    <BlockStack>
      <AuthModal />
    </BlockStack>
  );
}
