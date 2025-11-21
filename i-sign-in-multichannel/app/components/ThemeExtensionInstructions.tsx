import { Banner, BlockStack, Card, Link, List, Text } from "@shopify/polaris";

interface ThemeExtensionInstructionsProps {
  shop: string;
}

export function ThemeExtensionInstructions({ shop }: ThemeExtensionInstructionsProps) {
  // Extract the myshopify domain from the full shop domain
  const shopDomain = shop.replace(/^https?:\/\//, '');
  const themeEditorUrl = `https://${shopDomain}/admin/themes/current/editor`;

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h3" variant="headingMd">
          Enable Customer Login on Your Storefront
        </Text>
        
        <Banner tone="info">
          <Text as="p" variant="bodyMd">
            The Customer Login theme extension is installed and ready to use. Follow these steps to add it to your theme.
          </Text>
        </Banner>

        <BlockStack gap="300">
          <Text as="h4" variant="headingSm">
            Step-by-Step Instructions:
          </Text>
          
          <List type="number">
            <List.Item>
              <Text as="span" variant="bodyMd">
                Open your{" "}
                <Link url={themeEditorUrl} target="_blank" removeUnderline>
                  Theme Editor
                </Link>
              </Text>
            </List.Item>
            <List.Item>
              <Text as="span" variant="bodyMd">
                Navigate to the page where you want to add the login form (e.g., Login page, Account page, or any custom page)
              </Text>
            </List.Item>
            <List.Item>
              <Text as="span" variant="bodyMd">
                Click "Add section" or "Add block" depending on your theme
              </Text>
            </List.Item>
            <List.Item>
              <Text as="span" variant="bodyMd">
                Look for "Apps" in the sidebar and find "Customer Login" under your app extensions
              </Text>
            </List.Item>
            <List.Item>
              <Text as="span" variant="bodyMd">
                Click to add the Customer Login block to your page
              </Text>
            </List.Item>
            <List.Item>
              <Text as="span" variant="bodyMd">
                Customize the settings in the theme editor:
              </Text>
              <List type="bullet">
                <List.Item>
                  <Text as="span" variant="bodySm">
                    Toggle authentication methods (SMS, Email, OAuth)
                  </Text>
                </List.Item>
                <List.Item>
                  <Text as="span" variant="bodySm">
                    Enable OAuth providers (Google, Apple, Facebook)
                  </Text>
                </List.Item>
                <List.Item>
                  <Text as="span" variant="bodySm">
                    Customize colors and button styles
                  </Text>
                </List.Item>
                <List.Item>
                  <Text as="span" variant="bodySm">
                    Upload your logo (optional)
                  </Text>
                </List.Item>
              </List>
            </List.Item>
            <List.Item>
              <Text as="span" variant="bodyMd">
                Click "Save" in the theme editor to publish your changes
              </Text>
            </List.Item>
          </List>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h4" variant="headingSm">
            What Your Customers Will See:
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            A modern, responsive login form with tabs for different authentication methods. Customers can choose to sign in with SMS (one-time code), email/password, or their social accounts (Google, Apple, Facebook).
          </Text>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h4" variant="headingSm">
            Preview:
          </Text>
          <div style={{ 
            border: '1px solid #e1e3e5', 
            borderRadius: '8px', 
            padding: '16px',
            backgroundColor: '#f6f6f7'
          }}>
            <Text as="p" variant="bodySm" tone="subdued" alignment="center">
              📱 SMS Tab | ✉️ Email Tab | 🔐 Social Tab
            </Text>
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <Text as="p" variant="bodySm" tone="subdued">
                [Login form will appear here with your custom branding]
              </Text>
            </div>
          </div>
        </BlockStack>

        <Banner tone="warning">
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Before enabling the extension:
            </Text>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm">
                  Configure at least one SMS provider in Settings
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm">
                  Ensure your Shopify Plus plan has Multipass enabled
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm">
                  Add your Multipass secret in Settings
                </Text>
              </List.Item>
            </List>
          </BlockStack>
        </Banner>

        <Text as="p" variant="bodySm" tone="subdued">
          Need help? Check the{" "}
          <Link url="https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/apps" target="_blank">
            Shopify documentation
          </Link>
          {" "}for more information about theme app extensions.
        </Text>
      </BlockStack>
    </Card>
  );
}
