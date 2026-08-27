import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/services/categoryService';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // categories change rarely
  });
}
