import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useSellerOrderDetail, useRealSellersApi } from '@/hooks/useSellerOrders';
import { orderGroupStatusTone } from '@/utils/sellerOrderStatus';
import { formatCurrency, formatDate } from '@/utils/currency';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function SellerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { order, isLoading, updateNote, ship } = useSellerOrderDetail(id);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  // React's own documented "adjusting state when a prop changes" pattern —
  // setState called during render (not inside a useEffect, which would
  // cascade an extra render after commit) whenever the loaded order is a
  // genuinely different one than what `note` was last initialized from.
  const [noteInitializedForOrderId, setNoteInitializedForOrderId] = useState<string | undefined>(undefined);
  if (order && order.id !== noteInitializedForOrderId) {
    setNoteInitializedForOrderId(order.id);
    setNote(order.sellerNote ?? '');
  }

  if (!useRealSellersApi) {
    return (
      <div>
        <PageHeader title="Order" />
        <p className="text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Order" />
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <PageHeader title="Order not found" />
        <Link to="/seller/orders" className="text-fern underline text-sm">
          Back to orders
        </Link>
      </div>
    );
  }

  async function handleSaveNote() {
    await updateNote.mutateAsync(note);
    setNoteSaved(true);
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Order ${order.orderId}`}
        title={`Placed ${formatDate(order.createdAt)}`}
        action={<Tag tone={orderGroupStatusTone[order.status]}>{order.status}</Tag>}
      />

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="rounded-[var(--radius-card)] border border-stone-dark p-4">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Ship to</h2>
          <p className="text-sm text-ink">{order.shippingAddress.fullName}</p>
          <p className="text-sm text-ink-soft">
            {order.shippingAddress.addressLine1}
            {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}
          </p>
          <p className="text-sm text-ink-soft">
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
          </p>
          <p className="text-sm text-ink-soft">{order.shippingAddress.country}</p>
          <p className="text-xs text-ink-soft mt-3">
            {order.shippingAddress.phone} · {order.deliveryMethod}
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-stone-dark p-4">
          <h2 className="font-display text-base font-semibold text-heading mb-3">Your proceeds</h2>
          <div className="flex justify-between text-sm py-1">
            <span className="text-ink-soft">Subtotal</span>
            <span className="font-mono">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-ink-soft">Commission</span>
            <span className="font-mono">-{formatCurrency(order.commissionTotal)}</span>
          </div>
          <div className="flex justify-between text-sm py-1 font-medium border-t border-stone-dark mt-1 pt-2">
            <span>Net proceeds</span>
            <span className="font-mono">{formatCurrency(order.netProceeds)}</span>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-heading mb-3">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-dark">
                <th scope="col" className="py-2 px-3 text-left font-mono text-xs uppercase tracking-wider text-ink-soft">Item</th>
                <th scope="col" className="py-2 px-3 text-right font-mono text-xs uppercase tracking-wider text-ink-soft">Unit price</th>
                <th scope="col" className="py-2 px-3 text-right font-mono text-xs uppercase tracking-wider text-ink-soft">Qty</th>
                <th scope="col" className="py-2 px-3 text-right font-mono text-xs uppercase tracking-wider text-ink-soft">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-stone-dark/60 last:border-0">
                  <td className="py-2.5 px-3 text-ink">
                    {item.name}
                    {item.variantLabel ? ` — ${item.variantLabel}` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.price)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-10 max-w-md">
        <h2 className="font-display text-base font-semibold text-heading mb-3">Your private note</h2>
        <p className="text-xs text-ink-soft mb-2">Only visible to you — never shown to the customer or Folia admin.</p>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          rows={2}
          placeholder="e.g. Packed, ready for courier pickup Tuesday"
          className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
        />
        <div className="flex items-center gap-3 mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={updateNote.isPending || note === (order.sellerNote ?? '')}
            onClick={() => void handleSaveNote()}
          >
            {updateNote.isPending ? 'Saving…' : 'Save note'}
          </Button>
          {noteSaved && !updateNote.isPending && <span className="text-xs text-fern">Saved</span>}
        </div>
      </div>

      {order.status === 'PROCESSING' && (
        <div>
          <Button variant="primary" disabled={ship.isPending} onClick={() => void ship.mutateAsync()}>
            {ship.isPending ? 'Shipping…' : 'Ship this order'}
          </Button>
          {ship.isError && (
            <Alert tone="error" className="mt-3 max-w-md">
              {errorMessage(ship.error, 'Shipment failed.')}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
