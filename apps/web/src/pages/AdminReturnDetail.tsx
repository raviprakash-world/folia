import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { useAdminReturnDetail, useRealAdminApi } from '@/hooks/useAdminReturns';
import { returnClaimStatusTone, returnClaimStatusLabel } from '@/utils/returnClaimStatus';
import { formatCurrency, formatDate } from '@/utils/currency';

const RESOLUTION_LABEL: Record<string, string> = {
  REFUND: 'Refund',
  FOLIA_STORE_CREDIT: 'Store credit',
  REPLACEMENT: 'Replacement',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const { claim, isLoading, approve, reject, resolve, markReceived } = useAdminReturnDetail(id);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [asReplacement, setAsReplacement] = useState(false);
  const [reverseLogisticsChoice, setReverseLogisticsChoice] = useState<'default' | 'yes' | 'no'>('default');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Return claim" />
        <p className="text-sm text-ink-soft">
          Returns management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Return claim" />
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div>
        <PageHeader title="Claim not found" />
        <p className="text-sm text-ink-soft">
          <Link to="/admin/returns" className="text-fern underline">Back to returns</Link>.
        </p>
      </div>
    );
  }

  const claimValue = claim.items.reduce((sum, item) => sum + item.claimedLineValue, 0);
  const readyToResolve =
    claim.status === 'approved' && (!claim.resolution.requiresReverseLogistics || !!claim.resolution.itemReceivedAt);

  async function handleApprove() {
    await approve.mutateAsync({
      note: approveNote || undefined,
      resolutionType: asReplacement ? 'REPLACEMENT' : undefined,
      requiresReverseLogistics: reverseLogisticsChoice === 'default' ? undefined : reverseLogisticsChoice === 'yes',
    });
    setApproveOpen(false);
    setApproveNote('');
    setAsReplacement(false);
    setReverseLogisticsChoice('default');
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await reject.mutateAsync(rejectReason);
    setRejectOpen(false);
    setRejectReason('');
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Order ${claim.orderId}`}
        title={`Claim ${claim.id.slice(0, 8)}`}
        action={<Tag tone={returnClaimStatusTone[claim.status]}>{returnClaimStatusLabel[claim.status]}</Tag>}
      />

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="rounded-[var(--radius-card)] border border-stone-dark p-4">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Customer</h2>
          <p className="text-sm text-ink">{claim.customer.firstName} {claim.customer.lastName}</p>
          <p className="text-sm text-ink-soft">{claim.customer.email}</p>
          <p className="text-xs text-ink-soft mt-3">
            Order total {formatCurrency(claim.order.total)} · Delivered{' '}
            {claim.order.deliveredAt ? formatDate(claim.order.deliveredAt) : '—'}
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-stone-dark p-4">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Claim</h2>
          <p className="text-sm text-ink">
            {claim.claimType === 'doa-claim' ? 'DOA / damage claim' : 'Standard return'} · {claim.reason.replace(/-/g, ' ')}
          </p>
          {claim.note && <p className="text-sm text-ink-soft mt-1">&ldquo;{claim.note}&rdquo;</p>}
          <p className="text-xs text-ink-soft mt-3">Requested {formatDate(claim.requestedAt)}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {!claim.policy.reasonEligible && <Tag tone="rust">Reason not eligible</Tag>}
            {claim.policy.evidenceRequired && (
              <Tag tone={claim.policy.evidenceProvided ? 'pine' : 'rust'}>
                Evidence {claim.policy.evidenceProvided ? 'provided' : 'missing'}
              </Tag>
            )}
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-heading mb-3">Claimed items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-dark">
                <th scope="col" className="py-2 px-3 text-left font-mono text-xs uppercase tracking-wider text-ink-soft">Item</th>
                <th scope="col" className="py-2 px-3 text-right font-mono text-xs uppercase tracking-wider text-ink-soft">Unit price</th>
                <th scope="col" className="py-2 px-3 text-right font-mono text-xs uppercase tracking-wider text-ink-soft">Qty claimed</th>
                <th scope="col" className="py-2 px-3 text-right font-mono text-xs uppercase tracking-wider text-ink-soft">Line value</th>
              </tr>
            </thead>
            <tbody>
              {claim.items.map((item) => (
                <tr key={item.orderItemId} className="border-b border-stone-dark/60 last:border-0">
                  <td className="py-2.5 px-3 text-ink">{item.productName}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{item.quantity} / {item.purchasedQuantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.claimedLineValue)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="py-2.5 px-3 text-right text-sm font-medium text-ink-soft">Total claim value</td>
                <td className="py-2.5 px-3 text-right font-mono font-medium">{formatCurrency(claimValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {claim.evidence.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Evidence</h2>
          <div className="flex flex-wrap gap-3">
            {claim.evidence.map((e) => (
              <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="text-sm text-fern underline">
                {e.url.split('/').pop()}
              </a>
            ))}
          </div>
        </div>
      )}

      {claim.decision.decidedAt && (
        <div className="mb-10">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Decision</h2>
          <p className="text-sm text-ink-soft">
            {formatDate(claim.decision.decidedAt)}
            {claim.decision.decisionNote ? ` — ${claim.decision.decisionNote}` : ''}
          </p>
        </div>
      )}

      {claim.resolution.resolutionType && (
        <div className="mb-10">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Resolution</h2>
          <p className="text-sm text-ink-soft">
            {RESOLUTION_LABEL[claim.resolution.resolutionType] ?? claim.resolution.resolutionType}
            {claim.resolution.refundAmount != null ? ` — ${formatCurrency(claim.resolution.refundAmount)}` : ''}
          </p>
          {claim.resolution.requiresReverseLogistics && (
            <p className="text-xs text-ink-soft mt-1">
              Item received: {claim.resolution.itemReceivedAt ? formatDate(claim.resolution.itemReceivedAt) : 'not yet'}
            </p>
          )}
          {claim.resolution.replacementOrderId && (
            <p className="text-xs text-ink-soft mt-1">
              Replacement order:{' '}
              <Link to={`/admin/orders`} className="text-fern underline">{claim.resolution.replacementOrderId}</Link>
            </p>
          )}
        </div>
      )}

      {claim.status === 'pending' && (
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setApproveOpen(true)}>Approve</Button>
          <Button variant="outline" className="!border-rust !text-rust" onClick={() => setRejectOpen(true)}>Reject</Button>
        </div>
      )}

      {claim.status === 'approved' && (
        <div className="flex flex-col gap-3">
          {claim.resolution.requiresReverseLogistics && !claim.resolution.itemReceivedAt && (
            <Alert tone="info">Waiting for the item to be received back before this can be resolved.</Alert>
          )}
          <div className="flex flex-wrap gap-3">
            {claim.resolution.requiresReverseLogistics && !claim.resolution.itemReceivedAt && (
              <Button
                variant="outline"
                disabled={markReceived.isPending}
                onClick={() => void markReceived.mutateAsync()}
              >
                {markReceived.isPending ? 'Marking…' : 'Mark item received'}
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!readyToResolve || resolve.isPending}
              onClick={() => void resolve.mutateAsync()}
            >
              {resolve.isPending ? 'Resolving…' : 'Resolve claim'}
            </Button>
          </div>
          {resolve.isError && <p className="text-sm text-rust">{errorMessage(resolve.error, 'Resolution failed.')}</p>}
          {markReceived.isError && (
            <p className="text-sm text-rust">{errorMessage(markReceived.error, 'Could not mark item received.')}</p>
          )}
        </div>
      )}

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Approve this claim?">
        <div className="flex flex-col gap-4">
          {claim.claimType === 'doa-claim' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={asReplacement}
                onChange={(e) => setAsReplacement(e.target.checked)}
                className="w-4 h-4 accent-fern"
              />
              Resolve via free replacement instead of refund/store credit
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reverse-logistics" className="text-sm font-medium text-ink-soft">
              Require the item back before resolving?
            </label>
            <select
              id="reverse-logistics"
              value={reverseLogisticsChoice}
              onChange={(e) => setReverseLogisticsChoice(e.target.value as typeof reverseLogisticsChoice)}
              className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
            >
              <option value="default">Use default ({claim.claimType === 'doa-claim' ? 'no' : 'yes'})</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <textarea
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            placeholder="Note (optional)"
            rows={2}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {approve.isError && <p className="text-sm text-rust">{errorMessage(approve.error, 'Approval failed.')}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setApproveOpen(false)} disabled={approve.isPending}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleApprove()} disabled={approve.isPending}>
              {approve.isPending ? 'Approving…' : 'Confirm approval'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this claim?">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reject-reason" className="text-sm font-medium text-ink-soft">
              Reason (shown to the customer)
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
            />
          </div>
          {reject.isError && <p className="text-sm text-rust">{errorMessage(reject.error, 'Rejection failed.')}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>Cancel</Button>
            <Button
              variant="primary"
              className="!bg-rust hover:!bg-rust/90"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => void handleReject()}
            >
              {reject.isPending ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
