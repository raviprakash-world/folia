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
    <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-8 border-b border-stone-dark">
      <div className="w-20 h-20 rounded-full bg-stone flex items-center justify-center shrink-0 overflow-hidden">
        {seller.logoUrl ? (
          <img src={seller.logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Store size={28} className="text-ink-soft" />
        )}
      </div>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold text-heading">{seller.displayName}</h1>
        <p className="text-ink-soft mt-1 max-w-[60ch]">{seller.description}</p>
        <div className="flex items-center gap-4 mt-3 text-sm text-ink-soft font-mono">
          <span>
            {seller.productCount} {seller.productCount === 1 ? 'product' : 'products'}
          </span>
          {seller.averageRating !== null && (
            <span className="flex items-center gap-1">
              <Star size={14} className="fill-ochre text-ochre" />
              {seller.averageRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
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
