import type { Address } from './address';

export type DeliveryMethodType = 'standard' | 'express' | 'same-day' | 'pickup';

export type PaymentMethodType = 'credit-card' | 'debit-card' | 'upi' | 'net-banking' | 'cod' | 'wallet';

export type OrderStatus = 'processing' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded';

/**
 * Granular delivery-tracking timeline, distinct from OrderStatus (the
 * coarse lifecycle bucket used for order-history filtering). A "shipped"
 * OrderStatus corresponds to somewhere between the 'shipped' and
 * 'out-for-delivery' TrackingStage, for example.
 */
export type TrackingStage =
  | 'order-placed'
  | 'payment-confirmed'
  | 'packed'
  | 'picked-up'
  | 'shipped'
  | 'in-transit'
  | 'out-for-delivery'
  | 'delivered';

export type CourierId = 'swiftpost' | 'cascade-express' | 'trailrunner' | 'northline' | 'quickhatch';

export type ReturnReason =
  | 'no-longer-needed'
  | 'wrong-item'
  | 'damaged-in-transit'
  | 'not-as-described'
  | 'changed-mind'
  | 'other';

export type CancellationReason = 'changed-mind' | 'found-cheaper' | 'ordered-by-mistake' | 'shipping-too-slow' | 'other';

export type RefundStatus = 'processing' | 'refunded';

export interface ReturnRequest {
  requestedAt: string;
  reason: ReturnReason;
  note: string | null;
  refundStatus: RefundStatus;
}

export interface CancellationRequest {
  requestedAt: string;
  reason: CancellationReason;
  note: string | null;
  refundStatus: RefundStatus | null; // null when nothing was ever charged (e.g. COD)
}

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  variantId: string | null;
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
  courierId: CourierId;
  trackingNumber: string;

  customerNotes: string | null;
  cancellation: CancellationRequest | null;
  returnRequest: ReturnRequest | null;
}
