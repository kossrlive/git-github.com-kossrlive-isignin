import dotenv from 'dotenv';
import express from 'express';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { closeSMSQueue, getSMSQueue } from './config/queue.js';
import { closeRedisClient, getRedisClient } from './config/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { httpsEnforcement } from './middleware/httpsEnforcement.js';
import { requestLogger } from './middleware/requestLogger.js';
import { GoogleOAuthProvider } from './providers/GoogleOAuthProvider.js';
import { SmsToProvider } from './providers/SmsToProvider.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { AuthService } from './services/AuthService.js';
import { CustomerService } from './services/CustomerService.js';
import { MultipassService } from './services/MultipassService.js';
import { OAuthService } from './services/OAuthService.js';
import { OrderService } from './services/OrderService.js';
import { OTPService } from './services/OTPService.js';
import { SettingsService } from './services/SettingsService.js';
import { SMSService } from './services/SMSService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Order matters!
// 1. HTTPS enforcement (before any processing)
app.use(httpsEnforcement);

// 2. Request logging (track all requests)
app.use(requestLogger);

// 3. Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        requestId: req.requestId 
    });
});

// Root endpoint - friendly message
app.get('/', (req, res) => {
    res.status(418).json({
        message: "I'm a teapot ☕",
        service: 'Shopify SMS Authentication App',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth/*',
            admin: '/api/admin/*',
            webhooks: '/api/webhooks/*'
        },
        documentation: 'See README.md for API documentation',
        requestId: req.requestId
    });
});

// Initialize infrastructure and services
const initializeInfrastructure = async (): Promise<void> => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Initialize Redis
    let redis;
    try {
        redis = getRedisClient();
        await redis.ping();
        logger.info('Redis connection established');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to connect to Redis', { error: errorMessage });
        
        if (isDevelopment) {
            logger.warn('⚠️  Running in development mode without Redis connection');
            logger.warn('⚠️  Some features will not work until Redis is available');
            logger.warn('⚠️  Start Redis with: docker run -d -p 6379:6379 redis:7-alpine');
            return; // Exit early in development
        } else {
            // In production, Redis is required
            throw error;
        }
    }

    // Initialize Bull queue
    let smsQueue;
    try {
        smsQueue = getSMSQueue();
        logger.info('Bull queue initialized');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to initialize Bull queue', { error: errorMessage });
        if (!isDevelopment) throw error;
    }

    // Initialize core services (these should always work)
    const multipassService = new MultipassService();
    const customerService = new CustomerService();
    const otpService = new OTPService(redis);
    
    // Initialize SMS service
    let smsService: SMSService;
    try {
        if (config.sms.smsTo.apiKey && config.sms.smsTo.senderId) {
            const smsToProvider = new SmsToProvider(
                config.sms.smsTo.apiKey,
                config.sms.smsTo.senderId
            );
            smsService = new SMSService([smsToProvider], redis);
            logger.info('SMS service initialized with sms.to provider');
        } else {
            // Create SMS service with empty providers array
            smsService = new SMSService([], redis);
            logger.warn('⚠️  SMS service initialized without providers (SMS features disabled)');
            logger.warn('⚠️  Set SMS_TO_API_KEY and SMS_TO_SENDER_ID in .env to enable SMS');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to initialize SMS service', { error: errorMessage });
        // Create fallback SMS service
        smsService = new SMSService([], redis);
        logger.warn('⚠️  SMS service running in fallback mode (no providers)');
    }
    
    // Initialize OAuth service
    const oauthService = new OAuthService();
    try {
        if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
            const googleProvider = new GoogleOAuthProvider(
                config.oauth.google.clientId,
                config.oauth.google.clientSecret
            );
            oauthService.registerProvider('google', googleProvider);
            logger.info('OAuth service initialized with Google provider');
        } else {
            logger.warn('⚠️  Google OAuth not configured (OAuth features disabled)');
            logger.warn('⚠️  Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable Google OAuth');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to initialize Google OAuth provider', { error: errorMessage });
        logger.warn('⚠️  Google OAuth will not be available');
    }
    
    // Initialize Auth service
    const authService = new AuthService(
        multipassService,
        customerService,
        otpService,
        smsService,
        oauthService,
        smsQueue
    );
    
    // Initialize Order service
    const orderService = new OrderService(redis, otpService, smsService);
    
    // Initialize Settings service
    const settingsService = new SettingsService(redis);

    // Register routes
    const authRouter = createAuthRouter(authService, otpService, smsService);
    app.use('/api/auth', authRouter);
    
    const webhookRouter = createWebhookRouter(orderService, smsService);
    app.use('/api/webhooks', webhookRouter);
    
    const adminRouter = createAdminRouter(settingsService);
    app.use('/api/admin', adminRouter);
    
    // Register 404 handler (after all routes)
    app.use(notFoundHandler);
    
    // Register global error handler (must be last)
    app.use(errorHandler);
    
    logger.info('Services and routes initialized');
    logger.info('Infrastructure initialization complete');
};

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
    logger.info('Shutting down gracefully...');
    
    try {
        await closeSMSQueue();
        await closeRedisClient();
        logger.info('All connections closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async (): Promise<void> => {
    try {
        // Initialize infrastructure first
        await initializeInfrastructure();

        // Start Express server
        app.listen(PORT, () => {
            logger.info(`🚀 Shopify SMS Auth App running on port ${PORT}`);
            logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        logger.error('Failed to start server', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
        process.exit(1);
    }
};

// Start the application
startServer();

export default app;
