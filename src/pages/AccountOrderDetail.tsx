import { useParams, Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/ui/Tag';
import { OrderSummary } from '@/components/order/OrderSummary';
import { ShareButtons } from '@/components/product/ShareButtons';
import { useOrderStore } from '@/store/orderStore';
import { downloadInvoice } from '@/utils/invoice';
import { Button } from '@/components/ui/Button';

const statusTone = { processing: 'ochre', confirmed: 'pine', shipped: 'pine', delivered: 'stone', cancelled: 'rust' } as const;

export default function AccountOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useOrderStore((s) => (id ? s.getOrder(id) : undefined));

  if (!order) {
    return (
      <div>
        <PageHeader title="Order not found" />
        <p className="text-sm text-ink-soft">
          <Link to="/account/orders" className="text-fern underline">Back to orders</Link>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={order.createdAt}
        title={order.id}
        action={<Tag tone={statusTone[order.status]}>{order.status}</Tag>}
      />

      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="sm" icon={<Package size={14} />} onClick={() => downloadInvoice(order)}>
          Download invoice (mock)
        </Button>
        <ShareButtons title={`My Folia order ${order.id}`} url={typeof window !== 'undefined' ? window.location.href : ''} />
      </div>

      <OrderSummary order={order} />
    </div>
  );
}
