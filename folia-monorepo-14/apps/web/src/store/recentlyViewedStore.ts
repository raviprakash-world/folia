import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MAX_RECENTLY_VIEWED = 20;

export interface RecentlyViewedEntry {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  viewedAt: string;
}

interface RecentlyViewedState {
  items: RecentlyViewedEntry[];
  hasHydrated: boolean;

  recordView: (product: Omit<RecentlyViewedEntry, 'viewedAt'>) => void;
  clearHistory: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,

      recordView: (product) => {
        const withoutDuplicate = get().items.filter((i) => i.productId !== product.productId);
        const entry: RecentlyViewedEntry = { ...product, viewedAt: new Date().toISOString() };
        set({ items: [entry, ...withoutDuplicate].slice(0, MAX_RECENTLY_VIEWED) });
      },

      clearHistory: () => set({ items: [] }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-recently-viewed',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
