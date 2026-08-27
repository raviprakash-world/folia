import { coupons } from '@/data/coupons';
import type { Coupon } from '@/types/cart';

const VALIDATION_DELAY_MS = 500;

export class CouponError extends Error {}

export async function validateCoupon(code: string, subtotal: number): Promise<Coupon> {
  await new Promise((resolve) => setTimeout(resolve, VALIDATION_DELAY_MS));

  const normalized = code.trim().toUpperCase();
  const coupon = coupons.find((c) => c.code === normalized);

  if (!coupon) {
    throw new CouponError("That code isn't valid.");
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    const remainder = (coupon.minSubtotal - subtotal).toFixed(2);
    throw new CouponError(`This code needs a $${coupon.minSubtotal} subtotal — add $${remainder} more.`);
  }

  return coupon;
}
