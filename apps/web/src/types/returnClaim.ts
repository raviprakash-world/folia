/**
 * Phase 6D-4H — mirrors apps/api/src/orders/returns.service.ts's public
 * response shapes exactly (toPublicClaim for creation, toAdminRecord for
 * both the admin view and — minus admin-only fields — the customer's own
 * GET /orders/:id/returns). This is a genuinely new claim-based model,
 * distinct from the old whole-order ReturnRequest concept still in
 * types/order.ts (kept there only for the local-mock demo path, which the
 * real backend no longer implements).
 */

export type ReturnClaimType = 'standard-return' | 'doa-claim';

export type ReturnClaimReason =
  | 'no-longer-needed'
  | 'wrong-item'
  | 'damaged-in-transit'
  | 'not-as-described'
  | 'changed-mind'
  | 'other'
  | 'doa';

export type ReturnClaimStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'refund-issued'
  | 'store-credit-issued'
  | 'replacement-issued';

export type ReturnResolutionType = 'REFUND' | 'FOLIA_STORE_CREDIT' | 'REPLACEMENT' | null;

export interface ReturnClaimItemInput {
  orderItemId: string;
  quantity: number;
}

/** Response from POST /orders/:id/returns (toPublicClaim) — just what was submitted, freshly created and still PENDING. */
export interface ReturnClaim {
  id: string;
  orderId: string;
  claimType: ReturnClaimType;
  status: ReturnClaimStatus;
  reason: ReturnClaimReason;
  note: string | null;
  items: { orderItemId: string; quantity: number }[];
  evidence: { url: string }[];
  requestedAt: string;
}

export interface ReturnClaimLineDetail {
  orderItemId: string;
  quantity: number;
  productName: string;
  unitPrice: number;
  purchasedQuantity: number;
  claimedLineValue: number;
}

export interface ReturnClaimEvidenceDetail {
  url: string;
  uploadedAt: string;
}

export interface ReturnClaimPolicy {
  evidenceRequired: boolean;
  evidenceProvided: boolean;
  reasonEligible: boolean;
}

/** GET /orders/:id/returns — the caller's own claim. Same underlying record the admin view uses, minus admin-only fields (see ReturnsService.getMyClaim). */
export interface MyReturnClaim {
  id: string;
  orderId: string;
  claimType: ReturnClaimType;
  status: ReturnClaimStatus;
  reason: ReturnClaimReason;
  note: string | null;
  requestedAt: string;
  order: { id: string; total: number; deliveredAt: string | null };
  items: ReturnClaimLineDetail[];
  evidence: ReturnClaimEvidenceDetail[];
  policy: ReturnClaimPolicy;
  decision: { decidedAt: string | null; decisionNote: string | null };
  resolution: {
    resolutionType: ReturnResolutionType;
    requiresReverseLogistics: boolean;
    itemReceivedAt: string | null;
    refundAmount: number | null;
    replacementOrderId: string | null;
  };
}

/** GET/POST /admin/returns... — the full admin record, including customer identity and which admin decided. */
export interface AdminReturnClaim {
  id: string;
  orderId: string;
  claimType: ReturnClaimType;
  status: ReturnClaimStatus;
  reason: ReturnClaimReason;
  note: string | null;
  requestedAt: string;
  order: { id: string; total: number; deliveredAt: string | null };
  customer: { id: string; firstName: string; lastName: string; email: string };
  items: ReturnClaimLineDetail[];
  evidence: ReturnClaimEvidenceDetail[];
  policy: ReturnClaimPolicy;
  decision: { decidedBy: string | null; decidedAt: string | null; decisionNote: string | null };
  resolution: {
    resolutionType: ReturnResolutionType;
    requiresReverseLogistics: boolean;
    itemReceivedAt: string | null;
    refundAmount: number | null;
    refundId: string | null;
    replacementOrderId: string | null;
    storeCreditEntryId: string | null;
  };
}
