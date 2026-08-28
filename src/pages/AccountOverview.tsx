import { Link } from 'react-router-dom';
import { MapPin, Package, Heart, ArrowRight, Clock, TrendingUp, Award, Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { OrderRow } from '@/components/order/OrderRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ProductCard } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useAddressStore } from '@/store/addressStore';
import { useOrderStore } from '@/store/orderStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useAddressBootstrap } from '@/hooks/useAddresses';
import { getEffectiveOrderStatus } from '@/utils/refund';
import { formatCurrency } from '@/utils/currency';
import { products } from '@/data/products';

const ACTIVE_STATUSES = ['processing', 'confirmed', 'shipped'];

export default function AccountOverview() {
  useAddressBootstrap();
  const user = useAuthStore((s) => s.user);
  const addressCount = useAddressStore((s) => s.addresses.length);
  const orders = useOrderStore((s) => s.orders);
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const recentlyViewed = useRecentlyViewedStore((s) => s.items);
  const clearRecentlyViewed = useRecentlyViewedStore((s) => s.clearHistory);

  if (!user) return null; // ProtectedRoute guarantees this never renders without a user

  const activeOrderCount = orders.filter((o) => ACTIVE_STATUSES.includes(getEffectiveOrderStatus(o))).length;
  const deliveredOrderCount = orders.filter((o) => getEffectiveOrderStatus(o) === 'delivered').length;
  const totalSpend = orders.reduce((sum, o) => sum + o.total, 0);
  const totalSavings = orders.reduce((sum, o) => sum + o.discount, 0);
  // Mock loyalty program: 1 point per dollar spent, nothing more — no real rewards backend exists.
  const rewardPoints = Math.floor(totalSpend);

  const statCards = [
    { label: 'Total orders', value: orders.length, Icon: Package, to: '/account/orders' },
    { label: 'Active orders', value: activeOrderCount, Icon: Clock, to: '/account/orders' },
    { label: 'Delivered', value: deliveredOrderCount, Icon: Package, to: '/account/orders' },
    { label: 'Wishlist items', value: wishlistCount, Icon: Heart, to: '/wishlist' },
    { label: 'Saved addresses', value: addressCount, Icon: MapPin, to: '/account/addresses' },
    { label: 'Total savings', value: formatCurrency(totalSavings), Icon: TrendingUp, to: '/account/orders' },
    { label: 'Reward points', value: rewardPoints, Icon: Award, to: '/account/settings' },
  ];

  const recentlyViewedProducts = recentlyViewed
    .map((entry) => products.find((p) => p.id === entry.productId))
    .filter((p): p is (typeof products)[number] => !!p)
    .slice(0, 4);

  return (
    <div>
      <PageHeader title={`Welcome back, ${user.firstName}`} description={user.email} />

      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        {statCards.map(({ label, value, Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark hover:border-fern transition-colors"
          >
            <Icon size={16} className="text-fern mb-2" />
            <p className="font-display text-2xl font-semibold text-pine">{value}</p>
            <p className="text-xs text-ink-soft mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold text-pine">Recent orders</h2>
        {orders.length > 0 && (
          <Link to="/account/orders" className="flex items-center gap-1 text-sm text-fern hover:text-pine transition-colors">
            View all
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Once you place an order, it'll show up here." />
      ) : (
        <div className="flex flex-col gap-3 mb-14">
          {orders.slice(0, 3).map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}

      {recentlyViewedProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-pine flex items-center gap-2">
              <Eye size={17} className="text-fern" />
              Recently viewed
            </h2>
            <Button variant="ghost" size="sm" onClick={clearRecentlyViewed}>
              Clear history
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentlyViewedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
