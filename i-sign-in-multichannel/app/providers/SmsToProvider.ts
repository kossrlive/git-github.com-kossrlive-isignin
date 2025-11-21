/**
 * SMS.to Provider Implementation
 * Implements ISMSProvider for sms.to API
 */

import type { AxiosError } from 'axios';
import axios from 'axios';
import { logger } from '../config/logger.js';
import type {
    DeliveryReceipt,
    DeliveryStatus,
    DeliveryStatusType,
    ISMSProvider,
    SendSMSParams,
    SendSMSResult
} from './ISMSProvider.js';

export class SmsToProvider implements ISMSProvider {
  readonly name = 'sms.to';
  readonly priority = 1;
  
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly apiBaseUrl = 'https://api.sms.to';
  
  constructor(apiKey: string, senderId: string) {
    if (!apiKey) {
      throw new Error('SMS.to API key is required');
    }
    if (!senderId) {
      throw new Error('SMS.to sender ID is required');
    }
    
    this.apiKey = apiKey;
    this.senderId = senderId;
  }
  
  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    try {
      logger.info('Sending SMS via sms.to', {
        provider: this.name,
        to: params.to,
        from: params.from || this.senderId
      });
      
      const response = await axios.post(
        `${this.apiBaseUrl}/sms/send`,
        {
          to: params.to,
          message: params.message,
          sender_id: params.from || this.senderId,
          callback_url: params.callbackUrl
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      const messageId = response.data.message_id || response.data.messageId || response.data.id;
      
      if (!messageId) {
        logger.error('SMS.to response missing message ID', {
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
      
      logger.info('SMS sent successfully via sms.to', {
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
      
      logger.error('Failed to send SMS via sms.to', {
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
      logger.info('Checking delivery status via sms.to', {
        provider: this.name,
        messageId
      });
      
      const response = await axios.get(
        `${this.apiBaseUrl}/sms/status/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 5000
        }
      );
      
      const status = this.mapStatusFromApi(response.data.status);
      
      return {
        messageId,
        status,
        timestamp: new Date(response.data.timestamp || Date.now()),
        error: response.data.error
      };
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to check delivery status via sms.to', {
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
      logger.info('Processing DLR webhook from sms.to', {
        provider: this.name,
        payload
      });
      
      const messageId = payload.message_id || payload.messageId || payload.id;
      const status = this.mapStatusFromApi(payload.status);
      const deliveredAt = payload.delivered_at || payload.deliveredAt 
        ? new Date(payload.delivered_at || payload.deliveredAt)
        : undefined;
      const failureReason = payload.failure_reason || payload.failureReason || payload.error;
      
      return {
        messageId,
        status,
        deliveredAt,
        failureReason
      };
      
    } catch (error) {
      logger.error('Failed to parse DLR webhook from sms.to', {
        provider: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        payload
      });
      
      throw new Error('Invalid webhook payload');
    }
  }
  
  async getBalance(): Promise<import('./ISMSProvider.js').BalanceInfo> {
    try {
      logger.info('Fetching account balance from sms.to', {
        provider: this.name
      });
      
      // SMS.to balance endpoint
      const response = await axios.get(
        `${this.apiBaseUrl}/balance`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 5000
        }
      );
      
      // SMS.to typically returns balance in credits
      const balance = parseFloat(response.data.balance || response.data.credits || 0);
      const currency = response.data.currency || 'Credits';
      
      logger.info('Successfully fetched sms.to balance', {
        provider: this.name,
        balance,
        currency
      });
      
      return {
        balance,
        currency,
        formattedBalance: `${balance.toFixed(2)} ${currency}`
      };
      
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to fetch balance from sms.to', {
        provider: this.name,
        error: axiosError.message,
        statusCode: axiosError.response?.status
      });
      
      // Return zero balance on error
      return {
        balance: 0,
        currency: 'Credits',
        formattedBalance: 'N/A'
      };
    }
  }

  private mapStatusFromApi(apiStatus: string): DeliveryStatusType {
    const statusLower = (apiStatus || '').toLowerCase();
    
    switch (statusLower) {
      case 'pending':
      case 'queued':
      case 'accepted':
        return 'pending';
      
      case 'sent':
      case 'dispatched':
        return 'sent';
      
      case 'delivered':
      case 'success':
        return 'delivered';
      
      case 'failed':
      case 'error':
      case 'rejected':
      case 'undelivered':
        return 'failed';
      
      default:
        logger.warn('Unknown SMS status from sms.to', {
          provider: this.name,
          status: apiStatus
        });
        return 'pending';
    }
  }
}
