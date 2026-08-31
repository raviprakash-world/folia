/**
 * Ported directly from apps/web/src/utils/orderId.ts and tracking.ts —
 * same formats, same deterministic hash — so an order created by this
 * backend looks and behaves identically to one the frontend's mock
 * checkout already produces.
 */
export function generateOrderId(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = Math.floor(1000 + Math.random() * 9000); // 4-digit
  return `FOL-${y}${m}${d}-${suffix}`;
}

/** Tiny deterministic string hash (not cryptographic) — just needs to be stable per order id, matching apps/web/src/utils/tracking.ts's hashOrderId exactly. */
export function hashOrderId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Order matters — this is the exact array apps/web/src/data/couriers.ts
// declares, and assignCourier's modulo indexing depends on that order.
const COURIER_IDS = [
  'SWIFTPOST',
  'CASCADE_EXPRESS',
  'TRAILRUNNER',
  'NORTHLINE',
  'QUICKHATCH',
] as const;
export type CourierId = (typeof COURIER_IDS)[number];

export function assignCourier(orderId: string): CourierId {
  const index = hashOrderId(orderId) % COURIER_IDS.length;
  return COURIER_IDS[index];
}

export function generateTrackingNumber(
  orderId: string,
  courierId: CourierId,
): string {
  // Matches apps/web's courierId.slice(0,2) on the *lowercase, hyphenated*
  // id (e.g. "sw" from "swiftpost", "ca" from "cascade-express") — not the
  // backend's SCREAMING_SNAKE_CASE enum value, so this maps back to that
  // exact display form first rather than slicing the enum name itself.
  const displayId = courierId.toLowerCase().replace(/_/g, '-');
  const prefix = displayId.slice(0, 2).toUpperCase();
  const digits = String(hashOrderId(orderId + displayId))
    .slice(0, 9)
    .padStart(9, '0');
  return `${prefix}${digits}`;
}
