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

/**
 * No PENDING_PAYMENT here (Phase 1 briefly added it, Phase 2 removed it
 * along with the status itself — see schema.prisma's OrderStatus comment):
 * an Order row only ever exists once payment is already confirmed, so
 * "cancel before paying" is now "let the reservation expire/release
 * un-confirmed" (InventoryService.releaseExpiredReservations,
 * PaymentsService.expireStalePayments), not an Order-level cancellation.
 */
const CANCELLABLE_STATUSES = ['PROCESSING', 'CONFIRMED', 'SHIPPED'];

/** Matches apps/web/src/utils/refund.ts's canCancelOrder exactly. */
export function canCancelOrder(
  status: string,
  hasExistingCancellation: boolean,
): boolean {
  return CANCELLABLE_STATUSES.includes(status) && !hasExistingCancellation;
}

// The generic 30-day canReturnOrder that used to live here was removed in
// Phase 6D-3, along with the whole-order, always-auto-approved
// OrdersService.requestReturn() it backed — return/DOA eligibility is now
// claim-type-aware (return-policy.util.ts's isWithinReturnWindow, keyed
// off the real Order.deliveredAt, not order creation time) and enforced
// by ReturnsService.createClaim. See docs/PHASE_6D_MIGRATION_DESIGN.md.
