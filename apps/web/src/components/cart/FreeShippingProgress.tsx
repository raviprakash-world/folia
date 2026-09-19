import { Truck } from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import { formatCurrency } from '@/utils/currency';

/** Says how far the cart is from free delivery. The bar is decoration; the sentence carries the meaning. */
export function FreeShippingProgress({ subtotal }: { subtotal: number }) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  return (
    <div className="rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4">
      <p className="flex items-center gap-2 text-[15px] text-ink">
        <Truck size={18} className="shrink-0 text-fern" aria-hidden="true" />
        {remaining === 0 ? (
          <span className="font-medium">You&apos;ve unlocked free delivery</span>
        ) : (
          <span>
            Add <span className="font-semibold">{formatCurrency(remaining)}</span> more for free delivery
          </span>
        )}
      </p>
      <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-dark">
        <div className="h-full rounded-full bg-fern transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
