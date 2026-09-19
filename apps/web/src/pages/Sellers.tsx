import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Store } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { useSellers } from '@/hooks/useSellerStorefront';
import type { SellerStorefront } from '@/types/seller';

const PAGE_SIZE = 12;

function SellerCard({ seller }: { seller: SellerStorefront }) {
  return (
    <Link
      to={`/sellers/${seller.slug}`}
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4 transition-colors hover:border-fern sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-stone flex items-center justify-center shrink-0 overflow-hidden">
          {seller.logoUrl ? (
            <img src={seller.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store size={20} className="text-ink-soft" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-heading truncate">{seller.displayName}</h2>
          <div className="mt-0.5 flex items-center gap-3 text-sm text-ink-soft">
            <span>
              {seller.productCount} {seller.productCount === 1 ? 'product' : 'products'}
            </span>
            {seller.averageRating !== null && (
              <span className="flex items-center gap-1">
                <Star size={11} className="fill-ochre text-ochre" />
                {seller.averageRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-ink-soft line-clamp-2">{seller.description}</p>
    </Link>
  );
}

/** Marketplace Phase 16 — browse every active seller, not just one storefront reached by a direct link/product. */
export default function Sellers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useSellers({ search: search || undefined, page, pageSize: PAGE_SIZE });

  return (
    <Container className="py-12">
      <PageHeader title="Sellers" description="Independent makers and shops selling on Folia." />

      <div className="relative mb-6 max-w-sm sm:mb-8">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search sellers"
          aria-label="Search sellers"
          className="h-11 w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light pl-10 pr-3.5 text-[15px] transition-colors focus:border-fern"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-[var(--radius-card)] bg-stone-dark/40 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Something went wrong" description="We couldn't load the sellers right now." onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No sellers found" description="Try a different search." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {data.items.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
          <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </Container>
  );
}
