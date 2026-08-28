import { useQuery } from '@tanstack/react-query';
import { fetchOrderTracking } from '@/services/trackingService';
import { deliveryWindowHours } from '@/data/trackingStages';
import type { Order } from '@/types/order';

export function useOrderTracking(order: Order | undefined) {
  return useQuery({
    queryKey: ['tracking', order?.id, order?.cancellation?.requestedAt, order?.returnRequest?.requestedAt],
    queryFn: () =>
      fetchOrderTracking(order!.id, {
        placedAt: order!.createdAt,
        windowHours: deliveryWindowHours(order!.deliveryMethod),
        destinationCity: order!.shippingAddress.city,
        frozenAt: order!.cancellation?.requestedAt ?? order!.returnRequest?.requestedAt,
      }),
    enabled: !!order,
    staleTime: 60 * 1000,
  });
}
