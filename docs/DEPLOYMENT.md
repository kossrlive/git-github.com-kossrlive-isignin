# Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Shopify SMS Authentication App to production. The application requires specific infrastructure components and configuration to function properly.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Infrastructure Requirements](#infrastructure-requirements)
- [Environment Variables](#environment-variables)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Scaling Considerations](#scaling-considerations)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

1. **Shopify Plus Account** with Multipass enabled
2. **Shopify Partner Account** for app registration
3. **SMS Provider Account** (sms.to and/or Twilio)
4. **Google Cloud Console Project** (for OAuth)
5. **Redis Instance** (managed or self-hosted)
6. **Node.js 18+** runtime environment
7. **SSL Certificate** for HTTPS (required)

---

## Infrastructure Requirements

### Minimum Requirements

**Application Server:**
- Node.js 18.x or higher
- 2 CPU cores
- 4GB RAM
- 20GB storage
- HTTPS support (SSL/TLS certificate)

**Redis:**
- Redis 7.x or higher
- 2GB RAM minimum
- TLS/SSL support enabled
- Persistence enabled (AOF or RDB)

**Network:**
- Public IP address or domain
- HTTPS (port 443) accessible
- Webhook endpoints accessible from:
  - Shopify servers
  - SMS provider servers (sms.to, Twilio)

### Recommended Production Setup

**Application Server:**
- Node.js 18.x LTS
- 4 CPU cores
- 8GB RAM
- 50GB SSD storage
- Load balancer for multiple instances

**Redis:**
- Redis 7.x cluster (3+ nodes)
- 4GB RAM per node
- TLS enabled
- AOF persistence with fsync every second
- Automatic failover configured

**Additional Components:**
- **CDN**: For static assets and logo uploads
- **Monitoring**: Application Performance Monitoring (APM) tool
- **Logging**: Centralized logging system (ELK, CloudWatch, etc.)
- **Backup**: Automated Redis backups

---

## Environment Variables

### Required Variables

#### Shopify Configuration

```bash
# Your Shopify store domain
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com

# Admin API access token (from custom app)
# Get this from: Shopify Admin > Settings > Apps and sales channels > Develop apps
SHOPIFY_API_KEY=shpat_your_access_token_here
SHOPIFY_API_SECRET=shpat_your_access_token_here

# Public URL where your app is hosted
SHOPIFY_APP_URL=https://your-app-url.com

# Required API scopes
SHOPIFY_SCOPES=read_customers,write_customers,read_orders,write_orders

# Multipass secret (Shopify Plus only)
# Get this from: Shopify Admin > Settings > Checkout > Customer accounts
SHOPIFY_MULTIPASS_SECRET=your_multipass_secret_here
```

#### SMS Provider Configuration

**Primary Provider (sms.to):**
```bash
# API key from sms.to dashboard
SMS_TO_API_KEY=your_sms_to_api_key_here

# Sender ID (phone number or alphanumeric)
SMS_TO_SENDER_ID=YourBrand
```

**Secondary Provider (Twilio - Optional but Recommended):**
```bash
# Twilio Account SID
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio Auth Token
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here

# Twilio phone number (E.164 format)
TWILIO_FROM_NUMBER=+1234567890
```

#### OAuth Configuration

**Google OAuth:**
```bash
# Google OAuth Client ID
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Google OAuth Client Secret
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OAuth callback URL
GOOGLE_REDIRECT_URI=https://your-app-url.com/api/auth/oauth/google/callback
```

#### Redis Configuration

```bash
# Redis connection URL
# Format: redis://[username]:[password]@[host]:[port]
REDIS_URL=redis://localhost:6379

# For Redis with TLS:
# REDIS_URL=rediss://username:password@your-redis-host:6380

# Enable TLS for Redis connection
REDIS_TLS_ENABLED=true

# Reject unauthorized TLS certificates (set to false for self-signed certs in dev)
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

#### Application Configuration

```bash
# Environment (development, staging, production)
NODE_ENV=production

# Port for the application server
PORT=3000

# Session secret for JWT signing (generate a random string)
SESSION_SECRET=your_random_session_secret_minimum_32_characters
```

### Optional Variables

#### Rate Limiting Configuration

```bash
# Rate limit window in milliseconds (default: 60000 = 1 minute)
RATE_LIMIT_WINDOW_MS=60000

# Maximum requests per window per IP (default: 10)
RATE_LIMIT_MAX_REQUESTS=10
```

#### OTP Configuration

```bash
# OTP code length (default: 6)
OTP_LENGTH=6

# OTP time-to-live in seconds (default: 300 = 5 minutes)
OTP_TTL_SECONDS=300

# Maximum OTP verification attempts before blocking (default: 5)
OTP_MAX_ATTEMPTS=5

# Block duration after max attempts in seconds (default: 900 = 15 minutes)
OTP_BLOCK_DURATION_SECONDS=900
```

#### SMS Configuration

```bash
# Cooldown between OTP resend requests in seconds (default: 30)
SMS_RESEND_COOLDOWN_SECONDS=30

# Maximum send attempts per window (default: 3)
SMS_MAX_SEND_ATTEMPTS=3

# Send attempts window in seconds (default: 600 = 10 minutes)
SMS_SEND_ATTEMPTS_WINDOW_SECONDS=600

# Block duration after max send attempts (default: 600 = 10 minutes)
SMS_SEND_ATTEMPTS_BLOCK_DURATION_SECONDS=600
```

#### Logging Configuration

```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info
```

### Generating Secrets

**Session Secret:**
```bash
# Generate a secure random string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**For Docker Secrets:**
```bash
# Create a .env file from the example
cp .env.example .env

# Edit the .env file with your actual values
nano .env
```

---

## Deployment Steps

### Step 1: Prepare the Application

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/shopify-sms-auth-app.git
   cd shopify-sms-auth-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the application:**
   ```bash
   npm run build
   ```

4. **Build the admin panel:**
   ```bash
   npm run build:admin
   ```

### Step 2: Configure Environment

1. **Create production .env file:**
   ```bash
   cp .env.example .env.production
   ```

2. **Edit environment variables:**
   ```bash
   nano .env.production
   ```
   
   Fill in all required variables (see [Environment Variables](#environment-variables) section).

3. **Validate configuration:**
   ```bash
   # Test that all required variables are set
   node -e "require('dotenv').config({path: '.env.production'}); require('./dist/config/index.js').validateConfig()"
   ```

### Step 3: Set Up Redis

**Option A: Managed Redis (Recommended)**

Use a managed Redis service:
- **AWS ElastiCache**
- **Google Cloud Memorystore**
- **Azure Cache for Redis**
- **Redis Cloud**
- **Heroku Redis**

**Option B: Self-Hosted Redis**

1. **Install Redis:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install redis-server
   
   # Configure Redis for production
   sudo nano /etc/redis/redis.conf
   ```

2. **Configure Redis settings:**
   ```conf
   # Enable AOF persistence
   appendonly yes
   appendfsync everysec
   
   # Set max memory
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   
   # Enable TLS (if using)
   tls-port 6380
   tls-cert-file /path/to/redis.crt
   tls-key-file /path/to/redis.key
   tls-ca-cert-file /path/to/ca.crt
   ```

3. **Start Redis:**
   ```bash
   sudo systemctl start redis
   sudo systemctl enable redis
   ```

4. **Test connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Step 4: Deploy Application

**Option A: Docker Deployment (Recommended)**

1. **Create Dockerfile** (if not exists):
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm ci --only=production
   
   COPY dist ./dist
   COPY admin/dist ./admin/dist
   COPY uploads ./uploads
   
   EXPOSE 3000
   
   CMD ["node", "dist/index.js"]
   ```

2. **Build Docker image:**
   ```bash
   docker build -t shopify-sms-auth:latest .
   ```

3. **Run container:**
   ```bash
   docker run -d \
     --name shopify-sms-auth \
     --env-file .env.production \
     -p 3000:3000 \
     -v $(pwd)/uploads:/app/uploads \
     -v $(pwd)/logs:/app/logs \
     shopify-sms-auth:latest
   ```

**Option B: PM2 Deployment**

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 ecosystem file:**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'shopify-sms-auth',
       script: './dist/index.js',
       instances: 2,
       exec_mode: 'cluster',
       env_production: {
         NODE_ENV: 'production'
       },
       error_file: './logs/pm2-error.log',
       out_file: './logs/pm2-out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
     }]
   };
   ```

3. **Start application:**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

**Option C: Systemd Service**

1. **Create service file:**
   ```bash
   sudo nano /etc/systemd/system/shopify-sms-auth.service
   ```

2. **Add service configuration:**
   ```ini
   [Unit]
   Description=Shopify SMS Auth App
   After=network.target redis.service
   
   [Service]
   Type=simple
   User=nodejs
   WorkingDirectory=/opt/shopify-sms-auth
   EnvironmentFile=/opt/shopify-sms-auth/.env.production
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   
   [Install]
   WantedBy=multi-user.target
   ```

3. **Start service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start shopify-sms-auth
   sudo systemctl enable shopify-sms-auth
   ```

### Step 5: Configure Reverse Proxy (Nginx)

1. **Install Nginx:**
   ```bash
   sudo apt-get install nginx
   ```

2. **Create Nginx configuration:**
   ```bash
   sudo nano /etc/nginx/sites-available/shopify-sms-auth
   ```

3. **Add configuration:**
   ```nginx
   server {
       listen 80;
       server_name your-app-url.com;
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name your-app-url.com;
       
       ssl_certificate /etc/letsencrypt/live/your-app-url.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-app-url.com/privkey.pem;
       
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       
       client_max_body_size 10M;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /uploads {
           alias /opt/shopify-sms-auth/uploads;
           expires 30d;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

4. **Enable site and restart Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/shopify-sms-auth /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### Step 6: Configure SSL Certificate

**Using Let's Encrypt (Recommended):**

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-app-url.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

### Step 7: Verify Deployment

1. **Check application health:**
   ```bash
   curl https://your-app-url.com/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-15T10:30:00.000Z",
     "requestId": "..."
   }
   ```

2. **Check logs:**
   ```bash
   # PM2
   pm2 logs shopify-sms-auth
   
   # Systemd
   sudo journalctl -u shopify-sms-auth -f
   
   # Docker
   docker logs -f shopify-sms-auth
   ```

3. **Test Redis connection:**
   ```bash
   # From application server
   redis-cli -h your-redis-host -p 6379 ping
   ```

---

## Post-Deployment Configuration

### Configure Shopify Webhooks

1. **Go to Shopify Admin** > Settings > Notifications > Webhooks

2. **Add webhook for order creation:**
   - Event: `Order creation`
   - Format: `JSON`
   - URL: `https://your-app-url.com/api/webhooks/shopify/orders/create`
   - API version: `2024-01`

### Configure SMS Provider Webhooks

**sms.to:**
1. Log in to sms.to dashboard
2. Go to Settings > Webhooks
3. Add webhook URL: `https://your-app-url.com/api/webhooks/sms-dlr`
4. Select events: `Delivery Receipt`

**Twilio:**
1. Log in to Twilio Console
2. Go to Phone Numbers > Manage > Active Numbers
3. Select your number
4. Under Messaging, set Status Callback URL: `https://your-app-url.com/api/webhooks/sms-dlr`

### Configure Google OAuth

1. **Go to Google Cloud Console** > APIs & Services > Credentials
2. **Edit OAuth 2.0 Client**
3. **Add Authorized Redirect URI:**
   ```
   https://your-app-url.com/api/auth/oauth/google/callback
   ```
4. **Save changes**

---

## Monitoring and Logging

### Application Monitoring

**Recommended Tools:**
- **New Relic APM**
- **Datadog**
- **AppDynamics**
- **Elastic APM**

**Key Metrics to Monitor:**
- Request latency (p50, p95, p99)
- Error rate by endpoint
- SMS delivery success rate
- Queue depth and processing time
- Redis memory usage
- CPU and memory usage

### Logging Setup

**Centralized Logging Options:**

**Option A: ELK Stack (Elasticsearch, Logstash, Kibana)**

1. **Install Filebeat:**
   ```bash
   curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.x.x-amd64.deb
   sudo dpkg -i filebeat-8.x.x-amd64.deb
   ```

2. **Configure Filebeat:**
   ```yaml
   # /etc/filebeat/filebeat.yml
   filebeat.inputs:
   - type: log
     enabled: true
     paths:
       - /opt/shopify-sms-auth/logs/*.log
     json.keys_under_root: true
   
   output.elasticsearch:
     hosts: ["your-elasticsearch-host:9200"]
   ```

3. **Start Filebeat:**
   ```bash
   sudo systemctl start filebeat
   sudo systemctl enable filebeat
   ```

**Option B: CloudWatch Logs (AWS)**

1. **Install CloudWatch agent:**
   ```bash
   wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
   sudo dpkg -i amazon-cloudwatch-agent.deb
   ```

2. **Configure agent:**
   ```json
   {
     "logs": {
       "logs_collected": {
         "files": {
           "collect_list": [
             {
               "file_path": "/opt/shopify-sms-auth/logs/combined.log",
               "log_group_name": "/shopify-sms-auth/app",
               "log_stream_name": "{instance_id}"
             }
           ]
         }
       }
     }
   }
   ```

### Health Checks

**Set up automated health checks:**

```bash
# Cron job for health check
*/5 * * * * curl -f https://your-app-url.com/health || echo "Health check failed" | mail -s "App Down" admin@example.com
```

**Or use monitoring services:**
- **UptimeRobot**
- **Pingdom**
- **StatusCake**

---

## Scaling Considerations

### Horizontal Scaling

**Load Balancer Configuration:**

```nginx
# Nginx load balancer
upstream shopify_sms_auth {
    least_conn;
    server app1.internal:3000;
    server app2.internal:3000;
    server app3.internal:3000;
}

server {
    listen 443 ssl http2;
    server_name your-app-url.com;
    
    location / {
        proxy_pass http://shopify_sms_auth;
        # ... other proxy settings
    }
}
```

### Redis Clustering

**For high availability:**

1. **Set up Redis Sentinel** (3+ nodes)
2. **Or use Redis Cluster** (6+ nodes)
3. **Update REDIS_URL** to use sentinel or cluster endpoints

### Queue Workers

**Separate SMS queue workers:**

```javascript
// worker.js
const { getSMSQueue } = require('./config/queue');
const queue = getSMSQueue();

queue.process(async (job) => {
  // Process SMS jobs
});
```

**Run workers separately:**
```bash
pm2 start worker.js -i 2 --name sms-worker
```

---

## Troubleshooting

### Common Issues

**1. Redis Connection Failed**

```bash
# Check Redis is running
redis-cli ping

# Check Redis logs
sudo journalctl -u redis -n 50

# Test connection with credentials
redis-cli -h host -p port -a password ping
```

**2. SMS Not Sending**

```bash
# Check SMS provider credentials
curl -X POST https://api.sms.to/sms/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"to":"+1234567890","message":"Test"}'

# Check queue status
redis-cli LLEN bull:sms:wait
redis-cli LLEN bull:sms:failed
```

**3. Multipass Token Invalid**

- Verify `SHOPIFY_MULTIPASS_SECRET` is correct
- Ensure Multipass is enabled in Shopify (Plus only)
- Check token expiration (tokens expire after 10 minutes)

**4. High Memory Usage**

```bash
# Check Redis memory
redis-cli INFO memory

# Check Node.js memory
pm2 monit

# Adjust Redis maxmemory
redis-cli CONFIG SET maxmemory 2gb
```

**5. Application Won't Start**

```bash
# Check logs
pm2 logs shopify-sms-auth --lines 100

# Check environment variables
pm2 env 0

# Validate Node.js version
node --version  # Should be 18.x or higher
```

### Getting Help

1. Check application logs: `logs/combined.log` and `logs/error.log`
2. Review [API Documentation](./API.md)
3. Consult [User Guide](./USER_GUIDE.md)
4. Contact support with:
   - Error messages from logs
   - Request ID from failed requests
   - Environment details (Node.js version, OS, etc.)

---

## Security Checklist

Before going live, verify:

- [ ] All environment variables are set correctly
- [ ] HTTPS is enforced (no HTTP access)
- [ ] Redis TLS is enabled
- [ ] Firewall rules restrict access to necessary ports only
- [ ] Secrets are not committed to version control
- [ ] Rate limiting is configured
- [ ] Monitoring and alerting are set up
- [ ] Backups are configured for Redis
- [ ] SSL certificate auto-renewal is working
- [ ] Webhook endpoints validate HMAC signatures
- [ ] Admin endpoints have proper authentication
- [ ] Logs don't contain sensitive data (PII, passwords, API keys)

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error rates and latency
- Check SMS delivery success rate
- Review failed queue jobs

**Weekly:**
- Review application logs for errors
- Check Redis memory usage
- Verify backup integrity

**Monthly:**
- Update dependencies (`npm audit`, `npm update`)
- Review and rotate secrets
- Test disaster recovery procedures
- Review and optimize Redis memory usage

### Updates and Patches

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run tests
npm test

# Build application
npm run build

# Restart application
pm2 restart shopify-sms-auth
```

---

## Rollback Procedure

If deployment fails:

1. **Stop new version:**
   ```bash
   pm2 stop shopify-sms-auth
   ```

2. **Restore previous version:**
   ```bash
   git checkout <previous-commit>
   npm install
   npm run build
   ```

3. **Restart application:**
   ```bash
   pm2 restart shopify-sms-auth
   ```

4. **Verify health:**
   ```bash
   curl https://your-app-url.com/health
   ```

---

## Support

For deployment assistance:
- Email: support@example.com
- Documentation: https://docs.your-app-url.com
- Status Page: https://status.your-app-url.com
