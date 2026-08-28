import type { OrderItem } from '@/types/order';

export interface PackageDetails {
  weightLbs: number;
  dimensions: string;
}

/**
 * Deterministic mock package sizing — a real system would know actual
 * product weights/dims; this catalog doesn't track those, so this derives
 * a plausible figure from item count instead. Display-only estimate, never
 * used in any shipping-cost calculation.
 */
export function estimatePackageDetails(items: OrderItem[]): PackageDetails {
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const weightLbs = Math.round((2.5 + totalQty * 1.8) * 10) / 10;
  const boxSize = totalQty <= 2 ? '12 x 10 x 8' : totalQty <= 5 ? '16 x 12 x 10' : '20 x 16 x 14';
  return { weightLbs, dimensions: `${boxSize} in` };
}
