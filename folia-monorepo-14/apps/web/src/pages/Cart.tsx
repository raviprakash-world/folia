import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { useCartStore } from '@/store/cartStore';
import { useCartComplements } from '@/hooks/useRecommendations';

export default function Cart() {
  const items = useCartStore((s) => s.items);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const loadFromServer = useCartStore((s) => s.loadFromServer);
  const complements = useCartComplements();

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
      <Container className="py-16">
        <div className="animate-pulse flex flex-col gap-4 max-w-2xl">
          <div className="h-8 w-40 bg-stone-dark rounded" />
          <div className="h-24 bg-stone-dark/50 rounded-[var(--radius-card)]" />
          <div className="h-24 bg-stone-dark/50 rounded-[var(--radius-card)]" />
        </div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-24 text-center">
        <ShoppingBag size={36} className="text-ink-soft/40 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-semibold text-heading">Your cart is empty</h1>
        <p className="text-ink-soft mt-2">Nothing here yet — browse the shop to find something for your space.</p>
        <Button variant="primary" className="mt-6">
          <Link to="/shop">Browse the shop</Link>
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-16">
      <h1 className="font-display text-3xl font-semibold text-heading mb-10">
        Your cart <span className="text-ink-soft font-sans text-lg font-normal">({items.length} {items.length === 1 ? 'item' : 'items'})</span>
      </h1>

      <div className="grid lg:grid-cols-[1fr_360px] gap-12">
        <div className="flex flex-col gap-6">
          {items.map((item) => (
            <div key={item.lineId} className="pb-6 border-b border-stone-dark last:border-0">
              <CartLineItem item={item} />
            </div>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 h-fit bg-stone-light border border-stone-dark rounded-[var(--radius-card)] p-6">
          <CartSummary />
        </aside>
      </div>

      {complements.length > 0 && (
        <div className="mt-16">
          <SectionHeading title="Complete Your Setup" />
          <ProductCarousel products={complements} />
        </div>
      )}
    </Container>
  );
}
