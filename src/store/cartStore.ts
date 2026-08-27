import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildLineId } from '@/types/cart';
import type { CartItem, Coupon } from '@/types/cart';
import { validateCoupon, CouponError } from '@/services/couponService';
import { estimateShippingRate, ShippingError } from '@/services/shippingService';
import { computeSubtotal } from '@/utils/pricing';

interface AddItemInput {
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  maxQuantity: number;
}

interface AddItemResult {
  clampedToMax: boolean;
}

type AsyncStatus = 'idle' | 'pending' | 'error';

interface CartState {
  items: CartItem[];
  coupon: Coupon | null;
  couponStatus: AsyncStatus;
  couponError: string | null;
  shippingZip: string | null;
  shippingCost: number | null;
  shippingEta: string | null;
  shippingStatus: AsyncStatus;
  shippingError: string | null;
  hasHydrated: boolean;

  addItem: (input: AddItemInput) => AddItemResult;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
  estimateShipping: (zip: string) => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      couponStatus: 'idle',
      couponError: null,
      shippingZip: null,
      shippingCost: null,
      shippingEta: null,
      shippingStatus: 'idle',
      shippingError: null,
      hasHydrated: false,

      addItem: (input) => {
        const lineId = buildLineId(input.productId, input.variantId);
        const existing = get().items.find((i) => i.lineId === lineId);

        if (existing) {
          const desired = existing.quantity + input.quantity;
          const nextQuantity = Math.min(desired, input.maxQuantity);
          set({
            items: get().items.map((i) =>
              i.lineId === lineId ? { ...i, quantity: nextQuantity, maxQuantity: input.maxQuantity } : i
            ),
          });
          return { clampedToMax: nextQuantity < desired };
        }

        const nextQuantity = Math.min(input.quantity, input.maxQuantity);
        const newItem: CartItem = {
          lineId,
          productId: input.productId,
          slug: input.slug,
          name: input.name,
          categorySlug: input.categorySlug,
          price: input.price,
          variantId: input.variantId,
          variantLabel: input.variantLabel,
          quantity: nextQuantity,
          maxQuantity: input.maxQuantity,
        };
        set({ items: [...get().items, newItem] });
        return { clampedToMax: nextQuantity < input.quantity };
      },

      removeItem: (lineId) => set({ items: get().items.filter((i) => i.lineId !== lineId) }),

      updateQuantity: (lineId, quantity) =>
        set({
          items: get().items.map((i) =>
            i.lineId === lineId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) } : i
          ),
        }),

      clearCart: () =>
        set({
          items: [],
          coupon: null,
          couponStatus: 'idle',
          couponError: null,
          shippingZip: null,
          shippingCost: null,
          shippingEta: null,
          shippingStatus: 'idle',
          shippingError: null,
        }),

      applyCoupon: async (code) => {
        set({ couponStatus: 'pending', couponError: null });
        try {
          const subtotal = computeSubtotal(get().items);
          const coupon = await validateCoupon(code, subtotal);
          set({ coupon, couponStatus: 'idle', couponError: null });
        } catch (error) {
          const message = error instanceof CouponError ? error.message : "Couldn't validate that code — try again.";
          set({ couponStatus: 'error', couponError: message });
        }
      },

      removeCoupon: () => set({ coupon: null, couponStatus: 'idle', couponError: null }),

      estimateShipping: async (zip) => {
        set({ shippingStatus: 'pending', shippingError: null });
        try {
          const subtotal = computeSubtotal(get().items);
          const { cost, etaDays } = await estimateShippingRate(zip, subtotal);
          set({
            shippingZip: zip,
            shippingCost: cost,
            shippingEta: etaDays,
            shippingStatus: 'idle',
            shippingError: null,
          });
        } catch (error) {
          const message = error instanceof ShippingError ? error.message : "Couldn't estimate shipping for that ZIP.";
          set({ shippingStatus: 'error', shippingError: message, shippingCost: null, shippingEta: null });
        }
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        coupon: state.coupon,
        shippingZip: state.shippingZip,
        shippingCost: state.shippingCost,
        shippingEta: state.shippingEta,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
