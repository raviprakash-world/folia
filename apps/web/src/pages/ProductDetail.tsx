import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Check } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { Rating } from '@/components/ui/Rating';
import { Tag } from '@/components/ui/Tag';
import { ProductGallery } from '@/components/product/ProductGallery';
import { VariantSelector } from '@/components/product/VariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector';
import { DeliveryCheck, PolicyRows } from '@/components/product/DeliveryInfo';
import { PlantHighlights } from '@/components/product/PlantHighlights';
import { StickyBuyBar } from '@/components/product/StickyBuyBar';
import { ProductDetailSkeleton } from '@/components/product/ProductDetailSkeleton';
import { ProductTabs } from '@/components/product/ProductTabs';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ShareButtons } from '@/components/product/ShareButtons';
import { Accordion } from '@/components/common/Accordion';
import { ErrorState } from '@/components/common/ErrorState';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { useProduct } from '@/hooks/useProduct';
import { useSimilarProducts, useFrequentlyBoughtTogether, useCustomersAlsoViewed } from '@/hooks/useRecommendations';
import { useCartStore } from '@/store/cartStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useUIStore } from '@/store/uiStore';
import { useIsWishlisted, useToggleWishlist } from '@/hooks/useWishlist';
import { cn } from '@/utils/cn';

const badgeTone = { New: 'ochre', Sale: 'rust', Bestseller: 'pine', 'Low stock': 'stone' } as const;

const genericFaq = [
  { question: 'How is it packaged for shipping?', answer: 'Custom internal bracing holds the pot and soil in place, with breathable air holes — no plastic bag suffocating the leaves.' },
  { question: 'What if it arrives damaged?', answer: 'Photograph it within 48 hours of delivery and reach out through Contact — we replace it at no cost under the 30-day guarantee.' },
  { question: 'Can I change the delivery address after ordering?', answer: 'Yes, as long as the order hasn’t shipped yet. Contact us with your order number.' },
];

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, refetch } = useProduct(slug);
  const similarProducts = useSimilarProducts(product);
  const frequentlyBoughtTogether = useFrequentlyBoughtTogether(product);
  const customersAlsoViewed = useCustomersAlsoViewed(product);
  const addCartItem = useCartStore((s) => s.addItem);
  const openCartDrawer = useUIStore((s) => s.openCartDrawer);

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  const [variantPrompt, setVariantPrompt] = useState(false);
  const variantRef = useRef<HTMLDivElement>(null);

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

  if (isLoading) return <ProductDetailSkeleton />;

  if (isError) {
    return (
      <Container className="py-10">
        <ErrorState title="Something went wrong" description="We couldn't load this product right now." onRetry={() => void refetch()} />
      </Container>
    );
  }

  if (!product) {
    return (
      <Container className="py-12 sm:py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-heading">We couldn&apos;t find that product</h1>
        <p className="mt-2 text-ink-soft">
          It may no longer be available. <Link to="/shop" className="text-fern-dark underline">Browse the shop</Link>.
        </p>
      </Container>
    );
  }

  const variantBlocksAdd = product.variants.length > 0 && !selectedVariant;
  const variantWord = product.variants.some((v) => v.swatch) ? 'color' : 'size';
  const selectedVariantData = product.variants.find((v) => v.id === selectedVariant) ?? null;
  const currentProduct = product; // narrowed non-null binding, safe to use inside the closure below

  async function handleAddToCart() {
    if (variantBlocksAdd) {
      setVariantPrompt(true);
      variantRef.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    try {
      const { clampedToMax } = await addCartItem({
        productId: currentProduct.id,
        slug: currentProduct.slug,
        name: currentProduct.name,
        categorySlug: currentProduct.categorySlug,
        price: currentProduct.price,
        variantId: selectedVariantData?.id ?? null,
        variantLabel: selectedVariantData?.label ?? null,
        quantity,
        maxQuantity: currentProduct.stockCount,
        sellerName: currentProduct.seller?.displayName ?? null,
        imageUrl: currentProduct.images?.[0]?.url ?? null,
        compareAtPrice: currentProduct.compareAtPrice ?? null,
      });

      setStockNotice(clampedToMax ? "Adjusted to what's in stock — you already had some in your cart." : null);
      setJustAdded(true);
      openCartDrawer();
      setTimeout(() => setJustAdded(false), 2000);
    } catch {
      // A real backend call (unlike the old local-only version) can
      // genuinely fail — e.g. insufficient stock confirmed server-side.
      setStockNotice("Couldn't add that to your cart — please try again.");
    }
  }

  return (
    <Container className="pb-28 pt-4 md:py-12 lg:pb-12">
      <Breadcrumb
        items={[
          { label: 'Shop', to: '/shop' },
          { label: product.category, to: `/collections/${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <ProductGallery productName={product.name} images={product.images} />

        <div>
          {product.badge && (
            <Tag tone={badgeTone[product.badge]} tilted className="mb-3">
              {product.badge}
            </Tag>
          )}
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold leading-tight text-heading md:text-3xl">{product.name}</h1>
            <button
              type="button"
              onClick={() => toggleWishlist(product)}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
              className={cn(
                '-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors',
                wishlisted ? 'text-rust-text' : 'text-ink-soft hover:text-rust-text'
              )}
            >
              <Heart size={24} className={wishlisted ? 'fill-rust' : ''} />
            </button>
          </div>

          <p className="mt-1.5 text-sm text-ink-soft">
            Sold by{' '}
            {product.seller ? (
              <Link to={`/sellers/${product.seller.slug}`} className="font-medium text-fern-dark underline">
                {product.seller.displayName}
              </Link>
            ) : (
              <span className="font-medium text-ink">Folia</span>
            )}
          </p>

          <div className="mt-2">
            <Rating rating={product.rating} count={product.reviewCount} className="text-sm" />
          </div>

          <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" className="mt-3" />

          <div className="mt-5 flex flex-col gap-5">
            <div ref={variantRef}>
              <VariantSelector
                variants={product.variants}
                selectedId={selectedVariant}
                onSelect={(id) => {
                  setSelectedVariant(id);
                  setVariantPrompt(false);
                  setStockNotice(null);
                }}
              />
              {variantPrompt && variantBlocksAdd && (
                <p role="alert" className="mt-2 text-sm font-medium text-rust-text">
                  Please choose a {variantWord} to continue.
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <QuantitySelector value={quantity} onChange={setQuantity} max={product.stockCount} />
              {product.stockCount <= 5 && product.inStock && <span className="text-sm font-medium text-rust-text">Only {product.stockCount} left</span>}
            </div>

            <div className="hidden lg:block">
              <Button
                variant="primary"
                size="lg"
                onClick={() => void handleAddToCart()}
                disabled={!product.inStock}
                className="w-full"
                icon={justAdded ? <Check size={18} /> : undefined}
              >
                {!product.inStock ? 'Out of stock' : justAdded ? 'Added' : 'Add to cart'}
              </Button>
            </div>
            {stockNotice && (
              <p role="status" className="-mt-2 text-sm text-rust-text">
                {stockNotice}
              </p>
            )}

            <DeliveryCheck price={product.price} shipsFrom={product.shipsFrom} />
            <PlantHighlights product={product} />
            <PolicyRows categorySlug={product.categorySlug} />
            <ShareButtons title={product.name} url={typeof window !== 'undefined' ? window.location.href : ''} />
          </div>
        </div>
      </div>

      <div className="mt-10 max-w-3xl md:mt-16">
        <ProductTabs description={product.description} specs={product.specs} />
      </div>

      <div className="mt-10 max-w-3xl md:mt-16">
        <SectionHeading title="Frequently asked" />
        <Accordion items={genericFaq} />
      </div>

      <div className="mt-10 md:mt-16">
        <SectionHeading title="Customer reviews" />
        <ProductReviews productId={product.id} productSlug={product.slug} averageRating={product.rating} reviewCount={product.reviewCount} />
      </div>

      {similarProducts.length > 0 && (
        <div className="mt-10 md:mt-16">
          <SectionHeading title="Similar products" />
          <ProductCarousel products={similarProducts} />
        </div>
      )}

      {frequentlyBoughtTogether.length > 0 && (
        <div className="mt-10 md:mt-16">
          <SectionHeading title="Frequently bought together" />
          <ProductCarousel products={frequentlyBoughtTogether} />
        </div>
      )}

      {customersAlsoViewed.length > 0 && (
        <div className="mt-10 md:mt-16">
          <SectionHeading title="Customers also viewed" />
          <ProductCarousel products={customersAlsoViewed} />
        </div>
      )}

      <StickyBuyBar
        price={product.price}
        compareAtPrice={product.compareAtPrice}
        inStock={product.inStock}
        needsVariant={variantBlocksAdd}
        variantLabel={variantWord}
        added={justAdded}
        onAdd={() => void handleAddToCart()}
      />
    </Container>
  );
}
