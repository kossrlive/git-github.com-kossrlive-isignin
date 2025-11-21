/**
 * Logger configuration for the app
 * Includes automatic sensitive data masking
 * Requirement 9.4: Mask sensitive data in logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
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
}

export const logger = new Logger();
