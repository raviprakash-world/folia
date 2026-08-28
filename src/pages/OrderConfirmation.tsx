import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { OrderSummary } from '@/components/order/OrderSummary';
import { ShareButtons } from '@/components/product/ShareButtons';
import { useOrderStore } from '@/store/orderStore';
import { downloadInvoice } from '@/utils/invoice';

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrderStore((s) => (orderId ? s.getOrder(orderId) : undefined));

  if (!order) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-pine">Order not found</h1>
        <p className="text-ink-soft mt-2">
          <Link to="/account/orders" className="text-fern underline">View your orders</Link>.
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16 max-w-2xl">
      <div className="flex flex-col items-center text-center mb-12">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-16 h-16 rounded-full bg-fern/15 flex items-center justify-center mb-5"
        >
          <CheckCircle2 size={36} className="text-fern" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
          <h1 className="font-display text-3xl font-semibold text-pine">Order confirmed</h1>
          <p className="text-ink-soft mt-2">
            Order <span className="font-mono text-ink">{order.id}</span> — estimated delivery{' '}
            {order.estimatedDelivery.toLowerCase()}.
          </p>
        </motion.div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <Button variant="primary">
          <Link to="/shop">Continue shopping</Link>
        </Button>
        <Button variant="outline">
          <Link to={`/account/orders/${order.id}`}>Track order</Link>
        </Button>
        <Button variant="outline" icon={<Package size={14} />} onClick={() => void downloadInvoice(order)}>
          Download invoice
        </Button>
        <ShareButtons title={`My Folia order ${order.id}`} url={typeof window !== 'undefined' ? window.location.href : ''} />
      </div>

      <div className="rounded-[var(--radius-card)] bg-stone-light border border-stone-dark p-6">
        <OrderSummary order={order} />
      </div>

      <div className="text-center mt-10">
        <Link to="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-fern hover:text-pine transition-colors">
          View all orders
          <ArrowRight size={14} />
        </Link>
      </div>
    </Container>
  );
}
