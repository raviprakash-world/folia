/** Composite key so the same product in different variants stays separate cart lines. */
export function buildLineId(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? 'none'}`;
}

export interface CartItem {
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  /** Unit price at the moment it was added — the cart doesn't retroactively track price changes. */
  price: number;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  /** Stock ceiling snapshotted at add-time. */
  maxQuantity: number;
}

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  addedAt: string;
}

export type CouponType = 'percent' | 'fixed';

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  description: string;
  minSubtotal?: number;
}
