/**
 * Twilio Provider Implementation
 * Implements ISMSProvider for Twilio API
 * Configured as secondary provider with priority 2
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../config/logger.js';
import {
    DeliveryReceipt,
    DeliveryStatus,
    DeliveryStatusType,
    ISMSProvider,
    SendSMSParams,
    SendSMSResult
} from './ISMSProvider.js';

export class TwilioProvider implements ISMSProvider {
  readonly name = 'twilio';
  readonly priority = 2; // Secondary provider
  
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly apiBaseUrl: string;
  
  constructor(accountSid: string, authToken: string, fromNumber: string) {
    if (!accountSid) {
      throw new Error('Twilio Account SID is required');
    }
    if (!authToken) {
      throw new Error('Twilio Auth Token is required');
    }
    if (!fromNumber) {
      throw new Error('Twilio from number is required');
    }
    
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
    this.apiBaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
  }
  
  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    try {
      logger.info('Sending SMS via Twilio', {
        provider: this.name,
        to: params.to,
        from: params.from || this.fromNumber
      });
      
      // Twilio expects form-urlencoded data
      const formData = new URLSearchParams();
      formData.append('To', params.to);
      formData.append('From', params.from || this.fromNumber);
      formData.append('Body', params.message);
      
      if (params.callbackUrl) {
        formData.append('StatusCallback', params.callbackUrl);
      }
      
      const response = await axios.post(
        `${this.apiBaseUrl}/Messages.json`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: this.accountSid,
            password: this.authToken
          },
          timeout: 10000
        }
      );
      
      const messageId = response.data.sid;
      
      if (!messageId) {
        logger.error('Twilio response missing message SID', {
          provider: this.name,
          response: response.data
        });
        
        return {
          success: false,
          messageId: '',
          provider: this.name,
          error: 'Invalid response from SMS provider'
        };
      }
      
      logger.info('SMS sent successfully via Twilio', {
        provider: this.name,
        messageId,
        to: params.to
      });
      
      return {
        success: true,
        messageId,
        provider: this.name
      };
      
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data 
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;
      
      logger.error('Failed to send SMS via Twilio', {
        provider: this.name,
        error: errorMessage,
        to: params.to,
        statusCode: axiosError.response?.status
      });
      
      return {
        success: false,
        messageId: '',
        provider: this.name,
        error: `SMS provider error: ${errorMessage}`
      };
    }
  }
  
  async checkDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    try {
      logger.info('Checking delivery status via Twilio', {
        provider: this.name,
        messageId
      });
      
      const response = await axios.get(
        `${this.apiBaseUrl}/Messages/${messageId}.json`,
        {
          auth: {
            username: this.accountSid,
            password: this.authToken
          },
          timeout: 5000
        }
      );
      
      const status = this.mapStatusFromApi(response.data.status);
      
      return {
        messageId,
        status,
        timestamp: new Date(response.data.date_updated || response.data.date_created || Date.now()),
        error: response.data.error_message
      };
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to check delivery status via Twilio', {
        provider: this.name,
        error: axiosError.message,
        messageId
      });
      
      return {
        messageId,
        status: 'failed',
        timestamp: new Date(),
        error: 'Failed to check delivery status'
      };
    }
  }
  
  handleWebhook(payload: any): DeliveryReceipt {
    try {
      logger.info('Processing DLR webhook from Twilio', {
        provider: this.name,
        payload
      });
      
      // Twilio sends MessageSid in webhook
      const messageId = payload.MessageSid || payload.SmsSid;
      
      if (!messageId) {
        throw new Error('Missing MessageSid or SmsSid in webhook payload');
      }
      
      const status = this.mapStatusFromApi(payload.MessageStatus || payload.SmsStatus);
      
      // Parse timestamp if available
      let deliveredAt: Date | undefined;
      if (status === 'delivered' && payload.DateUpdated) {
        deliveredAt = new Date(payload.DateUpdated);
      }
      
      const failureReason = payload.ErrorCode 
        ? `Error ${payload.ErrorCode}: ${payload.ErrorMessage || 'Unknown error'}`
        : undefined;
      
      return {
        messageId,
        status,
        deliveredAt,
        failureReason
      };
      
    } catch (error) {
      logger.error('Failed to parse DLR webhook from Twilio', {
        provider: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        payload
      });
      
      throw new Error('Invalid webhook payload');
    }
  }
  
  /**
   * Map Twilio status to our standard status types
   * Twilio statuses: queued, sending, sent, delivered, undelivered, failed
   */
  private mapStatusFromApi(apiStatus: string): DeliveryStatusType {
    const statusLower = (apiStatus || '').toLowerCase();
    
    switch (statusLower) {
      case 'queued':
      case 'accepted':
        return 'pending';
      
      case 'sending':
      case 'sent':
        return 'sent';
      
      case 'delivered':
        return 'delivered';
      
      case 'undelivered':
      case 'failed':
        return 'failed';
      
      default:
        logger.warn('Unknown SMS status from Twilio', {
          provider: this.name,
          status: apiStatus
        });
        return 'pending';
    }
  }
}
