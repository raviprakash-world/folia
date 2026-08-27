import { Link } from 'react-router-dom';
import { MapPin, Package, Heart, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { OrderRow } from '@/components/order/OrderRow';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { useAddressStore } from '@/store/addressStore';
import { useOrderStore } from '@/store/orderStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useAddressBootstrap } from '@/hooks/useAddresses';

const statCards = [
  { key: 'addresses' as const, label: 'Saved addresses', Icon: MapPin, to: '/account/addresses' },
  { key: 'orders' as const, label: 'Orders placed', Icon: Package, to: '/account/orders' },
  { key: 'wishlist' as const, label: 'Wishlist items', Icon: Heart, to: '/wishlist' },
];

export default function AccountOverview() {
  useAddressBootstrap();
  const user = useAuthStore((s) => s.user);
  const addressCount = useAddressStore((s) => s.addresses.length);
  const orders = useOrderStore((s) => s.orders);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  if (!user) return null; // ProtectedRoute guarantees this never renders without a user

  const counts = { addresses: addressCount, orders: orders.length, wishlist: wishlistCount };

  return (
    <div>
      <PageHeader title={`Welcome back, ${user.firstName}`} description={user.email} />

      <div className="grid sm:grid-cols-3 gap-4 mb-12">
        {statCards.map(({ key, label, Icon, to }) => (
          <Link
            key={key}
            to={to}
            className="p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark hover:border-fern transition-colors"
          >
            <Icon size={16} className="text-fern mb-2" />
            <p className="font-display text-2xl font-semibold text-pine">{counts[key]}</p>
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
        <EmptyState
          title="No orders yet"
          description="Once you place an order, it'll show up here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.slice(0, 3).map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
