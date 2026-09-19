import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';

interface StickyBuyBarProps {
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
  needsVariant: boolean;
  variantLabel: string;
  added: boolean;
  onAdd: () => void;
}

/** Phone-only purchase bar pinned to the bottom, so the action is always one tap away. Sits in the space the bottom navigation uses elsewhere. */
export function StickyBuyBar({ price, compareAtPrice, inStock, needsVariant, variantLabel, added, onAdd }: StickyBuyBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-dark bg-stone-light/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <Price price={price} compareAtPrice={compareAtPrice} size="md" className="[&>span:first-child]:text-xl" />
        </div>
        <Button
          size="lg"
          onClick={onAdd}
          disabled={!inStock}
          icon={added ? <Check size={18} /> : undefined}
          className="ml-auto min-w-40 flex-1 sm:flex-none"
        >
          {!inStock ? 'Out of stock' : added ? 'Added' : needsVariant ? `Select ${variantLabel}` : 'Add to cart'}
        </Button>
      </div>
    </div>
  );
}
