import { Tag } from '@/components/ui/Tag';
import { formatCurrency } from '@/utils/currency';
import { deliveryMethodDefs } from '@/data/deliveryMethods';
import type { Order } from '@/types/order';

function AddressBlock({ title, address }: { title: string; address: Order['shippingAddress'] }) {
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-wider text-ink-soft mb-1.5">{title}</p>
      <p className="text-sm text-ink font-medium">{address.fullName}</p>
      <p className="text-sm text-ink-soft">
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ''}
      </p>
      <p className="text-sm text-ink-soft">
        {address.city}, {address.state} {address.postalCode}
      </p>
      <p className="font-mono text-xs text-ink-soft mt-1">{address.phone}</p>
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  const deliveryLabel = deliveryMethodDefs.find((d) => d.id === order.deliveryMethod)?.label ?? order.deliveryMethod;
  const sameAddress = order.shippingAddress.id === order.billingAddress.id;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-ink-soft mb-3">Items</p>
        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={`${item.productId}-${item.variantLabel ?? 'none'}`} className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-[var(--radius-control)] bg-stone-dark shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink font-medium truncate">{item.name}</p>
                {item.variantLabel && <p className="text-xs text-ink-soft">{item.variantLabel}</p>}
                <p className="text-xs text-ink-soft font-mono">Qty {item.quantity}</p>
              </div>
              <span className="font-mono text-sm text-ink shrink-0">{formatCurrency(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <AddressBlock title="Shipping address" address={order.shippingAddress} />
        <AddressBlock
          title={sameAddress ? 'Billing address (same as shipping)' : 'Billing address'}
          address={order.billingAddress}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-ink-soft mb-1.5">Delivery</p>
          <p className="text-sm text-ink">{deliveryLabel}</p>
          <p className="text-xs text-ink-soft">{order.estimatedDelivery}</p>
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-ink-soft mb-1.5">Payment</p>
          <p className="text-sm text-ink">{order.payment.displayLabel}</p>
          <p className="font-mono text-xs text-ink-soft">{order.payment.transactionId}</p>
        </div>
      </div>

      <dl className="flex flex-col gap-2 border-t border-stone-dark pt-4 font-mono text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="text-ink">{formatCurrency(order.subtotal)}</dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between items-center">
            <dt className="text-fern-dark flex items-center gap-1.5">
              Discount {order.couponCode && <Tag tone="stone">{order.couponCode}</Tag>}
            </dt>
            <dd className="text-fern-dark">-{formatCurrency(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-soft">Shipping</dt>
          <dd className="text-ink">{order.shippingCost === 0 ? 'Free' : formatCurrency(order.shippingCost)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">Tax</dt>
          <dd className="text-ink">{formatCurrency(order.tax)}</dd>
        </div>
        <div className="flex justify-between text-base font-medium border-t border-stone-dark pt-2 mt-1">
          <dt className="text-ink">Total</dt>
          <dd className="text-heading">{formatCurrency(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
