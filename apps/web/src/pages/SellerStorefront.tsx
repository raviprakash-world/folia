import { useParams, Link } from 'react-router-dom';
import { Star, Store } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageLoader } from '@/components/common/PageLoader';
import { ProductListing } from '@/components/product/ProductListing';
import { useSellerStorefront } from '@/hooks/useSellerStorefront';

/**
 * Marketplace Phase 4 — a seller's public storefront. Reuses
 * ProductListing entirely for the catalog grid/filters/pagination (via
 * its new fixedSellerId prop) rather than building a second product-grid
 * component — the only genuinely new UI here is the seller-info hero.
 */
export default function SellerStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const { data: seller, isLoading, isError } = useSellerStorefront(slug);

  if (isLoading) return <PageLoader />;

  if (isError || !seller) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-heading">Shop not found</h1>
        <p className="text-ink-soft mt-2">
          It may no longer be active. <Link to="/shop" className="text-fern underline">Browse the shop</Link>.
        </p>
      </Container>
    );
  }

  const hero = (
    <div className="mb-6 border-b border-stone-dark pb-6 sm:mb-10 sm:pb-8">
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone sm:size-20">
          {seller.logoUrl ? <img src={seller.logoUrl} alt="" className="h-full w-full object-cover" /> : <Store size={26} className="text-ink-soft" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight text-heading sm:text-3xl">{seller.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span>
              {seller.productCount} {seller.productCount === 1 ? 'product' : 'products'}
            </span>
            {seller.averageRating !== null && (
              <span className="flex items-center gap-1">
                <Star size={14} className="fill-ochre text-ochre" aria-hidden="true" />
                {seller.averageRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">{seller.description}</p>
    </div>
  );

  return (
    <ProductListing
      title={seller.displayName}
      fixedSellerId={seller.id}
      header={hero}
    />
  );
}
