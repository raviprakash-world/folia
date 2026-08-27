import type { CartItem, Coupon } from '@/types/cart';

const TAX_RATE = 0.08;

export function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function computeDiscount(subtotal: number, coupon: Coupon | null): number {
  if (!coupon) return 0;
  const raw = coupon.type === 'percent' ? subtotal * (coupon.value / 100) : coupon.value;
  return Math.min(raw, subtotal);
}

export function computeTax(taxableAmount: number): number {
  return taxableAmount * TAX_RATE;
}

export function computeTotal(subtotal: number, discount: number, shipping: number, tax: number): number {
  return Math.max(0, subtotal - discount + shipping + tax);
}
