/**
 * Tests for TwilioProvider
 */

import axios from 'axios';
import { SendSMSParams } from '../ISMSProvider.js';
import { TwilioProvider } from '../TwilioProvider.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TwilioProvider', () => {
  let provider: TwilioProvider;
  const accountSid = 'AC1234567890abcdef1234567890abcdef';
  const authToken = 'test_auth_token';
  const fromNumber = '+1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new TwilioProvider(accountSid, authToken, fromNumber);
  });

  describe('constructor', () => {
    it('should create provider with correct name and priority', () => {
      expect(provider.name).toBe('twilio');
      expect(provider.priority).toBe(2);
    });

    it('should throw error if accountSid is missing', () => {
      expect(() => new TwilioProvider('', authToken, fromNumber)).toThrow('Twilio Account SID is required');
    });

    it('should throw error if authToken is missing', () => {
      expect(() => new TwilioProvider(accountSid, '', fromNumber)).toThrow('Twilio Auth Token is required');
    });

    it('should throw error if fromNumber is missing', () => {
      expect(() => new TwilioProvider(accountSid, authToken, '')).toThrow('Twilio from number is required');
    });
  });

  describe('sendSMS', () => {
    const params: SendSMSParams = {
      to: '+1987654321',
      message: 'Your OTP is 123456',
      callbackUrl: 'https://example.com/webhook'
    };

    it('should send SMS successfully', async () => {
      const mockResponse = {
        data: {
          sid: 'SM1234567890abcdef1234567890abcdef',
          status: 'queued',
          to: params.to,
          from: fromNumber,
          body: params.message
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await provider.sendSMS(params);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890abcdef1234567890abcdef');
      expect(result.provider).toBe('twilio');
      expect(result.error).toBeUndefined();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/Messages.json'),
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: accountSid,
            password: authToken
          }
        })
      );
    });

    it('should use custom from number if provided', async () => {
      const customFrom = '+9876543210';
      const paramsWithFrom = { ...params, from: customFrom };

      const mockResponse = {
        data: {
          sid: 'SM1234567890abcdef1234567890abcdef',
          status: 'queued'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await provider.sendSMS(paramsWithFrom);

      const callArgs = mockedAxios.post.mock.calls[0];
      const formData = callArgs[1] as string;
      expect(formData).toContain(`From=${encodeURIComponent(customFrom)}`);
    });

    it('should include StatusCallback if callbackUrl is provided', async () => {
      const mockResponse = {
        data: {
          sid: 'SM1234567890abcdef1234567890abcdef',
          status: 'queued'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await provider.sendSMS(params);

      const callArgs = mockedAxios.post.mock.calls[0];
      const formData = callArgs[1] as string;
      expect(formData).toContain(`StatusCallback=${encodeURIComponent(params.callbackUrl!)}`);
    });

    it('should handle missing message SID in response', async () => {
      const mockResponse = {
        data: {
          status: 'queued'
          // Missing sid
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await provider.sendSMS(params);

      expect(result.success).toBe(false);
      expect(result.messageId).toBe('');
      expect(result.error).toBe('Invalid response from SMS provider');
    });

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            code: 21211,
            message: 'Invalid To phone number'
          }
        },
        message: 'Request failed'
      };

      mockedAxios.post.mockRejectedValue(mockError);

      const result = await provider.sendSMS(params);

      expect(result.success).toBe(false);
      expect(result.messageId).toBe('');
      expect(result.provider).toBe('twilio');
      expect(result.error).toContain('SMS provider error');
    });
  });

  describe('checkDeliveryStatus', () => {
    const messageId = 'SM1234567890abcdef1234567890abcdef';

    it('should check delivery status successfully', async () => {
      const mockResponse = {
        data: {
          sid: messageId,
          status: 'delivered',
          date_updated: '2024-01-01T12:00:00Z',
          date_created: '2024-01-01T11:59:00Z'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await provider.checkDeliveryStatus(messageId);

      expect(result.messageId).toBe(messageId);
      expect(result.status).toBe('delivered');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/Messages/${messageId}.json`),
        expect.objectContaining({
          auth: {
            username: accountSid,
            password: authToken
          }
        })
      );
    });

    it('should handle API errors when checking status', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await provider.checkDeliveryStatus(messageId);

      expect(result.messageId).toBe(messageId);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Failed to check delivery status');
    });

    it('should map Twilio statuses correctly', async () => {
      const statusMappings = [
        { twilioStatus: 'queued', expectedStatus: 'pending' },
        { twilioStatus: 'sending', expectedStatus: 'sent' },
        { twilioStatus: 'sent', expectedStatus: 'sent' },
        { twilioStatus: 'delivered', expectedStatus: 'delivered' },
        { twilioStatus: 'undelivered', expectedStatus: 'failed' },
        { twilioStatus: 'failed', expectedStatus: 'failed' }
      ];

      for (const mapping of statusMappings) {
        mockedAxios.get.mockResolvedValue({
          data: {
            sid: messageId,
            status: mapping.twilioStatus,
            date_created: '2024-01-01T12:00:00Z'
          }
        });

        const result = await provider.checkDeliveryStatus(messageId);
        expect(result.status).toBe(mapping.expectedStatus);
      }
    });
  });

  describe('handleWebhook', () => {
    it('should parse Twilio webhook payload correctly', () => {
      const payload = {
        MessageSid: 'SM1234567890abcdef1234567890abcdef',
        MessageStatus: 'delivered',
        DateUpdated: '2024-01-01T12:00:00Z'
      };

      const result = provider.handleWebhook(payload);

      expect(result.messageId).toBe('SM1234567890abcdef1234567890abcdef');
      expect(result.status).toBe('delivered');
      expect(result.deliveredAt).toBeInstanceOf(Date);
      expect(result.failureReason).toBeUndefined();
    });

    it('should handle SmsSid as fallback', () => {
      const payload = {
        SmsSid: 'SM1234567890abcdef1234567890abcdef',
        SmsStatus: 'sent'
      };

      const result = provider.handleWebhook(payload);

      expect(result.messageId).toBe('SM1234567890abcdef1234567890abcdef');
      expect(result.status).toBe('sent');
    });

    it('should include error information if present', () => {
      const payload = {
        MessageSid: 'SM1234567890abcdef1234567890abcdef',
        MessageStatus: 'failed',
        ErrorCode: '30003',
        ErrorMessage: 'Unreachable destination handset'
      };

      const result = provider.handleWebhook(payload);

      expect(result.messageId).toBe('SM1234567890abcdef1234567890abcdef');
      expect(result.status).toBe('failed');
      expect(result.failureReason).toContain('30003');
      expect(result.failureReason).toContain('Unreachable destination handset');
    });

    it('should throw error for invalid webhook payload', () => {
      const invalidPayload = {
        // Missing required fields
      };

      expect(() => provider.handleWebhook(invalidPayload)).toThrow('Invalid webhook payload');
    });

    it('should map webhook statuses correctly', () => {
      const statusMappings = [
        { twilioStatus: 'queued', expectedStatus: 'pending' },
        { twilioStatus: 'sending', expectedStatus: 'sent' },
        { twilioStatus: 'sent', expectedStatus: 'sent' },
        { twilioStatus: 'delivered', expectedStatus: 'delivered' },
        { twilioStatus: 'undelivered', expectedStatus: 'failed' },
        { twilioStatus: 'failed', expectedStatus: 'failed' }
      ];

      for (const mapping of statusMappings) {
        const payload = {
          MessageSid: 'SM1234567890abcdef1234567890abcdef',
          MessageStatus: mapping.twilioStatus
        };

        const result = provider.handleWebhook(payload);
        expect(result.status).toBe(mapping.expectedStatus);
      }
    });
  });
});
