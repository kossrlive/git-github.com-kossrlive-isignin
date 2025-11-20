/**
 * Admin Routes
 * Handles admin panel endpoints for app configuration
 * Requirements: 12.2
 */

import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import { logger } from '../config/logger.js';
import { ValidationError } from '../errors/index.js';
import { SettingsService } from '../services/SettingsService.js';

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/logos/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  }
});

export function createAdminRouter(settingsService: SettingsService): Router {
  const router = Router();

  /**
   * GET /api/admin/settings
   * Fetch current settings from shop metafields
   * Requirements: 12.2
   */
  router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      logger.info('Fetching admin settings', { requestId });

      // Requirement 12.2: Fetch settings from shop metafields
      const settings = await settingsService.getSettings();

      logger.info('Admin settings fetched successfully', { requestId });

      res.status(200).json(settings);
    } catch (error) {
      logger.error('Failed to fetch admin settings', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  });

  /**
   * PUT /api/admin/settings
   * Save settings to shop metafields
   * Requirements: 12.2
   */
  router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      const settings = req.body;

      logger.info('Saving admin settings', { requestId });

      // Validate settings structure
      if (!settings) {
        throw new ValidationError('Settings data is required', {
          field: 'settings',
          message: 'Settings data is required'
        });
      }

      // Validate enabledMethods
      if (!settings.enabledMethods || typeof settings.enabledMethods !== 'object') {
        throw new ValidationError('Invalid enabledMethods structure', {
          field: 'enabledMethods',
          message: 'enabledMethods must be an object'
        });
      }

      // Validate that at least one auth method is enabled
      const { sms, email, google } = settings.enabledMethods;
      if (!sms && !email && !google) {
        throw new ValidationError('At least one authentication method must be enabled', {
          field: 'enabledMethods',
          message: 'At least one authentication method must be enabled'
        });
      }

      // Validate uiCustomization
      if (!settings.uiCustomization || typeof settings.uiCustomization !== 'object') {
        throw new ValidationError('Invalid uiCustomization structure', {
          field: 'uiCustomization',
          message: 'uiCustomization must be an object'
        });
      }

      // Validate primaryColor (hex color format)
      const { primaryColor, buttonStyle } = settings.uiCustomization;
      if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
        throw new ValidationError('Invalid primary color format', {
          field: 'primaryColor',
          message: 'Primary color must be a valid hex color (e.g., #000000)'
        });
      }

      // Validate buttonStyle
      const validButtonStyles = ['rounded', 'square', 'pill'];
      if (buttonStyle && !validButtonStyles.includes(buttonStyle)) {
        throw new ValidationError('Invalid button style', {
          field: 'buttonStyle',
          message: `Button style must be one of: ${validButtonStyles.join(', ')}`
        });
      }

      // Requirement 12.2: Save settings to shop metafields
      const savedSettings = await settingsService.saveSettings(settings);

      logger.info('Admin settings saved successfully', { requestId });

      res.status(200).json({
        success: true,
        settings: savedSettings,
        requestId
      });
    } catch (error) {
      logger.error('Failed to save admin settings', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  });

  /**
   * POST /api/admin/upload-logo
   * Upload logo file
   */
  router.post('/upload-logo', upload.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.requestId;

    try {
      if (!req.file) {
        throw new ValidationError('Logo file is required', {
          field: 'logo',
          message: 'Logo file is required'
        });
      }

      logger.info('Logo uploaded successfully', {
        requestId,
        filename: req.file.filename,
        size: req.file.size
      });

      // In a real implementation, you would upload this to a CDN or cloud storage
      // For now, we'll return a local URL
      const logoUrl = `/uploads/logos/${req.file.filename}`;

      res.status(200).json({
        success: true,
        url: logoUrl,
        requestId
      });
    } catch (error) {
      logger.error('Failed to upload logo', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  });

  return router;
}
