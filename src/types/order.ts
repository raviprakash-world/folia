import type { Address } from './address';

export type DeliveryMethodType = 'standard' | 'express' | 'same-day' | 'pickup';

export type PaymentMethodType = 'credit-card' | 'debit-card' | 'upi' | 'net-banking' | 'cod' | 'wallet';

export type OrderStatus = 'processing' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  variantLabel: string | null;
  price: number;
  quantity: number;
}

export interface PaymentSummary {
  method: PaymentMethodType;
  /** Masked — last 4 digits for cards, masked UPI id, bank name, etc. Never a full card/account number. */
  displayLabel: string;
  transactionId: string;
}

export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;

  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingCost: number;
  tax: number;
  total: number;

  shippingAddress: Address;
  billingAddress: Address;
  deliveryMethod: DeliveryMethodType;
  estimatedDelivery: string;

  payment: PaymentSummary;
}
