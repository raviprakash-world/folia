/**
 * Admin status transitions cover ONLY the forward fulfillment pipeline —
 * PROCESSING → CONFIRMED → SHIPPED → DELIVERED. Deliberately excludes
 * CANCELLED/RETURNED/REFUNDED entirely: those already have dedicated,
 * side-effect-bearing endpoints (OrdersService.requestCancellation/
 * requestReturn, Phase 6) that create the actual CancellationRequest/
 * ReturnRequest records refund derivation depends on. Letting a generic
 * admin status-update endpoint set an order straight to CANCELLED would
 * produce a cancelled order with no CancellationRequest behind it — a
 * real data-integrity gap, not just an inconsistency.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PROCESSING: ['CONFIRMED'],
  CONFIRMED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
};

export const ADMIN_SETTABLE_STATUSES = [
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
] as const;

export function canTransitionStatus(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
