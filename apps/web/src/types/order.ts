import type { Address } from './address';

export type DeliveryMethodType = 'standard' | 'express' | 'same-day' | 'pickup';

export type PaymentMethodType = 'credit-card' | 'debit-card' | 'upi' | 'net-banking' | 'cod' | 'wallet';

/**
 * No 'pending-payment' (Phase 1 briefly added one, Phase 2 removed it):
 * an Order only ever exists once payment has already resolved — a real
 * gateway checkout awaiting Razorpay confirmation has a paymentId (see
 * paymentsApiService's CreatePaymentResult) but genuinely no order yet,
 * rather than an order sitting in a pending state.
 */
export type OrderStatus =
  | 'processing'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

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

/** The 5 fictional couriers used by the local/mock checkout path only (apps/web/src/utils/orderId.ts, apps/web/src/data/couriers.ts). A real order's Order.courierId (below) is plain free text — any real courier name a real aggregator returns — since Phase 5. */
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
  /** Masked — last 4 digits for cards, masked UPI id, bank name, etc. Never a full card/account number. Always known (Phase 2): an Order only ever exists once payment has already resolved. */
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
  /** Null until an admin actually ships the order (Phase 5) — real fulfillment now happens after checkout, not at it. */
  courierId: string | null;
  trackingNumber: string | null;
  /** A real, direct link to the shipment's tracking page on the courier/aggregator's own site, when the provider returns one. Always null in mock mode. */
  trackingUrl: string | null;

  customerNotes: string | null;
  cancellation: CancellationRequest | null;
  returnRequest: ReturnRequest | null;
}
