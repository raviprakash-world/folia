import type { OrderStatus } from '@/types/order';
import type { TagTone } from '@/components/ui/Tag';

export const orderStatusTone: Record<OrderStatus, TagTone> = {
  processing: 'ochre',
  confirmed: 'pine',
  shipped: 'pine',
  delivered: 'stone',
  cancelled: 'rust',
  returned: 'rust',
  refunded: 'stone',
};
