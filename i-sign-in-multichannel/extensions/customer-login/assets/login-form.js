/**
 * Customer Login Form JavaScript
 * Handles SMS, Email, and OAuth authentication flows
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE_URL = window.Shopify?.routes?.root || '/';
  const SHOP_DOMAIN = window.Shopify?.shop || '';

  // State management
  let currentPhone = '';
  let cooldownTimer = null;

  /**
   * Initialize the login form
   */
  function init() {
    const loginWrapper = document.querySelector('[data-customer-login]');
    if (!loginWrapper) return;

    setupTabs();
    setupSMSAuth();
    setupEmailAuth();
    setupOAuthAuth();
  }

  /**
   * Setup tab switching functionality
   */
  function setupTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    const forms = document.querySelectorAll('[data-form]');

    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const targetForm = this.getAttribute('data-tab');

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // Update active form
        forms.forEach(f => {
          if (f.getAttribute('data-form') === targetForm) {
            f.classList.add('active');
          } else {
            f.classList.remove('active');
          }
        });

        // Clear any error messages
        hideError();
        hideSuccess();
      });
    });
  }

  /**
   * Setup SMS authentication flow
   */
  function setupSMSAuth() {
    const sendButton = document.querySelector('[data-send-otp]');
    const verifyButton = document.querySelector('[data-verify-otp]');
    const resendButton = document.querySelector('[data-resend-otp]');
    const phoneInput = document.querySelector('[data-phone-input]');
    const otpInput = document.querySelector('[data-otp-input]');

    if (sendButton) {
      sendButton.addEventListener('click', handleSendOTP);
    }

    if (verifyButton) {
      verifyButton.addEventListener('click', handleVerifyOTP);
    }

    if (resendButton) {
      resendButton.addEventListener('click', handleResendOTP);
    }

    // Allow Enter key to submit
    if (phoneInput) {
      phoneInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          handleSendOTP();
        }
      });
    }

    if (otpInput) {
      otpInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          handleVerifyOTP();
        }
      });

      // Auto-format OTP input (numbers only)
      otpInput.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);
      });
    }
  }

  /**
   * Handle sending OTP
   */
  async function handleSendOTP() {
    const phoneInput = document.querySelector('[data-phone-input]');
    const sendButton = document.querySelector('[data-send-otp]');
    
    if (!phoneInput || !sendButton) return;

    const phoneNumber = phoneInput.value.trim();

    // Validate phone number
    if (!phoneNumber) {
      showError('Please enter your phone number');
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      showError('Please enter a valid phone number (e.g., +1234567890)');
      return;
    }

    // Show loading state
    setButtonLoading(sendButton, true);
    hideError();

    try {
      const response = await fetch(`${API_BASE_URL}api/auth/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          shop: SHOP_DOMAIN
        })
      });

      const data = await response.json();

      if (data.success) {
        currentPhone = phoneNumber;
        showSMSStep2();
        showSuccess('Code sent! Check your phone.');
        
        // Start cooldown timer if provided
        if (data.cooldownSeconds) {
          startCooldown(data.cooldownSeconds);
        }
      } else {
        showError(data.message || 'Failed to send code. Please try again.');
      }
    } catch (error) {
      console.error('SMS send error:', error);
      showError('Unable to send SMS. Please try another method.');
    } finally {
      setButtonLoading(sendButton, false);
    }
  }

  /**
   * Handle verifying OTP
   */
  async function handleVerifyOTP() {
    const otpInput = document.querySelector('[data-otp-input]');
    const verifyButton = document.querySelector('[data-verify-otp]');
    
    if (!otpInput || !verifyButton) return;

    const code = otpInput.value.trim();

    // Validate OTP
    if (!code || code.length !== 6) {
      showError('Please enter the 6-digit code');
      return;
    }

    // Show loading state
    setButtonLoading(verifyButton, true);
    hideError();

    try {
      const response = await fetch(`${API_BASE_URL}api/auth/sms/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: currentPhone,
          code: code,
          shop: SHOP_DOMAIN
        })
      });

      const data = await response.json();

      if (data.success && data.multipassUrl) {
        showSuccess('Verified! Redirecting...');
        // Redirect to Multipass URL
        setTimeout(() => {
          window.location.href = data.multipassUrl;
        }, 500);
      } else {
        showError(data.error || 'Invalid code. Please try again.');
      }
    } catch (error) {
      console.error('OTP verify error:', error);
      showError('Verification failed. Please try again.');
    } finally {
      setButtonLoading(verifyButton, false);
    }
  }

  /**
   * Handle resending OTP
   */
  async function handleResendOTP() {
    const resendButton = document.querySelector('[data-resend-otp]');
    
    if (!resendButton || !currentPhone) return;

    // Check if cooldown is active
    if (cooldownTimer) {
      showError('Please wait before requesting a new code');
      return;
    }

    // Reuse the send OTP logic
    await handleSendOTP();
  }

  /**
   * Setup email authentication flow
   */
  function setupEmailAuth() {
    const loginButton = document.querySelector('[data-email-login]');
    const emailInput = document.querySelector('[data-email-input]');
    const passwordInput = document.querySelector('[data-password-input]');

    if (loginButton) {
      loginButton.addEventListener('click', handleEmailLogin);
    }

    // Allow Enter key to submit
    if (emailInput) {
      emailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          handleEmailLogin();
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          handleEmailLogin();
        }
      });
    }
  }

  /**
   * Handle email login
   */
  async function handleEmailLogin() {
    const emailInput = document.querySelector('[data-email-input]');
    const passwordInput = document.querySelector('[data-password-input]');
    const loginButton = document.querySelector('[data-email-login]');
    
    if (!emailInput || !passwordInput || !loginButton) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validate inputs
    if (!email || !password) {
      showError('Please enter both email and password');
      return;
    }

    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    // Show loading state
    setButtonLoading(loginButton, true);
    hideError();

    try {
      const response = await fetch(`${API_BASE_URL}api/auth/email/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
          shop: SHOP_DOMAIN
        })
      });

      const data = await response.json();

      if (data.success && data.multipassUrl) {
        showSuccess('Success! Redirecting...');
        // Redirect to Multipass URL
        setTimeout(() => {
          window.location.href = data.multipassUrl;
        }, 500);
      } else {
        showError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch (error) {
      console.error('Email login error:', error);
      showError('Login failed. Please try again.');
    } finally {
      setButtonLoading(loginButton, false);
    }
  }

  /**
   * Setup OAuth authentication flow
   */
  function setupOAuthAuth() {
    const oauthButtons = document.querySelectorAll('[data-oauth-provider]');

    oauthButtons.forEach(button => {
      button.addEventListener('click', function() {
        const provider = this.getAttribute('data-oauth-provider');
        handleOAuthLogin(provider);
      });
    });
  }

  /**
   * Handle OAuth login
   */
  function handleOAuthLogin(provider) {
    if (!provider) return;

    hideError();

    // Build OAuth URL with return URL
    const returnUrl = window.location.href;
    const oauthUrl = `${API_BASE_URL}api/auth/oauth/${provider}?shop=${encodeURIComponent(SHOP_DOMAIN)}&returnUrl=${encodeURIComponent(returnUrl)}`;

    // Redirect to OAuth provider
    window.location.href = oauthUrl;
  }

  /**
   * Show SMS step 2 (OTP verification)
   */
  function showSMSStep2() {
    const step1 = document.querySelector('[data-sms-step="1"]');
    const step2 = document.querySelector('[data-sms-step="2"]');
    const phoneDisplay = document.querySelector('[data-phone-display]');

    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
    if (phoneDisplay) phoneDisplay.textContent = currentPhone;

    // Focus on OTP input
    const otpInput = document.querySelector('[data-otp-input]');
    if (otpInput) {
      setTimeout(() => otpInput.focus(), 100);
    }
  }

  /**
   * Start cooldown timer
   */
  function startCooldown(seconds) {
    const resendButton = document.querySelector('[data-resend-otp]');
    if (!resendButton) return;

    let remaining = seconds;
    resendButton.disabled = true;
    resendButton.textContent = `Resend Code (${remaining}s)`;

    cooldownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        resendButton.disabled = false;
        resendButton.textContent = 'Resend Code';
      } else {
        resendButton.textContent = `Resend Code (${remaining}s)`;
      }
    }, 1000);
  }

  /**
   * Set button loading state
   */
  function setButtonLoading(button, isLoading) {
    if (!button) return;

    const textSpan = button.querySelector('[data-button-text]');
    const loaderSpan = button.querySelector('[data-button-loader]');

    if (isLoading) {
      button.disabled = true;
      if (textSpan) textSpan.style.display = 'none';
      if (loaderSpan) loaderSpan.style.display = 'inline';
    } else {
      button.disabled = false;
      if (textSpan) textSpan.style.display = 'inline';
      if (loaderSpan) loaderSpan.style.display = 'none';
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    const errorDiv = document.querySelector('[data-error-message]');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Hide error message
   */
  function hideError() {
    const errorDiv = document.querySelector('[data-error-message]');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  /**
   * Show success message
   */
  function showSuccess(message) {
    const successDiv = document.querySelector('[data-success-message]');
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.style.display = 'block';
    }
  }

  /**
   * Hide success message
   */
  function hideSuccess() {
    const successDiv = document.querySelector('[data-success-message]');
    if (successDiv) {
      successDiv.style.display = 'none';
    }
  }

  /**
   * Validate phone number format (E.164)
   */
  function isValidPhoneNumber(phone) {
    // Basic E.164 validation: starts with +, followed by 1-15 digits
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  /**
   * Validate email format
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
