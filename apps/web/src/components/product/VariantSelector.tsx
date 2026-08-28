import { cn } from '@/utils/cn';
import type { ProductVariant } from '@/types/product';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VariantSelector({ variants, selectedId, onSelect }: VariantSelectorProps) {
  if (variants.length === 0) return null;

  const isColorStyle = variants.some((v) => v.swatch);

  return (
    <div>
      <p className="text-sm font-medium text-ink mb-2.5">
        {isColorStyle ? 'Color' : 'Size'}
        {selectedId && (
          <span className="text-ink-soft font-normal"> — {variants.find((v) => v.id === selectedId)?.label}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {variants.map((variant) => {
          const selected = variant.id === selectedId;
          if (isColorStyle) {
            return (
              <button
                key={variant.id}
                type="button"
                disabled={!variant.inStock}
                onClick={() => onSelect(variant.id)}
                aria-label={`${variant.label}${!variant.inStock ? ' (out of stock)' : ''}`}
                aria-pressed={selected}
                className={cn(
                  'relative w-9 h-9 rounded-full border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed',
                  selected ? 'border-pine' : 'border-transparent hover:border-stone-dark'
                )}
                style={{ backgroundColor: variant.swatch }}
              >
                {!variant.inStock && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-full h-px bg-ink/50 rotate-45" />
                  </span>
                )}
              </button>
            );
          }
          return (
            <button
              key={variant.id}
              type="button"
              disabled={!variant.inStock}
              onClick={() => onSelect(variant.id)}
              aria-pressed={selected}
              className={cn(
                'px-4 py-2 rounded-[var(--radius-control)] border text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:line-through',
                selected
                  ? 'border-pine bg-pine text-stone-light'
                  : 'border-stone-dark text-ink hover:border-fern'
              )}
            >
              {variant.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
