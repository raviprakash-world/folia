import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WishlistItem } from '@/types/cart';
import { fetchRealWishlist, addRealWishlistItem, removeRealWishlistItem } from '@/services/wishlistApiService';

const useRealWishlistApi = import.meta.env.VITE_REAL_WISHLIST_API === 'true';

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
  addItem: (input: AddWishlistInput) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (input: AddWishlistInput) => Promise<void>;
  loadFromServer: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,

      addItem: async (input) => {
        if (get().items.some((i) => i.productId === input.productId)) return;
        if (useRealWishlistApi) await addRealWishlistItem(input.productId);
        set({ items: [...get().items, { ...input, addedAt: new Date().toISOString() }] });
      },

      removeItem: async (productId) => {
        if (useRealWishlistApi) await removeRealWishlistItem(productId);
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      toggleItem: async (input) => {
        const exists = get().items.some((i) => i.productId === input.productId);
        if (useRealWishlistApi) {
          if (exists) await removeRealWishlistItem(input.productId);
          else await addRealWishlistItem(input.productId);
        }
        set({
          items: exists
            ? get().items.filter((i) => i.productId !== input.productId)
            : [...get().items, { ...input, addedAt: new Date().toISOString() }],
        });
      },

      /**
       * Real backend only — a no-op when the flag is off. Note this
       * domain has no guest fallback on the backend (WishlistController
       * uses @CurrentUser(), not @OptionalCurrentUser() — confirmed
       * directly against the source before writing this): a request
       * with no valid session will genuinely fail with 401, unlike
       * cart's optional-auth design. Meant to be called on the wishlist
       * page's mount.
       */
      loadFromServer: async () => {
        if (!useRealWishlistApi) return;
        const items = await fetchRealWishlist();
        set({ items });
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
