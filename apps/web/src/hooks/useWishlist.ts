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
      toggleItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        categorySlug: product.categorySlug,
        price: product.price,
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
    (item: ToggleableProduct, hasVariants: boolean, maxQuantity: number): MoveToCartResult => {
      if (hasVariants) {
        return { moved: false, reason: 'needs-variant' };
      }
      addCartItem({
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
      removeWishlistItem(item.id);
      return { moved: true };
    },
    [addCartItem, removeWishlistItem]
  );
}
