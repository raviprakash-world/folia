import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function QuantitySelector({ value, onChange, max = 10 }: QuantitySelectorProps) {
  return (
    <div className="inline-flex items-center border border-stone-dark rounded-[var(--radius-control)]">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className="flex size-11 items-center justify-center text-ink-soft hover:text-heading disabled:opacity-30 disabled:pointer-events-none"
      >
        <Minus size={16} />
      </button>
      <span className="w-9 text-center text-base font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="flex size-11 items-center justify-center text-ink-soft hover:text-heading disabled:opacity-30 disabled:pointer-events-none"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
