import { apiClient } from './apiClient';
import type { Review } from '@/types/product';

export async function fetchReviews(productId: string): Promise<Review[]> {
  const { data } = await apiClient.get<Review[]>('/reviews', { params: { productId } });
  return data;
}
