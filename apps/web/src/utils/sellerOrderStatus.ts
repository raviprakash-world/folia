import type { TagTone } from '@/components/ui/Tag';
import type { OrderGroupStatus } from '@/types/sellerDashboard';

/** Mirrors utils/returnClaimStatus.ts's own tone-map pattern. */
export const orderGroupStatusTone: Record<OrderGroupStatus, TagTone> = {
  PROCESSING: 'ochre',
  CONFIRMED: 'ochre',
  SHIPPED: 'pine',
  DELIVERED: 'stone',
  CANCELLED: 'rust',
  RETURNED: 'rust',
  REFUNDED: 'rust',
};
