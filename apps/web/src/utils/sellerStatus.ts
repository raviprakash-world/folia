import type { TagTone } from '@/components/ui/Tag';
import type { SellerStatus } from '@/types/sellerDashboard';

/** Mirrors utils/returnClaimStatus.ts's own tone-map pattern. */
export const sellerStatusTone: Record<SellerStatus, TagTone> = {
  APPLIED: 'ochre',
  UNDER_REVIEW: 'ochre',
  REJECTED: 'rust',
  APPROVED: 'pine',
  ACTIVE: 'pine',
  SUSPENDED: 'rust',
  DEACTIVATED: 'stone',
};

export const sellerStatusLabel: Record<SellerStatus, string> = {
  APPLIED: 'Application received',
  UNDER_REVIEW: 'Under review',
  REJECTED: 'Not approved',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};
