import { formatCurrency } from '@/utils/currency';
import type { Order } from '@/types/order';

/**
 * Generates and downloads a plain-text invoice. This is intentionally NOT a
 * real PDF — adding a PDF-generation library would mean introducing a new
 * dependency outside the project's established stack. The UI labels this
 * clearly as "Download invoice (mock)" rather than pretending it's a PDF.
 */
export function downloadInvoice(order: Order): void {
  const lines = [
    `FOLIA — INVOICE (mock, not a real PDF)`,
    `Order ${order.id}`,
    `Placed ${order.createdAt}`,
    '',
    'Items',
    '-----',
    ...order.items.map(
      (item) =>
        `${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''} x${item.quantity} — ${formatCurrency(item.price * item.quantity)}`
    ),
    '',
    'Totals',
    '------',
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    ...(order.discount > 0
      ? [`Discount${order.couponCode ? ` (${order.couponCode})` : ''}: -${formatCurrency(order.discount)}`]
      : []),
    `Shipping: ${order.shippingCost === 0 ? 'Free' : formatCurrency(order.shippingCost)}`,
    `Tax: ${formatCurrency(order.tax)}`,
    `Total: ${formatCurrency(order.total)}`,
    '',
    'Shipping address',
    '----------------',
    order.shippingAddress.fullName,
    order.shippingAddress.addressLine1,
    `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
    '',
    'Payment',
    '-------',
    order.payment.displayLabel,
    `Transaction ${order.payment.transactionId}`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${order.id}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
