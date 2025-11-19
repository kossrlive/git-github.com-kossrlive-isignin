import { NextFunction, Request, Response } from 'express';
import { createRequestLogger, generateRequestId } from '../config/logger.js';

/**
 * Request logging middleware with request ID tracking
 * Requirements: 7.5 - Log request ID, method, path, IP, status, duration, auth method
 */

// Extend Express Request type to include requestId and logger
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger: ReturnType<typeof createRequestLogger>;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate and attach request ID
  req.requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.startTime = Date.now();
  
  // Create request-specific logger
  req.logger = createRequestLogger(req.requestId);

  // Log request start
  req.logger.info('Request started', {
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  // Capture response finish event
  const originalSend = res.send;
  res.send = function (data): Response {
    res.send = originalSend; // Restore original send
    
    const duration = Date.now() - req.startTime;
    
    // Log request completion
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      authMethod: (req as any).authMethod || 'none', // Will be set by auth middleware
    });

    return originalSend.call(this, data);
  };

  // Set request ID in response header
  res.setHeader('X-Request-ID', req.requestId);

  next();
};
