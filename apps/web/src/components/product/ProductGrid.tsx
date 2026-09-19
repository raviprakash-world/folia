import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';
import { Tag } from '@/components/ui/Tag';
import { formatCurrency } from '@/utils/currency';
import type { Product } from '@/types/product';

interface ProductGridProps {
  products: Product[];
  view: 'grid' | 'list';
}

const badgeTone = { New: 'ochre', Sale: 'rust', Bestseller: 'pine', 'Low stock': 'stone' } as const;

function ProductListRow({ product }: { product: Product }) {
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;
  return (
    <Link
      to={`/product/${product.slug}`}
      className="flex items-center gap-5 p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark hover:shadow-[var(--shadow-soft)] transition-shadow"
    >
      <div className="relative w-20 h-20 rounded-[var(--radius-control)] bg-stone-dark shrink-0 overflow-hidden">
        <ProductImage src={product.images?.[0]?.url} alt={product.images?.[0]?.altText ?? product.name} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-ink truncate">{product.name}</h3>
          {product.badge && <Tag tone={badgeTone[product.badge]}>{product.badge}</Tag>}
        </div>
        <p className="text-sm text-ink-soft mt-1 line-clamp-1">{product.description}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-baseline gap-2 font-mono text-sm justify-end">
          <span className={onSale ? 'text-rust-text' : 'text-ink'}>{formatCurrency(product.price)}</span>
          {onSale && <span className="text-ink-soft line-through text-xs">{formatCurrency(product.compareAtPrice!)}</span>}
        </div>
        {product.rating && (
          <div className="flex items-center justify-end gap-1 text-xs text-ink-soft mt-1">
            <Star size={12} className="fill-ochre text-ochre" />
            {product.rating} ({product.reviewCount})
          </div>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({ products, view }: ProductGridProps) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {products.map((p) => (
          <ProductListRow key={p.id} product={p} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:gap-x-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
