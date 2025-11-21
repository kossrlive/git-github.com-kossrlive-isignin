import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
import {
    Badge,
    BlockStack,
    Card,
    InlineStack,
    Layout,
    Page,
    Text,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

interface AnalyticsStats {
  totalAuthentications: number;
  authMethodBreakdown: {
    sms: number;
    email: number;
    google: number;
    apple: number;
    facebook: number;
  };
  successRate: number;
  smsDeliveryRate: number;
  recentActivity: Array<{
    id: string;
    eventType: string;
    method: string | null;
    createdAt: string;
  }>;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

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

  // Calculate stats
  const authSuccesses = analytics.filter((a) => a.eventType === "auth_success");
  const authFailures = analytics.filter((a) => a.eventType === "auth_failure");
  const smsSent = analytics.filter((a) => a.eventType === "sms_sent");
  const smsFailed = analytics.filter((a) => a.eventType === "sms_failed");

  const totalAuthentications = authSuccesses.length + authFailures.length;
  const successRate =
    totalAuthentications > 0
      ? (authSuccesses.length / totalAuthentications) * 100
      : 0;

  const totalSms = smsSent.length + smsFailed.length;
  const smsDeliveryRate =
    totalSms > 0 ? (smsSent.length / totalSms) * 100 : 0;

  const authMethodBreakdown = {
    sms: authSuccesses.filter((a) => a.method === "sms").length,
    email: authSuccesses.filter((a) => a.method === "email").length,
    google: authSuccesses.filter((a) => a.method === "google").length,
    apple: authSuccesses.filter((a) => a.method === "apple").length,
    facebook: authSuccesses.filter((a) => a.method === "facebook").length,
  };

  const recentActivity = analytics.slice(0, 10).map((a) => ({
    id: a.id,
    eventType: a.eventType,
    method: a.method,
    createdAt: a.createdAt.toISOString(),
  }));

  const stats: AnalyticsStats = {
    totalAuthentications,
    authMethodBreakdown,
    successRate,
    smsDeliveryRate,
    recentActivity,
  };

  return json({ stats, shop });
};

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getEventBadge = (eventType: string) => {
    if (eventType === "auth_success" || eventType === "sms_sent") {
      return <Badge tone="success">{formatEventType(eventType)}</Badge>;
    }
    if (eventType === "auth_failure" || eventType === "sms_failed") {
      return <Badge tone="critical">{formatEventType(eventType)}</Badge>;
    }
    return <Badge>{formatEventType(eventType)}</Badge>;
  };

  return (
    <Page>
      <TitleBar title="Multi-Channel Authentication Dashboard" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Welcome to Multi-Channel Authentication
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Manage SMS, Email, and OAuth authentication for your
                    customers. View analytics and configure providers from this
                    dashboard.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Quick Stats (Last 30 Days)
                  </Text>
                  <Layout>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Total Authentications
                          </Text>
                          <Text as="p" variant="heading2xl">
                            {stats.totalAuthentications}
                          </Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Success Rate
                          </Text>
                          <Text as="p" variant="heading2xl">
                            {formatPercentage(stats.successRate)}
                          </Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            SMS Delivery Rate
                          </Text>
                          <Text as="p" variant="heading2xl">
                            {formatPercentage(stats.smsDeliveryRate)}
                          </Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Authentication Methods Used
                  </Text>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        SMS Authentication
                      </Text>
                      <Badge tone="info">
                        {String(stats.authMethodBreakdown.sms)} authentications
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Email/Password
                      </Text>
                      <Badge tone="info">
                        {String(stats.authMethodBreakdown.email)} authentications
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Google OAuth
                      </Text>
                      <Badge tone="info">
                        {String(stats.authMethodBreakdown.google)} authentications
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Apple OAuth
                      </Text>
                      <Badge tone="info">
                        {String(stats.authMethodBreakdown.apple)} authentications
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Facebook OAuth
                      </Text>
                      <Badge tone="info">
                        {String(stats.authMethodBreakdown.facebook)} authentications
                      </Badge>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {stats.recentActivity.length > 0 && (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">
                      Recent Activity
                    </Text>
                    <BlockStack gap="300">
                      {stats.recentActivity.map((activity) => (
                        <InlineStack key={activity.id} align="space-between">
                          <BlockStack gap="100">
                            {getEventBadge(activity.eventType)}
                            {activity.method && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                Method: {activity.method}
                              </Text>
                            )}
                          </BlockStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {new Date(activity.createdAt).toLocaleString()}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
