import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
    Badge,
    Banner,
    BlockStack,
    Button,
    Card,
    Checkbox,
    InlineStack,
    Layout,
    Page,
    ProgressBar,
    Select,
    Text,
    TextField,
} from "@shopify/polaris";
import { useCallback, useEffect, useState } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

type OnboardingStep = "welcome" | "sms" | "oauth" | "ui" | "complete";

interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  smsConfigured: boolean;
  oauthConfigured: boolean;
  uiConfigured: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get or create shop record
  let shopRecord = await prisma.shop.findUnique({
    where: { domain: shop },
    include: { settings: true },
  });

  if (!shopRecord) {
    shopRecord = await prisma.shop.create({
      data: {
        domain: shop,
        accessToken: session.accessToken || "",
      },
      include: { settings: true },
    });
  }

  // Check if onboarding is already complete
  const settings = shopRecord.settings;
  const onboardingComplete = settings && (
    (settings.smsToApiKey && settings.smsToSenderId) ||
    (settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber)
  );

  return json({ 
    shop, 
    settings: settings || null,
    onboardingComplete: !!onboardingComplete
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("action") as string;

  // Get or create shop record
  let shopRecord = await prisma.shop.findUnique({
    where: { domain: shop },
  });

  if (!shopRecord) {
    shopRecord = await prisma.shop.create({
      data: {
        domain: shop,
        accessToken: session.accessToken || "",
      },
    });
  }

  if (action === "saveSMS") {
    const smsPrimary = formData.get("smsPrimary") as string;
    const smsToApiKey = formData.get("smsToApiKey") as string;
    const smsToSenderId = formData.get("smsToSenderId") as string;
    const twilioAccountSid = formData.get("twilioAccountSid") as string;
    const twilioAuthToken = formData.get("twilioAuthToken") as string;
    const twilioFromNumber = formData.get("twilioFromNumber") as string;

    // Validate that at least one provider is configured
    const smsToConfigured = smsToApiKey && smsToSenderId;
    const twilioConfigured = twilioAccountSid && twilioAuthToken && twilioFromNumber;

    if (!smsToConfigured && !twilioConfigured) {
      return json({
        success: false,
        error: "Please configure at least one SMS provider",
      });
    }

    await prisma.shopSettings.upsert({
      where: { shopId: shopRecord.id },
      update: {
        smsPrimary,
        smsToApiKey: smsToApiKey || null,
        smsToSenderId: smsToSenderId || null,
        twilioAccountSid: twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
        twilioFromNumber: twilioFromNumber || null,
      },
      create: {
        shopId: shopRecord.id,
        smsPrimary,
        smsToApiKey: smsToApiKey || null,
        smsToSenderId: smsToSenderId || null,
        twilioAccountSid: twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
        twilioFromNumber: twilioFromNumber || null,
      },
    });

    return json({ success: true, step: "sms" });
  }

  if (action === "testSMS") {
    const provider = formData.get("provider") as string;
    const phoneNumber = formData.get("phoneNumber") as string;

    if (!phoneNumber) {
      return json({
        success: false,
        error: "Please enter a phone number to test",
      });
    }

    // Validate phone number format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return json({
        success: false,
        error: "Please enter a valid phone number in E.164 format (e.g., +1234567890)",
      });
    }

    try {
      // Import SMS providers dynamically
      const { SmsToProvider } = await import("../providers/SmsToProvider");
      const { TwilioProvider } = await import("../providers/TwilioProvider");
      const { SMSService } = await import("../services/SMSService");
      const { getRedis } = await import("../lib/redis.server");

      const redis = getRedis();

      // Get current settings
      const settings = await prisma.shopSettings.findUnique({
        where: { shopId: shopRecord.id },
      });

      let testProvider;
      
      if (provider === "sms.to") {
        const apiKey = formData.get("smsToApiKey") as string || settings?.smsToApiKey;
        const senderId = formData.get("smsToSenderId") as string || settings?.smsToSenderId;

        if (!apiKey || !senderId) {
          return json({
            success: false,
            error: "Please configure sms.to credentials first",
          });
        }

        testProvider = new SmsToProvider(apiKey, senderId);
      } else if (provider === "twilio") {
        const accountSid = formData.get("twilioAccountSid") as string || settings?.twilioAccountSid;
        const authToken = formData.get("twilioAuthToken") as string || settings?.twilioAuthToken;
        const fromNumber = formData.get("twilioFromNumber") as string || settings?.twilioFromNumber;

        if (!accountSid || !authToken || !fromNumber) {
          return json({
            success: false,
            error: "Please configure Twilio credentials first",
          });
        }

        testProvider = new TwilioProvider(accountSid, authToken, fromNumber);
      } else {
        return json({
          success: false,
          error: "Invalid provider",
        });
      }

      // Create SMS service with just the test provider
      const smsService = new SMSService([testProvider], redis);

      // Send test SMS
      const result = await smsService.sendSMS({
        to: phoneNumber,
        message: `Test message from Multi-Channel Authentication app. Your ${provider} configuration is working correctly!`,
      });

      if (result.success) {
        return json({
          success: true,
          message: `Test SMS sent successfully to ${phoneNumber} via ${provider}`,
          testResult: true,
        });
      } else {
        return json({
          success: false,
          error: `Failed to send test SMS: ${result.error || "Unknown error"}`,
        });
      }
    } catch (error) {
      return json({
        success: false,
        error: `Error testing SMS provider: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  if (action === "saveOAuth") {
    const googleClientId = formData.get("googleClientId") as string;
    const googleClientSecret = formData.get("googleClientSecret") as string;
    const googleEnabled = formData.get("googleEnabled") === "true";

    await prisma.shopSettings.upsert({
      where: { shopId: shopRecord.id },
      update: {
        googleClientId: googleClientId || null,
        googleClientSecret: googleClientSecret || null,
        googleEnabled,
      },
      create: {
        shopId: shopRecord.id,
        googleClientId: googleClientId || null,
        googleClientSecret: googleClientSecret || null,
        googleEnabled,
      },
    });

    return json({ success: true, step: "oauth" });
  }

  if (action === "saveUI") {
    const primaryColor = formData.get("primaryColor") as string;
    const buttonStyle = formData.get("buttonStyle") as string;
    const logoUrl = formData.get("logoUrl") as string;

    await prisma.shopSettings.upsert({
      where: { shopId: shopRecord.id },
      update: {
        primaryColor: primaryColor || "#000000",
        buttonStyle: buttonStyle || "rounded",
        logoUrl: logoUrl || null,
      },
      create: {
        shopId: shopRecord.id,
        primaryColor: primaryColor || "#000000",
        buttonStyle: buttonStyle || "rounded",
        logoUrl: logoUrl || null,
      },
    });

    return json({ success: true, step: "ui" });
  }

  if (action === "complete") {
    // Redirect to main dashboard
    return redirect("/app");
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function Onboarding() {
  const { shop, settings, onboardingComplete } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isLoading = navigation.state === "submitting";

  // Onboarding state
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);

  // SMS form state
  const [smsPrimary, setSmsPrimary] = useState(settings?.smsPrimary || "sms.to");
  const [smsToApiKey, setSmsToApiKey] = useState(settings?.smsToApiKey || "");
  const [smsToSenderId, setSmsToSenderId] = useState(settings?.smsToSenderId || "");
  const [twilioAccountSid, setTwilioAccountSid] = useState(settings?.twilioAccountSid || "");
  const [twilioAuthToken, setTwilioAuthToken] = useState(settings?.twilioAuthToken || "");
  const [twilioFromNumber, setTwilioFromNumber] = useState(settings?.twilioFromNumber || "");
  const [testPhoneNumber, setTestPhoneNumber] = useState("");

  // OAuth form state
  const [googleClientId, setGoogleClientId] = useState(settings?.googleClientId || "");
  const [googleClientSecret, setGoogleClientSecret] = useState(settings?.googleClientSecret || "");
  const [googleEnabled, setGoogleEnabled] = useState(settings?.googleEnabled || false);

  // UI form state
  const [primaryColor, setPrimaryColor] = useState(settings?.primaryColor || "#000000");
  const [buttonStyle, setButtonStyle] = useState(settings?.buttonStyle || "rounded");
  const [logoUrl, setLogoUrl] = useState(settings?.logoUrl || "");

  // Handle action responses
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      const step = (actionData as any).step;
      if (step && !completedSteps.includes(step)) {
        setCompletedSteps([...completedSteps, step]);
      }

      if ((actionData as any).testResult) {
        shopify.toast.show((actionData as any).message || "Test successful");
      }
    }

    if (actionData && "error" in actionData) {
      shopify.toast.show((actionData as any).error, { isError: true });
    }
  }, [actionData, completedSteps, shopify]);

  const getStepNumber = (step: OnboardingStep): number => {
    const steps: OnboardingStep[] = ["welcome", "sms", "oauth", "ui", "complete"];
    return steps.indexOf(step) + 1;
  };

  const getTotalSteps = (): number => 5;

  const getProgress = (): number => {
    return (getStepNumber(currentStep) / getTotalSteps()) * 100;
  };

  const handleNext = useCallback((nextStep: OnboardingStep) => {
    setCurrentStep(nextStep);
    window.scrollTo(0, 0);
  }, []);

  const handleSaveSMS = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "saveSMS");
    formData.append("smsPrimary", smsPrimary);
    formData.append("smsToApiKey", smsToApiKey);
    formData.append("smsToSenderId", smsToSenderId);
    formData.append("twilioAccountSid", twilioAccountSid);
    formData.append("twilioAuthToken", twilioAuthToken);
    formData.append("twilioFromNumber", twilioFromNumber);
    submit(formData, { method: "post" });
  }, [smsPrimary, smsToApiKey, smsToSenderId, twilioAccountSid, twilioAuthToken, twilioFromNumber, submit]);

  const handleTestSMS = useCallback((provider: string) => {
    if (!testPhoneNumber) {
      shopify.toast.show("Please enter a phone number to test", { isError: true });
      return;
    }

    const formData = new FormData();
    formData.append("action", "testSMS");
    formData.append("provider", provider);
    formData.append("phoneNumber", testPhoneNumber);
    submit(formData, { method: "post" });
  }, [testPhoneNumber, submit, shopify]);

  const handleSaveOAuth = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "saveOAuth");
    formData.append("googleClientId", googleClientId);
    formData.append("googleClientSecret", googleClientSecret);
    formData.append("googleEnabled", String(googleEnabled));
    submit(formData, { method: "post" });
  }, [googleClientId, googleClientSecret, googleEnabled, submit]);

  const handleSaveUI = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "saveUI");
    formData.append("primaryColor", primaryColor);
    formData.append("buttonStyle", buttonStyle);
    formData.append("logoUrl", logoUrl);
    submit(formData, { method: "post" });
  }, [primaryColor, buttonStyle, logoUrl, submit]);

  const handleComplete = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "complete");
    submit(formData, { method: "post" });
  }, [submit]);

  return (
    <Page>
      <TitleBar title="App Onboarding" />
      <BlockStack gap="500">
        {onboardingComplete && currentStep === "welcome" && (
          <Banner tone="info">
            <p>
              It looks like you've already configured your app. You can still go through the
              onboarding wizard to update your settings, or{" "}
              <Button variant="plain" onClick={() => handleComplete()}>
                skip to dashboard
              </Button>
              .
            </p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">
              Setup Progress
            </Text>
            <ProgressBar progress={getProgress()} size="small" />
            <Text as="p" variant="bodySm" tone="subdued">
              Step {getStepNumber(currentStep)} of {getTotalSteps()}
            </Text>
          </BlockStack>
        </Card>

        {/* Welcome Step */}
        {currentStep === "welcome" && (
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg">
                  Welcome to Multi-Channel Authentication
                </Text>
                <Text as="p" variant="bodyLg">
                  Let's get your app set up in just a few steps. This wizard will guide you through:
                </Text>
              </BlockStack>

              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="info">1</Badge>
                  <Text as="p" variant="bodyMd">
                    <strong>SMS Provider Setup</strong> - Configure sms.to or Twilio for SMS authentication
                  </Text>
                </InlineStack>

                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="info">2</Badge>
                  <Text as="p" variant="bodyMd">
                    <strong>OAuth Providers (Optional)</strong> - Enable Google, Apple, or Facebook login
                  </Text>
                </InlineStack>

                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="info">3</Badge>
                  <Text as="p" variant="bodyMd">
                    <strong>UI Customization</strong> - Customize colors, buttons, and branding
                  </Text>
                </InlineStack>

                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="success">4</Badge>
                  <Text as="p" variant="bodyMd">
                    <strong>Complete</strong> - Start using multi-channel authentication
                  </Text>
                </InlineStack>
              </BlockStack>

              <InlineStack align="end">
                <Button variant="primary" onClick={() => handleNext("sms")}>
                  Get Started
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* SMS Provider Setup Step */}
        {currentStep === "sms" && (
          <Layout>
            <Layout.Section>
              <BlockStack gap="500">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      SMS Provider Setup
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Configure at least one SMS provider to enable SMS authentication. You can configure
                      both for automatic failover.
                    </Text>

                    <Select
                      label="Primary Provider"
                      options={[
                        { label: "sms.to", value: "sms.to" },
                        { label: "Twilio", value: "twilio" },
                      ]}
                      value={smsPrimary}
                      onChange={setSmsPrimary}
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      sms.to Configuration
                    </Text>

                    <TextField
                      label="API Key"
                      value={smsToApiKey}
                      onChange={setSmsToApiKey}
                      autoComplete="off"
                      type="password"
                      helpText="Get your API key from sms.to dashboard"
                    />

                    <TextField
                      label="Sender ID"
                      value={smsToSenderId}
                      onChange={setSmsToSenderId}
                      autoComplete="off"
                      helpText="The sender name that appears on SMS messages"
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      Twilio Configuration
                    </Text>

                    <TextField
                      label="Account SID"
                      value={twilioAccountSid}
                      onChange={setTwilioAccountSid}
                      autoComplete="off"
                      helpText="Get your Account SID from Twilio console"
                    />

                    <TextField
                      label="Auth Token"
                      value={twilioAuthToken}
                      onChange={setTwilioAuthToken}
                      autoComplete="off"
                      type="password"
                      helpText="Get your Auth Token from Twilio console"
                    />

                    <TextField
                      label="From Number"
                      value={twilioFromNumber}
                      onChange={setTwilioFromNumber}
                      autoComplete="off"
                      placeholder="+1234567890"
                      helpText="Your Twilio phone number in E.164 format"
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      Test Connection
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Send a test SMS to verify your configuration
                    </Text>

                    <TextField
                      label="Test Phone Number"
                      value={testPhoneNumber}
                      onChange={setTestPhoneNumber}
                      autoComplete="off"
                      placeholder="+1234567890"
                      helpText="Enter your phone number in E.164 format"
                    />

                    <InlineStack gap="200">
                      <Button
                        onClick={() => handleTestSMS("sms.to")}
                        disabled={!smsToApiKey || !smsToSenderId || isLoading}
                      >
                        Test sms.to
                      </Button>
                      <Button
                        onClick={() => handleTestSMS("twilio")}
                        disabled={!twilioAccountSid || !twilioAuthToken || !twilioFromNumber || isLoading}
                      >
                        Test Twilio
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>

                <InlineStack align="space-between">
                  <Button onClick={() => handleNext("welcome")}>Back</Button>
                  <InlineStack gap="200">
                    <Button onClick={handleSaveSMS} loading={isLoading}>
                      Save & Continue
                    </Button>
                    <Button variant="primary" onClick={() => handleNext("oauth")}>
                      Skip to Next Step
                    </Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}

        {/* OAuth Provider Setup Step */}
        {currentStep === "oauth" && (
          <Layout>
            <Layout.Section>
              <BlockStack gap="500">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      OAuth Provider Setup (Optional)
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Enable social login providers to give customers more authentication options.
                      This step is optional - you can skip it and configure later.
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingMd">
                        Google OAuth
                      </Text>
                      <Checkbox
                        label="Enable"
                        checked={googleEnabled}
                        onChange={setGoogleEnabled}
                      />
                    </InlineStack>

                    <TextField
                      label="Client ID"
                      value={googleClientId}
                      onChange={setGoogleClientId}
                      autoComplete="off"
                      disabled={!googleEnabled}
                      helpText="Get your Client ID from Google Cloud Console"
                    />

                    <TextField
                      label="Client Secret"
                      value={googleClientSecret}
                      onChange={setGoogleClientSecret}
                      autoComplete="off"
                      type="password"
                      disabled={!googleEnabled}
                      helpText="Get your Client Secret from Google Cloud Console"
                    />
                  </BlockStack>
                </Card>

                <InlineStack align="space-between">
                  <Button onClick={() => handleNext("sms")}>Back</Button>
                  <InlineStack gap="200">
                    <Button onClick={handleSaveOAuth} loading={isLoading}>
                      Save & Continue
                    </Button>
                    <Button variant="primary" onClick={() => handleNext("ui")}>
                      Skip to Next Step
                    </Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}

        {/* UI Customization Step */}
        {currentStep === "ui" && (
          <Layout>
            <Layout.Section>
              <BlockStack gap="500">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      UI Customization
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Customize the look and feel of your authentication forms to match your brand.
                    </Text>

                    <TextField
                      label="Primary Color"
                      value={primaryColor}
                      onChange={setPrimaryColor}
                      autoComplete="off"
                      type="color"
                      helpText="Choose your brand's primary color"
                    />

                    <Select
                      label="Button Style"
                      options={[
                        { label: "Rounded", value: "rounded" },
                        { label: "Square", value: "square" },
                      ]}
                      value={buttonStyle}
                      onChange={setButtonStyle}
                    />

                    <TextField
                      label="Logo URL"
                      value={logoUrl}
                      onChange={setLogoUrl}
                      autoComplete="off"
                      placeholder="https://example.com/logo.png"
                      helpText="URL to your logo image (optional)"
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      Preview
                    </Text>
                    <div
                      style={{
                        padding: "20px",
                        border: "1px solid #e1e3e5",
                        borderRadius: "8px",
                        backgroundColor: "#f6f6f7",
                      }}
                    >
                      {logoUrl && (
                        <div style={{ marginBottom: "16px", textAlign: "center" }}>
                          <img
                            src={logoUrl}
                            alt="Logo"
                            style={{ maxWidth: "200px", maxHeight: "60px" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <button
                        style={{
                          backgroundColor: primaryColor,
                          color: "#ffffff",
                          padding: "12px 24px",
                          border: "none",
                          borderRadius: buttonStyle === "rounded" ? "8px" : "0px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "500",
                          width: "100%",
                        }}
                      >
                        Sign In
                      </button>
                    </div>
                  </BlockStack>
                </Card>

                <InlineStack align="space-between">
                  <Button onClick={() => handleNext("oauth")}>Back</Button>
                  <InlineStack gap="200">
                    <Button onClick={handleSaveUI} loading={isLoading}>
                      Save & Continue
                    </Button>
                    <Button variant="primary" onClick={() => handleNext("complete")}>
                      Skip to Completion
                    </Button>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}

        {/* Complete Step */}
        {currentStep === "complete" && (
          <Card>
            <BlockStack gap="500">
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg">
                  🎉 Setup Complete!
                </Text>
                <Text as="p" variant="bodyLg">
                  Your multi-channel authentication app is now configured and ready to use.
                </Text>
              </BlockStack>

              <Card background="bg-surface-success">
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Next Steps
                  </Text>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      1. <strong>Enable the theme extension</strong> - Go to your theme editor and add the
                      "Customer Login" block to your pages
                    </Text>
                    <Text as="p" variant="bodyMd">
                      2. <strong>Test authentication</strong> - Try logging in with SMS, email, or OAuth on
                      your storefront
                    </Text>
                    <Text as="p" variant="bodyMd">
                      3. <strong>Monitor analytics</strong> - View authentication statistics and SMS delivery
                      rates on your dashboard
                    </Text>
                    <Text as="p" variant="bodyMd">
                      4. <strong>Configure webhooks</strong> - Set up order confirmation SMS in your settings
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              <InlineStack align="space-between">
                <Button onClick={() => handleNext("ui")}>Back</Button>
                <Button variant="primary" onClick={handleComplete}>
                  Go to Dashboard
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
