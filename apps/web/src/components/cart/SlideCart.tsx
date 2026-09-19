import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Sprout } from 'lucide-react';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { CartGroupList } from './CartGroupList';
import { useCartStore } from '@/store/cartStore';
import { useCartTotals } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { formatCurrency } from '@/utils/currency';

export function SlideCart() {
  const open = useUIStore((s) => s.cartDrawerOpen);
  const closeCartDrawer = useUIStore((s) => s.closeCartDrawer);
  const items = useCartStore((s) => s.items);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const { subtotal } = useCartTotals();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCartDrawer();
    }
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeCartDrawer]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCartDrawer}
            className="fixed inset-0 bg-ink/40 z-40"
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-stone-light shadow-[var(--shadow-lifted)] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-dark">
              <h2 className="font-display text-lg font-semibold text-heading">Your cart</h2>
              <button
                type="button"
                onClick={closeCartDrawer}
                aria-label="Close cart"
                className="flex size-11 items-center justify-center text-ink-soft hover:text-heading"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!hasHydrated ? (
                <div className="animate-pulse flex flex-col gap-4">
                  <div className="h-20 bg-stone-dark/40 rounded-[var(--radius-control)]" />
                  <div className="h-20 bg-stone-dark/40 rounded-[var(--radius-control)]" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <Sprout size={36} className="mb-3 text-fern" aria-hidden="true" />
                  <p className="font-display text-xl font-semibold text-heading">Your green corner is waiting</p>
                  <p className="mt-1 max-w-[30ch] text-[15px] text-ink-soft">Discover plants, planters and everything you need to grow your space.</p>
                  <ButtonLink to="/shop" onClick={closeCartDrawer} className="mt-5">
                    Start shopping
                  </ButtonLink>
                </div>
              ) : (
                <CartGroupList items={items} compact />
              )}
            </div>

            {hasHydrated && items.length > 0 && (
              <div className="border-t border-stone-dark px-5 py-4 flex flex-col gap-3">
                <div className="flex justify-between text-[15px] tabular-nums">
                  <span className="text-ink-soft">Subtotal</span>
                  <span className="text-ink">{formatCurrency(subtotal)}</span>
                </div>
                <ButtonLink variant="primary" size="lg" className="w-full" onClick={closeCartDrawer} to="/cart">View cart & checkout</ButtonLink>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
