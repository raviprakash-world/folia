import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Tag } from '@/components/ui/Tag';
import { formatCurrency, formatDate } from '@/utils/currency';
import { orderStatusTone } from '@/utils/orderStatus';
import { getEffectiveOrderStatus } from '@/utils/refund';
import type { Order } from '@/types/order';

export function OrderRow({ order }: { order: Order }) {
  const status = getEffectiveOrderStatus(order);
  return (
    <Link
      to={`/account/orders/${order.id}`}
      className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark hover:border-fern transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-ink">{order.id}</span>
          <Tag tone={orderStatusTone[status]}>{status}</Tag>
        </div>
        <p className="text-xs text-ink-soft mt-1">
          {formatDate(order.createdAt)} — {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-sm text-ink">{formatCurrency(order.total)}</span>
        <ChevronRight size={16} className="text-ink-soft" />
      </div>
    </Link>
  );
}
