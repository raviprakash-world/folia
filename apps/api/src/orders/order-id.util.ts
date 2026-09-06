/**
 * Ported directly from apps/web/src/utils/orderId.ts — same format — so
 * an order created by this backend looks and behaves identically to one
 * the frontend's mock checkout already produces.
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
