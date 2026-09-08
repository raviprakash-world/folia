import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealSellersApi } from './useSellerProfile';
import {
  fetchSellerOrders,
  fetchSellerOrder,
  updateSellerOrderNote,
  shipSellerOrder,
} from '@/services/sellerDashboardApiService';

export { useRealSellersApi };

const LIST_QUERY_KEY = (status: string | undefined, page: number, pageSize: number) => [
  'seller-orders',
  status,
  page,
  pageSize,
];
const DETAIL_QUERY_KEY = (id: string) => ['seller-order', id];

export function useSellerOrdersList(status: string | undefined, page: number, pageSize = 20) {
  const { data, isLoading } = useQuery({
    queryKey: LIST_QUERY_KEY(status, page, pageSize),
    queryFn: () => fetchSellerOrders(status, page, pageSize),
    enabled: useRealSellersApi,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
}

export function useSellerOrderDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const detailKey = DETAIL_QUERY_KEY(id ?? '');

  const { data: order, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchSellerOrder(id!),
    enabled: useRealSellersApi && !!id,
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailKey }),
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] }),
    ]);
  }

  const noteMutation = useMutation({
    mutationFn: (note: string) => updateSellerOrderNote(id!, note),
    onSuccess: invalidateAll,
  });
  const shipMutation = useMutation({
    mutationFn: () => shipSellerOrder(id!),
    onSuccess: invalidateAll,
  });

  return { order, isLoading, updateNote: noteMutation, ship: shipMutation };
}
