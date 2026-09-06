import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrderStore } from '@/store/orderStore';
import {
  fetchRealOrders,
  fetchRealOrder,
  cancelRealOrder,
  requestRealReturn,
  updateRealOrderNotes,
  reorderReal,
} from '@/services/ordersApiService';
import type { Order, CancellationReason, ReturnReason } from '@/types/order';

export const useRealOrdersApi = import.meta.env.VITE_REAL_ORDERS_API === 'true';
const LIST_QUERY_KEY = ['real-orders'];

/** Order history — TanStack Query for real server state, matching this project's stated preference; the local Zustand store is used unchanged for the local path. */
export function useOrders(): { orders: Order[]; hasHydrated: boolean } {
  const localOrders = useOrderStore((s) => s.orders);
  const localHasHydrated = useOrderStore((s) => s.hasHydrated);

  const { data: realOrders, isLoading } = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: fetchRealOrders,
    enabled: useRealOrdersApi,
  });

  if (useRealOrdersApi) {
    return { orders: realOrders ?? [], hasHydrated: !isLoading };
  }
  return { orders: localOrders, hasHydrated: localHasHydrated };
}

/**
 * A single order plus every mutation AccountOrderDetail.tsx needs. Real
 * mutations invalidate both this order's own query and the list query,
 * so order history reflects a cancel/return immediately too — not just
 * the detail page.
 */
export function useOrder(id: string | undefined) {
  const queryClient = useQueryClient();
  const localGetOrder = useOrderStore((s) => s.getOrder);
  const localCancelOrder = useOrderStore((s) => s.cancelOrder);
  const localRequestReturn = useOrderStore((s) => s.requestReturn);
  const localUpdateCustomerNotes = useOrderStore((s) => s.updateCustomerNotes);

  const detailQueryKey = ['real-order', id];
  const { data: realOrder, isLoading } = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => fetchRealOrder(id!),
    enabled: useRealOrdersApi && !!id,
  });

  async function invalidateBoth() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailQueryKey }),
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY }),
    ]);
  }

  async function cancelOrder(reason: CancellationReason, note: string | null) {
    if (useRealOrdersApi) {
      if (!id) return;
      await cancelRealOrder(id, reason, note ?? undefined);
      await invalidateBoth();
    } else {
      localCancelOrder(id!, reason, note);
    }
  }

  async function requestReturn(reason: ReturnReason, note: string | null) {
    if (useRealOrdersApi) {
      if (!id) return;
      await requestRealReturn(id, reason, note ?? undefined);
      await invalidateBoth();
    } else {
      localRequestReturn(id!, reason, note);
    }
  }

  async function updateCustomerNotes(notes: string) {
    if (useRealOrdersApi) {
      if (!id) return;
      await updateRealOrderNotes(id, notes);
      await invalidateBoth();
    } else {
      localUpdateCustomerNotes(id!, notes);
    }
  }

  /**
   * Real backend only — no local-path equivalent, since the frontend's
   * existing addAllItemsToCart() in AccountOrderDetail.tsx already
   * covers the local case directly against cartStore, and duplicating
   * that logic here would be exactly the kind of redundant service this
   * project has avoided all night.
   */
  async function reorder(): Promise<{ added: number; skipped: number }> {
    if (!id) return { added: 0, skipped: 0 };
    return reorderReal(id);
  }

  const order: Order | undefined = useRealOrdersApi ? realOrder : id ? localGetOrder(id) : undefined;

  return {
    order,
    isLoading: useRealOrdersApi ? isLoading : false,
    cancelOrder,
    requestReturn,
    updateCustomerNotes,
    reorder,
  };
}
