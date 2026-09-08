import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Pagination } from '@/components/common/Pagination';
import { Tag } from '@/components/ui/Tag';
import { useAdminReturnsList, useRealAdminApi } from '@/hooks/useAdminReturns';
import { returnClaimStatusTone, returnClaimStatusLabel } from '@/utils/returnClaimStatus';
import { formatCurrency, formatDate } from '@/utils/currency';
import type { AdminReturnClaim, ReturnClaimStatus } from '@/types/returnClaim';

const STATUS_TABS: ReturnClaimStatus[] = [
  'pending',
  'approved',
  'rejected',
  'refund-issued',
  'store-credit-issued',
  'replacement-issued',
];

const PAGE_SIZE = 20;

export default function AdminReturns() {
  const [status, setStatus] = useState<ReturnClaimStatus>('pending');
  const [page, setPage] = useState(1);

  const { items, total, isLoading } = useAdminReturnsList(status, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function selectStatus(next: ReturnClaimStatus) {
    setStatus(next);
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Returns & DOA claims" description="Review, approve, and resolve customer return/DOA claims." />

      {useRealAdminApi ? (
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
                {returnClaimStatusLabel[tab]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
          ) : (
            <TableWidget
              caption={`Return/DOA claims filtered to ${returnClaimStatusLabel[status]}`}
              emptyMessage="No claims in this queue."
              rows={items}
              keyExtractor={(c: AdminReturnClaim) => c.id}
              columns={[
                {
                  key: 'order',
                  label: 'Order',
                  render: (c: AdminReturnClaim) => (
                    <Link to={`/admin/returns/${c.id}`} className="text-fern underline">
                      {c.orderId}
                    </Link>
                  ),
                },
                {
                  key: 'customer',
                  label: 'Customer',
                  render: (c: AdminReturnClaim) => `${c.customer.firstName} ${c.customer.lastName}`,
                },
                {
                  key: 'type',
                  label: 'Type',
                  render: (c: AdminReturnClaim) => (c.claimType === 'doa-claim' ? 'DOA / damage' : 'Standard return'),
                },
                { key: 'reason', label: 'Reason', render: (c: AdminReturnClaim) => c.reason.replace(/-/g, ' ') },
                {
                  key: 'value',
                  label: 'Claim value',
                  align: 'right',
                  render: (c: AdminReturnClaim) =>
                    formatCurrency(c.items.reduce((sum, item) => sum + item.claimedLineValue, 0)),
                },
                { key: 'requested', label: 'Requested', render: (c: AdminReturnClaim) => formatDate(c.requestedAt) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (c: AdminReturnClaim) => (
                    <Tag tone={returnClaimStatusTone[c.status]}>{returnClaimStatusLabel[c.status]}</Tag>
                  ),
                },
              ]}
            />
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <p className="mt-10 text-sm text-ink-soft">
          Returns management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      )}
    </div>
  );
}
