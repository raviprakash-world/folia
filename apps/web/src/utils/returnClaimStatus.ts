import type { TagTone } from '@/components/ui/Tag';
import type { ReturnClaimStatus } from '@/types/returnClaim';

/** Mirrors utils/orderStatus.ts's own tone-map pattern exactly. Tag only has 4 tones, so the three "issued" terminal states share 'stone' (a resolved, no-further-action state) — pine is reserved for states moving forward in the customer's favor (approved, replacement on the way). */
export const returnClaimStatusTone: Record<ReturnClaimStatus, TagTone> = {
  pending: 'ochre',
  approved: 'pine',
  rejected: 'rust',
  'refund-issued': 'stone',
  'store-credit-issued': 'stone',
  'replacement-issued': 'pine',
};

export const returnClaimStatusLabel: Record<ReturnClaimStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Not approved',
  'refund-issued': 'Refund issued',
  'store-credit-issued': 'Store credit issued',
  'replacement-issued': 'Replacement on the way',
};
