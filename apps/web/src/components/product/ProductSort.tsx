import type { SortKey } from '@/types/product';

interface ProductSortProps {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}

const options: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top rated' },
];

export function ProductSort({ value, onChange }: ProductSortProps) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm lg:flex-none">
      <span className="hidden text-ink-soft lg:inline">Sort</span>
      <select
        value={value}
        aria-label="Sort products"
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 text-[15px] text-ink lg:h-10 lg:w-auto"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
