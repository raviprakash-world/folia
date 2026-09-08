import { useQuery } from '@tanstack/react-query';
import { useRealSellersApi } from './useSellerProfile';
import { fetchSellerBalance, fetchSellerLedger, fetchSellerPayouts } from '@/services/sellerDashboardApiService';

export { useRealSellersApi };

export function useSellerBalance() {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-balance'],
    queryFn: fetchSellerBalance,
    enabled: useRealSellersApi,
  });
  return { balance: data ?? 0, isLoading };
}

export function useSellerLedger(page: number, pageSize = 20) {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-ledger', page, pageSize],
    queryFn: () => fetchSellerLedger(page, pageSize),
    enabled: useRealSellersApi,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
}

export function useSellerPayouts() {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-payouts'],
    queryFn: fetchSellerPayouts,
    enabled: useRealSellersApi,
  });
  return { items: data ?? [], isLoading };
}
