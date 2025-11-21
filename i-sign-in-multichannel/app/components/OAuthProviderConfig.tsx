import { BlockStack, Card, Checkbox, Text, TextField } from "@shopify/polaris";

interface OAuthProviderConfigProps {
  googleClientId: string;
  googleClientSecret: string;
  googleEnabled: boolean;
  appleClientId: string;
  appleTeamId: string;
  appleKeyId: string;
  appleEnabled: boolean;
  facebookAppId: string;
  facebookAppSecret: string;
  facebookEnabled: boolean;
  onChange: (field: string, value: string | boolean) => void;
}

export function OAuthProviderConfig({
  googleClientId,
  googleClientSecret,
  googleEnabled,
  appleClientId,
  appleTeamId,
  appleKeyId,
  appleEnabled,
  facebookAppId,
  facebookAppSecret,
  facebookEnabled,
  onChange,
}: OAuthProviderConfigProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          OAuth Provider Configuration
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Configure OAuth providers to allow customers to sign in with their social accounts.
        </Text>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Google OAuth
          </Text>
          <Checkbox
            label="Enable Google OAuth"
            checked={googleEnabled}
            onChange={(value) => onChange("googleEnabled", value)}
          />
          <TextField
            label="Client ID"
            value={googleClientId}
            onChange={(value) => onChange("googleClientId", value)}
            disabled={!googleEnabled}
            autoComplete="off"
          />
          <TextField
            label="Client Secret"
            value={googleClientSecret}
            onChange={(value) => onChange("googleClientSecret", value)}
            type="password"
            disabled={!googleEnabled}
            autoComplete="off"
          />
        </BlockStack>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Apple OAuth
          </Text>
          <Checkbox
            label="Enable Apple OAuth"
            checked={appleEnabled}
            onChange={(value) => onChange("appleEnabled", value)}
          />
          <TextField
            label="Client ID (Service ID)"
            value={appleClientId}
            onChange={(value) => onChange("appleClientId", value)}
            disabled={!appleEnabled}
            autoComplete="off"
          />
          <TextField
            label="Team ID"
            value={appleTeamId}
            onChange={(value) => onChange("appleTeamId", value)}
            disabled={!appleEnabled}
            autoComplete="off"
          />
          <TextField
            label="Key ID"
            value={appleKeyId}
            onChange={(value) => onChange("appleKeyId", value)}
            disabled={!appleEnabled}
            autoComplete="off"
          />
        </BlockStack>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Facebook OAuth
          </Text>
          <Checkbox
            label="Enable Facebook OAuth"
            checked={facebookEnabled}
            onChange={(value) => onChange("facebookEnabled", value)}
          />
          <TextField
            label="App ID"
            value={facebookAppId}
            onChange={(value) => onChange("facebookAppId", value)}
            disabled={!facebookEnabled}
            autoComplete="off"
          />
          <TextField
            label="App Secret"
            value={facebookAppSecret}
            onChange={(value) => onChange("facebookAppSecret", value)}
            type="password"
            disabled={!facebookEnabled}
            autoComplete="off"
          />
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
