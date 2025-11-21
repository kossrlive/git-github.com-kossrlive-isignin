/**
 * Translation Configuration Component
 * Allows merchants to customize text for each supported language
 * Requirements: 17.5
 */

import {
    Banner,
    BlockStack,
    Button,
    Card,
    FormLayout,
    InlineStack,
    Select,
    Text,
    TextField,
} from "@shopify/polaris";
import { useState } from "react";
import { getSupportedLanguages, getTranslations, type SupportedLanguage } from "../lib/i18n.server";

interface TranslationConfigProps {
  defaultLanguage: string;
  customTranslations?: string; // JSON string
  onSave: (language: string, translations: Record<string, string>) => void;
}

const languageNames: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
};

export function TranslationConfig({
  defaultLanguage,
  customTranslations,
  onSave,
}: TranslationConfigProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (defaultLanguage as SupportedLanguage) || "en"
  );
  const [customTexts, setCustomTexts] = useState<Record<string, Record<string, string>>>(() => {
    try {
      return customTranslations ? JSON.parse(customTranslations) : {};
    } catch {
      return {};
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Get default translations for the selected language
  const defaultTranslations = getTranslations(selectedLanguage);

  // Get custom translations for the selected language
  const currentCustom = customTexts[selectedLanguage] || {};

  // Language options for the select
  const languageOptions = getSupportedLanguages().map((lang) => ({
    label: languageNames[lang],
    value: lang,
  }));

  const handleTextChange = (key: string, value: string) => {
    setCustomTexts((prev) => ({
      ...prev,
      [selectedLanguage]: {
        ...prev[selectedLanguage],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(selectedLanguage, customTexts[selectedLanguage] || {});
    setHasChanges(false);
  };

  const handleReset = () => {
    setCustomTexts((prev) => {
      const updated = { ...prev };
      delete updated[selectedLanguage];
      return updated;
    });
    setHasChanges(true);
  };

  // Get the display value for a field (custom or default)
  const getFieldValue = (key: string, defaultValue: string) => {
    return currentCustom[key] || defaultValue;
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Translation Configuration
        </Text>

        <Banner>
          <p>
            Customize text for each language. Leave fields empty to use default translations.
          </p>
        </Banner>

        <Select
          label="Language"
          options={languageOptions}
          value={selectedLanguage}
          onChange={(value) => setSelectedLanguage(value as SupportedLanguage)}
        />

        <FormLayout>
          <Text as="h3" variant="headingSm">
            Login Form Labels
          </Text>

          <TextField
            label="Title"
            value={getFieldValue("loginForm.title", defaultTranslations.loginForm.title)}
            onChange={(value) => handleTextChange("loginForm.title", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.title}`}
          />

          <TextField
            label="Phone Label"
            value={getFieldValue("loginForm.phoneLabel", defaultTranslations.loginForm.phoneLabel)}
            onChange={(value) => handleTextChange("loginForm.phoneLabel", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.phoneLabel}`}
          />

          <TextField
            label="Email Label"
            value={getFieldValue("loginForm.emailLabel", defaultTranslations.loginForm.emailLabel)}
            onChange={(value) => handleTextChange("loginForm.emailLabel", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.emailLabel}`}
          />

          <TextField
            label="Password Label"
            value={getFieldValue("loginForm.passwordLabel", defaultTranslations.loginForm.passwordLabel)}
            onChange={(value) => handleTextChange("loginForm.passwordLabel", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.passwordLabel}`}
          />

          <TextField
            label="Send Code Button"
            value={getFieldValue("loginForm.sendCodeButton", defaultTranslations.loginForm.sendCodeButton)}
            onChange={(value) => handleTextChange("loginForm.sendCodeButton", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.sendCodeButton}`}
          />

          <TextField
            label="Verify Code Button"
            value={getFieldValue("loginForm.verifyCodeButton", defaultTranslations.loginForm.verifyCodeButton)}
            onChange={(value) => handleTextChange("loginForm.verifyCodeButton", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.verifyCodeButton}`}
          />

          <TextField
            label="Login Button"
            value={getFieldValue("loginForm.loginButton", defaultTranslations.loginForm.loginButton)}
            onChange={(value) => handleTextChange("loginForm.loginButton", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.loginForm.loginButton}`}
          />

          <Text as="h3" variant="headingSm">
            Error Messages
          </Text>

          <TextField
            label="Invalid Code"
            value={getFieldValue("errors.invalidCode", defaultTranslations.errors.invalidCode)}
            onChange={(value) => handleTextChange("errors.invalidCode", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.errors.invalidCode}`}
          />

          <TextField
            label="Code Expired"
            value={getFieldValue("errors.codeExpired", defaultTranslations.errors.codeExpired)}
            onChange={(value) => handleTextChange("errors.codeExpired", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.errors.codeExpired}`}
          />

          <TextField
            label="Too Many Attempts"
            value={getFieldValue("errors.tooManyAttempts", defaultTranslations.errors.tooManyAttempts)}
            onChange={(value) => handleTextChange("errors.tooManyAttempts", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.errors.tooManyAttempts}`}
          />

          <TextField
            label="SMS Failure"
            value={getFieldValue("errors.smsFailure", defaultTranslations.errors.smsFailure)}
            onChange={(value) => handleTextChange("errors.smsFailure", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.errors.smsFailure}`}
          />

          <Text as="h3" variant="headingSm">
            SMS Message Templates
          </Text>

          <TextField
            label="OTP Message"
            value={getFieldValue("sms.otpMessage", defaultTranslations.sms.otpMessage)}
            onChange={(value) => handleTextChange("sms.otpMessage", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.sms.otpMessage}. Use {code} as placeholder.`}
            multiline={2}
          />

          <TextField
            label="Order Confirmation"
            value={getFieldValue("sms.orderConfirmation", defaultTranslations.sms.orderConfirmation)}
            onChange={(value) => handleTextChange("sms.orderConfirmation", value)}
            autoComplete="off"
            helpText={`Default: ${defaultTranslations.sms.orderConfirmation}. Use {number} and \${total} as placeholders.`}
            multiline={3}
          />
        </FormLayout>

        <InlineStack gap="200">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Translations
          </Button>
          <Button onClick={handleReset}>
            Reset to Defaults
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
