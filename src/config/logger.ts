import { randomUUID } from 'crypto';
import winston from 'winston';

/**
 * Logger configuration with request ID tracking
 * Requirements: 7.5 - Log request start, completion with method, path, IP, status, duration, auth method
 */

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'shopify-sms-auth' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          const reqId = requestId ? `[${requestId}]` : '';
          return `${timestamp} ${level} ${reqId}: ${message} ${metaStr}`;
        })
      ),
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json(),
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json(),
    }),
  ],
});

// If we're not in production, log to console with more detail
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

/**
 * Create a child logger with a specific request ID
 */
export const createRequestLogger = (requestId: string) => {
  return logger.child({ requestId });
};

/**
 * Generate a new request ID
 */
export const generateRequestId = (): string => {
  return randomUUID();
};
