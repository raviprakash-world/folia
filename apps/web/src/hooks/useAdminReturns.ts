import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealAdminApi } from './useAdminAnalytics';
import {
  fetchAdminReturns,
  fetchAdminReturnClaim,
  approveAdminReturnClaim,
  rejectAdminReturnClaim,
  resolveAdminReturnClaim,
  markAdminReturnItemReceived,
} from '@/services/adminReturnsApiService';
import type { ApproveReturnClaimInput } from '@/services/adminReturnsApiService';
import type { ReturnClaimStatus } from '@/types/returnClaim';

export { useRealAdminApi };

const LIST_QUERY_KEY = (status: ReturnClaimStatus, page: number, pageSize: number) => [
  'admin-returns',
  status,
  page,
  pageSize,
];
const DETAIL_QUERY_KEY = (id: string) => ['admin-return', id];

/** The queue — mirrors AdminOrders.tsx's own useQuery + enabled-gate pattern. */
export function useAdminReturnsList(status: ReturnClaimStatus, page: number, pageSize = 20) {
  const { data, isLoading } = useQuery({
    queryKey: LIST_QUERY_KEY(status, page, pageSize),
    queryFn: () => fetchAdminReturns(status, page, pageSize),
    enabled: useRealAdminApi,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
}

/** A single claim plus every admin action AdminReturnDetail.tsx needs — one useMutation per action, each invalidating both this claim's own query and every list query so the queue reflects a decision immediately. */
export function useAdminReturnDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const detailKey = DETAIL_QUERY_KEY(id ?? '');

  const { data: claim, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchAdminReturnClaim(id!),
    enabled: useRealAdminApi && !!id,
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailKey }),
      queryClient.invalidateQueries({ queryKey: ['admin-returns'] }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: (input: ApproveReturnClaimInput) => approveAdminReturnClaim(id!, input),
    onSuccess: invalidateAll,
  });
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectAdminReturnClaim(id!, reason),
    onSuccess: invalidateAll,
  });
  const resolveMutation = useMutation({
    mutationFn: () => resolveAdminReturnClaim(id!),
    onSuccess: invalidateAll,
  });
  const markReceivedMutation = useMutation({
    mutationFn: () => markAdminReturnItemReceived(id!),
    onSuccess: invalidateAll,
  });

  return {
    claim,
    isLoading,
    approve: approveMutation,
    reject: rejectMutation,
    resolve: resolveMutation,
    markReceived: markReceivedMutation,
  };
}
