import { Check } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import type { ProductQuery } from '@/types/product';
import { cn } from '@/utils/cn';
import { useLocationStore } from '@/store/locationStore';

interface ProductFiltersProps {
  filters: ProductQuery;
  onChange: (next: Partial<ProductQuery>) => void;
  onReset: () => void;
}

const PRICE_MAX = 2000;

export function ProductFilters({ filters, onChange, onReset }: ProductFiltersProps) {
  const { data: categories } = useCategories();
  const location = useLocationStore((s) => s.location);
  const openPicker = useLocationStore((s) => s.openPicker);
  const hasActiveFilters = !!(filters.category || filters.minPrice || filters.maxPrice || filters.inStockOnly || filters.nearMe);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink-soft">Filters</h2>
        {hasActiveFilters && (
          <button type="button" onClick={onReset} className="text-xs text-fern hover:text-heading underline">
            Clear all
          </button>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink mb-3">Category</legend>
        <div className="flex flex-col gap-2.5">
          {categories?.map((cat) => {
            const active = filters.category === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onChange({ category: active ? undefined : cat.slug })}
                aria-pressed={active}
                className="flex items-center gap-2.5 text-sm text-left"
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-4 h-4 rounded border shrink-0',
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
            className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-2.5 py-1.5 text-sm font-mono"
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
            className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-2.5 py-1.5 text-sm font-mono"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="sr-only">Availability</legend>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!filters.inStockOnly}
            onChange={(e) => onChange({ inStockOnly: e.target.checked || undefined })}
            className="w-4 h-4 accent-fern"
          />
          <span className="text-ink-soft">In stock only</span>
        </label>
        <label className={cn('flex items-center gap-2.5 text-sm mt-3', location?.state ? 'cursor-pointer' : 'cursor-not-allowed')}>
          <input
            type="checkbox"
            checked={!!filters.nearMe}
            disabled={!location?.state}
            onChange={(e) => onChange({ nearMe: e.target.checked || undefined })}
            className="w-4 h-4 accent-fern"
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
