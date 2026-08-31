import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { formatCurrency } from '@/utils/currency';
import { useCartStore } from '@/store/cartStore';
import type { CartItem } from '@/types/cart';

interface CartLineItemProps {
  item: CartItem;
  compact?: boolean;
}

export function CartLineItem({ item, compact = false }: CartLineItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const atMax = item.quantity >= item.maxQuantity;

  return (
    <div className="flex gap-3">
      <div className={compact ? 'w-16 h-16' : 'w-20 h-20'}>
        <div className="w-full h-full rounded-[var(--radius-control)] bg-stone-dark" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/product/${item.slug}`}
              className="text-sm font-medium text-ink hover:text-fern transition-colors line-clamp-1"
            >
              {item.name}
            </Link>
            {item.variantLabel && <p className="text-xs text-ink-soft mt-0.5">{item.variantLabel}</p>}
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.lineId)}
            aria-label={`Remove ${item.name} from cart`}
            className="p-1 text-ink-soft hover:text-rust transition-colors shrink-0"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <QuantitySelector
            value={item.quantity}
            onChange={(qty) => updateQuantity(item.lineId, qty)}
            max={item.maxQuantity}
          />
          <span className="font-mono text-sm text-ink">{formatCurrency(item.price * item.quantity)}</span>
        </div>
        {atMax && <p className="text-xs text-rust mt-1">Max available in stock</p>}
      </div>
    </div>
  );
}
