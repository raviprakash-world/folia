import { apiClient } from './apiClient';
import type { WishlistItem } from '@/types/cart';

/** Matches the real backend's wishlist response shape exactly (toPublicWishlistItem, Phase 4) — checked directly against the source before writing this. */
export async function fetchRealWishlist(): Promise<WishlistItem[]> {
  const { data } = await apiClient.get<WishlistItem[]>('/wishlist');
  return data;
}

export async function addRealWishlistItem(productId: string): Promise<void> {
  await apiClient.post(`/wishlist/${productId}`);
}

export async function removeRealWishlistItem(productId: string): Promise<void> {
  await apiClient.delete(`/wishlist/${productId}`);
}
