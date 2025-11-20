import {
    BlockStack,
    reactExtension,
} from '@shopify/ui-extensions-react/checkout';
import { CheckoutInterceptor } from './components/CheckoutInterceptor';

export default reactExtension(
  'purchase.checkout.actions.render-before',
  () => <Extension />
);

function Extension() {
  return (
    <BlockStack>
      <CheckoutInterceptor />
    </BlockStack>
  );
}
