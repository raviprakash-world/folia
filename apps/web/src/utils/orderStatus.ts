import type { OrderStatus } from '@/types/order';
import type { TagTone } from '@/components/ui/Tag';

export const orderStatusTone: Record<OrderStatus, TagTone> = {
  'pending-payment': 'ochre', // same "waiting" tone as processing — a real customer-facing distinction (awaiting payment vs. already paid) belongs in the label shown alongside this tag, not a new color
  processing: 'ochre',
  confirmed: 'pine',
  shipped: 'pine',
  delivered: 'stone',
  cancelled: 'rust',
  returned: 'rust',
  refunded: 'stone',
};
