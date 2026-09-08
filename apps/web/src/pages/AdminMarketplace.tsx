import { Link } from 'react-router-dom';
import { IndianRupee, Percent, Users, Package, Wallet, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { TableWidget } from '@/components/admin/TableWidget';
import { useMarketplaceAnalytics, useRealAdminApi } from '@/hooks/useAdminMarketplace';
import { formatCurrency } from '@/utils/currency';

const QUICK_LINKS = [
  { to: '/admin/marketplace/sellers', label: 'Seller applications', description: 'Review, approve, and manage sellers.' },
  { to: '/admin/marketplace/products', label: 'Product moderation', description: 'Approve or reject seller-submitted listings.' },
  { to: '/admin/marketplace/commissions', label: 'Commission rates', description: 'Set the marketplace default and per-seller overrides.' },
  { to: '/admin/marketplace/payouts', label: 'Payouts', description: 'View seller balances and pay out real proceeds.' },
];

export default function AdminMarketplace() {
  const { data, isLoading } = useMarketplaceAnalytics();

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Marketplace" />
        <p className="text-sm text-ink-soft">
          Marketplace management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Marketplace" />
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Marketplace" description="Real GMV split, seller status, and everything awaiting your review." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Seller GMV" value={formatCurrency(data.gmv.sellerGmv)} Icon={IndianRupee} />
        <StatCard label="Folia GMV" value={formatCurrency(data.gmv.foliaGmv)} Icon={TrendingUp} />
        <StatCard label="Commission collected" value={formatCurrency(data.gmv.commissionCollected)} Icon={Percent} />
        <StatCard label="Active sellers" value={data.sellers.byStatus.ACTIVE ?? 0} Icon={Users} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Link
          to="/admin/marketplace/sellers"
          className="rounded-[var(--radius-card)] border border-stone-dark p-4 hover:border-fern transition-colors"
        >
          <Users size={16} className="text-fern mb-2" aria-hidden="true" />
          <p className="font-display text-2xl font-semibold text-heading">{data.pending.sellersAwaitingReview}</p>
          <p className="text-xs text-ink-soft mt-0.5">Sellers awaiting review</p>
        </Link>
        <Link
          to="/admin/marketplace/products"
          className="rounded-[var(--radius-card)] border border-stone-dark p-4 hover:border-fern transition-colors"
        >
          <Package size={16} className="text-fern mb-2" aria-hidden="true" />
          <p className="font-display text-2xl font-semibold text-heading">{data.pending.productsAwaitingReview}</p>
          <p className="text-xs text-ink-soft mt-0.5">Products awaiting review</p>
        </Link>
        <Link
          to="/admin/marketplace/payouts"
          className="rounded-[var(--radius-card)] border border-stone-dark p-4 hover:border-fern transition-colors"
        >
          <Wallet size={16} className="text-fern mb-2" aria-hidden="true" />
          <p className="font-display text-2xl font-semibold text-heading">{data.pending.payoutsPending}</p>
          <p className="text-xs text-ink-soft mt-0.5">Payouts pending</p>
        </Link>
      </div>

      <div className="mb-10">
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Top sellers by revenue</h2>
        <TableWidget
          caption="Top sellers by revenue"
          emptyMessage="No seller sales yet."
          rows={data.topSellers}
          keyExtractor={(s) => s.sellerId}
          columns={[
            { key: 'seller', label: 'Seller', render: (s) => s.displayName },
            { key: 'revenue', label: 'Revenue', align: 'right', render: (s) => formatCurrency(s.revenue) },
          ]}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4 hover:border-fern transition-colors"
          >
            <h3 className="text-sm font-medium text-ink">{link.label}</h3>
            <p className="text-xs text-ink-soft mt-1">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
