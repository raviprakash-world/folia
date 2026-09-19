import { ButtonLink } from '@/components/ui/ButtonLink';
import { useCartTotals } from '@/hooks/useCart';
import { useCartStore } from '@/store/cartStore';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import { formatCurrency } from '@/utils/currency';

/** Phone-only: keeps the total and the checkout button in reach while scrolling a long cart. */
export function CartCheckoutBar() {
  const { total, itemCount, subtotal } = useCartTotals();
  const shippingZip = useCartStore((s) => s.shippingZip);
  const shippingKnown = shippingZip !== null || subtotal >= FREE_SHIPPING_THRESHOLD;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-dark bg-stone-light/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-ink-soft">
            {shippingKnown ? 'Total' : 'Total before shipping'} ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </p>
          <p className="text-xl font-semibold tabular-nums text-ink">{formatCurrency(total)}</p>
        </div>
        <ButtonLink to="/checkout/shipping" size="lg" className="ml-auto min-w-40 flex-1 sm:flex-none">
          Checkout
        </ButtonLink>
      </div>
    </div>
  );
}
