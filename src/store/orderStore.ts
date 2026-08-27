import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Order } from '@/types/order';

interface OrderState {
  orders: Order[];
  hasHydrated: boolean;

  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
  setHasHydrated: (value: boolean) => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      hasHydrated: false,

      addOrder: (order) => set({ orders: [order, ...get().orders] }),

      getOrder: (id) => get().orders.find((o) => o.id === id),

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
