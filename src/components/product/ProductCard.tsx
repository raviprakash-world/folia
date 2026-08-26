import { Link } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/utils/cn';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  className?: string;
}

const badgeTone = {
  New: 'ochre',
  Sale: 'rust',
  Bestseller: 'pine',
  'Low stock': 'stone',
} as const;

/**
 * The wishlist heart is visual-only until Phase 4 wires the Zustand store —
 * it's part of the card's interaction design, not deferred to a later pass,
 * so the click target and layout are already correct.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;

  return (
    <Card variant="raised" className={cn('p-4 group', className)}>
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square rounded-[var(--radius-control)] bg-stone-dark mb-4 overflow-hidden">
          {product.badge && (
            <Tag tone={badgeTone[product.badge]} className="absolute top-3 left-3 z-10">
              {product.badge}
            </Tag>
          )}
          <button
            type="button"
            aria-label={`Add ${product.name} to wishlist`}
            onClick={(e) => e.preventDefault()}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-stone-light/90 text-ink-soft hover:text-rust transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Heart size={16} />
          </button>
        </div>

        <h3 className="font-medium text-ink text-sm">{product.name}</h3>

        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-baseline gap-2 font-mono text-sm">
            <span className={onSale ? 'text-rust' : 'text-ink-soft'}>${product.price}</span>
            {onSale && (
              <span className="text-ink-soft/50 line-through text-xs">
                ${product.compareAtPrice}
              </span>
            )}
          </div>
          {product.rating && (
            <div className="flex items-center gap-1 text-xs text-ink-soft">
              <Star size={12} className="fill-ochre text-ochre" />
              {product.rating}
            </div>
          )}
        </div>
      </Link>
    </Card>
  );
}
