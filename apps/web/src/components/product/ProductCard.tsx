import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/utils/cn';
import { ProductImage } from '@/components/product/ProductImage';
import { useIsWishlisted, useToggleWishlist } from '@/hooks/useWishlist';
import { useLocationStore } from '@/store/locationStore';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
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

/** Borderless tile: photo, then who sells it, name, rating, price, and one honest delivery line. Works at ~160px wide (two across on a phone). */
export function ProductCard({ product, className }: ProductCardProps) {
  const wishlisted = useIsWishlisted(product.id);
  const toggleWishlist = useToggleWishlist();
  const [popping, setPopping] = useState(false);
  const locationState = useLocationStore((s) => s.location?.state);
  const inYourState = !!locationState && product.shipsFrom?.state.toLowerCase() === locationState.toLowerCase();
  const freeDelivery = product.price >= FREE_SHIPPING_THRESHOLD;
  const sellerName = product.seller?.displayName ?? 'Folia';

  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-stone-dark">
        <Link to={`/product/${product.slug}`} aria-label={product.name} tabIndex={-1} className="absolute inset-0 block">
          <ProductImage
            src={product.images?.[0]?.url}
            alt={product.images?.[0]?.altText ?? product.name}
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
            className="transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        {product.badge && (
          <Tag tone={badgeTone[product.badge]} className="pointer-events-none absolute left-2 top-2 z-10">
            {product.badge}
          </Tag>
        )}
        {!product.inStock && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-ink/70 py-1 text-center text-xs font-medium text-cream-light">
            Out of stock
          </span>
        )}
        <button
          type="button"
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          onClick={() => {
            if (!wishlisted) setPopping(true);
            toggleWishlist(product);
          }}
          className="absolute right-0 top-0 z-10 flex size-11 items-center justify-center"
        >
          <span
            onAnimationEnd={() => setPopping(false)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full bg-stone-light/90 shadow-sm transition-colors',
              wishlisted ? 'text-rust-text' : 'text-ink-soft hover:text-rust-text',
              popping && 'animate-heart-pop'
            )}
          >
            <Heart size={18} aria-hidden="true" className={wishlisted ? 'fill-rust' : ''} />
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-2.5">
        <p className="truncate text-xs text-ink-soft">{sellerName}</p>
        <h3 className="line-clamp-2 text-[15px] font-medium leading-tight text-ink">
          <Link to={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-[var(--radius-card)]">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-col gap-1 pt-0.5">
          <Rating rating={product.rating} count={product.reviewCount} />
          <Price price={product.price} compareAtPrice={product.compareAtPrice} />
          {(freeDelivery || inYourState) && (
            <p className="text-xs font-medium text-fern-dark">
              {freeDelivery && 'Free delivery'}
              {freeDelivery && inYourState && ' · '}
              {inYourState && 'Ships from your state'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
