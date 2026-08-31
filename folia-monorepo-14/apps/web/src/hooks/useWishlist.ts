import { useCallback } from 'react';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';

interface ToggleableProduct {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
}

export function useIsWishlisted(productId: string): boolean {
  return useWishlistStore((s) => s.items.some((i) => i.productId === productId));
}

export function useWishlistCount(): number {
  const hasHydrated = useWishlistStore((s) => s.hasHydrated);
  const items = useWishlistStore((s) => s.items);
  return hasHydrated ? items.length : 0;
}

export function useToggleWishlist() {
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  return useCallback(
    (product: ToggleableProduct) => {
      // Deliberately not propagated as async to every caller (ProductCard
      // is used across the whole site) — a heart-icon toggle is an
      // instant-feedback UX pattern, not something callers wait on.
      // The underlying real API call (when the flag is on) still
      // happens and is still error-handled, just not awaited here.
      toggleItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        categorySlug: product.categorySlug,
        price: product.price,
      }).catch((error: unknown) => {
        console.error('Failed to update wishlist:', error);
      });
    },
    [toggleItem]
  );
}

type MoveToCartResult = { moved: true } | { moved: false; reason: 'needs-variant' };

/**
 * Moves a wishlist entry into the cart. A wishlist entry has no variant
 * selection recorded, so a product with variants can't be moved blindly —
 * this returns `needs-variant` and the caller sends the person to the
 * product page to choose one, instead of guessing.
 */
export function useMoveToCart() {
  const addCartItem = useCartStore((s) => s.addItem);
  const removeWishlistItem = useWishlistStore((s) => s.removeItem);

  return useCallback(
    async (item: ToggleableProduct, hasVariants: boolean, maxQuantity: number): Promise<MoveToCartResult> => {
      if (hasVariants) {
        return { moved: false, reason: 'needs-variant' };
      }
      // Awaited before removing from the wishlist — with the real cart
      // API (Phase 14), the add can genuinely fail (e.g. insufficient
      // stock confirmed server-side); removing from the wishlist first
      // or unconditionally would lose the item from both places if that
      // happened. This was a real sequencing gap, not just a lint fix —
      // caught while making addItem itself properly async.
      await addCartItem({
        productId: item.id,
        slug: item.slug,
        name: item.name,
        categorySlug: item.categorySlug,
        price: item.price,
        variantId: null,
        variantLabel: null,
        quantity: 1,
        maxQuantity,
      });
      await removeWishlistItem(item.id);
      return { moved: true };
    },
    [addCartItem, removeWishlistItem]
  );
}
