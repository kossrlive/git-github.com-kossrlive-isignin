import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Shopify Configuration
    shopify: {
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || '',
        apiKey: process.env.SHOPIFY_API_KEY || '',
        apiSecret: process.env.SHOPIFY_API_SECRET || '',
        appUrl: process.env.SHOPIFY_APP_URL || 'http://localhost:3000',
        scopes: process.env.SHOPIFY_SCOPES || 'read_customers,write_customers,read_orders,write_orders',
        multipassSecret: process.env.SHOPIFY_MULTIPASS_SECRET || '',
    },

    // SMS Provider Configuration
    sms: {
        smsTo: {
            apiKey: process.env.SMS_TO_API_KEY || '',
            senderId: process.env.SMS_TO_SENDER_ID || '',
        },
    },

    // OAuth Provider Configuration
    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/oauth/google/callback',
        },
    },

    // Redis Configuration
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
    },

    // Application Configuration
    app: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3000', 10),
        sessionSecret: process.env.SESSION_SECRET || 'change_this_to_a_random_secret',
    },

    // Rate Limiting Configuration
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
    },

    // OTP Configuration
    otp: {
        length: parseInt(process.env.OTP_LENGTH || '6', 10),
        ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),
        maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
        blockDurationSeconds: parseInt(process.env.OTP_BLOCK_DURATION_SECONDS || '900', 10),
    },

    // SMS Configuration
    smsConfig: {
        resendCooldownSeconds: parseInt(process.env.SMS_RESEND_COOLDOWN_SECONDS || '30', 10),
        maxSendAttempts: parseInt(process.env.SMS_MAX_SEND_ATTEMPTS || '3', 10),
        sendAttemptsWindowSeconds: parseInt(process.env.SMS_SEND_ATTEMPTS_WINDOW_SECONDS || '600', 10),
        sendAttemptsBlockDurationSeconds: parseInt(process.env.SMS_SEND_ATTEMPTS_BLOCK_DURATION_SECONDS || '600', 10),
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};

// Validate required configuration
export function validateConfig(): void {
    const requiredFields = [
        { key: 'SHOPIFY_SHOP_DOMAIN', value: config.shopify.shopDomain },
        { key: 'SHOPIFY_API_KEY', value: config.shopify.apiKey },
        { key: 'SHOPIFY_API_SECRET', value: config.shopify.apiSecret },
        { key: 'SHOPIFY_MULTIPASS_SECRET', value: config.shopify.multipassSecret },
    ];

    const missing = requiredFields.filter(field => !field.value);

    if (missing.length > 0 && config.app.nodeEnv === 'production') {
        console.warn('⚠️  Missing required environment variables:');
        missing.forEach(field => console.warn(`   - ${field.key}`));
        console.warn('   Please configure these in your .env file or environment');
    }
}

// Export infrastructure modules
export * from './logger.js';
export * from './queue.js';
export * from './redis.js';

