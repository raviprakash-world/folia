import type { TagTone } from '@/components/ui/Tag';
import type { SellerPayoutStatus } from '@/types/sellerDashboard';

/** Mirrors utils/returnClaimStatus.ts's own tone-map pattern. */
export const payoutStatusTone: Record<SellerPayoutStatus, TagTone> = {
  PENDING: 'ochre',
  PROCESSING: 'ochre',
  PAID: 'pine',
  FAILED: 'rust',
  CANCELLED: 'stone',
};
