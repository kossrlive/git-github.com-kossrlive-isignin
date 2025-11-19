/**
 * SMS Provider Interface
 * Defines the contract for all SMS provider implementations
 */

export interface SendSMSParams {
  to: string;           // E.164 format phone number
  message: string;
  from?: string;        // Sender ID
  callbackUrl?: string; // DLR webhook URL
}

export interface SendSMSResult {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
}

export type DeliveryStatusType = 'pending' | 'sent' | 'delivered' | 'failed';

export interface DeliveryStatus {
  messageId: string;
  status: DeliveryStatusType;
  timestamp: Date;
  error?: string;
}

export interface DeliveryReceipt {
  messageId: string;
  status: DeliveryStatusType;
  deliveredAt?: Date;
  failureReason?: string;
}

export interface ISMSProvider {
  readonly name: string;
  readonly priority: number;
  
  sendSMS(params: SendSMSParams): Promise<SendSMSResult>;
  checkDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
  handleWebhook(payload: any): DeliveryReceipt;
}
