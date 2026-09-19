import { Check } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import type { ProductQuery } from '@/types/product';
import { cn } from '@/utils/cn';
import { useLocationStore } from '@/store/locationStore';

interface ProductFiltersProps {
  filters: ProductQuery;
  onChange: (next: Partial<ProductQuery>) => void;
  onReset: () => void;
  /** On a category page the category is part of the address, so picking another one is a navigation, not a URL parameter. */
  onCategorySelect?: (slug: string | undefined) => void;
  /** The category the page itself is about; it is not counted as a filter the shopper applied. */
  pageCategory?: string;
}

const PRICE_MAX = 2000;

export function ProductFilters({ filters, onChange, onReset, onCategorySelect, pageCategory }: ProductFiltersProps) {
  const { data: categories } = useCategories();
  const location = useLocationStore((s) => s.location);
  const openPicker = useLocationStore((s) => s.openPicker);
  const hasActiveFilters = !!((filters.category && filters.category !== pageCategory) || filters.minPrice || filters.maxPrice || filters.inStockOnly || filters.nearMe);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end lg:justify-between">
        <h2 className="hidden font-mono text-xs uppercase tracking-wider text-ink-soft lg:block">Filters</h2>
        {hasActiveFilters && (
          <button type="button" onClick={onReset} className="min-h-11 px-1 text-sm text-fern-dark underline hover:text-heading">
            Clear all
          </button>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink mb-3">Category</legend>
        <div className="flex flex-col">
          {categories?.map((cat) => {
            const active = filters.category === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  const next = active ? undefined : cat.slug;
                  if (onCategorySelect) onCategorySelect(next);
                  else onChange({ category: next });
                }}
                aria-pressed={active}
                className="flex min-h-11 items-center gap-3 text-[15px] text-left"
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded border',
                    active ? 'bg-fern border-fern' : 'border-stone-dark'
                  )}
                >
                  {active && <Check size={11} className="text-stone-light" />}
                </span>
                <span className={active ? 'text-heading font-medium' : 'text-ink-soft'}>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink mb-3">Price</legend>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={PRICE_MAX}
            placeholder="Min"
            aria-label="Minimum price"
            value={filters.minPrice ?? ''}
            onChange={(e) => onChange({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
            className="h-11 w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 text-[15px] tabular-nums"
          />
          <span className="text-ink-soft text-sm">–</span>
          <input
            type="number"
            min={0}
            max={PRICE_MAX}
            placeholder="Max"
            aria-label="Maximum price"
            value={filters.maxPrice ?? ''}
            onChange={(e) => onChange({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
            className="h-11 w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 text-[15px] tabular-nums"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="sr-only">Availability</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={!!filters.inStockOnly}
            onChange={(e) => onChange({ inStockOnly: e.target.checked || undefined })}
            className="size-5 accent-fern"
          />
          <span className="text-ink-soft">In stock only</span>
        </label>
        <label className={cn('flex min-h-11 items-center gap-3 text-[15px]', location?.state ? 'cursor-pointer' : 'cursor-not-allowed')}>
          <input
            type="checkbox"
            checked={!!filters.nearMe}
            disabled={!location?.state}
            onChange={(e) => onChange({ nearMe: e.target.checked || undefined })}
            className="size-5 accent-fern"
          />
          <span className="text-ink-soft">Ships from my state</span>
        </label>
        {!location ? (
          <button type="button" onClick={openPicker} className="mt-1.5 ml-6 text-xs text-fern hover:text-heading underline">
            Set your location
          </button>
        ) : !location.state ? (
          <p className="mt-1.5 ml-6 text-xs text-ink-soft">We couldn&apos;t find the state for PIN {location.pincode}.</p>
        ) : (
          <p className="mt-1.5 ml-6 text-xs text-ink-soft">{location.state}</p>
        )}
      </fieldset>
    </div>
  );
}
