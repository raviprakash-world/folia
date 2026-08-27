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
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 py-2 text-sm text-ink"
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
