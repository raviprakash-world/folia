import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { ProductFilters } from './ProductFilters';
import { ProductSort } from './ProductSort';
import { ProductGrid } from './ProductGrid';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { useProducts } from '@/hooks/useProducts';
import { useProductListState } from '@/hooks/useProductListState';
import { cn } from '@/utils/cn';

interface ProductListingProps {
  title: string;
  description?: string;
  fixedCategory?: string;
  /** A curated collection page fixes this to that collection's products. */
  fixedCollection?: string;
  /** The offers page fixes this to show only discounted products. */
  fixedOnSale?: boolean;
  /** Marketplace Phase 4 — a seller storefront page fixes this to show
   * only that seller's own catalog. */
  fixedSellerId?: string;
  /** Optional content rendered above the grid, in place of the default
   * title/description block — the storefront page uses this for its own
   * seller-info hero instead of a plain heading. */
  header?: ReactNode;
}

export function ProductListing({
  title,
  description,
  fixedCategory,
  fixedCollection,
  fixedOnSale,
  fixedSellerId,
  header,
}: ProductListingProps) {
  const { filters, view, updateFilters, setPage, setSort, setView, resetFilters } =
    useProductListState({
      category: fixedCategory,
      sellerId: fixedSellerId,
      collection: fixedCollection,
      onSale: fixedOnSale,
    });
  const { data, isLoading, isError, refetch } = useProducts(filters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <Container className="py-6 sm:py-10 lg:py-16">
      {header ?? (
        <div className="mb-6 sm:mb-10">
          <h1 className="font-display text-3xl font-semibold text-heading sm:text-4xl">{title}</h1>
          {description && <p className="text-ink-soft mt-2 max-w-[60ch]">{description}</p>}
        </div>
      )}

      <div className="grid lg:grid-cols-[220px_1fr] gap-10">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block">
          <ProductFilters filters={filters} onChange={updateFilters} onReset={resetFilters} />
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
            {data && (
              <p className="order-2 text-sm text-ink-soft lg:order-1" aria-live="polite">
                {data.total} {data.total === 1 ? 'product' : 'products'}
              </p>
            )}
            <div className="order-1 flex items-center gap-2 lg:order-2 lg:gap-3">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-4 text-[15px] font-medium text-ink hover:border-fern lg:hidden"
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
              </button>
              <ProductSort value={filters.sort ?? 'featured'} onChange={setSort} />
              <div className="hidden sm:flex items-center border border-stone-dark rounded-[var(--radius-control)] overflow-hidden">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  onClick={() => setView('grid')}
                  className={cn('p-2.5', view === 'grid' ? 'bg-pine text-cream-light' : 'text-ink-soft')}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  className={cn('p-2.5', view === 'list' ? 'bg-pine text-cream-light' : 'text-ink-soft')}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {isLoading && <ProductGridSkeleton />}

          {isError && (
            <ErrorState title="Something went wrong" description="We couldn't load the products right now." onRetry={() => void refetch()} />
          )}

          {data && data.items.length === 0 && (
            <EmptyState
              title="Nothing matches those filters"
              description="Try a wider price range, or clear a filter to see more."
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
              <h2 className="font-display text-lg font-semibold text-heading">Filters</h2>
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
