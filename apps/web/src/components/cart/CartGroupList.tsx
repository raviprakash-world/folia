import { Store } from 'lucide-react';
import { CartLineItem } from './CartLineItem';
import { groupBySeller } from '@/utils/cartGroups';
import type { CartItem } from '@/types/cart';

/** One block per seller so a marketplace cart is clear about who is shipping what. */
export function CartGroupList({ items, compact = false }: { items: CartItem[]; compact?: boolean }) {
  const groups = groupBySeller(items);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.seller} aria-label={`Items sold by ${group.seller}`}>
          <h2 className="mb-3 flex items-center gap-2 text-sm text-ink-soft">
            <Store size={16} className="text-fern" aria-hidden="true" />
            Sold by <span className="font-medium text-ink">{group.seller}</span>
          </h2>
          <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4">
            {group.items.map((item) => (
              <CartLineItem key={item.lineId} item={item} compact={compact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
