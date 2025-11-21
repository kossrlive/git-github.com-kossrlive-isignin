import {
    BlockStack,
    Card,
    Link,
    Text,
    TextField,
} from "@shopify/polaris";

interface MultipassConfigProps {
  multipassSecret: string;
  onChange: (field: string, value: string) => void;
}

export function MultipassConfig({
  multipassSecret,
  onChange,
}: MultipassConfigProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Shopify Multipass Configuration
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Multipass is required for seamless customer authentication. This feature is only available on Shopify Plus plans.{" "}
            <Link
              url="https://shopify.dev/docs/api/multipass"
              target="_blank"
            >
              Learn more about Multipass
            </Link>
          </Text>
        </BlockStack>

        <TextField
          label="Multipass Secret"
          value={multipassSecret}
          onChange={(value) => onChange("multipassSecret", value)}
          type="password"
          helpText="Enter your Shopify Multipass secret. You can find this in your Shopify Admin under Settings > Checkout > Multipass."
          autoComplete="off"
        />

        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            How to get your Multipass secret:
          </Text>
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" tone="subdued">
              1. Go to your Shopify Admin
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              2. Navigate to Settings → Checkout
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              3. Scroll down to the "Multipass" section
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              4. Enable Multipass if not already enabled
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              5. Copy the Multipass secret and paste it above
            </Text>
          </BlockStack>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
