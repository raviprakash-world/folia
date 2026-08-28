const options = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

interface DateRangeFilterProps {
  value: number;
  onChange: (days: number) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft hidden sm:inline">Range</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 py-2 text-sm text-ink"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Last {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
