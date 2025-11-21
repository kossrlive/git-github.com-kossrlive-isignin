import { BlockStack, Box, Card, InlineStack, Select, Text, TextField } from "@shopify/polaris";

interface UICustomizationProps {
  primaryColor: string;
  buttonStyle: string;
  logoUrl: string;
  onChange: (field: string, value: string) => void;
}

export function UICustomization({
  primaryColor,
  buttonStyle,
  logoUrl,
  onChange,
}: UICustomizationProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          UI Customization
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Customize the appearance of the login form to match your brand.
        </Text>

        <TextField
          label="Primary Color"
          value={primaryColor}
          onChange={(value) => onChange("primaryColor", value)}
          autoComplete="off"
          helpText="This color will be used for buttons and accents in the login form (e.g., #000000)"
        />

        <Select
          label="Button Style"
          options={[
            { label: "Rounded", value: "rounded" },
            { label: "Square", value: "square" },
          ]}
          value={buttonStyle}
          onChange={(value) => onChange("buttonStyle", value)}
        />

        <TextField
          label="Logo URL"
          value={logoUrl}
          onChange={(value) => onChange("logoUrl", value)}
          placeholder="https://example.com/logo.png"
          autoComplete="off"
          helpText="URL to your logo image (recommended size: 200x200px)"
        />

        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            Preview
          </Text>
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              {logoUrl && (
                <InlineStack align="center">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    style={{ maxWidth: "100px", maxHeight: "100px" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </InlineStack>
              )}
              <Text as="p" variant="bodyMd" alignment="center">
                Login Form Preview
              </Text>
              <Box
                padding="200"
                background="bg-fill-brand"
                borderRadius={buttonStyle === "rounded" ? "200" : "0"}
              >
                <Text as="p" variant="bodyMd" alignment="center" tone="text-inverse">
                  Sign In
                </Text>
              </Box>
            </BlockStack>
          </Box>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
