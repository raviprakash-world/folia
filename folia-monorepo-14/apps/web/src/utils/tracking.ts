import { couriers } from '@/data/couriers';
import type { CourierId } from '@/types/order';

/** Tiny deterministic string hash (not cryptographic) — just needs to be stable per order id. Exported so other modules (e.g. the tracking MSW handler) can derive consistent pseudo-random details from the same seed. */
export function hashOrderId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function assignCourier(orderId: string): CourierId {
  const index = hashOrderId(orderId) % couriers.length;
  return couriers[index]!.id;
}

export function generateTrackingNumber(orderId: string, courierId: CourierId): string {
  const prefix = courierId.slice(0, 2).toUpperCase();
  const digits = String(hashOrderId(orderId + courierId)).slice(0, 9).padStart(9, '0');
  return `${prefix}${digits}`;
}
