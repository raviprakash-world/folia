import { isFarRegion } from '@/utils/region';

const ESTIMATE_DELAY_MS = 450;
const FREE_SHIPPING_THRESHOLD = 75;

export class ShippingError extends Error {}

export interface ShippingRate {
  cost: number;
  etaDays: string;
}

/**
 * Cost is a flat rate keyed off the ZIP's first digit as a rough US-region
 * proxy (src/utils/region.ts — shared with the checkout delivery step and
 * address book, so this heuristic exists in exactly one place), unless the
 * order already clears the free-shipping threshold. A real implementation
 * would call a carrier rate API with package weight/dims — that's out of
 * scope for a portfolio mock backend.
 */
export async function estimateShippingRate(zip: string, subtotal: number): Promise<ShippingRate> {
  await new Promise((resolve) => setTimeout(resolve, ESTIMATE_DELAY_MS));

  if (!/^\d{5}$/.test(zip)) {
    throw new ShippingError('Enter a 5-digit ZIP code.');
  }

  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return { cost: 0, etaDays: '3–5 business days' };
  }

  const farRegion = isFarRegion(zip);
  return {
    cost: farRegion ? 9.5 : 6.5,
    etaDays: farRegion ? '4–6 business days' : '2–4 business days',
  };
}
