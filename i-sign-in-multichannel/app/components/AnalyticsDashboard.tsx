import { Badge, BlockStack, Box, Card, InlineStack, Text } from "@shopify/polaris";

interface AnalyticsData {
  totalAuthentications: number;
  authMethodBreakdown: {
    sms: number;
    email: number;
    google: number;
    apple: number;
    facebook: number;
  };
  successRate: number;
  failureRate: number;
  smsDeliveryRate: number;
  smsFailureRate: number;
  recentAttempts: Array<{
    id: string;
    eventType: string;
    method: string | null;
    createdAt: string;
  }>;
}

interface AnalyticsDashboardProps {
  data: AnalyticsData;
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
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

  const totalMethods =
    data.authMethodBreakdown.sms +
    data.authMethodBreakdown.email +
    data.authMethodBreakdown.google +
    data.authMethodBreakdown.apple +
    data.authMethodBreakdown.facebook;

  const getMethodPercentage = (count: number) => {
    if (totalMethods === 0) return "0%";
    return `${((count / totalMethods) * 100).toFixed(1)}%`;
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Analytics Dashboard
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          View authentication statistics and trends for the last 30 days.
        </Text>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Authentication Methods Used
          </Text>
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  SMS Authentication
                </Text>
                <InlineStack gap="200">
                  <Badge tone="info">{String(data.authMethodBreakdown.sms)}</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {getMethodPercentage(data.authMethodBreakdown.sms)}
                  </Text>
                </InlineStack>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  Email/Password
                </Text>
                <InlineStack gap="200">
                  <Badge tone="info">{String(data.authMethodBreakdown.email)}</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {getMethodPercentage(data.authMethodBreakdown.email)}
                  </Text>
                </InlineStack>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  Google OAuth
                </Text>
                <InlineStack gap="200">
                  <Badge tone="info">{String(data.authMethodBreakdown.google)}</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {getMethodPercentage(data.authMethodBreakdown.google)}
                  </Text>
                </InlineStack>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  Apple OAuth
                </Text>
                <InlineStack gap="200">
                  <Badge tone="info">{String(data.authMethodBreakdown.apple)}</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {getMethodPercentage(data.authMethodBreakdown.apple)}
                  </Text>
                </InlineStack>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  Facebook OAuth
                </Text>
                <InlineStack gap="200">
                  <Badge tone="info">{String(data.authMethodBreakdown.facebook)}</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {getMethodPercentage(data.authMethodBreakdown.facebook)}
                  </Text>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Box>
        </BlockStack>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Success/Failure Rates
          </Text>
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  Authentication Success Rate
                </Text>
                <Badge tone="success">
                  {formatPercentage(data.successRate)}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  Authentication Failure Rate
                </Text>
                <Badge tone="critical">
                  {formatPercentage(data.failureRate)}
                </Badge>
              </InlineStack>
            </BlockStack>
          </Box>
        </BlockStack>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            SMS Delivery Statistics
          </Text>
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  SMS Delivery Rate
                </Text>
                <Badge tone="success">
                  {formatPercentage(data.smsDeliveryRate)}
                </Badge>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="span" variant="bodyMd">
                  SMS Failure Rate
                </Text>
                <Badge tone="critical">
                  {formatPercentage(data.smsFailureRate)}
                </Badge>
              </InlineStack>
            </BlockStack>
          </Box>
        </BlockStack>

        {data.recentAttempts.length > 0 && (
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm">
              Recent Authentication Attempts
            </Text>
            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="300">
                {data.recentAttempts.map((attempt) => (
                  <InlineStack key={attempt.id} align="space-between">
                    <BlockStack gap="100">
                      {getEventBadge(attempt.eventType)}
                      {attempt.method && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          Method: {attempt.method}
                        </Text>
                      )}
                    </BlockStack>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {new Date(attempt.createdAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </Box>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
