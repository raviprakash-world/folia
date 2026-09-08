import type { OrderItem } from '@/types/order';

export interface PackageDetails {
  weightKg: number;
  dimensions: string;
}

/**
 * Deterministic mock package sizing — a real system would know actual
 * product weights/dims; this catalog doesn't track those, so this derives
 * a plausible figure from item count instead. Display-only estimate, never
 * used in any shipping-cost calculation (the backend's own shipping
 * estimate — see apps/api/src/shipping/shipping.service.ts's
 * DEFAULT_ESTIMATE_WEIGHT_KG — already used a real kg placeholder; this
 * was the one remaining lbs/inches holdout — P0-F).
 */
export function estimatePackageDetails(items: OrderItem[]): PackageDetails {
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const weightKg = Math.round((1 + totalQty * 0.8) * 10) / 10;
  const boxSize = totalQty <= 2 ? '30 x 25 x 20' : totalQty <= 5 ? '40 x 30 x 25' : '50 x 40 x 35';
  return { weightKg, dimensions: `${boxSize} cm` };
}
