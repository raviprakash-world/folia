import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { useCoupons } from '@/hooks/useCoupons';
import { useProducts } from '@/hooks/useProducts';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import type { Coupon } from '@/types/cart';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function couponText(c: Coupon) {
  const off = c.type === 'percent' ? `${c.value}% off` : `${inr(c.value)} off`;
  return `${c.code}: ${off}${c.minSubtotal ? ` over ${inr(c.minSubtotal)}` : ''}`;
}

/** A slim strip above the header. Every figure comes from live data (the delivery threshold, the coupons the API lists, the products on sale), so it never advertises an offer that has ended. */
export function AnnouncementBar() {
  const { data: coupons } = useCoupons();
  const { data: sale } = useProducts({ onSale: true, page: 1, pageSize: 1 });
  const saleCount = sale?.total ?? 0;

  return (
    <div role="region" aria-label="Offers" className="bg-ochre text-pine text-sm">
      <Container className="py-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center font-medium">
        <span className="inline-flex items-center gap-2">
          <Truck size={16} aria-hidden="true" />
          Free delivery on orders over {inr(FREE_SHIPPING_THRESHOLD)}
        </span>
        {coupons?.slice(0, 2).map((c) => (
          <span key={c.code} className="hidden sm:inline">
            {couponText(c)}
          </span>
        ))}
        {saleCount > 0 && <span className="hidden md:inline">{saleCount} products on sale</span>}
        <Link to="/offers" className="underline underline-offset-2 hover:no-underline">
          See all offers
        </Link>
      </Container>
    </div>
  );
}
