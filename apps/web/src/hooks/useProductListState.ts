import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import type { ProductQuery, SortKey } from '@/types/product';

const PAGE_SIZE = 9;

export function useProductListState(fixedCategory?: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ProductQuery = useMemo(
    () => ({
      category: fixedCategory ?? searchParams.get('category') ?? undefined,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      inStockOnly: searchParams.get('inStock') === 'true',
      sort: (searchParams.get('sort') as SortKey | null) ?? 'featured',
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      pageSize: PAGE_SIZE,
    }),
    [searchParams, fixedCategory]
  );

  const view = (searchParams.get('view') as 'grid' | 'list') ?? 'grid';

  const updateFilters = useCallback(
    (next: Partial<ProductQuery>) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(next).forEach(([key, value]) => {
        const paramKey = key === 'inStockOnly' ? 'inStock' : key;
        if (value === undefined || value === false || value === '') {
          params.delete(paramKey);
        } else {
          params.set(paramKey, String(value));
        }
      });
      // Any filter change resets pagination back to page 1
      if (!('page' in next)) params.delete('page');
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(page));
      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams]
  );

  const setSort = useCallback((sort: SortKey) => updateFilters({ sort }), [updateFilters]);
  const setView = useCallback(
    (nextView: 'grid' | 'list') => {
      const params = new URLSearchParams(searchParams);
      params.set('view', nextView);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (fixedCategory) params.set('category', fixedCategory);
    setSearchParams(params);
  }, [fixedCategory, setSearchParams]);

  return { filters, view, updateFilters, setPage, setSort, setView, resetFilters };
}
