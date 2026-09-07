import { apiClient } from './apiClient';
import type { SellerStorefront } from '@/types/seller';

export async function fetchSellerStorefront(slug: string): Promise<SellerStorefront> {
  const { data } = await apiClient.get<SellerStorefront>(`/sellers/${slug}`);
  return data;
}
