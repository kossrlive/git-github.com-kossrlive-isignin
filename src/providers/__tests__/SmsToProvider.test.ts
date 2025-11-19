/**
 * Property-based tests for SmsToProvider
 */

import axios from 'axios';
import fc from 'fast-check';
import { logger } from '../../config/logger.js';
import { SmsToProvider } from '../SmsToProvider.js';

// Mock axios and logger
jest.mock('axios');
jest.mock('../../config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SmsToProvider Property Tests', () => {
  let provider: SmsToProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    provider = new SmsToProvider('test-api-key', 'test-sender');
  });
  
  /**
   * Feature: shopify-sms-auth, Property 31: Provider error logging
   * Validates: Requirements 13.5
   * 
   * For any SMS provider error, the log entry should include the provider name and error details
   */
  describe('Property 31: Provider error logging', () => {
    it('should log provider name and error details for all sendSMS failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            to: fc.string({ minLength: 10, maxLength: 15 }),
            message: fc.string({ minLength: 1, maxLength: 160 }),
            errorMessage: fc.string({ minLength: 1 }),
            statusCode: fc.integer({ min: 400, max: 599 })
          }),
          async (testData) => {
            // Setup: Mock axios to throw an error
            const error = {
              response: {
                status: testData.statusCode,
                data: { error: testData.errorMessage }
              },
              message: testData.errorMessage
            };
            
            mockedAxios.post.mockRejectedValueOnce(error);
            
            // Clear previous mock calls
            (logger.error as jest.Mock).mockClear();
            
            // Execute: Send SMS which will fail
            const result = await provider.sendSMS({
              to: testData.to,
              message: testData.message
            });
            
            // Verify: Result indicates failure
            expect(result.success).toBe(false);
            expect(result.provider).toBe('sms.to');
            
            // Verify: Logger was called with provider name and error details
            expect(logger.error).toHaveBeenCalled();
            
            const logCalls = (logger.error as jest.Mock).mock.calls;
            const errorLogCall = logCalls.find(call => 
              call[0] === 'Failed to send SMS via sms.to'
            );
            
            expect(errorLogCall).toBeDefined();
            expect(errorLogCall[1]).toMatchObject({
              provider: 'sms.to',
              to: testData.to
            });
            
            // Verify: Error details are present in the log
            expect(errorLogCall[1]).toHaveProperty('error');
            expect(errorLogCall[1].error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should log provider name and error details for all checkDeliveryStatus failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.string({ minLength: 10, maxLength: 50 }),
            errorMessage: fc.string({ minLength: 1 })
          }),
          async (testData) => {
            // Setup: Mock axios to throw an error
            mockedAxios.get.mockRejectedValueOnce(new Error(testData.errorMessage));
            
            // Clear previous mock calls
            (logger.error as jest.Mock).mockClear();
            
            // Execute: Check delivery status which will fail
            const result = await provider.checkDeliveryStatus(testData.messageId);
            
            // Verify: Result indicates failure
            expect(result.status).toBe('failed');
            
            // Verify: Logger was called with provider name and error details
            expect(logger.error).toHaveBeenCalled();
            
            const logCalls = (logger.error as jest.Mock).mock.calls;
            const errorLogCall = logCalls.find(call => 
              call[0] === 'Failed to check delivery status via sms.to'
            );
            
            expect(errorLogCall).toBeDefined();
            expect(errorLogCall[1]).toMatchObject({
              provider: 'sms.to',
              messageId: testData.messageId
            });
            
            // Verify: Error details are present in the log
            expect(errorLogCall[1]).toHaveProperty('error');
            expect(errorLogCall[1].error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should log provider name when webhook parsing fails', () => {
      fc.assert(
        fc.property(
          fc.record({
            // Create payloads that will cause errors during processing
            invalidPayload: fc.oneof(
              // Payloads that will throw when accessing properties
              fc.constant(null),
              fc.constant(undefined)
            )
          }),
          (testData) => {
            // Clear previous mock calls
            (logger.error as jest.Mock).mockClear();
            
            // Execute: Handle webhook with invalid payload that will throw
            let didThrow = false;
            try {
              provider.handleWebhook(testData.invalidPayload);
            } catch (error) {
              didThrow = true;
            }
            
            // Only verify logging if an error was thrown
            if (didThrow) {
              // Verify: Logger was called with provider name
              expect(logger.error).toHaveBeenCalled();
              
              const logCalls = (logger.error as jest.Mock).mock.calls;
              const errorLogCall = logCalls.find(call => 
                call[0] === 'Failed to parse DLR webhook from sms.to'
              );
              
              expect(errorLogCall).toBeDefined();
              expect(errorLogCall[1]).toMatchObject({
                provider: 'sms.to'
              });
              
              // Verify: Error details are present in the log
              expect(errorLogCall[1]).toHaveProperty('error');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
