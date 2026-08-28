import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Star, Check } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { ProductGallery } from '@/components/product/ProductGallery';
import { VariantSelector } from '@/components/product/VariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { DeliveryInfo } from '@/components/product/DeliveryInfo';
import { ProductTabs } from '@/components/product/ProductTabs';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ShareButtons } from '@/components/product/ShareButtons';
import { Accordion } from '@/components/common/Accordion';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { PageLoader } from '@/components/common/PageLoader';
import { useProduct, useRelatedProducts } from '@/hooks/useProduct';
import { useCartStore } from '@/store/cartStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useUIStore } from '@/store/uiStore';
import { useIsWishlisted, useToggleWishlist } from '@/hooks/useWishlist';
import { cn } from '@/utils/cn';

const badgeTone = { New: 'ochre', Sale: 'rust', Bestseller: 'pine', 'Low stock': 'stone' } as const;

const genericFaq = [
  { question: 'How is it packaged for shipping?', answer: 'Custom internal bracing holds the pot and soil in place, with breathable air holes — no plastic bag suffocating the leaves.' },
  { question: 'What if it arrives damaged?', answer: 'Photograph it within 48 hours of delivery and reach out through Contact — we replace it at no cost under the 30-day guarantee.' },
  { question: 'Can I change the delivery address after ordering?', answer: 'Yes, as long as the order hasn\u2019t shipped yet. Contact us with your order number.' },
];

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProduct(slug);
  const { data: related } = useRelatedProducts(slug);
  const addCartItem = useCartStore((s) => s.addItem);
  const openCartDrawer = useUIStore((s) => s.openCartDrawer);

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [stockNotice, setStockNotice] = useState<string | null>(null);

  // Hooks must run unconditionally, so the wishlist toggle is wired with a
  // safe fallback id — it's never actually invoked before `product` exists,
  // since the button that calls it only renders once product data has loaded.
  const wishlisted = useIsWishlisted(product?.id ?? '');
  const toggleWishlist = useToggleWishlist();
  const recordView = useRecentlyViewedStore((s) => s.recordView);

  useEffect(() => {
    if (!product) return;
    recordView({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      categorySlug: product.categorySlug,
      price: product.price,
    });
  }, [product, recordView]);

  if (isLoading) return <PageLoader />;

  if (isError || !product) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-pine">Product not found</h1>
        <p className="text-ink-soft mt-2">
          It may have sold out permanently. <Link to="/shop" className="text-fern underline">Browse the shop</Link>.
        </p>
      </Container>
    );
  }

  const onSale = product.compareAtPrice && product.compareAtPrice > product.price;
  const variantBlocksAdd = product.variants.length > 0 && !selectedVariant;
  const selectedVariantData = product.variants.find((v) => v.id === selectedVariant) ?? null;
  const currentProduct = product; // narrowed non-null binding, safe to use inside the closure below

  function handleAddToCart() {
    if (variantBlocksAdd) return;
    const { clampedToMax } = addCartItem({
      productId: currentProduct.id,
      slug: currentProduct.slug,
      name: currentProduct.name,
      categorySlug: currentProduct.categorySlug,
      price: currentProduct.price,
      variantId: selectedVariantData?.id ?? null,
      variantLabel: selectedVariantData?.label ?? null,
      quantity,
      maxQuantity: currentProduct.stockCount,
    });

    setStockNotice(clampedToMax ? "Adjusted to what's in stock — you already had some in your cart." : null);
    setJustAdded(true);
    openCartDrawer();
    setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <Container className="py-12">
      <Breadcrumb
        items={[
          { label: 'Shop', to: '/shop' },
          { label: product.category, to: `/collections/${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      <div className="grid md:grid-cols-2 gap-12">
        <ProductGallery productName={product.name} />

        <div>
          {product.badge && (
            <Tag tone={badgeTone[product.badge]} tilted className="mb-3">
              {product.badge}
            </Tag>
          )}
          <h1 className="font-display text-3xl font-semibold text-pine">{product.name}</h1>

          {product.rating && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex text-ochre">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < Math.round(product.rating!) ? 'fill-ochre' : ''} />
                ))}
              </div>
              <span className="text-sm text-ink-soft">
                {product.rating} ({product.reviewCount} reviews)
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mt-4 font-mono text-2xl">
            <span className={onSale ? 'text-rust' : 'text-ink'}>${product.price}</span>
            {onSale && <span className="text-ink-soft/50 line-through text-lg">${product.compareAtPrice}</span>}
          </div>

          {product.careLevel && (
            <p className="text-sm text-ink-soft mt-2">
              Care level: <span className="text-ink font-medium">{product.careLevel}</span>
            </p>
          )}

          <div className="mt-6 flex flex-col gap-5">
            <VariantSelector
              variants={product.variants}
              selectedId={selectedVariant}
              onSelect={(id) => {
                setSelectedVariant(id);
                setStockNotice(null);
              }}
            />

            <div className="flex items-center gap-4">
              <QuantitySelector value={quantity} onChange={setQuantity} max={product.stockCount} />
              {product.stockCount <= 5 && product.inStock && (
                <span className="text-xs text-rust">Only {product.stockCount} left</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToCart}
                disabled={!product.inStock || variantBlocksAdd}
                className="flex-1"
                icon={justAdded ? <Check size={18} /> : undefined}
              >
                {!product.inStock ? 'Out of stock' : justAdded ? 'Added' : 'Add to cart'}
              </Button>
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className={cn(
                  'p-3.5 rounded-[var(--radius-control)] border transition-colors',
                  wishlisted ? 'border-rust text-rust bg-rust-light' : 'border-stone-dark text-ink-soft hover:text-rust'
                )}
              >
                <Heart size={20} className={wishlisted ? 'fill-rust' : ''} />
              </button>
            </div>
            {variantBlocksAdd && (
              <p className="text-xs text-rust -mt-2">Select a {product.variants.some((v) => v.swatch) ? 'color' : 'size'} first.</p>
            )}
            {stockNotice && <p className="text-xs text-rust -mt-2">{stockNotice}</p>}

            <ShareButtons title={product.name} url={typeof window !== 'undefined' ? window.location.href : ''} />
          </div>

          <DeliveryInfo />
        </div>
      </div>

      <div className="mt-16 max-w-3xl">
        <ProductTabs description={product.description} specs={product.specs} />
      </div>

      <div className="mt-16 max-w-3xl">
        <SectionHeading title="Frequently asked" />
        <Accordion items={genericFaq} />
      </div>

      <div className="mt-16">
        <SectionHeading title="Customer reviews" />
        <ProductReviews productId={product.id} averageRating={product.rating} reviewCount={product.reviewCount} />
      </div>

      {related && related.length > 0 && (
        <div className="mt-16">
          <SectionHeading title="You might also like" />
          <ProductCarousel products={related} />
        </div>
      )}
    </Container>
  );
}
