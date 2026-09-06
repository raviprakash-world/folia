/**
 * Admin status transitions cover the forward fulfillment pipeline —
 * PROCESSING → CONFIRMED → SHIPPED → DELIVERED — MINUS the one step that
 * now has its own dedicated, side-effect-bearing endpoint: CONFIRMED →
 * SHIPPED only ever happens via AdminOrdersController's POST .../ship
 * (Phase 5), which calls a real courier provider to actually create a
 * shipment and assign a courier/tracking number before flipping the
 * status — a generic status-only endpoint reaching SHIPPED would leave
 * an order marked shipped with no real shipment behind it. Same
 * reasoning CANCELLED/RETURNED/REFUNDED were already excluded for (see
 * OrdersService.requestCancellation/requestReturn, Phase 6): a real
 * side effect needs a real endpoint, not a bare status flip.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PROCESSING: ['CONFIRMED'],
  CONFIRMED: [],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
};

export const ADMIN_SETTABLE_STATUSES = ['CONFIRMED', 'DELIVERED'] as const;

export function canTransitionStatus(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
