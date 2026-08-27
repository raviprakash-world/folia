import { apiClient } from './apiClient';
import type { Category } from '@/types/product';

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/categories');
  return data;
}

export async function fetchCollectionBySlug(slug: string): Promise<Category> {
  const { data } = await apiClient.get<Category>(`/collections/${slug}`);
  return data;
}
