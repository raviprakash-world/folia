import { Link } from 'react-router-dom';
import { Copy, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { ProductListing } from '@/components/product/ProductListing';
import { useCoupons } from '@/hooks/useCoupons';
import { useToastStore } from '@/store/toastStore';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import { formatDate } from '@/utils/currency';
import type { Coupon } from '@/types/cart';

function CouponCard({ coupon }: { coupon: Coupon }) {
  const showToast = useToastStore((s) => s.showToast);
  const summary = coupon.type === 'percent' ? `${coupon.value}% off` : `₹${coupon.value.toLocaleString('en-IN')} off`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(coupon.code);
      showToast('success', `Code ${coupon.code} copied — paste it in your cart.`);
    } catch {
      showToast('error', `Couldn't copy automatically. Your code is ${coupon.code}.`);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-6">
      <p className="font-display text-3xl font-semibold text-heading">{summary}</p>
      <p className="text-sm text-ink-soft">{coupon.description}</p>
      {coupon.expiresAt && <p className="text-xs text-ink-soft font-mono">Valid until {formatDate(coupon.expiresAt)}</p>}
      <div className="mt-auto flex items-center gap-3 pt-2">
        <code className="flex-1 rounded-[var(--radius-control)] border border-dashed border-fern bg-fern/10 px-3 py-2 font-mono text-sm font-medium tracking-wider text-fern-dark">
          {coupon.code}
        </code>
        <Button variant="outline" size="sm" icon={<Copy size={14} />} onClick={() => void copy()} aria-label={`Copy code ${coupon.code}`}>
          Copy
        </Button>
      </div>
    </article>
  );
}

function OffersHeader() {
  const { data: coupons, isLoading, isError } = useCoupons();

  return (
    <div className="mb-14">
      <PageHeader
        eyebrow="Offers"
        title="Special offers & discounts"
        description="Every discount that's available right now — coupon codes, free shipping, and products on sale."
      />

      <h2 className="font-display text-2xl font-semibold text-heading mb-5">Coupon codes</h2>
      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading offers…</p>
      ) : isError ? (
        <p className="text-sm text-ink-soft">Couldn&apos;t load coupon codes right now. Please try again in a moment.</p>
      ) : coupons && coupons.length > 0 ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon) => (
              <CouponCard key={coupon.code} coupon={coupon} />
            ))}
          </div>
          <p className="text-sm text-ink-soft mt-4">
            Enter a code in your{' '}
            <Link to="/cart" className="text-fern-dark underline hover:text-heading">
              cart
            </Link>{' '}
            to apply it. Codes can&apos;t be combined.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-soft">There are no coupon codes running right now.</p>
      )}

      <div className="mt-10 flex items-start gap-4 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-6">
        <Truck size={22} className="text-fern mt-0.5 shrink-0" />
        <div>
          <h2 className="font-display text-xl font-semibold text-heading">Free shipping over ₹{FREE_SHIPPING_THRESHOLD.toLocaleString('en-IN')}</h2>
          <p className="text-sm text-ink-soft mt-1">
            Standard delivery is free once your order passes ₹{FREE_SHIPPING_THRESHOLD.toLocaleString('en-IN')}. Below that, shipping is a flat rate shown before you pay.
          </p>
        </div>
      </div>

      <h2 className="font-display text-2xl font-semibold text-heading mt-14">On sale now</h2>
    </div>
  );
}

export default function Offers() {
  return <ProductListing title="Special offers & discounts" header={<OffersHeader />} fixedOnSale />;
}
