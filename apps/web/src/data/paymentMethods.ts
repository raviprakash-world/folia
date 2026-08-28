import type { PaymentMethodType } from '@/types/order';

export interface PaymentMethodDef {
  id: PaymentMethodType;
  label: string;
  description: string;
}

export const paymentMethodDefs: PaymentMethodDef[] = [
  { id: 'credit-card', label: 'Credit Card', description: 'Visa, Mastercard, Amex' },
  { id: 'debit-card', label: 'Debit Card', description: 'Visa, Mastercard' },
  { id: 'upi', label: 'UPI', description: 'Pay via any UPI app' },
  { id: 'net-banking', label: 'Net Banking', description: 'Pay directly from your bank' },
  { id: 'wallet', label: 'Wallet', description: 'Use your Folia wallet balance' },
  { id: 'cod', label: 'Cash on Delivery', description: 'Pay when your order arrives' },
];

export interface SavedCard {
  id: string;
  brand: 'Visa' | 'Mastercard';
  last4: string;
  expiry: string;
}

/** Mock saved cards — no real card data, ever. Selecting one still requires re-entering the CVV. */
export const savedCards: SavedCard[] = [
  { id: 'card1', brand: 'Visa', last4: '4242', expiry: '08/28' },
  { id: 'card2', brand: 'Mastercard', last4: '8210', expiry: '02/27' },
];

export const banks: string[] = [
  'Cascade Community Bank',
  'Pacific Trust',
  'Northwind Federal',
  'Harbor & Main Bank',
  'Evergreen Credit Union',
  'Union Point Bank',
];

/** Mock wallet balance for the Wallet payment method demo. */
export const walletBalance = 42.5;
