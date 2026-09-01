import { apiClient } from './apiClient';
import type { Product, Category } from '@/types/product';

/** Matches the real backend's search response exactly (SearchService.search, Phase 7) — products/categories use toPublicProduct/toPublicCategory, the same functions already proven correct via this session's catalog integration. Deliberately has no blog field: blog posts aren't a real backend concept at all (confirmed directly, Phase 7), so blog matching stays client-side regardless of this flag. */
interface RealSearchResponse {
  products: Product[];
  categories: Category[];
  didYouMean: string | null;
}

export async function fetchRealSearch(query: string): Promise<RealSearchResponse> {
  const { data } = await apiClient.get<RealSearchResponse>('/search', { params: { q: query } });
  return data;
}
