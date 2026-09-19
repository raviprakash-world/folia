import { useQuery } from '@tanstack/react-query';
import { listCoupons } from '@/services/couponService';

export function useCoupons() {
  return useQuery({ queryKey: ['coupons'], queryFn: listCoupons, staleTime: 5 * 60_000 });
}
