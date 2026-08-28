import type { Order, OrderStatus, RefundStatus } from '@/types/order';

/** Short on purpose (3 minutes) so the processing → refunded transition is actually observable in a demo session. */
const REFUND_PROCESSING_WINDOW_MS = 3 * 60 * 1000;

export function deriveRefundStatus(requestedAt: string): RefundStatus {
  const elapsed = Date.now() - new Date(requestedAt).getTime();
  return elapsed >= REFUND_PROCESSING_WINDOW_MS ? 'refunded' : 'processing';
}

const CANCELLABLE_STATUSES: OrderStatus[] = ['processing', 'confirmed', 'shipped'];
const RETURN_WINDOW_DAYS = 30;

export function canCancelOrder(order: Order): boolean {
  return CANCELLABLE_STATUSES.includes(order.status) && !order.cancellation;
}

export function canReturnOrder(order: Order): boolean {
  if (order.status !== 'delivered' || order.returnRequest) return false;
  const daysSinceOrder = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceOrder <= RETURN_WINDOW_DAYS;
}

/**
 * The stored order.status stays 'cancelled' or 'returned' — refund status
 * is derived from elapsed time, not stored, so "refunded" can't be written
 * back into the order at request time. This computes the effective status
 * for display/filtering: a cancelled or returned order whose refund has
 * finished processing shows (and filters) as 'refunded'.
 */
export function getEffectiveOrderStatus(order: Order): OrderStatus {
  const refundRequestedAt = order.cancellation?.refundStatus ? order.cancellation.requestedAt : order.returnRequest?.requestedAt;
  if (refundRequestedAt && deriveRefundStatus(refundRequestedAt) === 'refunded') {
    return 'refunded';
  }
  return order.status;
}
