// See users/user.types.ts's top-of-file comment for why these are hand-written.
import { deriveRefundStatus } from './refund.util';
export type DeliveryMethodType = 'STANDARD' | 'EXPRESS' | 'SAME_DAY' | 'PICKUP';
export type PaymentMethodType =
  'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NET_BANKING' | 'COD' | 'WALLET';

/** Mirrors apps/web/src/data/deliveryMethods.ts's deliveryMethodDefs exactly — same ids, costs, and ETAs. */
export const DELIVERY_METHOD_DEFS: Record<
  DeliveryMethodType,
  { cost: number; etaDays: string }
> = {
  STANDARD: { cost: 6.5, etaDays: '3–5 business days' },
  EXPRESS: { cost: 14, etaDays: '1–2 business days' },
  SAME_DAY: { cost: 19, etaDays: 'Today, by 9pm' },
  PICKUP: { cost: 0, etaDays: 'Ready in 2 hours' },
};

export const TAX_RATE = 0.08; // matches apps/web/src/utils/pricing.ts's TAX_RATE exactly

/** Snapshotted into Order.shippingAddressSnapshot/billingAddressSnapshot as-is at checkout time — this IS apps/web's Address shape (the exact output of addresses/address.types.ts's toPublicAddress), stored verbatim rather than reconstructed later from partial fields. */
export interface AddressSnapshot {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  deliveryInstructions?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  type: 'home' | 'office' | 'other';
  label?: string;
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  geo?: { lat: number; lng: number; source: 'mock' };
}

export type OrderStatus =
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED';

const statusToPublic: Record<OrderStatus, string> = {
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
  REFUNDED: 'refunded',
};

const deliveryMethodToPublic: Record<DeliveryMethodType, string> = {
  STANDARD: 'standard',
  EXPRESS: 'express',
  SAME_DAY: 'same-day',
  PICKUP: 'pickup',
};

const paymentMethodToPublic: Record<PaymentMethodType, string> = {
  CREDIT_CARD: 'credit-card',
  DEBIT_CARD: 'debit-card',
  UPI: 'upi',
  NET_BANKING: 'net-banking',
  COD: 'cod',
  WALLET: 'wallet',
};

export interface OrderItemRecord {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  variantId: string | null;
  variantLabel: string | null;
  price: { toNumber(): number };
  quantity: number;
}

export interface OrderRecord {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  items: OrderItemRecord[];
  subtotal: { toNumber(): number };
  discount: { toNumber(): number };
  couponCode: string | null;
  shippingCost: { toNumber(): number };
  tax: { toNumber(): number };
  total: { toNumber(): number };
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  deliveryMethod: DeliveryMethodType;
  estimatedDelivery: string;
  paymentMethod: PaymentMethodType;
  /** Always known at creation time (Phase 2): an Order row is only ever created once PaymentsService.confirmAndCreateOrder runs, by which point payment has already resolved — see Order.paymentDisplayLabel's schema comment. */
  paymentDisplayLabel: string;
  paymentTransactionId: string;
  /** Null until an admin actually ships the order (Phase 5) — see the Order.courierId schema comment. */
  courierId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  customerNotes: string | null;
  cancellation?: CancellationRequestRecord | null;
  returnRequest?: ReturnRequestRecord | null;
}

/** Matches apps/web/src/types/order.ts's Order exactly. cancellation/returnRequest are always null here — a freshly created order has neither; a later order-management phase owns setting them. */
export function toPublicOrder(order: OrderRecord) {
  return {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: statusToPublic[order.status],
    items: order.items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      categorySlug: item.categorySlug,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      price: item.price.toNumber(),
      quantity: item.quantity,
    })),
    subtotal: order.subtotal.toNumber(),
    discount: order.discount.toNumber(),
    couponCode: order.couponCode,
    shippingCost: order.shippingCost.toNumber(),
    tax: order.tax.toNumber(),
    total: order.total.toNumber(),
    shippingAddress: order.shippingAddressSnapshot,
    billingAddress: order.billingAddressSnapshot,
    deliveryMethod: deliveryMethodToPublic[order.deliveryMethod],
    estimatedDelivery: order.estimatedDelivery,
    payment: {
      method: paymentMethodToPublic[order.paymentMethod],
      displayLabel: order.paymentDisplayLabel,
      transactionId: order.paymentTransactionId,
    },
    courierId: order.courierId,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    customerNotes: order.customerNotes,
    cancellation: order.cancellation
      ? toPublicCancellation(order.cancellation)
      : null,
    returnRequest: order.returnRequest
      ? toPublicReturn(order.returnRequest)
      : null,
  };
}

export type CancellationReasonDb =
  | 'CHANGED_MIND'
  | 'FOUND_CHEAPER'
  | 'ORDERED_BY_MISTAKE'
  | 'SHIPPING_TOO_SLOW'
  | 'OTHER';
export type ReturnReasonDb =
  | 'NO_LONGER_NEEDED'
  | 'WRONG_ITEM'
  | 'DAMAGED_IN_TRANSIT'
  | 'NOT_AS_DESCRIBED'
  | 'CHANGED_MIND'
  | 'OTHER';

export const CANCELLATION_REASON_TO_DB: Record<string, CancellationReasonDb> = {
  'changed-mind': 'CHANGED_MIND',
  'found-cheaper': 'FOUND_CHEAPER',
  'ordered-by-mistake': 'ORDERED_BY_MISTAKE',
  'shipping-too-slow': 'SHIPPING_TOO_SLOW',
  other: 'OTHER',
};

export const RETURN_REASON_TO_DB: Record<string, ReturnReasonDb> = {
  'no-longer-needed': 'NO_LONGER_NEEDED',
  'wrong-item': 'WRONG_ITEM',
  'damaged-in-transit': 'DAMAGED_IN_TRANSIT',
  'not-as-described': 'NOT_AS_DESCRIBED',
  'changed-mind': 'CHANGED_MIND',
  other: 'OTHER',
};

const cancellationReasonToPublic: Record<CancellationReasonDb, string> = {
  CHANGED_MIND: 'changed-mind',
  FOUND_CHEAPER: 'found-cheaper',
  ORDERED_BY_MISTAKE: 'ordered-by-mistake',
  SHIPPING_TOO_SLOW: 'shipping-too-slow',
  OTHER: 'other',
};

const returnReasonToPublic: Record<ReturnReasonDb, string> = {
  NO_LONGER_NEEDED: 'no-longer-needed',
  WRONG_ITEM: 'wrong-item',
  DAMAGED_IN_TRANSIT: 'damaged-in-transit',
  NOT_AS_DESCRIBED: 'not-as-described',
  CHANGED_MIND: 'changed-mind',
  OTHER: 'other',
};

export interface CancellationRequestRecord {
  reason: CancellationReasonDb;
  note: string | null;
  hasRefund: boolean;
  requestedAt: Date;
}

export interface ReturnRequestRecord {
  reason: ReturnReasonDb;
  note: string | null;
  requestedAt: Date;
}

export function toPublicCancellation(c: CancellationRequestRecord) {
  return {
    requestedAt: c.requestedAt.toISOString(),
    reason: cancellationReasonToPublic[c.reason],
    note: c.note,
    refundStatus: c.hasRefund ? deriveRefundStatus(c.requestedAt) : null,
  };
}

export function toPublicReturn(r: ReturnRequestRecord) {
  return {
    requestedAt: r.requestedAt.toISOString(),
    reason: returnReasonToPublic[r.reason],
    note: r.note,
    refundStatus: deriveRefundStatus(r.requestedAt),
  };
}

/** One cart line as reserved at checkout time — carries the exact InventoryItem/StockReservation each line resolved to, so confirmAndCreateOrder commits precisely the same rows checkout reserved, never re-deriving "an" item for the product. */
export interface CheckoutSnapshotItem {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  variantId: string | null;
  variantLabel: string | null;
  price: number;
  quantity: number;
  inventoryItemId: string;
  reservationId: string;
}

/**
 * Everything PaymentsService.confirmAndCreateOrder needs to create the real
 * Order row once a Payment is confirmed — computed once at checkout time
 * (prices, coupon, shipping, the pre-generated order id, address
 * snapshots) and persisted verbatim on Payment.checkoutSnapshot until
 * confirmation reads it back. See that field's own schema.prisma comment
 * for why this exists at all: Phase 2 moves Order creation to AFTER
 * payment confirms, so nothing about the order can be computed fresh at
 * confirmation time — cart contents, prices, and address selections a
 * customer made at checkout could all have changed by then.
 *
 * No courierId/trackingNumber here (Phase 2 had them, deterministically
 * pre-assigned) — Phase 5 moves real courier assignment to actual ship
 * time (see Order.courierId's schema comment), which is necessarily
 * after this snapshot is taken.
 */
export interface CheckoutSnapshot {
  orderId: string;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingCost: number;
  tax: number;
  total: number;
  estimatedDelivery: string;
  deliveryMethod: DeliveryMethodType;
  customerNotes: string | null;
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  items: CheckoutSnapshotItem[];
}
