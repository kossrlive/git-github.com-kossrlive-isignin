# Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues with the Shopify SMS Authentication App. Issues are organized by category with step-by-step solutions.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [SMS Issues](#sms-issues)
- [Authentication Issues](#authentication-issues)
- [Configuration Issues](#configuration-issues)
- [Performance Issues](#performance-issues)
- [Integration Issues](#integration-issues)
- [Error Reference](#error-reference)
- [Debug Mode](#debug-mode)
- [Getting Support](#getting-support)

---

## Quick Diagnostics

### Health Check

First, verify the application is running:

```bash
curl https://your-app-url.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "..."
}
```

**If health check fails:**
1. Check if the application is running
2. Verify network connectivity
3. Check firewall rules
4. Review application logs

### Check Logs

```bash
# PM2
pm2 logs shopify-sms-auth --lines 100

# Systemd
sudo journalctl -u shopify-sms-auth -n 100 -f

# Docker
docker logs shopify-sms-auth --tail 100 -f

# Direct file access
tail -f logs/combined.log
tail -f logs/error.log
```

### Check Redis Connection

```bash
# Test Redis connection
redis-cli -h your-redis-host -p 6379 ping

# Check Redis memory
redis-cli INFO memory

# Check queue status
redis-cli LLEN bull:sms:wait
redis-cli LLEN bull:sms:failed
```

---

## Installation Issues

### Issue: App Won't Install

**Symptoms:**
- Installation hangs or fails
- Error message during installation
- Redirect loop after installation

**Diagnosis:**
```bash
# Check Node.js version
node --version  # Should be 18.x or higher

# Check npm version
npm --version

# Verify dependencies
npm list --depth=0
```

**Solutions:**

1. **Update Node.js:**
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18
   
   # Or download from nodejs.org
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check environment variables:**
   ```bash
   # Verify all required variables are set
   node -e "require('dotenv').config(); console.log(process.env.SHOPIFY_API_KEY ? 'OK' : 'MISSING')"
   ```

### Issue: Build Fails

**Symptoms:**
- `npm run build` fails
- TypeScript compilation errors
- Missing dependencies

**Solutions:**

1. **Install all dependencies:**
   ```bash
   npm install
   npm run build
   ```

2. **Check TypeScript version:**
   ```bash
   npx tsc --version  # Should be 5.x
   ```

3. **Clear build cache:**
   ```bash
   rm -rf dist
   npm run build
   ```

4. **Check for syntax errors:**
   ```bash
   npm run typecheck
   ```

---

## SMS Issues

### Issue: SMS Not Sending

**Symptoms:**
- Customers don't receive OTP codes
- "SMS sent" message appears but no SMS arrives
- Delivery status shows "failed"

**Diagnosis:**

1. **Check SMS provider status:**
   ```bash
   # Test sms.to API
   curl -X POST https://api.sms.to/sms/send \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "+1234567890",
       "message": "Test message",
       "sender_id": "YourBrand"
     }'
   ```

2. **Check queue:**
   ```bash
   # Check pending SMS jobs
   redis-cli LLEN bull:sms:wait
   
   # Check failed SMS jobs
   redis-cli LLEN bull:sms:failed
   
   # View failed job details
   redis-cli LRANGE bull:sms:failed 0 -1
   ```

3. **Check logs:**
   ```bash
   grep "SMS" logs/combined.log | tail -20
   grep "ERROR" logs/error.log | grep -i sms
   ```

**Solutions:**

1. **Verify API credentials:**
   - Check `SMS_TO_API_KEY` is correct
   - Verify `SMS_TO_SENDER_ID` is approved
   - Test credentials in provider dashboard

2. **Check account balance:**
   - Log in to SMS provider dashboard
   - Verify sufficient credits
   - Add credits if needed

3. **Verify phone number format:**
   - Must be in E.164 format: +1234567890
   - Include country code
   - No spaces or special characters

4. **Check provider restrictions:**
   - Some countries may be blocked
   - Verify destination country is supported
   - Check for rate limits

5. **Enable fallback provider:**
   - Configure Twilio as secondary provider
   - Automatic fallback on primary failure

### Issue: SMS Delayed

**Symptoms:**
- OTP arrives after several minutes
- Inconsistent delivery times
- Codes expire before arrival

**Diagnosis:**

1. **Check queue processing:**
   ```bash
   # Check queue depth
   redis-cli LLEN bull:sms:wait
   
   # Check worker status
   pm2 list | grep worker
   ```

2. **Check provider latency:**
   - Review provider status page
   - Check for known issues
   - Test with different provider

**Solutions:**

1. **Scale queue workers:**
   ```bash
   # Add more workers
   pm2 scale sms-worker +2
   ```

2. **Increase OTP TTL:**
   ```bash
   # In .env
   OTP_TTL_SECONDS=600  # 10 minutes instead of 5
   ```

3. **Switch providers:**
   - Try Twilio if using sms.to
   - Check provider status pages
   - Contact provider support

### Issue: Wrong Sender ID

**Symptoms:**
- SMS shows wrong sender name
- Generic number instead of brand name
- Sender ID not recognized

**Solutions:**

1. **Verify sender ID registration:**
   - Some countries require pre-registration
   - Check provider dashboard for approval status
   - Use approved sender ID

2. **Use phone number:**
   ```bash
   # In .env
   SMS_TO_SENDER_ID=+1234567890  # Use phone number instead
   ```

3. **Check country restrictions:**
   - Some countries don't support alphanumeric sender IDs
   - Use numeric sender ID for those countries

---

## Authentication Issues

### Issue: OTP Verification Fails

**Symptoms:**
- "Invalid verification code" error
- Correct code rejected
- Code works sometimes but not always

**Diagnosis:**

1. **Check OTP in Redis:**
   ```bash
   # Check if OTP exists
   redis-cli GET "otp:+1234567890"
   
   # Check TTL
   redis-cli TTL "otp:+1234567890"
   ```

2. **Check for timing issues:**
   ```bash
   # Verify server time is correct
   date
   
   # Check Redis time
   redis-cli TIME
   ```

**Solutions:**

1. **Verify OTP format:**
   - Must be exactly 6 digits
   - No spaces or special characters
   - Case-sensitive if alphanumeric

2. **Check Redis connection:**
   ```bash
   redis-cli ping
   ```

3. **Verify TTL:**
   - Default is 300 seconds (5 minutes)
   - Check if code expired
   - Request new code

4. **Clear blocked status:**
   ```bash
   # If phone is blocked
   redis-cli DEL "otp:blocked:+1234567890"
   redis-cli DEL "otp:attempts:+1234567890"
   ```

### Issue: Multipass Token Invalid

**Symptoms:**
- "Invalid Multipass token" error
- Redirect to Shopify fails
- Customer not logged in after authentication

**Diagnosis:**

1. **Verify Multipass is enabled:**
   - Go to Shopify Admin > Settings > Checkout
   - Check "Customer accounts" section
   - Verify Multipass is enabled

2. **Check Multipass secret:**
   ```bash
   # Verify secret is set
   echo $SHOPIFY_MULTIPASS_SECRET
   ```

3. **Check token generation:**
   ```bash
   # Enable debug logging
   LOG_LEVEL=debug npm start
   
   # Look for Multipass token in logs
   grep "Multipass" logs/combined.log
   ```

**Solutions:**

1. **Verify Multipass secret:**
   - Get correct secret from Shopify Admin
   - Update `SHOPIFY_MULTIPASS_SECRET` in .env
   - Restart application

2. **Check token expiration:**
   - Multipass tokens expire after 10 minutes
   - Ensure customer uses token immediately
   - Check server time synchronization

3. **Verify customer data:**
   - Email must be valid
   - Customer must exist in Shopify
   - Check customer status (not disabled)

### Issue: OAuth Fails

**Symptoms:**
- "OAuth authentication failed" error
- Redirect loop
- "Invalid authorization code" error

**Diagnosis:**

1. **Check OAuth configuration:**
   ```bash
   # Verify credentials are set
   echo $GOOGLE_CLIENT_ID
   echo $GOOGLE_CLIENT_SECRET
   ```

2. **Check redirect URI:**
   - Must match exactly in Google Console
   - Include protocol (https://)
   - No trailing slash

3. **Check logs:**
   ```bash
   grep "OAuth" logs/combined.log | tail -20
   ```

**Solutions:**

1. **Verify redirect URI:**
   - Go to Google Cloud Console
   - Check authorized redirect URIs
   - Add: `https://your-app-url.com/api/auth/oauth/google/callback`

2. **Check OAuth scopes:**
   - Verify required scopes are enabled
   - Default: openid, email, profile

3. **Clear OAuth state:**
   - Clear browser cookies
   - Try incognito mode
   - Use different browser

4. **Regenerate credentials:**
   - Create new OAuth client in Google Console
   - Update credentials in app
   - Test with new credentials

---

## Configuration Issues

### Issue: Settings Not Saving

**Symptoms:**
- Admin panel changes don't persist
- Settings revert after refresh
- "Failed to save settings" error

**Diagnosis:**

1. **Check Redis connection:**
   ```bash
   redis-cli ping
   redis-cli GET "settings:shop"
   ```

2. **Check permissions:**
   ```bash
   # Verify write permissions
   ls -la uploads/
   ```

3. **Check logs:**
   ```bash
   grep "settings" logs/error.log
   ```

**Solutions:**

1. **Verify Redis is running:**
   ```bash
   sudo systemctl status redis
   # or
   docker ps | grep redis
   ```

2. **Check Redis memory:**
   ```bash
   redis-cli INFO memory
   
   # If memory is full, increase maxmemory
   redis-cli CONFIG SET maxmemory 2gb
   ```

3. **Clear settings cache:**
   ```bash
   redis-cli DEL "settings:*"
   ```

### Issue: Logo Upload Fails

**Symptoms:**
- "Failed to upload logo" error
- Logo doesn't appear after upload
- File size error

**Solutions:**

1. **Check file size:**
   - Maximum: 5MB
   - Compress large images
   - Use PNG or JPG format

2. **Check upload directory:**
   ```bash
   # Verify directory exists and is writable
   ls -la uploads/logos/
   chmod 755 uploads/logos/
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

4. **Check file permissions:**
   ```bash
   # Ensure app can write to uploads
   chown -R nodejs:nodejs uploads/
   ```

---

## Performance Issues

### Issue: Slow Response Times

**Symptoms:**
- API requests take > 1 second
- Timeout errors
- Customers complain about slow login

**Diagnosis:**

1. **Check response times:**
   ```bash
   # Test API endpoint
   time curl https://your-app-url.com/health
   ```

2. **Check Redis latency:**
   ```bash
   redis-cli --latency
   redis-cli --latency-history
   ```

3. **Check CPU and memory:**
   ```bash
   top
   htop
   pm2 monit
   ```

**Solutions:**

1. **Scale application:**
   ```bash
   # Add more instances
   pm2 scale shopify-sms-auth +2
   ```

2. **Optimize Redis:**
   ```bash
   # Enable Redis pipelining
   # Increase connection pool size
   # Use Redis cluster for high load
   ```

3. **Add caching:**
   - Cache Shopify API responses
   - Cache settings in memory
   - Use CDN for static assets

4. **Optimize database queries:**
   - Add indexes
   - Use connection pooling
   - Batch operations

### Issue: High Memory Usage

**Symptoms:**
- Application crashes with OOM error
- Memory usage grows over time
- Slow performance

**Diagnosis:**

1. **Check memory usage:**
   ```bash
   pm2 monit
   free -h
   ```

2. **Check for memory leaks:**
   ```bash
   # Enable heap snapshots
   node --inspect dist/index.js
   ```

**Solutions:**

1. **Increase memory limit:**
   ```bash
   # In PM2 ecosystem.config.js
   max_memory_restart: '1G'
   ```

2. **Restart periodically:**
   ```bash
   # Auto-restart daily
   pm2 start ecosystem.config.js --cron-restart="0 0 * * *"
   ```

3. **Fix memory leaks:**
   - Review event listeners
   - Close database connections
   - Clear intervals and timeouts

---

## Integration Issues

### Issue: Shopify Webhooks Not Working

**Symptoms:**
- Order confirmation OTPs not sent
- Webhook endpoint returns errors
- No webhook logs

**Diagnosis:**

1. **Check webhook configuration:**
   - Go to Shopify Admin > Settings > Notifications
   - Verify webhook URL is correct
   - Check webhook status

2. **Test webhook endpoint:**
   ```bash
   curl -X POST https://your-app-url.com/api/webhooks/shopify/orders/create \
     -H "Content-Type: application/json" \
     -H "X-Shopify-Topic: orders/create" \
     -d '{"id": 123, "order_number": 1001}'
   ```

3. **Check HMAC validation:**
   ```bash
   grep "HMAC" logs/combined.log
   ```

**Solutions:**

1. **Verify webhook URL:**
   - Must be publicly accessible
   - Must use HTTPS
   - Must return 200 OK

2. **Check HMAC secret:**
   - Verify `SHOPIFY_API_SECRET` is correct
   - Test HMAC validation

3. **Review webhook logs:**
   - Check Shopify webhook delivery logs
   - Look for error responses
   - Verify payload format

### Issue: SMS Provider Webhook Not Working

**Symptoms:**
- Delivery status not updated
- DLR webhook returns errors
- No delivery receipts

**Solutions:**

1. **Verify webhook URL:**
   - Configure in SMS provider dashboard
   - Must be publicly accessible
   - Format: `https://your-app-url.com/api/webhooks/sms-dlr`

2. **Check webhook format:**
   - Different providers use different formats
   - Verify payload parsing
   - Check logs for errors

3. **Test webhook:**
   ```bash
   # Test with sample payload
   curl -X POST https://your-app-url.com/api/webhooks/sms-dlr \
     -H "Content-Type: application/json" \
     -d '{
       "message_id": "test123",
       "status": "delivered"
     }'
   ```

---

## Error Reference

### Error Codes

| Code | Description | Common Causes | Solution |
|------|-------------|---------------|----------|
| `VALIDATION_ERROR` | Invalid input data | Wrong format, missing fields | Check input format |
| `AUTHENTICATION_ERROR` | Invalid credentials | Wrong OTP, expired token | Request new code |
| `RATE_LIMIT_ERROR` | Too many requests | Exceeded rate limit | Wait and retry |
| `EXTERNAL_SERVICE_ERROR` | External API failed | Provider down, network issue | Check provider status |
| `INTERNAL_ERROR` | Server error | Bug, misconfiguration | Check logs |

### Common Error Messages

**"Invalid phone number format"**
- Use E.164 format: +1234567890
- Include country code
- No spaces or special characters

**"Please wait X seconds before requesting another code"**
- Cooldown period active
- Wait specified time
- Don't spam requests

**"Too many failed verification attempts"**
- Phone blocked for 15 minutes
- Wait for block to expire
- Use different authentication method

**"Session expired"**
- Session older than 30 days
- Log in again
- Enable "Remember me"

**"Unable to send SMS at this time"**
- SMS provider issue
- Check provider status
- Try again later
- Use different authentication method

---

## Debug Mode

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug

# Restart application
pm2 restart shopify-sms-auth
```

### View Debug Logs

```bash
# Real-time logs
pm2 logs shopify-sms-auth --lines 100

# Filter by level
grep "DEBUG" logs/combined.log

# Filter by component
grep "SMSService" logs/combined.log
```

### Debug Specific Components

**SMS Service:**
```bash
# Enable SMS debug
DEBUG=sms:* npm start
```

**OAuth Service:**
```bash
# Enable OAuth debug
DEBUG=oauth:* npm start
```

**Redis:**
```bash
# Monitor Redis commands
redis-cli MONITOR
```

---

## Getting Support

### Before Contacting Support

1. **Check this troubleshooting guide**
2. **Review application logs**
3. **Test with different browsers/devices**
4. **Verify configuration**
5. **Check provider status pages**

### Information to Include

When contacting support, provide:

1. **Error Details:**
   - Exact error message
   - Error code
   - Request ID (from error response)
   - Timestamp

2. **Environment:**
   - Node.js version
   - Operating system
   - Deployment method (Docker, PM2, etc.)
   - Browser (for customer issues)

3. **Logs:**
   ```bash
   # Export recent logs
   tail -100 logs/error.log > error-logs.txt
   tail -100 logs/combined.log > combined-logs.txt
   ```

4. **Steps to Reproduce:**
   - What you were trying to do
   - Steps taken
   - Expected vs actual result

5. **Configuration:**
   - Enabled authentication methods
   - SMS providers configured
   - OAuth providers configured
   - (Don't include secrets!)

### Contact Information

**Technical Support:**
- Email: support@your-app-domain.com
- Priority Support: priority@your-app-domain.com
- Documentation: https://docs.your-app-domain.com

**Emergency Support:**
- For production outages
- Email: emergency@your-app-domain.com
- Include "URGENT" in subject line

### Response Times

- **Standard Support**: 24-48 hours
- **Priority Support**: 4-8 hours
- **Emergency Support**: 1-2 hours

---

## Additional Resources

- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [User Guide](./USER_GUIDE.md)
- [GitHub Issues](https://github.com/your-org/shopify-sms-auth/issues)
- [Status Page](https://status.your-app-domain.com)

---

## Preventive Maintenance

### Daily Checks

- Monitor error rates
- Check SMS delivery success rate
- Review failed queue jobs
- Verify Redis memory usage

### Weekly Checks

- Review application logs
- Check for security updates
- Test all authentication methods
- Verify webhook delivery

### Monthly Checks

- Update dependencies
- Review and optimize performance
- Test disaster recovery
- Audit security settings
- Review SMS costs

---

## Known Issues

### Issue: Rate Limiting Too Aggressive

**Status**: Known limitation

**Workaround**: Adjust rate limit settings in .env:
```bash
RATE_LIMIT_MAX_REQUESTS=20  # Increase from 10
```

### Issue: Some Countries Don't Support Alphanumeric Sender ID

**Status**: Provider limitation

**Workaround**: Use numeric sender ID (phone number) for those countries

### Issue: Multipass Requires Shopify Plus

**Status**: Shopify limitation

**Workaround**: None - Shopify Plus required for this app

---

This troubleshooting guide is regularly updated. Last updated: January 2024
