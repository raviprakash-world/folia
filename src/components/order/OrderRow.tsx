import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Tag } from '@/components/ui/Tag';
import { formatCurrency } from '@/utils/currency';
import type { Order, OrderStatus } from '@/types/order';

const statusTone: Record<OrderStatus, 'pine' | 'ochre' | 'stone' | 'rust'> = {
  processing: 'ochre',
  confirmed: 'pine',
  shipped: 'pine',
  delivered: 'stone',
  cancelled: 'rust',
};

export function OrderRow({ order }: { order: Order }) {
  return (
    <Link
      to={`/account/orders/${order.id}`}
      className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark hover:border-fern transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-ink">{order.id}</span>
          <Tag tone={statusTone[order.status]}>{order.status}</Tag>
        </div>
        <p className="text-xs text-ink-soft mt-1">
          {order.createdAt} — {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-sm text-ink">{formatCurrency(order.total)}</span>
        <ChevronRight size={16} className="text-ink-soft" />
      </div>
    </Link>
  );
}
