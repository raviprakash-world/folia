export type PaymentMethodType =
  'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NET_BANKING' | 'COD' | 'WALLET';

export interface PaymentSummary {
  method: PaymentMethodType;
  transactionId: string;
  displayLabel: string;
}
