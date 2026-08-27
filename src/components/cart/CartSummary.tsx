import { useState } from 'react';
import { Info } from 'lucide-react';
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
  const [showCheckoutNote, setShowCheckoutNote] = useState(false);

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
          <dd className="text-ink">{shippingZip ? formatCurrency(shipping) : 'Enter ZIP'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Tax</dt>
          <dd className="text-ink">{formatCurrency(tax)}</dd>
        </div>
        <div className="flex justify-between text-base font-medium border-t border-stone-dark pt-2 mt-1">
          <dt className="text-ink">Total</dt>
          <dd className="text-pine">{formatCurrency(total)}</dd>
        </div>
      </dl>

      {showCheckoutButton && (
        <div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => setShowCheckoutNote(true)}>
            Proceed to checkout
          </Button>
          {showCheckoutNote && (
            <p className="flex gap-2 text-xs text-ink-soft mt-3 leading-relaxed">
              <Info size={14} className="shrink-0 mt-0.5" />
              This is a portfolio project — checkout isn't connected to a payment
              processor. In a production build, this would move to address and
              payment collection.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
