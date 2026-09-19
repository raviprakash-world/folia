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
  /** Marketplace Phase 16 — null for a Folia-owned line, or when the real cart API is off (mock cart lines never set this). */
  sellerName?: string | null;
  /** Primary product photo from the real cart API; local-cart lines fall back to the catalog lookup in CartLineItem. */
  imageUrl?: string | null;
  /** Display-only snapshot of the original price, so the cart can show what the shopper saves. Never used in totals. */
  compareAtPrice?: number | null;
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
  /** ISO timestamp; only set for coupons that expire. */
  expiresAt?: string;
}
