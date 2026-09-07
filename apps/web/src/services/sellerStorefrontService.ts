import { apiClient } from './apiClient';
import type { SellerStorefront, SellerDirectoryQuery, SellerDirectoryResult } from '@/types/seller';

export async function fetchSellerStorefront(slug: string): Promise<SellerStorefront> {
  const { data } = await apiClient.get<SellerStorefront>(`/sellers/${slug}`);
  return data;
}

/** Marketplace Phase 16 — GET /sellers, the public sellers directory. */
export async function fetchSellers(query: SellerDirectoryQuery): Promise<SellerDirectoryResult> {
  const { data } = await apiClient.get<SellerDirectoryResult>('/sellers', { params: query });
  return data;
}
