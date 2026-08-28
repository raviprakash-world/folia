import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { WishlistGrid } from '@/components/wishlist/WishlistGrid';
import { useWishlistStore } from '@/store/wishlistStore';

export default function Wishlist() {
  const items = useWishlistStore((s) => s.items);
  const hasHydrated = useWishlistStore((s) => s.hasHydrated);

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
        <Heart size={36} className="text-ink-soft/40 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-semibold text-heading">Your wishlist is empty</h1>
        <p className="text-ink-soft mt-2">Save plants and vessels here to come back to later.</p>
        <Button variant="primary" className="mt-6">
          <Link to="/shop">Browse the shop</Link>
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-16 max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-heading mb-10">
        Your wishlist <span className="text-ink-soft font-sans text-lg font-normal">({items.length})</span>
      </h1>
      <WishlistGrid items={items} />
    </Container>
  );
}
