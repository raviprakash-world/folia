import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { OrderRow } from '@/components/order/OrderRow';
import { Button } from '@/components/ui/Button';
import { useOrderStore } from '@/store/orderStore';

export default function AccountOrders() {
  const orders = useOrderStore((s) => s.orders);
  const hasHydrated = useOrderStore((s) => s.hasHydrated);

  return (
    <div>
      <PageHeader title="Orders" description="Your order history for this browser." />

      {!hasHydrated ? (
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-16 bg-stone-dark/40 rounded-[var(--radius-card)]" />
          <div className="h-16 bg-stone-dark/40 rounded-[var(--radius-card)]" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order, it'll show up here."
          action={
            <Button variant="primary">
              <Link to="/shop">Browse the shop</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
