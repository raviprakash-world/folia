import { useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { WishlistGrid } from '@/components/wishlist/WishlistGrid';
import { EmptyState } from '@/components/common/EmptyState';
import { useWishlistStore } from '@/store/wishlistStore';

export default function Wishlist() {
  const items = useWishlistStore((s) => s.items);
  const hasHydrated = useWishlistStore((s) => s.hasHydrated);
  const loadFromServer = useWishlistStore((s) => s.loadFromServer);

  // A no-op when VITE_REAL_WISHLIST_API is off — see cartStore's
  // loadFromServer for the same reasoning.
  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  if (!hasHydrated) {
    return (
      <Container className="py-8 sm:py-16">
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
      <Container>
        <EmptyState
          as="h1"
          icon={<Heart size={44} />}
          title="Save plants you love"
          description="Tap the heart on anything you want to come back to later."
          action={
            <ButtonLink to="/collections/plants" size="lg">
              Explore plants
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl py-8 sm:py-16">
      <h1 className="mb-6 font-display text-3xl font-semibold text-heading sm:mb-10">
        Your wishlist <span className="text-ink-soft font-sans text-lg font-normal">({items.length})</span>
      </h1>
      <WishlistGrid items={items} />
    </Container>
  );
}
