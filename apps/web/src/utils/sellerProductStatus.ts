import type { TagTone } from '@/components/ui/Tag';
import type { ProductApprovalStatus } from '@/types/sellerDashboard';

/** Mirrors utils/returnClaimStatus.ts's own tone-map pattern. */
export const productApprovalStatusTone: Record<ProductApprovalStatus, TagTone> = {
  DRAFT: 'stone',
  SUBMITTED: 'ochre',
  UNDER_REVIEW: 'ochre',
  REJECTED: 'rust',
  APPROVED: 'pine',
  ACTIVE: 'pine',
  ARCHIVED: 'stone',
};

export const productApprovalStatusLabel: Record<ProductApprovalStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted for review',
  UNDER_REVIEW: 'Under review',
  REJECTED: 'Not approved',
  APPROVED: 'Approved',
  ACTIVE: 'Live',
  ARCHIVED: 'Archived',
};
