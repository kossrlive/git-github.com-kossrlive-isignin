import {
    Banner,
    BlockStack,
    Button,
    Card,
    Checkbox,
    DropZone,
    FormLayout,
    InlineStack,
    Layout,
    Page,
    Select,
    SkeletonBodyText,
    Text,
    TextField,
    Thumbnail,
} from '@shopify/polaris';
import React, { useCallback, useEffect, useState } from 'react';
import { AuthSettings, DEFAULT_SETTINGS } from '../types/settings';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AuthSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings');
      
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      const data = await response.json();
      setSettings(data);
      
      if (data.uiCustomization.logoUrl) {
        setLogoPreview(data.uiCustomization.logoUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // If there's a new logo file, upload it first
      let logoUrl = settings.uiCustomization.logoUrl;
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        
        const uploadResponse = await fetch('/api/admin/upload-logo', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload logo');
        }
        
        const uploadData = await uploadResponse.json();
        logoUrl = uploadData.url;
      }

      // Save settings
      const updatedSettings = {
        ...settings,
        uiCustomization: {
          ...settings.uiCustomization,
          logoUrl,
        },
      };

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSettings(updatedSettings);
      setSuccess(true);
      setLogoFile(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleMethodToggle = useCallback((method: 'sms' | 'email' | 'google') => {
    setSettings((prev) => ({
      ...prev,
      enabledMethods: {
        ...prev.enabledMethods,
        [method]: !prev.enabledMethods[method],
      },
    }));
  }, []);

  const handleColorChange = useCallback((value: string) => {
    setSettings((prev) => ({
      ...prev,
      uiCustomization: {
        ...prev.uiCustomization,
        primaryColor: value,
      },
    }));
  }, []);

  const handleButtonStyleChange = useCallback((value: string) => {
    setSettings((prev) => ({
      ...prev,
      uiCustomization: {
        ...prev.uiCustomization,
        buttonStyle: value as 'rounded' | 'square' | 'pill',
      },
    }));
  }, []);

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setLogoFile(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  const buttonStyleOptions = [
    { label: 'Rounded', value: 'rounded' },
    { label: 'Square', value: 'square' },
    { label: 'Pill', value: 'pill' },
  ];

  if (loading) {
    return (
      <Page title="Authentication Settings">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={10} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Authentication Settings"
      primaryAction={{
        content: 'Save',
        loading: saving,
        onAction: handleSave,
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        {success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(false)}>
              Settings saved successfully!
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Authentication Methods
              </Text>
              <Text as="p" tone="subdued">
                Enable or disable authentication methods for your customers
              </Text>
              <FormLayout>
                <Checkbox
                  label="SMS Authentication"
                  checked={settings.enabledMethods.sms}
                  onChange={() => handleMethodToggle('sms')}
                  helpText="Allow customers to login with phone number and OTP"
                />
                <Checkbox
                  label="Email/Password Authentication"
                  checked={settings.enabledMethods.email}
                  onChange={() => handleMethodToggle('email')}
                  helpText="Allow customers to login with email and password"
                />
                <Checkbox
                  label="Google OAuth"
                  checked={settings.enabledMethods.google}
                  onChange={() => handleMethodToggle('google')}
                  helpText="Allow customers to login with their Google account"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                UI Customization
              </Text>
              <Text as="p" tone="subdued">
                Customize the appearance of the login form
              </Text>
              <FormLayout>
                <TextField
                  label="Primary Color"
                  type="color"
                  value={settings.uiCustomization.primaryColor}
                  onChange={handleColorChange}
                  autoComplete="off"
                  helpText="Choose the primary color for buttons and accents"
                />
                <Select
                  label="Button Style"
                  options={buttonStyleOptions}
                  value={settings.uiCustomization.buttonStyle}
                  onChange={handleButtonStyleChange}
                  helpText="Select the button corner style"
                />
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="medium">
                    Logo
                  </Text>
                  {logoPreview && (
                    <InlineStack gap="200" align="start">
                      <Thumbnail
                        source={logoPreview}
                        alt="Logo preview"
                        size="large"
                      />
                      <Button
                        onClick={() => {
                          setLogoPreview('');
                          setLogoFile(null);
                          setSettings((prev) => ({
                            ...prev,
                            uiCustomization: {
                              ...prev.uiCustomization,
                              logoUrl: '',
                            },
                          }));
                        }}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                  )}
                  <DropZone
                    accept="image/*"
                    type="image"
                    onDrop={handleDropZoneDrop}
                    allowMultiple={false}
                  >
                    <DropZone.FileUpload />
                  </DropZone>
                  <Text as="p" tone="subdued">
                    Upload your store logo to display on the login form
                  </Text>
                </BlockStack>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default SettingsPage;
