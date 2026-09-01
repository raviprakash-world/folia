import { Link } from 'react-router-dom';
import { Trash2, ShoppingBag, AlertCircle } from 'lucide-react';
import { products } from '@/data/products';
import { useWishlistStore } from '@/store/wishlistStore';
import { useMoveToCart } from '@/hooks/useWishlist';
import { formatCurrency } from '@/utils/currency';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import type { WishlistItem } from '@/types/cart';

function WishlistRow({ item }: { item: WishlistItem }) {
  const removeItem = useWishlistStore((s) => s.removeItem);
  const moveToCart = useMoveToCart();
  const product = products.find((p) => p.id === item.productId);

  if (!product) {
    return (
      <Card variant="flat" className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <AlertCircle size={15} />
          <span>{item.name} is no longer available.</span>
        </div>
        <button
          type="button"
          onClick={() => void removeItem(item.productId)}
          aria-label={`Remove ${item.name} from wishlist`}
          className="p-1.5 text-ink-soft hover:text-rust transition-colors shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </Card>
    );
  }

  const hasVariants = product.variants.length > 0;
  const currentProduct = product; // narrowed non-null binding, safe inside the closure below

  async function handleMoveToCart() {
    // This button only renders in the !hasVariants branch below, so the
    // move always succeeds — nothing to branch on from the return value.
    await moveToCart(currentProduct, hasVariants, currentProduct.stockCount);
  }

  return (
    <Card variant="raised" className="p-4 flex items-center gap-4">
      <Link to={`/product/${product.slug}`} className="w-20 h-20 shrink-0">
        <div className="w-full h-full rounded-[var(--radius-control)] bg-stone-dark" />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/product/${product.slug}`} className="font-medium text-ink hover:text-fern transition-colors">
            {product.name}
          </Link>
          {product.badge && <Tag tone={product.badge === 'Sale' ? 'rust' : 'stone'}>{product.badge}</Tag>}
        </div>
        <p className="font-mono text-sm text-ink-soft mt-1">{formatCurrency(product.price)}</p>
        {!product.inStock && <p className="text-xs text-rust mt-1">Out of stock</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasVariants ? (
          <Button variant="outline" size="sm">
            <Link to={`/product/${product.slug}`}>Select options</Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            icon={<ShoppingBag size={14} />}
            disabled={!product.inStock}
            onClick={() => void handleMoveToCart()}
          >
            Move to cart
          </Button>
        )}
        <button
          type="button"
          onClick={() => void removeItem(item.productId)}
          aria-label={`Remove ${product.name} from wishlist`}
          className="p-1.5 text-ink-soft hover:text-rust transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Card>
  );
}

export function WishlistGrid({ items }: { items: WishlistItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <WishlistRow key={item.productId} item={item} />
      ))}
    </div>
  );
}
