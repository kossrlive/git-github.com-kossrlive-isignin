import dotenv from 'dotenv';
import express from 'express';
import { logger } from './config/logger.js';
import { closeSMSQueue, getSMSQueue } from './config/queue.js';
import { closeRedisClient, getRedisClient } from './config/redis.js';
import { httpsEnforcement } from './middleware/httpsEnforcement.js';
import { requestLogger } from './middleware/requestLogger.js';

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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        requestId: req.requestId 
    });
});

// Initialize infrastructure
const initializeInfrastructure = async (): Promise<void> => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    try {
        // Initialize Redis
        const redis = getRedisClient();
        await redis.ping();
        logger.info('Redis connection established');

        // Initialize Bull queue
        getSMSQueue();
        logger.info('Bull queue initialized');

        logger.info('Infrastructure initialization complete');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to initialize infrastructure', { error: errorMessage });
        
        // In development, allow server to start without Redis
        if (isDevelopment) {
            logger.warn('⚠️  Running in development mode without Redis connection');
            logger.warn('⚠️  Some features will not work until Redis is available');
            logger.warn('⚠️  Start Redis with: docker run -d -p 6379:6379 redis:7-alpine');
        } else {
            // In production, Redis is required
            throw error;
        }
    }
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
