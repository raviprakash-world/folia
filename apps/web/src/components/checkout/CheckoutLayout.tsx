import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Container } from '@/components/ui/Container';
import { CheckoutStepper } from './CheckoutStepper';
import { useCartStore } from '@/store/cartStore';

export function CheckoutLayout() {
  const location = useLocation();
  const items = useCartStore((s) => s.items);
  const hasHydrated = useCartStore((s) => s.hasHydrated);

  // Confirmation is a separate top-level route (not nested here), so by the
  // time anyone reaches this layout the cart should still have items — if
  // it's empty (direct navigation, or a stale bookmark), send them back.
  if (hasHydrated && items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <Container className="py-12 max-w-3xl">
      <CheckoutStepper pathname={location.pathname} />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </Container>
  );
}
