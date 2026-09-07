import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Pagination } from '@/components/common/Pagination';
import { Tag } from '@/components/ui/Tag';
import { useAdminSellersList, useRealAdminApi } from '@/hooks/useAdminMarketplace';
import { sellerStatusTone, sellerStatusLabel } from '@/utils/sellerStatus';
import { formatDate } from '@/utils/currency';
import type { AdminSellerStatusFilter } from '@/services/adminMarketplaceApiService';
import type { AdminSellerRecord } from '@/types/adminMarketplace';

const STATUS_TABS: { value: AdminSellerStatusFilter; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'under-review', label: 'Under review' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'all', label: 'All' },
];

const PAGE_SIZE = 20;

export default function AdminSellers() {
  const [status, setStatus] = useState<AdminSellerStatusFilter>('applied');
  const [page, setPage] = useState(1);
  const { items, total, isLoading } = useAdminSellersList(status, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function selectStatus(next: AdminSellerStatusFilter) {
    setStatus(next);
    setPage(1);
  }

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Sellers" />
        <p className="text-sm text-ink-soft">
          Seller management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Sellers" description="Review applications and manage every seller's account status." />

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => selectStatus(tab.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              status === tab.value ? 'border-fern bg-fern text-stone-light' : 'border-stone-dark text-ink-soft hover:border-fern'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      ) : (
        <TableWidget
          caption={`Sellers filtered to ${status}`}
          emptyMessage="No sellers in this queue."
          rows={items}
          keyExtractor={(s: AdminSellerRecord) => s.id}
          columns={[
            {
              key: 'name',
              label: 'Seller',
              render: (s: AdminSellerRecord) => (
                <Link to={`/admin/marketplace/sellers/${s.id}`} className="text-fern underline">
                  {s.displayName}
                </Link>
              ),
            },
            { key: 'contact', label: 'Contact', render: (s: AdminSellerRecord) => s.contactEmail },
            { key: 'applied', label: 'Applied', render: (s: AdminSellerRecord) => formatDate(s.appliedAt) },
            {
              key: 'status',
              label: 'Status',
              render: (s: AdminSellerRecord) => <Tag tone={sellerStatusTone[s.status]}>{sellerStatusLabel[s.status]}</Tag>,
            },
          ]}
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
