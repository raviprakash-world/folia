import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { OrderRow } from '@/components/order/OrderRow';
import { Button } from '@/components/ui/Button';
import { useOrders } from '@/hooks/useOrders';
import { getEffectiveOrderStatus } from '@/utils/refund';
import { cn } from '@/utils/cn';
import type { OrderStatus } from '@/types/order';

const PAGE_SIZE = 6;

type FilterBucket = 'all' | 'active' | OrderStatus;

const filterTabs: { value: FilterBucket; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returned', label: 'Returned' },
  { value: 'refunded', label: 'Refunded' },
];

const ACTIVE_STATUSES: OrderStatus[] = ['processing', 'confirmed', 'shipped'];

type SortKey = 'date-desc' | 'date-asc' | 'total-desc' | 'total-asc';

export default function AccountOrders() {
  const { orders, hasHydrated } = useOrders();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterBucket>('all');
  const [sort, setSort] = useState<SortKey>('date-desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = orders;

    if (filter === 'active') {
      result = result.filter((o) => ACTIVE_STATUSES.includes(getEffectiveOrderStatus(o)));
    } else if (filter !== 'all') {
      result = result.filter((o) => getEffectiveOrderStatus(o) === filter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (o) => o.id.toLowerCase().includes(q) || o.items.some((item) => item.name.toLowerCase().includes(q))
      );
    }

    const sorted = [...result].sort((a, b) => {
      switch (sort) {
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'total-desc':
          return b.total - a.total;
        case 'total-asc':
          return a.total - b.total;
        case 'date-desc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return sorted;
  }, [orders, filter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange(next: FilterBucket) {
    setFilter(next);
    setPage(1);
  }

  if (!hasHydrated) {
    return (
      <div>
        <PageHeader title="Orders" />
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-16 bg-stone-dark/40 rounded-[var(--radius-card)]" />
          <div className="h-16 bg-stone-dark/40 rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div>
        <PageHeader title="Orders" description="Your order history for this browser." />
        <EmptyState
          title="No orders yet"
          description="Once you place an order, it'll show up here."
          action={
            <Button variant="primary">
              <Link to="/shop">Browse the shop</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Orders" description="Your order history for this browser." />

      <div className="flex flex-wrap gap-2 mb-5">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleFilterChange(tab.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm border transition-colors',
              filter === tab.value ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by order number or item…"
            aria-label="Search orders"
            className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light pl-9 pr-3 py-2 text-sm focus:border-fern transition-colors"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort orders"
          className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 py-2 text-sm"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="total-desc">Total: high to low</option>
          <option value="total-asc">Total: low to high</option>
        </select>
      </div>

      {pageItems.length === 0 ? (
        <EmptyState title="No matching orders" description="Try a different search term or filter." />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pageItems.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
