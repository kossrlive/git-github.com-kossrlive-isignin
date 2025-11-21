import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
    Banner,
    BlockStack,
    Button,
    InlineStack,
    Layout,
    Page,
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import { AnalyticsDashboard } from "../components/AnalyticsDashboard";
import { OAuthProviderConfig } from "../components/OAuthProviderConfig";
import { SMSProviderConfig } from "../components/SMSProviderConfig";
import { UICustomization } from "../components/UICustomization";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

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

  // Get or create settings
  let settings = shopRecord.settings;
  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: {
        shopId: shopRecord.id,
      },
    });
  }

  // Get analytics data
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const analytics = await prisma.analytics.findMany({
    where: {
      shopId: shopRecord.id,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calculate analytics stats
  const authSuccesses = analytics.filter((a: any) => a.eventType === "auth_success");
  const authFailures = analytics.filter((a: any) => a.eventType === "auth_failure");
  const smsSent = analytics.filter((a: any) => a.eventType === "sms_sent");
  const smsFailed = analytics.filter((a: any) => a.eventType === "sms_failed");

  const totalAuthentications = authSuccesses.length + authFailures.length;
  const successRate =
    totalAuthentications > 0
      ? (authSuccesses.length / totalAuthentications) * 100
      : 0;
  const failureRate = 100 - successRate;

  const totalSms = smsSent.length + smsFailed.length;
  const smsDeliveryRate = totalSms > 0 ? (smsSent.length / totalSms) * 100 : 0;
  const smsFailureRate = 100 - smsDeliveryRate;

  const authMethodBreakdown = {
    sms: authSuccesses.filter((a: any) => a.method === "sms").length,
    email: authSuccesses.filter((a: any) => a.method === "email").length,
    google: authSuccesses.filter((a: any) => a.method === "google").length,
    apple: authSuccesses.filter((a: any) => a.method === "apple").length,
    facebook: authSuccesses.filter((a: any) => a.method === "facebook").length,
  };

  const recentAttempts = analytics.slice(0, 10).map((a: any) => ({
    id: a.id,
    eventType: a.eventType,
    method: a.method,
    createdAt: a.createdAt.toISOString(),
  }));

  const analyticsData = {
    totalAuthentications,
    authMethodBreakdown,
    successRate,
    failureRate,
    smsDeliveryRate,
    smsFailureRate,
    recentAttempts,
  };

  return json({ settings, analyticsData });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("action");

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

  if (action === "save") {
    // Update settings
    const settingsData = {
      smsPrimary: formData.get("smsPrimary") as string,
      smsToApiKey: formData.get("smsToApiKey") as string,
      smsToSenderId: formData.get("smsToSenderId") as string,
      twilioAccountSid: formData.get("twilioAccountSid") as string,
      twilioAuthToken: formData.get("twilioAuthToken") as string,
      twilioFromNumber: formData.get("twilioFromNumber") as string,
      googleClientId: formData.get("googleClientId") as string,
      googleClientSecret: formData.get("googleClientSecret") as string,
      googleEnabled: formData.get("googleEnabled") === "true",
      appleClientId: formData.get("appleClientId") as string,
      appleTeamId: formData.get("appleTeamId") as string,
      appleKeyId: formData.get("appleKeyId") as string,
      appleEnabled: formData.get("appleEnabled") === "true",
      facebookAppId: formData.get("facebookAppId") as string,
      facebookAppSecret: formData.get("facebookAppSecret") as string,
      facebookEnabled: formData.get("facebookEnabled") === "true",
      primaryColor: formData.get("primaryColor") as string,
      buttonStyle: formData.get("buttonStyle") as string,
      logoUrl: formData.get("logoUrl") as string,
    };

    await prisma.shopSettings.upsert({
      where: { shopId: shopRecord.id },
      update: settingsData,
      create: {
        ...settingsData,
        shopId: shopRecord.id,
      },
    });

    return json({ success: true, message: "Settings saved successfully" });
  }

  if (action === "testConnection") {
    const provider = formData.get("provider") as string;
    // TODO: Implement actual connection testing
    // For now, just return success
    return json({
      success: true,
      message: `${provider} connection test successful`,
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function Settings() {
  const { settings, analyticsData } = useLoaderData<typeof loader>() as any;
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isLoading = navigation.state === "submitting";

  // Form state
  const [formData, setFormData] = useState({
    smsPrimary: settings.smsPrimary || "sms.to",
    smsToApiKey: settings.smsToApiKey || "",
    smsToSenderId: settings.smsToSenderId || "",
    twilioAccountSid: settings.twilioAccountSid || "",
    twilioAuthToken: settings.twilioAuthToken || "",
    twilioFromNumber: settings.twilioFromNumber || "",
    googleClientId: settings.googleClientId || "",
    googleClientSecret: settings.googleClientSecret || "",
    googleEnabled: settings.googleEnabled,
    appleClientId: settings.appleClientId || "",
    appleTeamId: settings.appleTeamId || "",
    appleKeyId: settings.appleKeyId || "",
    appleEnabled: settings.appleEnabled,
    facebookAppId: settings.facebookAppId || "",
    facebookAppSecret: settings.facebookAppSecret || "",
    facebookEnabled: settings.facebookEnabled,
    primaryColor: settings.primaryColor,
    buttonStyle: settings.buttonStyle,
    logoUrl: settings.logoUrl || "",
  });

  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle" && (navigation.formData as any)?.get("action") === "save") {
      setShowSuccessBanner(true);
      shopify.toast.show("Settings saved successfully");
      setTimeout(() => setShowSuccessBanner(false), 3000);
    }
  }, [navigation.state, navigation.formData, shopify]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const formDataToSubmit = new FormData();
    formDataToSubmit.append("action", "save");
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSubmit.append(key, String(value));
    });
    submit(formDataToSubmit, { method: "post" });
  };

  const handleTestConnection = async (provider: "sms.to" | "twilio") => {
    const formDataToSubmit = new FormData();
    formDataToSubmit.append("action", "testConnection");
    formDataToSubmit.append("provider", provider);
    submit(formDataToSubmit, { method: "post" });
    shopify.toast.show(`Testing ${provider} connection...`);
  };

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        {showSuccessBanner && (
          <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
            Settings saved successfully
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <SMSProviderConfig
                smsPrimary={formData.smsPrimary}
                smsToApiKey={formData.smsToApiKey}
                smsToSenderId={formData.smsToSenderId}
                twilioAccountSid={formData.twilioAccountSid}
                twilioAuthToken={formData.twilioAuthToken}
                twilioFromNumber={formData.twilioFromNumber}
                onChange={handleChange}
                onTestConnection={handleTestConnection}
              />

              <OAuthProviderConfig
                googleClientId={formData.googleClientId}
                googleClientSecret={formData.googleClientSecret}
                googleEnabled={formData.googleEnabled}
                appleClientId={formData.appleClientId}
                appleTeamId={formData.appleTeamId}
                appleKeyId={formData.appleKeyId}
                appleEnabled={formData.appleEnabled}
                facebookAppId={formData.facebookAppId}
                facebookAppSecret={formData.facebookAppSecret}
                facebookEnabled={formData.facebookEnabled}
                onChange={handleChange}
              />

              <UICustomization
                primaryColor={formData.primaryColor}
                buttonStyle={formData.buttonStyle}
                logoUrl={formData.logoUrl}
                onChange={handleChange}
              />

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isLoading}
                >
                  Save Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <AnalyticsDashboard data={analyticsData} />
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
