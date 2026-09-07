import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Store } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { useSellers } from '@/hooks/useSellerStorefront';
import type { SellerStorefront } from '@/types/seller';

const PAGE_SIZE = 12;

function SellerCard({ seller }: { seller: SellerStorefront }) {
  return (
    <Link
      to={`/sellers/${seller.slug}`}
      className="flex flex-col gap-3 p-5 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light hover:border-fern transition-colors"
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
          <div className="flex items-center gap-3 text-xs text-ink-soft font-mono mt-0.5">
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
  const { data, isLoading } = useSellers({ search: search || undefined, page, pageSize: PAGE_SIZE });

  return (
    <Container className="py-12">
      <PageHeader title="Sellers" description="Independent makers and shops selling on Folia." />

      <div className="relative max-w-sm mb-8">
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
          className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light pl-10 pr-3.5 py-2.5 text-sm focus:border-fern transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-[var(--radius-card)] bg-stone-dark/40 animate-pulse" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No sellers found" description="Try a different search." />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
