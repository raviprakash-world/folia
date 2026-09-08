import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { useAdminSellerDetail, useRealAdminApi } from '@/hooks/useAdminMarketplace';
import { sellerStatusTone, sellerStatusLabel } from '@/utils/sellerStatus';
import { formatDate } from '@/utils/currency';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminSellerDetail() {
  const { id } = useParams<{ id: string }>();
  const { seller, isLoading, approve, reject, suspend, reactivate, deactivate } = useAdminSellerDetail(id);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendNote, setSuspendNote] = useState('');
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateNote, setDeactivateNote] = useState('');

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Seller" />
        <p className="text-sm text-ink-soft">
          Seller management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Seller" />
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      </div>
    );
  }

  if (!seller) {
    return (
      <div>
        <PageHeader title="Seller not found" />
        <Link to="/admin/marketplace/sellers" className="text-fern underline text-sm">
          Back to sellers
        </Link>
      </div>
    );
  }

  const canApproveReject = seller.status === 'APPLIED' || seller.status === 'UNDER_REVIEW';
  const canSuspend = seller.status === 'ACTIVE';
  const canDeactivate = seller.status === 'ACTIVE' || seller.status === 'SUSPENDED';
  const canReactivate = seller.status === 'SUSPENDED' || seller.status === 'DEACTIVATED';

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await reject.mutateAsync(rejectReason);
    setRejectOpen(false);
    setRejectReason('');
  }

  async function handleSuspend() {
    await suspend.mutateAsync(suspendNote || undefined);
    setSuspendOpen(false);
    setSuspendNote('');
  }

  async function handleDeactivate() {
    await deactivate.mutateAsync(deactivateNote || undefined);
    setDeactivateOpen(false);
    setDeactivateNote('');
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Applied ${formatDate(seller.appliedAt)}`}
        title={seller.displayName}
        action={<Tag tone={sellerStatusTone[seller.status]}>{sellerStatusLabel[seller.status]}</Tag>}
      />

      {seller.status === 'REJECTED' && seller.rejectionNote && (
        <Alert tone="error" className="mb-6">
          Rejected: {seller.rejectionNote}
        </Alert>
      )}
      {seller.statusNote && seller.status !== 'REJECTED' && (
        <Alert tone="info" className="mb-6">
          Note: {seller.statusNote}
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="rounded-[var(--radius-card)] border border-stone-dark p-4">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Storefront</h2>
          <p className="text-sm text-ink">{seller.description}</p>
          <p className="text-xs text-ink-soft mt-3">Slug: /sellers/{seller.slug}</p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-stone-dark p-4">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Contact</h2>
          <p className="text-sm text-ink">{seller.contactEmail}</p>
          <p className="text-sm text-ink-soft">{seller.contactPhone}</p>
          {seller.address && (
            <p className="text-xs text-ink-soft mt-3">
              {seller.address.addressLine1}
              {seller.address.addressLine2 ? `, ${seller.address.addressLine2}` : ''}, {seller.address.city},{' '}
              {seller.address.state} {seller.address.postalCode}, {seller.address.country}
            </p>
          )}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-heading mb-3">Verification documents</h2>
        {seller.verifications.length === 0 ? (
          <p className="text-sm text-ink-soft">No documents uploaded.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {seller.verifications.map((v) => (
              <li key={v.id} className="flex items-center gap-3 text-sm">
                <Tag tone={v.status === 'APPROVED' ? 'pine' : v.status === 'REJECTED' ? 'rust' : 'ochre'}>{v.status}</Tag>
                <span className="text-ink">{v.documentType}</span>
                <a href={v.documentUrl} target="_blank" rel="noreferrer" className="text-fern underline text-xs">
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {canApproveReject && (
          <>
            <Button variant="primary" disabled={approve.isPending} onClick={() => void approve.mutateAsync()}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
            <Button variant="outline" className="!border-rust !text-rust" onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
          </>
        )}
        {canSuspend && (
          <Button variant="outline" className="!border-rust !text-rust" onClick={() => setSuspendOpen(true)}>
            Suspend
          </Button>
        )}
        {canDeactivate && (
          <Button variant="outline" className="!border-rust !text-rust" onClick={() => setDeactivateOpen(true)}>
            Deactivate
          </Button>
        )}
        {canReactivate && (
          <Button variant="primary" disabled={reactivate.isPending} onClick={() => void reactivate.mutateAsync()}>
            {reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
          </Button>
        )}
        <Link
          to={`/admin/marketplace/payouts?sellerId=${seller.id}`}
          className="text-sm text-fern underline self-center"
        >
          View balance & payouts
        </Link>
      </div>
      {approve.isError && <p className="text-sm text-rust mt-3">{errorMessage(approve.error, "Couldn't approve this seller.")}</p>}
      {reactivate.isError && (
        <p className="text-sm text-rust mt-3">{errorMessage(reactivate.error, "Couldn't reactivate this seller.")}</p>
      )}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this application?">
        <div className="flex flex-col gap-4">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason shown to the applicant (required)"
            rows={3}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {reject.isError && <Alert tone="error">{errorMessage(reject.error, "Couldn't reject this application.")}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!rejectReason.trim() || reject.isPending} onClick={() => void handleReject()}>
              {reject.isPending ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title="Suspend this seller?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">Their storefront and listings go offline immediately. This can be undone.</p>
          <textarea
            value={suspendNote}
            onChange={(e) => setSuspendNote(e.target.value)}
            placeholder="Internal note (optional)"
            rows={2}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {suspend.isError && <Alert tone="error">{errorMessage(suspend.error, "Couldn't suspend this seller.")}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={suspend.isPending} onClick={() => void handleSuspend()}>
              {suspend.isPending ? 'Suspending…' : 'Confirm suspension'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deactivateOpen} onClose={() => setDeactivateOpen(false)} title="Deactivate this seller?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">A longer-term account closure than a suspension. This can be undone.</p>
          <textarea
            value={deactivateNote}
            onChange={(e) => setDeactivateNote(e.target.value)}
            placeholder="Internal note (optional)"
            rows={2}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {deactivate.isError && <Alert tone="error">{errorMessage(deactivate.error, "Couldn't deactivate this seller.")}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeactivateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={deactivate.isPending} onClick={() => void handleDeactivate()}>
              {deactivate.isPending ? 'Deactivating…' : 'Confirm deactivation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
