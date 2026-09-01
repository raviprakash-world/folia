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
export type CourierIdDb =
  'SWIFTPOST' | 'CASCADE_EXPRESS' | 'TRAILRUNNER' | 'NORTHLINE' | 'QUICKHATCH';

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

const courierIdToPublic: Record<CourierIdDb, string> = {
  SWIFTPOST: 'swiftpost',
  CASCADE_EXPRESS: 'cascade-express',
  TRAILRUNNER: 'trailrunner',
  NORTHLINE: 'northline',
  QUICKHATCH: 'quickhatch',
};

/** Exported for OrdersService.getTracking, which needs this same mapping outside of toPublicOrder. */
export function courierIdToPublicName(id: CourierIdDb): string {
  return courierIdToPublic[id];
}

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
  paymentDisplayLabel: string;
  paymentTransactionId: string;
  courierId: CourierIdDb;
  trackingNumber: string;
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
    courierId: courierIdToPublic[order.courierId],
    trackingNumber: order.trackingNumber,
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
