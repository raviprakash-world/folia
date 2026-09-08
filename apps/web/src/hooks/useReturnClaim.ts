import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReturnClaim, fetchMyReturnClaim } from '@/services/returnsApiService';
import type { CreateReturnClaimInput } from '@/services/returnsApiService';

/**
 * Same gate as useOrders.ts's useRealOrdersApi — the multi-item claim
 * model this feature implements has no local-mock equivalent (the old
 * whole-order ReturnRequest concept in types/order.ts/orderStore.ts is
 * kept only for the mock demo path; the real backend no longer
 * implements it at all). Matches useOrder's own precedent for reorder():
 * "no local-path equivalent... duplicating that logic here would be
 * exactly the kind of redundant service this project has avoided."
 */
export const useRealReturnClaimsApi = import.meta.env.VITE_REAL_ORDERS_API === 'true';

/**
 * A single order's claim (if any) plus the mutation to create one.
 * Mirrors useOrder's own shape/invalidation convention.
 */
export function useReturnClaim(orderId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['return-claim', orderId];

  const { data: claim, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchMyReturnClaim(orderId!),
    enabled: useRealReturnClaimsApi && !!orderId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateReturnClaimInput) => createReturnClaim(orderId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    claim: claim ?? null,
    isLoading: useRealReturnClaimsApi ? isLoading : false,
    createClaim: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
  };
}
