import { Link } from 'react-router-dom';
import { Tag } from '@/components/ui/Tag';
import { formatCurrency, formatDate } from '@/utils/currency';
import { returnClaimStatusTone, returnClaimStatusLabel } from '@/utils/returnClaimStatus';
import type { MyReturnClaim } from '@/types/returnClaim';

const RESOLUTION_LABEL: Record<NonNullable<MyReturnClaim['resolution']['resolutionType']>, string> = {
  REFUND: 'Refund',
  FOLIA_STORE_CREDIT: 'Store credit',
  REPLACEMENT: 'Replacement',
};

/** Displayed in place of the old order.returnRequest alert (see AccountOrderDetail.tsx) once a real Phase 6D claim exists for this order. */
export function ReturnClaimStatus({ claim }: { claim: MyReturnClaim }) {
  const { resolution } = claim;

  return (
    <div className="rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-heading">Return / DOA claim</p>
        <Tag tone={returnClaimStatusTone[claim.status]}>{returnClaimStatusLabel[claim.status]}</Tag>
      </div>

      <p className="text-xs text-ink-soft">Filed {formatDate(claim.requestedAt)}</p>

      {claim.status === 'pending' && (
        <p className="text-sm text-ink-soft">We&apos;re reviewing your claim — we&apos;ll follow up with next steps.</p>
      )}

      {claim.status === 'rejected' && claim.decision.decisionNote && (
        <p className="text-sm text-ink-soft">Reason: {claim.decision.decisionNote}</p>
      )}

      {resolution.requiresReverseLogistics && !resolution.itemReceivedAt && claim.status === 'approved' && (
        <p className="text-sm text-ink-soft">
          Approved — please ship the item back to us. We&apos;ll process your{' '}
          {resolution.resolutionType ? RESOLUTION_LABEL[resolution.resolutionType].toLowerCase() : 'resolution'} once it
          arrives.
        </p>
      )}

      {resolution.resolutionType && (claim.status === 'refund-issued' || claim.status === 'store-credit-issued') && (
        <p className="text-sm text-ink-soft">
          {RESOLUTION_LABEL[resolution.resolutionType]}
          {resolution.refundAmount != null ? ` of ${formatCurrency(resolution.refundAmount)}` : ''} issued.
        </p>
      )}

      {claim.status === 'replacement-issued' && resolution.replacementOrderId && (
        <p className="text-sm text-ink-soft">
          A free replacement was created as order{' '}
          <Link to={`/account/orders/${resolution.replacementOrderId}`} className="text-fern underline">
            {resolution.replacementOrderId}
          </Link>
          .
        </p>
      )}
    </div>
  );
}
