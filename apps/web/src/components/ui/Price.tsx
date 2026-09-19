import { discountPercent, formatPrice } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface PriceProps {
  price: number;
  compareAtPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { now: 'text-base', was: 'text-xs', off: 'text-xs' },
  md: { now: 'text-xl', was: 'text-sm', off: 'text-sm' },
  lg: { now: 'text-3xl', was: 'text-base', off: 'text-base' },
} as const;

/** Current price first, then the struck-through original and the % saved. The saving is stated in words, never by colour alone. */
export function Price({ price, compareAtPrice, size = 'sm', className }: PriceProps) {
  const off = discountPercent(price, compareAtPrice);
  const s = sizes[size];
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums', className)}>
      <span className={cn('font-semibold text-ink', s.now)}>{formatPrice(price)}</span>
      {off > 0 && (
        <>
          <span className={cn('text-ink-soft line-through', s.was)}>
            <span className="sr-only">Original price </span>
            {formatPrice(compareAtPrice!)}
          </span>
          <span className={cn('font-medium text-rust-text', s.off)}>{off}% off</span>
        </>
      )}
    </p>
  );
}
