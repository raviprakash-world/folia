import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Clock } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { bestSellers, trending, recentSearchesSeed } from '@/data/homepage';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
}

const allProducts = [...bestSellers, ...trending];

export function SearchDrawer({ open, onClose }: SearchDrawerProps) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(recentSearchesSeed);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleClose() {
    onClose();
    setQuery('');
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleClose is stable in effect: it only closes over onClose/setQuery
  }, [open, onClose]);

  const results = debouncedQuery.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : [];

  function commitSearch(term: string) {
    if (!term.trim()) return;
    setRecent((prev) => [term, ...prev.filter((t) => t !== term)].slice(0, 5));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-ink/40 z-40"
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-50 bg-stone-light border-b border-stone-dark shadow-[var(--shadow-lifted)]"
          >
            <Container className="py-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitSearch(query);
                }}
                className="flex items-center gap-3 border-b-2 border-pine pb-3"
              >
                <Search size={22} className="text-ink-soft shrink-0" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search plants, vessels, tools…"
                  aria-label="Search products"
                  className="flex-1 bg-transparent text-xl font-display text-ink placeholder:text-ink-soft/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close search"
                  className="p-1.5 text-ink-soft hover:text-pine"
                >
                  <X size={20} />
                </button>
              </form>

              <div className="mt-6 min-h-[120px]">
                {debouncedQuery.trim() === '' && (
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wider text-ink-soft mb-3">
                      Recent searches
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {recent.map((term) => (
                        <li key={term}>
                          <button
                            type="button"
                            onClick={() => setQuery(term)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone border border-stone-dark text-sm text-ink-soft hover:text-pine hover:border-fern transition-colors"
                          >
                            <Clock size={12} />
                            {term}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {debouncedQuery.trim() !== '' && results.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-ink font-medium">No results for "{debouncedQuery}"</p>
                    <p className="text-sm text-ink-soft mt-1">
                      Try a broader term, or browse the full shop.
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {results.map((product) => (
                      <li key={product.id}>
                        <Link
                          to={`/product/${product.slug}`}
                          onClick={() => {
                            commitSearch(debouncedQuery);
                            handleClose();
                          }}
                          className="flex items-center gap-3 p-2 rounded-[var(--radius-control)] hover:bg-stone transition-colors"
                        >
                          <div className="w-12 h-12 rounded-[var(--radius-control)] bg-stone-dark shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-ink">{product.name}</p>
                            <p className="font-mono text-xs text-ink-soft">${product.price}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Container>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
