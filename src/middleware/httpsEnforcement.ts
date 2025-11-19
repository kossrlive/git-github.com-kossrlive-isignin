import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

/**
 * HTTPS enforcement middleware
 * Requirements: 9.5 - Require HTTPS for all endpoints
 */
export const httpsEnforcement = (req: Request, res: Response, next: NextFunction): void => {
  // Skip in development or if already secure
  if (process.env.NODE_ENV === 'development' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.hostname}${req.url}`;
  logger.warn('Redirecting HTTP request to HTTPS', { 
    originalUrl: req.url,
    ip: req.ip 
  });
  
  res.redirect(301, httpsUrl);
};
