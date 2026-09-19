import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, Sparkles, Tag, Truck } from 'lucide-react';
import { useCoupons } from '@/hooks/useCoupons';
import { useProducts } from '@/hooks/useProducts';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import type { Coupon } from '@/types/cart';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function couponText(c: Coupon) {
  const off = c.type === 'percent' ? `${c.value}% off` : `${inr(c.value)} off`;
  return `Use ${c.code} for ${off}${c.minSubtotal ? ` on orders over ${inr(c.minSubtotal)}` : ''}`;
}

function Item({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}

/** A scrolling ticker above the header. Every figure comes from live data (the delivery threshold, the coupons the API lists, the products on sale), so it never advertises an offer that has ended. It pauses on hover/focus and via the button, and holds still for anyone who prefers reduced motion. */
export function AnnouncementBar() {
  const [paused, setPaused] = useState(false);
  const { data: coupons } = useCoupons();
  const { data: sale } = useProducts({ onSale: true, page: 1, pageSize: 1 });
  const saleCount = sale?.total ?? 0;

  const items = (
    <>
      <Item icon={<Truck size={16} />}>Free delivery on orders over {inr(FREE_SHIPPING_THRESHOLD)}</Item>
      {coupons?.slice(0, 2).map((c) => (
        <Item key={c.code} icon={<Tag size={16} />}>
          {couponText(c)}
        </Item>
      ))}
      {saleCount > 0 && (
        <Item icon={<Sparkles size={16} />}>
          {saleCount} {saleCount === 1 ? 'product' : 'products'} on sale now
        </Item>
      )}
      <Link to="/offers" className="shrink-0 whitespace-nowrap underline underline-offset-2 hover:no-underline">
        See all offers
      </Link>
    </>
  );

  return (
    <div
      role="region"
      aria-label="Offers"
      data-paused={paused}
      className="announce bg-ochre text-pine text-sm font-medium"
    >
      <div className="announce-viewport py-2 pr-10">
        <div className="announce-track">
          <div className="announce-group">{items}</div>
          <div className="announce-group" aria-hidden="true" inert>
            {items}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? 'Play announcements' : 'Pause announcements'}
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-ochre p-1.5 text-pine hover:bg-ochre-light"
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  );
}
