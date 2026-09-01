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
  // A real bug, caught live: axios's default params serializer encodes
  // arrays as recentlyViewedIds[]=p1&recentlyViewedIds[]=p8 (bracket
  // notation), but the real backend's PersonalizedQueryDto
  // (@IsArray() @IsString({ each: true }), no bracket-aware transform)
  // rejects that literal property name with a real 400 — confirmed
  // directly from a live request, not assumed. Building the query
  // string manually with URLSearchParams instead, which repeats the
  // plain key for each value with no brackets, matches what the DTO
  // actually accepts.
  const searchParams = new URLSearchParams();
  for (const id of recentlyViewedIds) searchParams.append('recentlyViewedIds', id);
  for (const term of recentSearches) searchParams.append('recentSearches', term);

  const { data } = await apiClient.get<Product[]>(
    `/recommendations/personalized?${searchParams.toString()}`
  );
  return data;
}
