/**
 * Ported directly from apps/web/src/utils/refund.ts — same 3-minute
 * processing window (deliberately short so the processing → refunded
 * transition is actually observable in a demo session, not just a
 * theoretical state), same "derive at read time, never store 'refunded'
 * directly" design.
 */
const REFUND_PROCESSING_WINDOW_MS = 3 * 60 * 1000;

export type RefundStatus = 'processing' | 'refunded';

export function deriveRefundStatus(requestedAt: Date): RefundStatus {
  const elapsed = Date.now() - requestedAt.getTime();
  return elapsed >= REFUND_PROCESSING_WINDOW_MS ? 'refunded' : 'processing';
}

const CANCELLABLE_STATUSES = ['PROCESSING', 'CONFIRMED', 'SHIPPED'];
const RETURN_WINDOW_DAYS = 30;

/** Matches apps/web/src/utils/refund.ts's canCancelOrder exactly. */
export function canCancelOrder(
  status: string,
  hasExistingCancellation: boolean,
): boolean {
  return CANCELLABLE_STATUSES.includes(status) && !hasExistingCancellation;
}

/** Matches apps/web/src/utils/refund.ts's canReturnOrder exactly. */
export function canReturnOrder(
  status: string,
  hasExistingReturn: boolean,
  orderCreatedAt: Date,
): boolean {
  if (status !== 'DELIVERED' || hasExistingReturn) return false;
  const daysSinceOrder =
    (Date.now() - orderCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceOrder <= RETURN_WINDOW_DAYS;
}
