# Infrastructure Setup Guide

## Overview

Task 2 has been completed successfully. The core infrastructure is now configured and ready to use.

## What Was Implemented

### 1. Redis Client with TLS Support
- **Location**: `src/config/redis.ts`
- **Features**:
  - TLS/SSL support for secure connections
  - Automatic retry with exponential backoff
  - Connection event monitoring
  - Singleton pattern for efficient resource usage

### 2. Bull Queue for SMS Processing
- **Location**: `src/config/queue.ts`
- **Features**:
  - Redis-backed job queue
  - 3 retry attempts with exponential backoff (2s initial delay)
  - Comprehensive event logging
  - Job management utilities

### 3. Express.js with HTTPS Enforcement
- **Location**: `src/middleware/httpsEnforcement.ts`
- **Features**:
  - Automatic HTTP → HTTPS redirect in production
  - Development mode bypass
  - X-Forwarded-Proto header support

### 4. Winston Logger with Request ID Tracking
- **Location**: `src/config/logger.ts`
- **Features**:
  - UUID-based request ID generation
  - Multiple log levels (info, warn, error, debug)
  - File and console transports
  - Structured JSON logging

### 5. Request Logging Middleware
- **Location**: `src/middleware/requestLogger.ts`
- **Features**:
  - Automatic request ID tracking
  - Request start/completion logging
  - Duration tracking
  - IP and user agent logging

## Running the Application

### Development Mode (Without Redis)

The application can run in development mode without Redis:

```bash
npm run dev
```

You'll see warnings about Redis not being available, but the server will start. Some features requiring Redis won't work until you start Redis.

### Starting Redis (Required for Full Functionality)

#### Option 1: Docker (Recommended)
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

#### Option 2: Local Installation
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from https://redis.io/download
```

### Production Mode

In production, Redis is **required**. The application will not start without a valid Redis connection.

```bash
NODE_ENV=production npm start
```

## Environment Variables

Key infrastructure-related environment variables:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TLS=false
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Application
NODE_ENV=development
PORT=3000

# Logging
LOG_LEVEL=info
```

## Testing

All infrastructure components have been tested:

```bash
npm test
```

**Test Results**: ✅ 15 tests passing
- Logger functionality
- Redis configuration
- Queue configuration
- HTTPS enforcement
- Request logging

## Verification

To verify the setup is working:

1. **Start Redis** (if not already running):
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Start the application**:
   ```bash
   npm run dev
   ```

3. **Check the health endpoint**:
   ```bash
   curl http://localhost:3000/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-11-19T...",
     "requestId": "uuid-here"
   }
   ```

4. **Check logs**:
   - Console output shows structured logs
   - `logs/combined.log` contains all logs
   - `logs/error.log` contains error logs only

## Next Steps

The infrastructure is ready for the next tasks:
- ✅ Task 2: Set up core infrastructure and dependencies (COMPLETE)
- ⏭️ Task 3: Implement provider interfaces and base implementations

## Troubleshooting

### Redis Connection Errors

If you see Redis connection errors:

1. **Check if Redis is running**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check Redis URL**:
   ```bash
   echo $REDIS_URL
   # Should be: redis://localhost:6379
   ```

3. **In development**: The app will start anyway with warnings
4. **In production**: Fix Redis connection before starting

### Port Already in Use

If port 3000 is already in use:

```bash
# Change port in .env
PORT=3001

# Or set it directly
PORT=3001 npm run dev
```

## Architecture Notes

The infrastructure follows these patterns:

1. **Singleton Pattern**: Redis and Queue clients are singletons
2. **Graceful Shutdown**: SIGTERM/SIGINT handlers close connections properly
3. **Error Handling**: Comprehensive error logging with context
4. **Development-Friendly**: Works without Redis in dev mode
5. **Production-Ready**: Strict requirements in production mode

## Requirements Validated

This implementation satisfies:
- ✅ Requirement 9.4: Redis with TLS support
- ✅ Requirement 9.5: HTTPS enforcement
- ✅ Requirement 10.1: Bull queue for SMS processing
- ✅ Requirement 7.5: Request logging with request ID tracking
