import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Pagination } from '@/components/common/Pagination';
import { Tag } from '@/components/ui/Tag';
import { useSellerOrdersList, useRealSellersApi } from '@/hooks/useSellerOrders';
import { orderGroupStatusTone } from '@/utils/sellerOrderStatus';
import { formatCurrency, formatDate } from '@/utils/currency';
import type { SellerOrderGroup, OrderGroupStatus } from '@/types/sellerDashboard';

const STATUS_TABS: (OrderGroupStatus | 'ALL')[] = [
  'ALL',
  'PROCESSING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const PAGE_SIZE = 20;

export default function SellerOrders() {
  const [status, setStatus] = useState<OrderGroupStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const { items, total, isLoading } = useSellerOrdersList(status === 'ALL' ? undefined : status, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function selectStatus(next: OrderGroupStatus | 'ALL') {
    setStatus(next);
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Your orders" description="Every order containing at least one of your products." />

      {!useRealSellersApi ? (
        <p className="mt-10 text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={status === tab}
                onClick={() => selectStatus(tab)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  status === tab
                    ? 'border-fern bg-fern text-stone-light'
                    : 'border-stone-dark text-ink-soft hover:border-fern'
                }`}
              >
                {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
          ) : (
            <TableWidget
              caption={`Orders filtered to ${status === 'ALL' ? 'all statuses' : status}`}
              emptyMessage="No orders in this queue."
              rows={items}
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
                { key: 'subtotal', label: 'Subtotal', align: 'right', render: (g: SellerOrderGroup) => formatCurrency(g.subtotal) },
                { key: 'net', label: 'Net proceeds', align: 'right', render: (g: SellerOrderGroup) => formatCurrency(g.netProceeds) },
                { key: 'placed', label: 'Placed', render: (g: SellerOrderGroup) => formatDate(g.createdAt) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (g: SellerOrderGroup) => <Tag tone={orderGroupStatusTone[g.status]}>{g.status}</Tag>,
                },
              ]}
            />
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
