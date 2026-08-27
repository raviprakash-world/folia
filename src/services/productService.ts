import { apiClient } from './apiClient';
import type { Product, ProductQuery, ProductQueryResult } from '@/types/product';

export async function fetchProducts(query: ProductQuery): Promise<ProductQueryResult> {
  const params: Record<string, string> = {};
  if (query.category) params.category = query.category;
  if (query.minPrice !== undefined) params.minPrice = String(query.minPrice);
  if (query.maxPrice !== undefined) params.maxPrice = String(query.maxPrice);
  if (query.inStockOnly) params.inStockOnly = 'true';
  if (query.sort) params.sort = query.sort;
  if (query.search) params.search = query.search;
  params.page = String(query.page ?? 1);
  params.pageSize = String(query.pageSize ?? 12);

  const { data } = await apiClient.get<ProductQueryResult>('/products', { params });
  return data;
}

export async function fetchProductBySlug(slug: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${slug}`);
  return data;
}

export async function fetchRelatedProducts(slug: string): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>(`/products/${slug}/related`);
  return data;
}
