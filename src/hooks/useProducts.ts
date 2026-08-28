import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '@/services/productService';
import type { ProductQuery } from '@/types/product';

export function useProducts(query: ProductQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => fetchProducts(query),
    placeholderData: (previousData) => previousData, // keep old page visible while the next page loads
    enabled: options?.enabled,
  });
}
