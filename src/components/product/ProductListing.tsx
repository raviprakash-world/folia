import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { ProductFilters } from './ProductFilters';
import { ProductSort } from './ProductSort';
import { ProductGrid } from './ProductGrid';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { useProducts } from '@/hooks/useProducts';
import { useProductListState } from '@/hooks/useProductListState';
import { cn } from '@/utils/cn';

interface ProductListingProps {
  title: string;
  description?: string;
  fixedCategory?: string;
}

export function ProductListing({ title, description, fixedCategory }: ProductListingProps) {
  const { filters, view, updateFilters, setPage, setSort, setView, resetFilters } =
    useProductListState(fixedCategory);
  const { data, isLoading, isError } = useProducts(filters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <Container className="py-16">
      <div className="mb-10">
        <h1 className="font-display text-4xl font-semibold text-pine">{title}</h1>
        {description && <p className="text-ink-soft mt-2 max-w-[60ch]">{description}</p>}
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-10">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block">
          <ProductFilters filters={filters} onChange={updateFilters} onReset={resetFilters} />
        </aside>

        <div>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-pine"
              >
                <SlidersHorizontal size={16} />
                Filters
              </button>
              {data && (
                <p className="text-sm text-ink-soft font-mono">
                  {data.total} {data.total === 1 ? 'product' : 'products'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <ProductSort value={filters.sort ?? 'featured'} onChange={setSort} />
              <div className="hidden sm:flex items-center border border-stone-dark rounded-[var(--radius-control)] overflow-hidden">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                  className={cn('p-2', view === 'grid' ? 'bg-pine text-stone-light' : 'text-ink-soft')}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  className={cn('p-2', view === 'list' ? 'bg-pine text-stone-light' : 'text-ink-soft')}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {isLoading && <ProductGridSkeleton />}

          {isError && (
            <EmptyState
              title="Couldn't load products"
              description="Something went wrong fetching the catalog. Try refreshing the page."
            />
          )}

          {data && data.items.length === 0 && (
            <EmptyState
              title="No products match those filters"
              description="Try widening your price range or clearing a filter."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {data && data.items.length > 0 && (
            <>
              <ProductGrid products={data.items} view={view} />
              <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs bg-stone-light p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-semibold text-pine">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="p-1.5 text-ink-soft"
              >
                <X size={20} />
              </button>
            </div>
            <ProductFilters filters={filters} onChange={updateFilters} onReset={resetFilters} />
          </div>
        </div>
      )}
    </Container>
  );
}
