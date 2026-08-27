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
import { computeSubtotal, computeDiscount, computeTax, computeTotal } from '@/utils/pricing';
import { generateOrderId } from '@/utils/orderId';
import type { Order, OrderItem } from '@/types/order';

const PLACE_ORDER_DELAY_MS = 700;

export default function CheckoutReview() {
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartItems = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const clearCart = useCartStore((s) => s.clearCart);

  const addresses = useAddressStore((s) => s.addresses);
  const addOrder = useOrderStore((s) => s.addOrder);

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
    variantLabel: item.variantLabel,
    price: item.price,
    quantity: item.quantity,
  }));

  const previewOrder: Order = {
    id: 'preview',
    createdAt: new Date().toISOString().slice(0, 10),
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
  };

  async function handlePlaceOrder() {
    setPlacing(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, PLACE_ORDER_DELAY_MS));
      const order: Order = { ...previewOrder, id: generateOrderId() };
      addOrder(order);
      clearCart();
      resetCheckout();
      void navigate(`/checkout/confirmation/${order.id}`);
    } catch {
      setError("Couldn't place your order — try again.");
      setPlacing(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pine mb-1">Review your order</h1>
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
