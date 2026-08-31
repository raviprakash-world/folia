import { apiClient } from './apiClient';
import type { Product } from '@/types/product';

/**
 * Matches the real backend's recommendation responses exactly — all
 * three return a plain Product[] directly (RecommendationsService,
 * Phase 8), using the same toPublicProduct shape already proven correct
 * via this session's catalog integration. Only these 3 of the real
 * backend's 5 endpoints have a frontend equivalent — bestsellers/trending
 * exist server-side but nothing in the frontend calls for them yet.
 */
export async function fetchRealSimilarProducts(productId: string): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>(`/recommendations/products/${productId}/similar`);
  return data;
}

export async function fetchRealFrequentlyBoughtTogether(productId: string): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>(`/recommendations/products/${productId}/frequently-bought-together`);
  return data;
}

export async function fetchRealPersonalizedRecommendations(
  recentlyViewedIds: string[],
  recentSearches: string[]
): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>('/recommendations/personalized', {
    params: { recentlyViewedIds, recentSearches },
  });
  return data;
}
