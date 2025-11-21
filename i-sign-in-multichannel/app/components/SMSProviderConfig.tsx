import { BlockStack, Button, Card, InlineStack, Select, Text, TextField } from "@shopify/polaris";
import { useState } from "react";

interface SMSProviderConfigProps {
  smsPrimary: string;
  smsToApiKey: string;
  smsToSenderId: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  onChange: (field: string, value: string) => void;
  onTestConnection: (provider: "sms.to" | "twilio") => void;
}

export function SMSProviderConfig({
  smsPrimary,
  smsToApiKey,
  smsToSenderId,
  twilioAccountSid,
  twilioAuthToken,
  twilioFromNumber,
  onChange,
  onTestConnection,
}: SMSProviderConfigProps) {
  const [testing, setTesting] = useState<"sms.to" | "twilio" | null>(null);

  const handleTestConnection = async (provider: "sms.to" | "twilio") => {
    setTesting(provider);
    try {
      await onTestConnection(provider);
    } finally {
      setTesting(null);
    }
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          SMS Provider Configuration
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Configure your SMS providers for sending OTP codes. The primary provider will be used first, with automatic failover to the secondary.
        </Text>

        <Select
          label="Primary SMS Provider"
          options={[
            { label: "sms.to", value: "sms.to" },
            { label: "Twilio", value: "twilio" },
          ]}
          value={smsPrimary}
          onChange={(value) => onChange("smsPrimary", value)}
        />

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            sms.to Configuration
          </Text>
          <TextField
            label="API Key"
            value={smsToApiKey}
            onChange={(value) => onChange("smsToApiKey", value)}
            type="password"
            autoComplete="off"
          />
          <TextField
            label="Sender ID"
            value={smsToSenderId}
            onChange={(value) => onChange("smsToSenderId", value)}
            autoComplete="off"
          />
          <InlineStack align="start">
            <Button
              onClick={() => handleTestConnection("sms.to")}
              loading={testing === "sms.to"}
              disabled={!smsToApiKey || !smsToSenderId}
            >
              Test sms.to Connection
            </Button>
          </InlineStack>
        </BlockStack>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Twilio Configuration
          </Text>
          <TextField
            label="Account SID"
            value={twilioAccountSid}
            onChange={(value) => onChange("twilioAccountSid", value)}
            autoComplete="off"
          />
          <TextField
            label="Auth Token"
            value={twilioAuthToken}
            onChange={(value) => onChange("twilioAuthToken", value)}
            type="password"
            autoComplete="off"
          />
          <TextField
            label="From Phone Number"
            value={twilioFromNumber}
            onChange={(value) => onChange("twilioFromNumber", value)}
            placeholder="+1234567890"
            autoComplete="off"
          />
          <InlineStack align="start">
            <Button
              onClick={() => handleTestConnection("twilio")}
              loading={testing === "twilio"}
              disabled={!twilioAccountSid || !twilioAuthToken || !twilioFromNumber}
            >
              Test Twilio Connection
            </Button>
          </InlineStack>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
