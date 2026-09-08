import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Pagination } from '@/components/common/Pagination';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { useAdminSellerProductsList, useRealAdminApi } from '@/hooks/useAdminMarketplace';
import { productApprovalStatusTone, productApprovalStatusLabel } from '@/utils/sellerProductStatus';
import { formatCurrency } from '@/utils/currency';
import type { AdminSellerProductStatusFilter } from '@/services/adminMarketplaceApiService';
import type { AdminSellerProductRecord } from '@/types/adminMarketplace';

const STATUS_TABS: { value: AdminSellerProductStatusFilter; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under-review', label: 'Under review' },
  { value: 'active', label: 'Live' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const PAGE_SIZE = 20;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type ReasonAction = 'reject' | 'request-changes';

export default function AdminSellerProducts() {
  const [status, setStatus] = useState<AdminSellerProductStatusFilter>('submitted');
  const [page, setPage] = useState(1);
  const { items, total, isLoading, approve, reject, requestChanges, deactivate } = useAdminSellerProductsList(
    status,
    page,
    PAGE_SIZE
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [reasonTarget, setReasonTarget] = useState<{ product: AdminSellerProductRecord; action: ReasonAction } | null>(null);
  const [reason, setReason] = useState('');

  function selectStatus(next: AdminSellerProductStatusFilter) {
    setStatus(next);
    setPage(1);
  }

  async function handleReasonSubmit() {
    if (!reasonTarget || !reason.trim()) return;
    if (reasonTarget.action === 'reject') {
      await reject.mutateAsync({ id: reasonTarget.product.id, reason });
    } else {
      await requestChanges.mutateAsync({ id: reasonTarget.product.id, reason });
    }
    setReasonTarget(null);
    setReason('');
  }

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Product moderation" />
        <p className="text-sm text-ink-soft">
          Product moderation requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Product moderation" description="Approve, reject, or request changes on seller-submitted listings." />

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

      {(approve.isError || deactivate.isError) && (
        <Alert tone="error" className="mb-4">
          {errorMessage(approve.error ?? deactivate.error, "Couldn't update that product.")}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      ) : (
        <TableWidget
          caption={`Seller products filtered to ${status}`}
          emptyMessage="No products in this queue."
          rows={items}
          keyExtractor={(p: AdminSellerProductRecord) => p.id}
          columns={[
            { key: 'name', label: 'Product', render: (p: AdminSellerProductRecord) => p.name },
            { key: 'seller', label: 'Seller', render: (p: AdminSellerProductRecord) => p.sellerDisplayName },
            { key: 'category', label: 'Category', render: (p: AdminSellerProductRecord) => p.categoryName },
            { key: 'price', label: 'Price', align: 'right', render: (p: AdminSellerProductRecord) => formatCurrency(p.price) },
            {
              key: 'status',
              label: 'Status',
              render: (p: AdminSellerProductRecord) => (
                <Tag tone={productApprovalStatusTone[p.approvalStatus]}>{productApprovalStatusLabel[p.approvalStatus]}</Tag>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (p: AdminSellerProductRecord) => (
                <div className="flex flex-wrap gap-2 justify-end">
                  {(p.approvalStatus === 'SUBMITTED' || p.approvalStatus === 'UNDER_REVIEW') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={approve.isPending}
                        onClick={() => void approve.mutateAsync(p.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="!border-rust !text-rust"
                        onClick={() => setReasonTarget({ product: p, action: 'reject' })}
                      >
                        Reject
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReasonTarget({ product: p, action: 'request-changes' })}>
                        Request changes
                      </Button>
                    </>
                  )}
                  {p.approvalStatus === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="!border-rust !text-rust"
                      disabled={deactivate.isPending}
                      onClick={() => void deactivate.mutateAsync(p.id)}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal
        open={!!reasonTarget}
        onClose={() => setReasonTarget(null)}
        title={reasonTarget?.action === 'reject' ? 'Reject this product?' : 'Request changes?'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            {reasonTarget?.product.name} — {reasonTarget?.product.sellerDisplayName}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason shown to the seller (required)"
            rows={3}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {(reject.isError || requestChanges.isError) && (
            <Alert tone="error">{errorMessage(reject.error ?? requestChanges.error, "Couldn't submit that decision.")}</Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReasonTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!reason.trim() || reject.isPending || requestChanges.isPending}
              onClick={() => void handleReasonSubmit()}
            >
              {reject.isPending || requestChanges.isPending ? 'Submitting…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
