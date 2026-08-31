import { useMemo } from 'react';
import { useCartStore } from '@/store/cartStore';
import { computeSubtotal, computeDiscount, computeTax, computeTotal } from '@/utils/pricing';

export function useCartTotals() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const shippingCost = useCartStore((s) => s.shippingCost);

  return useMemo(() => {
    const subtotal = computeSubtotal(items);
    const discount = computeDiscount(subtotal, coupon);
    const shipping = shippingCost ?? 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = computeTax(taxableAmount);
    const total = computeTotal(subtotal, discount, shipping, tax);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return { subtotal, discount, shipping, tax, total, itemCount };
  }, [items, coupon, shippingCost]);
}

export function useCartItemCount(): number {
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const items = useCartStore((s) => s.items);
  return hasHydrated ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;
}
