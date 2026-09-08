import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealAdminApi } from './useAdminAnalytics';
import {
  fetchMarketplaceAnalytics,
  fetchAdminSellers,
  fetchAdminSeller,
  approveAdminSeller,
  rejectAdminSeller,
  suspendAdminSeller,
  reactivateAdminSeller,
  deactivateAdminSeller,
  fetchAdminSellerProducts,
  approveAdminSellerProduct,
  rejectAdminSellerProduct,
  requestChangesAdminSellerProduct,
  deactivateAdminSellerProduct,
  fetchAdminCommissions,
  setAdminCommissionRate,
  fetchAdminSellerBalance,
  fetchAdminSellerLedger,
  adjustAdminSellerLedger,
  initiateAdminPayout,
  fetchAdminPayouts,
  fetchAdminPayoutDetail,
  markAdminPayoutProcessing,
  markAdminPayoutPaid,
  markAdminPayoutFailed,
  cancelAdminPayout,
} from '@/services/adminMarketplaceApiService';
import type { AdminSellerStatusFilter, AdminSellerProductStatusFilter } from '@/services/adminMarketplaceApiService';

export { useRealAdminApi };

/** GET /analytics/marketplace — the marketplace landing dashboard. */
export function useMarketplaceAnalytics() {
  return useQuery({
    queryKey: ['admin-marketplace-analytics'],
    queryFn: fetchMarketplaceAnalytics,
    enabled: useRealAdminApi,
  });
}

// --- Sellers ---

export function useAdminSellersList(status: AdminSellerStatusFilter, page: number, pageSize = 20) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', status, page, pageSize],
    queryFn: () => fetchAdminSellers(status, page, pageSize),
    enabled: useRealAdminApi,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
}

export function useAdminSellerDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const detailKey = ['admin-seller', id ?? ''];

  const { data: seller, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchAdminSeller(id!),
    enabled: useRealAdminApi && !!id,
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailKey }),
      queryClient.invalidateQueries({ queryKey: ['admin-sellers'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-analytics'] }),
    ]);
  }

  const approve = useMutation({ mutationFn: () => approveAdminSeller(id!), onSuccess: invalidateAll });
  const reject = useMutation({ mutationFn: (reason: string) => rejectAdminSeller(id!, reason), onSuccess: invalidateAll });
  const suspend = useMutation({ mutationFn: (note?: string) => suspendAdminSeller(id!, note), onSuccess: invalidateAll });
  const reactivate = useMutation({ mutationFn: () => reactivateAdminSeller(id!), onSuccess: invalidateAll });
  const deactivate = useMutation({ mutationFn: (note?: string) => deactivateAdminSeller(id!, note), onSuccess: invalidateAll });

  return { seller, isLoading, approve, reject, suspend, reactivate, deactivate };
}

// --- Seller-submitted products ---

export function useAdminSellerProductsList(status: AdminSellerProductStatusFilter, page: number, pageSize = 20) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-seller-products', status, page, pageSize],
    queryFn: () => fetchAdminSellerProducts(status, page, pageSize),
    enabled: useRealAdminApi,
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-seller-products'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-analytics'] }),
    ]);
  }

  const approve = useMutation({ mutationFn: (id: string) => approveAdminSellerProduct(id), onSuccess: invalidateAll });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectAdminSellerProduct(id, reason),
    onSuccess: invalidateAll,
  });
  const requestChanges = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => requestChangesAdminSellerProduct(id, reason),
    onSuccess: invalidateAll,
  });
  const deactivate = useMutation({ mutationFn: (id: string) => deactivateAdminSellerProduct(id), onSuccess: invalidateAll });

  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading, approve, reject, requestChanges, deactivate };
}

// --- Commissions ---

export function useAdminCommissions() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-commissions'],
    queryFn: fetchAdminCommissions,
    enabled: useRealAdminApi,
  });

  const setRate = useMutation({
    mutationFn: ({ sellerId, ratePercent }: { sellerId: string | null; ratePercent: number }) =>
      setAdminCommissionRate(sellerId, ratePercent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-commissions'] }),
  });

  return {
    marketplaceDefault: data?.marketplaceDefault ?? null,
    sellers: data?.sellers ?? [],
    isLoading,
    setRate,
  };
}

// --- Payouts / ledger ---

export function useAdminPayoutsList(filter: { sellerId?: string; status?: string } = {}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', filter],
    queryFn: () => fetchAdminPayouts(filter),
    enabled: useRealAdminApi,
  });
  return { payouts: data ?? [], isLoading };
}

export function useAdminPayoutDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-payout', id ?? ''],
    queryFn: () => fetchAdminPayoutDetail(id!),
    enabled: useRealAdminApi && !!id,
  });
}

/** One seller's balance/ledger, plus every payout admin action — used by AdminPayouts.tsx's seller-detail panel. */
export function useAdminSellerPayoutPanel(sellerId: string | undefined, ledgerPage: number) {
  const queryClient = useQueryClient();

  const { data: balance } = useQuery({
    queryKey: ['admin-seller-balance', sellerId ?? ''],
    queryFn: () => fetchAdminSellerBalance(sellerId!),
    enabled: useRealAdminApi && !!sellerId,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['admin-seller-ledger', sellerId ?? '', ledgerPage],
    queryFn: () => fetchAdminSellerLedger(sellerId!, ledgerPage),
    enabled: useRealAdminApi && !!sellerId,
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-seller-balance', sellerId ?? ''] }),
      queryClient.invalidateQueries({ queryKey: ['admin-seller-ledger', sellerId ?? ''] }),
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-analytics'] }),
    ]);
  }

  const adjustLedger = useMutation({
    mutationFn: ({ amount, note }: { amount: number; note: string }) => adjustAdminSellerLedger(sellerId!, amount, note),
    onSuccess: invalidateAll,
  });
  const initiatePayout = useMutation({
    mutationFn: (idempotencyKey: string) => initiateAdminPayout(sellerId!, idempotencyKey),
    onSuccess: invalidateAll,
  });

  return {
    balance: balance ?? 0,
    ledgerItems: ledger?.items ?? [],
    ledgerTotal: ledger?.total ?? 0,
    ledgerLoading,
    adjustLedger,
    initiatePayout,
  };
}

/** Payout status-transition actions, usable from any list/detail view — invalidates every payout-adjacent query the same way useAdminSellerPayoutPanel's own mutations do. */
export function useAdminPayoutActions() {
  const queryClient = useQueryClient();

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-payout'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-seller-balance'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-seller-ledger'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-analytics'] }),
    ]);
  }

  const markProcessing = useMutation({ mutationFn: (id: string) => markAdminPayoutProcessing(id), onSuccess: invalidateAll });
  const markPaid = useMutation({ mutationFn: (id: string) => markAdminPayoutPaid(id), onSuccess: invalidateAll });
  const markFailed = useMutation({
    mutationFn: ({ id, failureReason }: { id: string; failureReason: string }) => markAdminPayoutFailed(id, failureReason),
    onSuccess: invalidateAll,
  });
  const cancel = useMutation({ mutationFn: (id: string) => cancelAdminPayout(id), onSuccess: invalidateAll });

  return { markProcessing, markPaid, markFailed, cancel };
}
