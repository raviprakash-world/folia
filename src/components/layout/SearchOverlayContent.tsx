import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp, Eye, ArrowRight, Package, Tag as TagIcon, Newspaper } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Tag } from '@/components/ui/Tag';
import { HighlightText } from '@/components/common/HighlightText';
import { formatCurrency } from '@/utils/currency';
import { useSearchResults } from '@/hooks/useSearchResults';
import { useSearchStore } from '@/store/searchStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { getTrendingSearches } from '@/data/trendingSearches';
import { products as allProducts } from '@/data/products';
import { cn } from '@/utils/cn';

interface NavItem {
  key: string;
  href: string;
  onSelect: () => void;
}

export function SearchOverlayContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState(rawQuery);
  if (rawQuery !== prevQuery) {
    setPrevQuery(rawQuery);
    setActiveIndex(0);
  }

  const recentSearches = useSearchStore((s) => s.recentSearches);
  const addRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const clearRecentSearches = useSearchStore((s) => s.clearRecentSearches);
  const logSearchEvent = useSearchStore((s) => s.logSearchEvent);
  const recentlyViewedItems = useRecentlyViewedStore((s) => s.items);

  const {
    query,
    isLoading,
    products,
    productTotal,
    matchedCategories,
    matchedBlogPosts,
    totalResultCount,
    didYouMean,
  } = useSearchResults(rawQuery);

  const trendingSearches = useMemo(() => getTrendingSearches(), []);
  const recentlyViewedIds = useMemo(() => recentlyViewedItems.map((i) => i.productId), [recentlyViewedItems]);
  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => allProducts.find((p) => p.id === id))
        .filter((p): p is (typeof allProducts)[number] => !!p)
        .slice(0, 4),
    [recentlyViewedIds]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commitSearch(term: string) {
    if (!term.trim()) return;
    addRecentSearch(term);
  }

  function goToFullResults(term: string) {
    commitSearch(term);
    logSearchEvent({ query: term, resultCount: totalResultCount });
    void navigate(`/search?q=${encodeURIComponent(term)}`);
    onClose();
  }

  function selectProduct(slug: string, id: string) {
    if (query) commitSearch(query);
    logSearchEvent({ query, resultCount: totalResultCount, clickedResultId: id });
    void navigate(`/product/${slug}`);
    onClose();
  }

  function selectHref(href: string, term?: string) {
    if (term) commitSearch(term);
    void navigate(href);
    onClose();
  }

  const navItems: NavItem[] = useMemo(() => {
    if (!query) {
      const items: NavItem[] = [];
      recentSearches.forEach((term) =>
        items.push({ key: `recent-${term}`, href: `/search?q=${encodeURIComponent(term)}`, onSelect: () => goToFullResults(term) })
      );
      trendingSearches.forEach((term) =>
        items.push({ key: `trending-${term}`, href: `/search?q=${encodeURIComponent(term)}`, onSelect: () => goToFullResults(term) })
      );
      return items;
    }
    const items: NavItem[] = [];
    products.forEach((p) =>
      items.push({ key: `product-${p.id}`, href: `/product/${p.slug}`, onSelect: () => selectProduct(p.slug, p.id) })
    );
    matchedCategories.forEach((c) =>
      items.push({ key: `cat-${c.slug}`, href: `/collections/${c.slug}`, onSelect: () => selectHref(`/collections/${c.slug}`, query) })
    );
    matchedBlogPosts.forEach((p) =>
      items.push({ key: `blog-${p.slug}`, href: `/blog/${p.slug}`, onSelect: () => selectHref(`/blog/${p.slug}`, query) })
    );
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSelect closures rebuilt intentionally each render; listed deps cover what actually changes the list
  }, [query, recentSearches, trendingSearches, products, matchedCategories, matchedBlogPosts]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (navItems.length === 0 ? 0 : (i + 1) % navItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (navItems.length === 0 ? 0 : (i - 1 + navItems.length) % navItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = navItems[activeIndex];
      if (active) active.onSelect();
      else if (query) goToFullResults(query);
    }
  }

  const rowBase = 'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-control)] transition-colors cursor-pointer';
  function rowClass(key: string) {
    const index = navItems.findIndex((i) => i.key === key);
    return cn(rowBase, index === activeIndex ? 'bg-fern/10' : 'hover:bg-stone-dark/40');
  }

  return (
    <Container className="py-6">
      <div className="flex items-center gap-3 border-b-2 border-pine pb-3">
        <Search size={22} className="text-ink-soft shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search plants, vessels, tools, articles…"
          aria-label="Search"
          aria-activedescendant={navItems[activeIndex]?.key}
          role="combobox"
          aria-expanded={navItems.length > 0}
          aria-controls="search-results-list"
          className="flex-1 bg-transparent text-xl font-display text-ink placeholder:text-ink-soft/40 focus:outline-none"
        />
        <kbd className="hidden sm:inline-block font-mono text-[10px] text-ink-soft border border-stone-dark rounded px-1.5 py-0.5">
          ESC
        </kbd>
        <button type="button" onClick={onClose} aria-label="Close search" className="p-1.5 text-ink-soft hover:text-heading">
          <X size={20} />
        </button>
      </div>

      <div id="search-results-list" role="listbox" className="mt-6 min-h-[200px]">
        {!query && (
          <div className="flex flex-col gap-8">
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-xs uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
                    <Clock size={12} />
                    Recent searches
                  </p>
                  <button type="button" onClick={clearRecentSearches} className="text-xs text-ink-soft hover:text-rust underline">
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => goToFullResults(term)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors',
                        navItems[activeIndex]?.key === `recent-${term}`
                          ? 'border-fern text-heading bg-fern/10'
                          : 'border-stone-dark text-ink-soft hover:border-fern'
                      )}
                    >
                      <Clock size={12} />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-3 flex items-center gap-1.5">
                <TrendingUp size={12} />
                Trending searches
              </p>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => goToFullResults(term)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-sm transition-colors',
                      navItems[activeIndex]?.key === `trending-${term}`
                        ? 'border-fern text-heading bg-fern/10'
                        : 'border-stone-dark text-ink-soft hover:border-fern'
                    )}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {recentlyViewedProducts.length > 0 && (
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-3 flex items-center gap-1.5">
                  <Eye size={12} />
                  Recently viewed
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {recentlyViewedProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p.slug, p.id)}
                      className="flex items-center gap-3 p-2 rounded-[var(--radius-control)] hover:bg-stone-dark/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-[var(--radius-control)] bg-stone-dark shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-ink truncate">{p.name}</p>
                        <p className="font-mono text-xs text-ink-soft">{formatCurrency(p.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {query && isLoading && (
          <div className="flex flex-col gap-2" aria-label="Loading results">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-[var(--radius-control)] bg-stone-dark/40 animate-pulse" />
            ))}
          </div>
        )}

        {query && !isLoading && totalResultCount === 0 && (
          <div className="py-4">
            <p className="text-ink font-medium">No results for "{query}"</p>
            {didYouMean && (
              <button
                type="button"
                onClick={() => setRawQuery(didYouMean)}
                className="text-sm text-fern hover:text-heading mt-1 underline"
              >
                Did you mean "{didYouMean}"?
              </button>
            )}
            <p className="text-sm text-ink-soft mt-4 mb-2">Try one of these instead:</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {trendingSearches.slice(0, 4).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => goToFullResults(term)}
                  className="px-3 py-1.5 rounded-full border border-stone-dark text-sm text-ink-soft hover:border-fern transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-soft mb-2">Popular categories:</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {[...allProducts.reduce((set, p) => set.add(p.category), new Set<string>())].map((cat) => (
                <Tag key={cat} tone="stone">
                  {cat}
                </Tag>
              ))}
            </div>
            <button
              type="button"
              onClick={() => selectHref('/shop')}
              className="inline-flex items-center gap-1.5 text-sm text-fern hover:text-heading transition-colors"
            >
              Continue browsing the shop
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {query && !isLoading && totalResultCount > 0 && (
          <div className="flex flex-col gap-7">
            <p className="text-xs text-ink-soft font-mono">
              {totalResultCount} result{totalResultCount === 1 ? '' : 's'}
            </p>

            {products.length > 0 && (
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-1.5">
                  <Package size={12} />
                  Products {productTotal > products.length && `(${productTotal} total)`}
                </p>
                <div className="flex flex-col gap-1">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      role="option"
                      aria-selected={navItems[activeIndex]?.key === `product-${p.id}`}
                      id={`product-${p.id}`}
                      onClick={() => selectProduct(p.slug, p.id)}
                      className={rowClass(`product-${p.id}`)}
                    >
                      <div className="w-10 h-10 rounded-[var(--radius-control)] bg-stone-dark shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">
                          <HighlightText text={p.name} query={query} />
                        </p>
                        <p className="text-xs text-ink-soft">{p.category}</p>
                      </div>
                      <span className="font-mono text-sm text-ink shrink-0">{formatCurrency(p.price)}</span>
                    </div>
                  ))}
                </div>
                {productTotal > products.length && (
                  <button
                    type="button"
                    onClick={() => goToFullResults(query)}
                    className="text-sm text-fern hover:text-heading mt-2 transition-colors"
                  >
                    View all {productTotal} products →
                  </button>
                )}
              </div>
            )}

            {matchedCategories.length > 0 && (
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-1.5">
                  <TagIcon size={12} />
                  Categories & Collections
                </p>
                <div className="flex flex-col gap-1">
                  {matchedCategories.map((c) => (
                    <div
                      key={c.slug}
                      role="option"
                      aria-selected={navItems[activeIndex]?.key === `cat-${c.slug}`}
                      onClick={() => selectHref(`/collections/${c.slug}`, query)}
                      className={rowClass(`cat-${c.slug}`)}
                    >
                      <TagIcon size={16} className="text-fern shrink-0" />
                      <span className="text-sm text-ink">
                        <HighlightText text={c.name} query={query} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchedBlogPosts.length > 0 && (
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-1.5">
                  <Newspaper size={12} />
                  Journal
                </p>
                <div className="flex flex-col gap-1">
                  {matchedBlogPosts.map((p) => (
                    <div
                      key={p.slug}
                      role="option"
                      aria-selected={navItems[activeIndex]?.key === `blog-${p.slug}`}
                      onClick={() => selectHref(`/blog/${p.slug}`, query)}
                      className={rowClass(`blog-${p.slug}`)}
                    >
                      <Newspaper size={16} className="text-fern shrink-0" />
                      <span className="text-sm text-ink">
                        <HighlightText text={p.title} query={query} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Container>
  );
}
