import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { CouponInput } from './CouponInput';
import { ShippingEstimator } from './ShippingEstimator';
import { useCartTotals } from '@/hooks/useCart';
import { useCartStore } from '@/store/cartStore';
import { formatCurrency } from '@/utils/currency';

interface CartSummaryProps {
  showCheckoutButton?: boolean;
}

export function CartSummary({ showCheckoutButton = true }: CartSummaryProps) {
  const { subtotal, discount, shipping, tax, total } = useCartTotals();
  const shippingZip = useCartStore((s) => s.shippingZip);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-ink mb-2">Have a code?</p>
        <CouponInput />
      </div>

      <div>
        <p className="text-sm font-medium text-ink mb-2">Estimate shipping</p>
        <ShippingEstimator />
      </div>

      <dl className="flex flex-col gap-2 border-t border-stone-dark pt-4 font-mono text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="text-ink">{formatCurrency(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-fern-dark">Discount</dt>
            <dd className="text-fern-dark">-{formatCurrency(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">Shipping</dt>
          <dd className="text-ink">{shippingZip ? formatCurrency(shipping) : 'Enter PIN'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Tax</dt>
          <dd className="text-ink">{formatCurrency(tax)}</dd>
        </div>
        <div className="flex justify-between text-base font-medium border-t border-stone-dark pt-2 mt-1">
          <dt className="text-ink">Total</dt>
          <dd className="text-heading">{formatCurrency(total)}</dd>
        </div>
      </dl>

      {showCheckoutButton && (
        <Button variant="primary" size="lg" className="w-full">
          <Link to="/checkout/shipping">Proceed to checkout</Link>
        </Button>
      )}
    </div>
  );
}
