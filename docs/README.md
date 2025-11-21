# Shopify SMS Authentication App - Documentation

Welcome to the documentation for the Shopify SMS Authentication App. This comprehensive documentation will help you install, configure, deploy, and use the application.

## 📚 Documentation Index

### For Developers

- **[API Documentation](./API.md)** - Complete API reference with endpoints, request/response examples, and error codes
- **[Deployment Guide](./DEPLOYMENT.md)** - Step-by-step deployment instructions, infrastructure requirements, and configuration
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues, diagnostics, and solutions

### For Merchants

- **[User Guide](./USER_GUIDE.md)** - Installation, configuration, and usage instructions for store owners

### Additional Resources

- **[Postman Collection](./postman/Shopify-SMS-Auth-API.postman_collection.json)** - Import into Postman for API testing
- **[OpenAPI Specification](./openapi/openapi.yaml)** - OpenAPI 3.0 spec for API documentation tools

---

## 🚀 Quick Start

### For Developers

1. **Read the [Deployment Guide](./DEPLOYMENT.md)** to set up infrastructure
2. **Configure environment variables** as described in the deployment guide
3. **Test the API** using the [Postman Collection](./postman/Shopify-SMS-Auth-API.postman_collection.json)
4. **Refer to [API Documentation](./API.md)** for endpoint details

### For Merchants

1. **Read the [User Guide](./USER_GUIDE.md)** for installation instructions
2. **Follow the setup wizard** in the admin panel
3. **Configure authentication methods** based on your needs
4. **Test the customer experience** before going live

---

## 📖 Documentation Overview

### API Documentation

The [API Documentation](./API.md) provides:
- Complete endpoint reference
- Request/response examples
- Authentication requirements
- Error codes and handling
- Rate limiting information
- Webhook specifications

**Use this when:**
- Integrating with the API
- Building custom features
- Debugging API issues
- Understanding error responses

### Deployment Guide

The [Deployment Guide](./DEPLOYMENT.md) covers:
- Infrastructure requirements
- Environment variable configuration
- Step-by-step deployment process
- Monitoring and logging setup
- Scaling considerations
- Security best practices

**Use this when:**
- Deploying to production
- Setting up development environment
- Configuring infrastructure
- Planning capacity
- Implementing monitoring

### User Guide

The [User Guide](./USER_GUIDE.md) explains:
- App installation process
- Admin panel configuration
- Authentication method setup
- UI customization options
- Customer authentication flows
- Common questions and answers

**Use this when:**
- Installing the app
- Configuring for your store
- Customizing the login experience
- Training staff
- Helping customers

### Troubleshooting Guide

The [Troubleshooting Guide](./TROUBLESHOOTING.md) helps with:
- Common issues and solutions
- Diagnostic procedures
- Error message reference
- Debug mode instructions
- Support contact information

**Use this when:**
- Experiencing issues
- Debugging problems
- Understanding error messages
- Before contacting support

---

## 🎯 Common Tasks

### Setting Up SMS Authentication

1. Sign up for SMS provider (sms.to or Twilio)
2. Get API credentials from provider dashboard
3. Configure credentials in app admin panel
4. Test SMS delivery
5. Enable SMS authentication for customers

**Detailed instructions:** [User Guide - SMS Configuration](./USER_GUIDE.md#step-1-configure-sms-provider)

### Deploying to Production

1. Set up Redis instance
2. Configure environment variables
3. Build and deploy application
4. Configure reverse proxy (Nginx)
5. Set up SSL certificate
6. Configure webhooks
7. Enable monitoring

**Detailed instructions:** [Deployment Guide](./DEPLOYMENT.md#deployment-steps)

### Customizing the Login Form

1. Access admin panel
2. Go to UI Customization
3. Choose primary color
4. Select button style
5. Upload logo
6. Preview changes
7. Save settings

**Detailed instructions:** [User Guide - Customization](./USER_GUIDE.md#customizing-the-login-form)

### Troubleshooting SMS Issues

1. Check SMS provider status
2. Verify API credentials
3. Check account balance
4. Review queue status
5. Check logs for errors
6. Test with different provider

**Detailed instructions:** [Troubleshooting Guide - SMS Issues](./TROUBLESHOOTING.md#sms-issues)

---

## 🔧 Technical Specifications

### System Requirements

**Application Server:**
- Node.js 18.x or higher
- 4GB RAM minimum
- 2 CPU cores minimum
- 20GB storage

**Redis:**
- Redis 7.x or higher
- 2GB RAM minimum
- TLS/SSL support
- Persistence enabled

**Network:**
- HTTPS support (SSL certificate)
- Public IP or domain
- Webhook endpoints accessible

### Supported Features

**Authentication Methods:**
- ✅ SMS OTP authentication
- ✅ Email/password authentication
- ✅ Google OAuth
- 🔄 Apple Sign-In (coming soon)
- 🔄 Facebook Login (coming soon)

**SMS Providers:**
- ✅ sms.to (primary)
- ✅ Twilio (secondary)
- ✅ Automatic fallback
- ✅ Provider rotation

**Security Features:**
- ✅ Rate limiting
- ✅ OTP expiration
- ✅ Account blocking
- ✅ HTTPS enforcement
- ✅ HMAC validation
- ✅ Password hashing (bcrypt)

**Additional Features:**
- ✅ Order confirmation via SMS
- ✅ Session persistence
- ✅ UI customization
- ✅ Multi-language support
- ✅ Admin configuration panel

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Shopify Storefront                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  App Extension (Login Form)                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shopify App Backend (Node.js)                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Routes (Express.js)                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Core Services                                              │ │
│  │  - AuthService, OTPService, SMSService                     │ │
│  │  - MultipassService, CustomerService                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Provider Implementations                                   │ │
│  │  - SmsToProvider, TwilioProvider                           │ │
│  │  - GoogleOAuthProvider                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Redis           │  │  Bull Queue      │
        │  - OTP storage   │  │  - SMS jobs      │
        │  - Rate limiting │  │  - Retry logic   │
        └──────────────────┘  └──────────────────┘
```

**Learn more:** [Deployment Guide - Architecture](./DEPLOYMENT.md#infrastructure-requirements)

---

## 🔐 Security

### Security Features

- **HTTPS Enforcement** - All traffic encrypted
- **Rate Limiting** - Prevents abuse and DoS attacks
- **OTP Expiration** - Codes expire after 5 minutes
- **Account Blocking** - Automatic blocking after failed attempts
- **Password Hashing** - bcrypt with cost factor 12
- **HMAC Validation** - Webhook signature verification
- **Session Security** - Secure token generation
- **PII Protection** - Sensitive data masked in logs

### Security Best Practices

1. **Use strong secrets** - Generate random secrets for production
2. **Enable TLS for Redis** - Encrypt data in transit
3. **Configure firewalls** - Restrict access to necessary ports
4. **Monitor logs** - Watch for suspicious activity
5. **Update regularly** - Keep dependencies up to date
6. **Backup Redis** - Regular backups of OTP and session data
7. **Rotate credentials** - Periodically rotate API keys and secrets

**Learn more:** [Deployment Guide - Security](./DEPLOYMENT.md#security-checklist)

---

## 📈 Monitoring

### Key Metrics

Monitor these metrics for optimal performance:

- **Request Latency** - p50, p95, p99 response times
- **Error Rate** - Percentage of failed requests
- **SMS Delivery Rate** - Percentage of successfully delivered SMS
- **Queue Depth** - Number of pending SMS jobs
- **Redis Memory** - Memory usage and hit rate
- **Authentication Success Rate** - Successful logins vs attempts

### Recommended Tools

- **APM**: New Relic, Datadog, AppDynamics
- **Logging**: ELK Stack, CloudWatch, Splunk
- **Uptime**: UptimeRobot, Pingdom, StatusCake
- **Alerts**: PagerDuty, Opsgenie, VictorOps

**Learn more:** [Deployment Guide - Monitoring](./DEPLOYMENT.md#monitoring-and-logging)

---

## 🆘 Getting Help

### Self-Service Resources

1. **Check [Troubleshooting Guide](./TROUBLESHOOTING.md)** for common issues
2. **Review [API Documentation](./API.md)** for endpoint details
3. **Consult [User Guide](./USER_GUIDE.md)** for configuration help
4. **Search [GitHub Issues](https://github.com/your-org/shopify-sms-auth/issues)** for similar problems

### Contact Support

**Technical Support:**
- Email: support@your-app-domain.com
- Documentation: https://docs.your-app-domain.com
- Status Page: https://status.your-app-domain.com

**When contacting support, include:**
- Error message and request ID
- Steps to reproduce
- Environment details
- Relevant log excerpts

**Response Times:**
- Standard: 24-48 hours
- Priority: 4-8 hours
- Emergency: 1-2 hours

---

## 🔄 Updates and Changelog

### Current Version: 1.0.0

**Features:**
- SMS authentication with sms.to and Twilio
- Email/password authentication
- Google OAuth integration
- Admin configuration panel
- UI customization
- Order confirmation via SMS
- Session persistence
- Multi-provider SMS support

### Upcoming Features

- Apple Sign-In
- Facebook Login
- Two-factor authentication
- Biometric authentication (WebAuthn)
- Advanced analytics dashboard
- Custom SMS templates

---

## 📝 Contributing

We welcome contributions! Please:

1. Read the [API Documentation](./API.md) to understand the system
2. Check [GitHub Issues](https://github.com/your-org/shopify-sms-auth/issues) for open tasks
3. Follow the coding standards
4. Write tests for new features
5. Update documentation

---

## 📄 License

This project is proprietary software. See LICENSE file for details.

---

## 🙏 Acknowledgments

Built with:
- Node.js & TypeScript
- Express.js
- Redis & Bull
- React & Shopify Polaris
- Shopify API & Multipass

Special thanks to:
- Shopify for the excellent API and documentation
- sms.to and Twilio for reliable SMS delivery
- The open-source community

---

## 📞 Support Channels

- **Documentation**: https://docs.your-app-domain.com
- **Email**: support@your-app-domain.com
- **Status Page**: https://status.your-app-domain.com
- **GitHub**: https://github.com/your-org/shopify-sms-auth
- **Community**: https://community.your-app-domain.com

---

**Last Updated:** January 2024

**Documentation Version:** 1.0.0
