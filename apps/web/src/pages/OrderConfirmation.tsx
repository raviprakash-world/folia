import { useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { OrderSummary } from '@/components/order/OrderSummary';
import { ShareButtons } from '@/components/product/ShareButtons';
import { useOrderStore } from '@/store/orderStore';
import { useCartStore } from '@/store/cartStore';
import { useCheckoutStore } from '@/store/checkoutStore';
import { downloadInvoice } from '@/utils/invoice';
import type { Order } from '@/types/order';

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  // CheckoutReview hands the just-placed order over directly via router
  // state — the real-API path never adds it to this local mock store (see
  // that store's own real-vs-mock scope), so without this, a real order's
  // confirmation page would always show "Order not found" right after a
  // successful checkout. Falls back to the local store for a bookmarked
  // or refreshed confirmation URL, where router state is gone.
  const freshOrder = (location.state as { order?: Order } | null)?.order;
  const storedOrder = useOrderStore((s) => (orderId ? s.getOrder(orderId) : undefined));
  const order = freshOrder ?? storedOrder;

  const clearCart = useCartStore((s) => s.clearCart);
  const resetCheckout = useCheckoutStore((s) => s.reset);
  useEffect(() => {
    // Only for a genuinely fresh completion (order arrived via router
    // state from this exact checkout) — never for a bookmarked/refreshed
    // visit to an old confirmation URL, which must not touch whatever the
    // customer currently has in their cart. Deliberately done HERE, in an
    // effect on the confirmation page itself, rather than in
    // CheckoutReview right before navigating: this is a real,
    // live-verified fix for a genuine race — react-router's
    // createBrowserRouter navigations run inside a React.startTransition,
    // so clearing the cart synchronously in CheckoutReview immediately
    // before/after calling navigate() could still re-render the
    // still-mounted CheckoutLayout (whose own guard redirects to /cart
    // the moment it sees an empty cart) before that transition actually
    // commits — bouncing the customer to /cart instead of their own
    // order. An effect here only ever runs after React has committed to
    // this page, by which point CheckoutLayout is guaranteed unmounted.
    if (freshOrder) {
      clearCart();
      resetCheckout();
    }
    // Deliberately mount-only — see the comment above for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!order) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-heading">Order not found</h1>
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
          <h1 className="font-display text-3xl font-semibold text-heading">Order confirmed</h1>
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
        <Link to="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-fern hover:text-heading transition-colors">
          View all orders
          <ArrowRight size={14} />
        </Link>
      </div>
    </Container>
  );
}
