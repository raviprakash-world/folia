// See users/user.types.ts's top-of-file comment for why these are hand-written.
export type CouponType = 'PERCENT' | 'FIXED';

export interface CouponRecord {
  code: string;
  type: CouponType;
  value: { toNumber(): number };
  description: string;
  minSubtotal: { toNumber(): number } | null;
  isActive: boolean;
  expiresAt: Date | null;
}

/** Matches apps/web/src/types/cart.ts's Coupon exactly. */
export function toPublicCoupon(coupon: CouponRecord) {
  return {
    code: coupon.code,
    type: coupon.type === 'PERCENT' ? ('percent' as const) : ('fixed' as const),
    value: coupon.value.toNumber(),
    description: coupon.description,
    minSubtotal: coupon.minSubtotal?.toNumber(),
  };
}
