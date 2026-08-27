import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WishlistItem } from '@/types/cart';

interface AddWishlistInput {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
}

interface WishlistState {
  items: WishlistItem[];
  hasHydrated: boolean;
  addItem: (input: AddWishlistInput) => void;
  removeItem: (productId: string) => void;
  toggleItem: (input: AddWishlistInput) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,

      addItem: (input) => {
        if (get().items.some((i) => i.productId === input.productId)) return;
        set({ items: [...get().items, { ...input, addedAt: new Date().toISOString() }] });
      },

      removeItem: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),

      toggleItem: (input) => {
        const exists = get().items.some((i) => i.productId === input.productId);
        set({
          items: exists
            ? get().items.filter((i) => i.productId !== input.productId)
            : [...get().items, { ...input, addedAt: new Date().toISOString() }],
        });
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-wishlist',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
