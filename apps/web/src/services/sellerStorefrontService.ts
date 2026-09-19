import { apiClient } from './apiClient';
import type { SellerStorefront, SellerDirectoryQuery, SellerDirectoryResult } from '@/types/seller';

export async function fetchSellerStorefront(slug: string): Promise<SellerStorefront> {
  const { data } = await apiClient.get<SellerStorefront>(`/sellers/${slug}`);
  // A proxy or outage can answer 200 with a web page instead of JSON; treat that as a failed load, not data.
  if (!data || typeof data !== 'object' || typeof data.slug !== 'string') throw new Error('Unexpected seller response');
  return data;
}

/** Marketplace Phase 16 — GET /sellers, the public sellers directory. */
export async function fetchSellers(query: SellerDirectoryQuery): Promise<SellerDirectoryResult> {
  const { data } = await apiClient.get<SellerDirectoryResult>('/sellers', { params: query });
  if (!data || !Array.isArray(data.items)) throw new Error('Unexpected sellers response');
  return data;
}
