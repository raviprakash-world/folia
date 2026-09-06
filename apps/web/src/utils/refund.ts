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
 * for a return (and for a cancellation in mock mode) is derived from
 * elapsed time, not stored, so "refunded" can't be written back into the
 * order at request time. This computes the effective status for
 * display/filtering: a cancelled or returned order whose refund has
 * finished processing shows (and filters) as 'refunded'.
 *
 * Phase 6: a cancellation's refundStatus is real server-computed state in
 * real mode (OrdersService.requestCancellation attempts an actual
 * refund) — useReal trusts that value verbatim instead of re-deriving a
 * second, client-side opinion from elapsed time, which would show
 * "refunded" on a fixed 3-minute timer regardless of whether the real
 * refund actually succeeded. Returns aren't wired to a real refund yet,
 * so they always use the elapsed-time simulation regardless of useReal.
 */
export function getEffectiveOrderStatus(order: Order, useReal = false): OrderStatus {
  if (order.cancellation?.refundStatus) {
    const refunded = useReal
      ? order.cancellation.refundStatus === 'refunded'
      : deriveRefundStatus(order.cancellation.requestedAt) === 'refunded';
    return refunded ? 'refunded' : order.status;
  }
  if (order.returnRequest && deriveRefundStatus(order.returnRequest.requestedAt) === 'refunded') {
    return 'refunded';
  }
  return order.status;
}
