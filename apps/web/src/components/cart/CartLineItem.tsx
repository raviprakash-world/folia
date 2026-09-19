import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { formatCurrency } from '@/utils/currency';
import { useCartStore } from '@/store/cartStore';
import { products } from '@/data/products';
import { ProductImage } from '@/components/product/ProductImage';
import type { CartItem } from '@/types/cart';

interface CartLineItemProps {
  item: CartItem;
  compact?: boolean;
}

export function CartLineItem({ item, compact = false }: CartLineItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const atMax = item.quantity >= item.maxQuantity;
  const imageUrl = item.imageUrl ?? products.find((p) => p.id === item.productId)?.images?.[0]?.url;
  const wasTotal = item.compareAtPrice && item.compareAtPrice > item.price ? item.compareAtPrice * item.quantity : null;

  return (
    <div className="flex gap-3">
      <Link to={`/product/${item.slug}`} aria-hidden="true" tabIndex={-1} className={compact ? 'size-16 shrink-0' : 'size-20 shrink-0 sm:size-24'}>
        <span className="relative block h-full w-full overflow-hidden rounded-[var(--radius-control)] bg-stone-dark">
          <ProductImage src={imageUrl} alt="" sizes="96px" />
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/product/${item.slug}`} className="line-clamp-2 text-[15px] font-medium leading-snug text-ink transition-colors hover:text-fern">
              {item.name}
            </Link>
            {item.variantLabel && <p className="mt-0.5 text-sm text-ink-soft">{item.variantLabel}</p>}
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.lineId)}
            aria-label={`Remove ${item.name} from cart`}
            className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center text-ink-soft transition-colors hover:text-rust-text"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <QuantitySelector value={item.quantity} onChange={(qty) => updateQuantity(item.lineId, qty)} max={item.maxQuantity} />
          <p className="text-right tabular-nums">
            <span className="block font-semibold text-ink">{formatCurrency(item.price * item.quantity)}</span>
            {wasTotal && <span className="block text-xs text-ink-soft line-through">{formatCurrency(wasTotal)}</span>}
          </p>
        </div>
        {atMax && <p className="mt-1 text-sm text-rust-text">That&apos;s all we have in stock</p>}
      </div>
    </div>
  );
}
