import { useEffect } from 'react';
import { Sprout } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { CartGroupList } from '@/components/cart/CartGroupList';
import { CartSummary } from '@/components/cart/CartSummary';
import { CartCheckoutBar } from '@/components/cart/CartCheckoutBar';
import { FreeShippingProgress } from '@/components/cart/FreeShippingProgress';
import { EmptyState } from '@/components/common/EmptyState';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { useCartStore } from '@/store/cartStore';
import { useCartComplements } from '@/hooks/useRecommendations';
import { useCartTotals } from '@/hooks/useCart';

export default function Cart() {
  const items = useCartStore((s) => s.items);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const loadFromServer = useCartStore((s) => s.loadFromServer);
  const complements = useCartComplements();
  const { subtotal } = useCartTotals();

  // A no-op when VITE_REAL_CART_API is off — loadFromServer itself
  // returns immediately in that case, so this has zero effect on the
  // default MSW-mocked experience. When on, syncs the real, persisted
  // server cart on every visit to this page, so a reload reflects
  // reality rather than stale localStorage.
  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  if (!hasHydrated) {
    return (
      <Container className="py-8 lg:py-16">
        <div role="status" aria-label="Loading your cart" className="flex max-w-2xl animate-pulse flex-col gap-4">
          <div className="h-8 w-40 rounded bg-stone-dark" />
          <div className="h-28 rounded-[var(--radius-card)] bg-stone-dark/50" />
          <div className="h-28 rounded-[var(--radius-card)] bg-stone-dark/50" />
        </div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container>
        <EmptyState
          as="h1"
          icon={<Sprout size={44} />}
          title="Your green corner is waiting"
          description="Discover plants, planters and everything you need to grow your space."
          action={
            <ButtonLink to="/shop" size="lg">
              Start shopping
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Container className="pb-28 pt-6 lg:py-16">
      <h1 className="mb-6 font-display text-3xl font-semibold text-heading lg:mb-10">
        Your cart{' '}
        <span className="font-sans text-lg font-normal text-ink-soft">
          ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </span>
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
        <div className="flex flex-col gap-6">
          <FreeShippingProgress subtotal={subtotal} />
          <CartGroupList items={items} />
        </div>

        <aside className="h-fit rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-5 lg:sticky lg:top-24 lg:p-6">
          <CartSummary />
        </aside>
      </div>

      {complements.length > 0 && (
        <div className="mt-12 lg:mt-16">
          <SectionHeading title="Complete your setup" />
          <ProductCarousel products={complements} />
        </div>
      )}

      <CartCheckoutBar />
    </Container>
  );
}
