/**
 * Logger configuration for the app
 * Includes automatic sensitive data masking and severity levels
 * Requirement 9.4: Mask sensitive data in logs
 * Requirement 16.5: Log errors with appropriate severity levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogContext {
  [key: string]: any;
  severity?: LogLevel;
  errorType?: string;
  stack?: string;
}

class Logger {
  /**
   * Mask phone numbers in text
   * Shows only last 4 digits
   */
  private maskPhoneNumber(phone: string): string {
    if (!phone || phone.length <= 4) {
      return '****';
    }
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }

  /**
   * Mask email addresses
   * Shows first 2 chars of local part and domain
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return '****@****.***';
    }
    
    const [localPart, domain] = email.split('@');
    
    const maskedLocal = localPart.length <= 2 
      ? '**' 
      : localPart.slice(0, 2) + '****';
    
    const domainParts = domain.split('.');
    const maskedDomain = domainParts.length > 1
      ? domainParts[0].slice(0, 2) + '****.' + domainParts[domainParts.length - 1]
      : '****';
    
    return `${maskedLocal}@${maskedDomain}`;
  }

  /**
   * Mask credit card numbers
   * Shows only last 4 digits
   */
  private maskCreditCard(card: string): string {
    if (!card || card.length <= 4) {
      return '****';
    }
    return '**** **** **** ' + card.slice(-4);
  }

  /**
   * Recursively mask sensitive data in objects
   * Requirement 9.4: Mask phone numbers and emails in logs
   */
  private maskSensitiveData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      // Check if string looks like a phone number (E.164 format or similar)
      if (/^\+?[1-9]\d{1,14}$/.test(data) || /^\d{10,15}$/.test(data)) {
        return this.maskPhoneNumber(data);
      }
      
      // Check if string looks like an email
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
        return this.maskEmail(data);
      }
      
      // Check if string looks like a credit card
      if (/^\d{13,19}$/.test(data.replace(/\s/g, ''))) {
        return this.maskCreditCard(data);
      }
      
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    if (typeof data === 'object') {
      const masked: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        
        // Mask specific fields by name
        if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('tel')) {
          masked[key] = typeof value === 'string' ? this.maskPhoneNumber(value) : value;
        } else if (lowerKey.includes('email')) {
          masked[key] = typeof value === 'string' ? this.maskEmail(value) : value;
        } else if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('key')) {
          masked[key] = '***REDACTED***';
        } else if (lowerKey.includes('card') || lowerKey.includes('credit')) {
          masked[key] = typeof value === 'string' ? this.maskCreditCard(value) : value;
        } else {
          // Recursively mask nested objects
          masked[key] = this.maskSensitiveData(value);
        }
      }
      
      return masked;
    }

    return data;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    
    // Mask sensitive data in context
    const maskedContext = context ? this.maskSensitiveData(context) : undefined;
    
    const contextStr = maskedContext ? ` ${JSON.stringify(maskedContext)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    console.debug(this.formatMessage('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  /**
   * Log critical errors that require immediate attention
   * Use for system failures, data corruption, security breaches
   * Requirement 16.5: Log errors with appropriate severity levels
   */
  critical(message: string, context?: LogContext): void {
    console.error(this.formatMessage('critical', message, { ...context, severity: 'critical' }));
  }

  /**
   * Log error with automatic severity detection based on error type
   * Requirement 16.5: Log errors with appropriate severity levels
   * 
   * @param message - Error message
   * @param error - Error object or context
   * @param severity - Optional explicit severity level
   */
  logError(message: string, error?: Error | LogContext, severity?: LogLevel): void {
    let context: LogContext = {};
    let detectedSeverity: LogLevel = severity || 'error';

    // If error is an Error object, extract details
    if (error instanceof Error) {
      context = {
        errorType: error.name,
        errorMessage: error.message,
        stack: error.stack,
      };

      // Auto-detect severity based on error type
      if (!severity) {
        detectedSeverity = this.detectSeverity(error);
      }
    } else if (error) {
      context = error;
    }

    // Add severity to context
    context.severity = detectedSeverity;

    // Log with appropriate level
    switch (detectedSeverity) {
      case 'critical':
        this.critical(message, context);
        break;
      case 'error':
        this.error(message, context);
        break;
      case 'warn':
        this.warn(message, context);
        break;
      case 'info':
        this.info(message, context);
        break;
      case 'debug':
        this.debug(message, context);
        break;
    }
  }

  /**
   * Detect severity level based on error type
   * Requirement 16.5: Appropriate severity levels for different error types
   */
  private detectSeverity(error: Error): LogLevel {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    // Critical errors - system failures, security issues
    if (
      errorName.includes('security') ||
      errorName.includes('auth') ||
      errorMessage.includes('database connection') ||
      errorMessage.includes('redis connection') ||
      errorMessage.includes('corruption') ||
      errorMessage.includes('breach')
    ) {
      return 'critical';
    }

    // Errors - operational failures that need attention
    if (
      errorName.includes('error') ||
      errorName.includes('exception') ||
      errorMessage.includes('failed') ||
      errorMessage.includes('unable to')
    ) {
      return 'error';
    }

    // Warnings - recoverable issues
    if (
      errorName.includes('warning') ||
      errorMessage.includes('deprecated') ||
      errorMessage.includes('retry')
    ) {
      return 'warn';
    }

    // Default to error
    return 'error';
  }
}

export const logger = new Logger();
