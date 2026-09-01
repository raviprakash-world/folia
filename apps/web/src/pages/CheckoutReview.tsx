import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { OrderSummary } from '@/components/order/OrderSummary';
import { useCartStore } from '@/store/cartStore';
import { useCheckoutStore } from '@/store/checkoutStore';
import { useAddressStore } from '@/store/addressStore';
import { useOrderStore } from '@/store/orderStore';
import { useNotificationStore } from '@/store/notificationStore';
import { computeSubtotal, computeDiscount, computeTax, computeTotal } from '@/utils/pricing';
import { formatCurrency } from '@/utils/currency';
import { generateOrderId } from '@/utils/orderId';
import { assignCourier, generateTrackingNumber } from '@/utils/tracking';
import { checkoutReal } from '@/services/ordersApiService';
import type { Order, OrderItem } from '@/types/order';

const PLACE_ORDER_DELAY_MS = 700;
const useRealOrdersApi = import.meta.env.VITE_REAL_ORDERS_API === 'true';

export default function CheckoutReview() {
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Generated once on mount (not at submit time) so the courier/tracking
  // assignment shown in the preview — both deterministically seeded by
  // order id — matches exactly what gets persisted on "Place order".
  const [orderId] = useState(() => generateOrderId());
  // Real backend only — a stable key for the whole page lifetime, so a
  // network retry of the same submit doesn't create a second order
  // (Phase 11's real idempotency support). Regenerating per-click would
  // defeat the purpose.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const cartItems = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const clearCart = useCartStore((s) => s.clearCart);

  const addresses = useAddressStore((s) => s.addresses);
  const addOrder = useOrderStore((s) => s.addOrder);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const shippingAddressId = useCheckoutStore((s) => s.shippingAddressId);
  const billingSameAsShipping = useCheckoutStore((s) => s.billingSameAsShipping);
  const billingAddressId = useCheckoutStore((s) => s.billingAddressId);
  const deliveryMethod = useCheckoutStore((s) => s.deliveryMethod);
  const deliveryCost = useCheckoutStore((s) => s.deliveryCost);
  const deliveryEta = useCheckoutStore((s) => s.deliveryEta);
  const payment = useCheckoutStore((s) => s.payment);
  const resetCheckout = useCheckoutStore((s) => s.reset);

  const shippingAddress = addresses.find((a) => a.id === shippingAddressId);
  const billingAddress = billingSameAsShipping ? shippingAddress : addresses.find((a) => a.id === billingAddressId);

  if (!shippingAddress || !billingAddress || !deliveryMethod || !deliveryEta || !payment) {
    return (
      <Alert tone="error">
        Something's missing from your checkout — a required step wasn't completed.{' '}
        <button type="button" onClick={() => void navigate('/checkout/shipping')} className="underline">
          Start over
        </button>
        .
      </Alert>
    );
  }

  // Shadowed with explicitly non-null bindings — the guard above proves
  // these at runtime, but TS doesn't propagate that narrowing into the
  // nested handlePlaceOrder() closure below, so this makes the real
  // guarantee explicit instead of fighting the closure with casts.
  const deliveryMethodChecked = deliveryMethod;
  const paymentChecked = payment;
  const shippingAddressChecked = shippingAddress;
  const billingAddressChecked = billingAddress;

  const subtotal = computeSubtotal(cartItems);
  const discount = computeDiscount(subtotal, coupon);
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = computeTax(taxableAmount);
  const total = computeTotal(subtotal, discount, deliveryCost, tax);

  const items: OrderItem[] = cartItems.map((item) => ({
    productId: item.productId,
    slug: item.slug,
    name: item.name,
    categorySlug: item.categorySlug,
    variantId: item.variantId,
    variantLabel: item.variantLabel,
    price: item.price,
    quantity: item.quantity,
  }));

  const courierId = assignCourier(orderId);

  const previewOrder: Order = {
    id: orderId,
    createdAt: new Date().toISOString(),
    status: 'confirmed',
    items,
    subtotal,
    discount,
    couponCode: coupon?.code ?? null,
    shippingCost: deliveryCost,
    tax,
    total,
    shippingAddress,
    billingAddress,
    deliveryMethod,
    estimatedDelivery: deliveryEta,
    payment,
    courierId,
    trackingNumber: generateTrackingNumber(orderId, courierId),
    customerNotes: null,
    cancellation: null,
    returnRequest: null,
  };

  async function handlePlaceOrder() {
    setPlacing(true);
    setError(null);
    try {
      if (useRealOrdersApi) {
        const realOrder = await checkoutReal(
          {
            shippingAddressId: shippingAddressChecked.id,
            billingAddressId: billingAddressChecked.id,
            deliveryMethod: deliveryMethodChecked,
            paymentMethod: paymentChecked.method,
            paymentDisplayLabel: paymentChecked.displayLabel,
            couponCode: coupon?.code,
          },
          idempotencyKey
        );
        // No manual addNotification calls here on the real path — the
        // real backend's own ORDER_CREATED event listener (Phase 15)
        // already creates an "Order Placed" notification server-side;
        // calling the old local store too would duplicate it. There's
        // no real backend equivalent to the local "Payment Successful"
        // notification — a stated, honest gap, not an oversight.
        clearCart();
        resetCheckout();
        void navigate(`/checkout/confirmation/${realOrder.id}`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, PLACE_ORDER_DELAY_MS));
      addOrder(previewOrder);
      addNotification({
        type: 'order',
        title: 'Order Placed',
        message: `Order ${previewOrder.id} was placed successfully.`,
        href: `/account/orders/${previewOrder.id}`,
      });
      addNotification({
        type: 'order',
        title: 'Payment Successful',
        message: `${previewOrder.payment.displayLabel} — ${formatCurrency(previewOrder.total)} charged.`,
        href: `/account/orders/${previewOrder.id}`,
      });
      clearCart();
      resetCheckout();
      void navigate(`/checkout/confirmation/${previewOrder.id}`);
    } catch {
      setError("Couldn't place your order — try again.");
      setPlacing(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-heading mb-1">Review your order</h1>
      <p className="text-sm text-ink-soft mb-8">Check everything looks right before you place it.</p>

      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      <OrderSummary order={previewOrder} />

      <div className="flex justify-between pt-6 mt-8 border-t border-stone-dark">
        <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => void navigate('/checkout/payment')}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={placing}
          icon={placing ? <Loader2 size={16} className="animate-spin" /> : undefined}
          onClick={() => void handlePlaceOrder()}
        >
          {placing ? 'Placing order…' : 'Place order'}
        </Button>
      </div>
    </div>
  );
}
