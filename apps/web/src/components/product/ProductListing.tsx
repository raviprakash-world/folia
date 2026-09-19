import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useFocusTrap } from '@/hooks/useFocusTrap';
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

function FilterDrawer({ onClose, total, children }: { onClose: () => void; total?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-stone-light"
      >
        <div className="flex items-center justify-between border-b border-stone-dark px-5 py-2">
          <h2 className="font-display text-lg font-semibold text-heading">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className="-mr-2 flex size-11 items-center justify-center text-ink-soft">
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        <div className="border-t border-stone-dark p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <Button size="lg" className="w-full" onClick={onClose}>
            {total === undefined ? 'Show products' : `Show ${total} ${total === 1 ? 'product' : 'products'}`}
          </Button>
        </div>
      </div>
    </div>
  );
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // A category page fixes its category, so switching category means going to that category's page (or the full shop),
  // carrying the price / stock filters along.
  const selectCategory = fixedCategory
    ? (slug: string | undefined) => {
        const params = new URLSearchParams(searchParams);
        params.delete('page');
        params.delete('category');
        const qs = params.toString();
        void navigate(`${slug ? `/collections/${slug}` : '/shop'}${qs ? `?${qs}` : ''}`);
      }
    : undefined;

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
          <ProductFilters filters={filters} onChange={updateFilters} onReset={resetFilters} onCategorySelect={selectCategory} pageCategory={fixedCategory} />
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
                  className={cn('flex size-10 items-center justify-center', view === 'grid' ? 'bg-pine text-cream-light' : 'text-ink-soft')}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                  className={cn('flex size-10 items-center justify-center', view === 'list' ? 'bg-pine text-cream-light' : 'text-ink-soft')}
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
        <FilterDrawer onClose={() => setMobileFiltersOpen(false)} total={data?.total}>
          <ProductFilters
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            onCategorySelect={selectCategory}
            pageCategory={fixedCategory}
          />
        </FilterDrawer>
      )}
    </Container>
  );
}
