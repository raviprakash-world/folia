import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Order, CancellationReason, ReturnReason } from '@/types/order';

interface OrderState {
  orders: Order[];
  hasHydrated: boolean;

  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
  cancelOrder: (id: string, reason: CancellationReason, note: string | null) => void;
  requestReturn: (id: string, reason: ReturnReason, note: string | null) => void;
  updateCustomerNotes: (id: string, notes: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      hasHydrated: false,

      addOrder: (order) => set({ orders: [order, ...get().orders] }),

      getOrder: (id) => get().orders.find((o) => o.id === id),

      cancelOrder: (id, reason, note) => {
        const requestedAt = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'cancelled',
                  cancellation: {
                    requestedAt,
                    reason,
                    note,
                    // Cash on Delivery never charged anything, so there's nothing to refund.
                    refundStatus: o.payment.method === 'cod' ? null : 'processing',
                  },
                }
              : o
          ),
        });
      },

      requestReturn: (id, reason, note) => {
        const requestedAt = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'returned',
                  returnRequest: { requestedAt, reason, note, refundStatus: 'processing' },
                }
              : o
          ),
        });
      },

      updateCustomerNotes: (id, notes) =>
        set({ orders: get().orders.map((o) => (o.id === id ? { ...o, customerNotes: notes || null } : o)) }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-orders',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ orders: state.orders }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
