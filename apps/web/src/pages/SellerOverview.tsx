import { Link } from 'react-router-dom';
import { Wallet, Package, ShoppingBag, Clock } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { TableWidget } from '@/components/admin/TableWidget';
import { Tag } from '@/components/ui/Tag';
import { useSellerProfile, useRealSellersApi } from '@/hooks/useSellerProfile';
import { useSellerProductsList } from '@/hooks/useSellerProducts';
import { useSellerOrdersList } from '@/hooks/useSellerOrders';
import { useSellerBalance } from '@/hooks/useSellerEarnings';
import { orderGroupStatusTone } from '@/utils/sellerOrderStatus';
import { formatCurrency, formatDate } from '@/utils/currency';
import type { SellerOrderGroup } from '@/types/sellerDashboard';

export default function SellerOverview() {
  const { profile } = useSellerProfile();
  const { items: products } = useSellerProductsList();
  const { items: recentOrders } = useSellerOrdersList(undefined, 1, 5);
  const { balance } = useSellerBalance();

  if (!useRealSellersApi) {
    return (
      <div>
        <PageHeader title="Seller dashboard" />
        <p className="text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      </div>
    );
  }

  const activeProducts = products.filter((p) => p.approvalStatus === 'ACTIVE').length;
  const pendingProducts = products.filter((p) =>
    ['SUBMITTED', 'UNDER_REVIEW'].includes(p.approvalStatus)
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow={profile?.status}
        title={`Welcome back${profile ? `, ${profile.displayName}` : ''}`}
        description="A real-time look at your storefront's earnings, listings, and orders."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Available balance" value={formatCurrency(balance)} Icon={Wallet} />
        <StatCard label="Active products" value={activeProducts} Icon={Package} />
        <StatCard label="Awaiting review" value={pendingProducts} Icon={Clock} />
        <StatCard label="Recent orders" value={recentOrders.length} Icon={ShoppingBag} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-heading">Your recent orders</h2>
          <Link to="/seller/orders" className="text-sm text-fern underline">
            View all
          </Link>
        </div>
        <TableWidget
          caption="Your most recent orders"
          emptyMessage="No orders yet — once a customer buys one of your products, it will show up here."
          rows={recentOrders}
          keyExtractor={(g: SellerOrderGroup) => g.id}
          columns={[
            {
              key: 'order',
              label: 'Order',
              render: (g: SellerOrderGroup) => (
                <Link to={`/seller/orders/${g.id}`} className="text-fern underline">
                  {g.orderId}
                </Link>
              ),
            },
            { key: 'items', label: 'Items', render: (g: SellerOrderGroup) => g.items.length },
            { key: 'net', label: 'Net proceeds', align: 'right', render: (g: SellerOrderGroup) => formatCurrency(g.netProceeds) },
            { key: 'date', label: 'Placed', render: (g: SellerOrderGroup) => formatDate(g.createdAt) },
            {
              key: 'status',
              label: 'Status',
              render: (g: SellerOrderGroup) => <Tag tone={orderGroupStatusTone[g.status]}>{g.status}</Tag>,
            },
          ]}
        />
      </div>
    </div>
  );
}
