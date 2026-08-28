import { isFarRegion } from '@/utils/region';
import { deliveryMethodDefs } from '@/data/deliveryMethods';
import type { DeliveryOptionBase } from '@/data/deliveryMethods';

const DELIVERY_CHECK_DELAY_MS = 500;
const FREE_SHIPPING_THRESHOLD = 75;

export interface DeliveryAvailability {
  postalCode: string;
  sameDayAvailable: boolean;
  options: (DeliveryOptionBase & { cost: number })[];
}

/**
 * Mock delivery-availability check, shared by the checkout Delivery step and
 * the address book's "delivery available in your area" indicator — one
 * function, two call sites, so they can never disagree about what "far
 * region" means (src/utils/region.ts).
 *
 * Same-Day is only offered for postal codes near the (fictional) Portland
 * depot; Standard/Express/Pickup are always offered. Free-shipping-threshold
 * logic mirrors the cart's shippingService for consistency, though the two
 * remain separate services since a checkout delivery *choice* and a cart
 * shipping *estimate* are different concerns (see README).
 */
export async function checkDeliveryAvailability(postalCode: string, subtotal: number): Promise<DeliveryAvailability> {
  await new Promise((resolve) => setTimeout(resolve, DELIVERY_CHECK_DELAY_MS));

  const farRegion = isFarRegion(postalCode);
  const sameDayAvailable = !farRegion;
  const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

  const options = deliveryMethodDefs
    .filter((def) => def.id !== 'same-day' || sameDayAvailable)
    .map((def) => ({
      ...def,
      cost: def.id === 'standard' && freeShipping ? 0 : def.baseCost,
    }));

  return { postalCode, sameDayAvailable, options };
}
