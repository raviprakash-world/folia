import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Package,
  RotateCcw,
  ShoppingBag,
  XCircle,
  Undo2,
  MessageCircle,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { OrderSummary } from '@/components/order/OrderSummary';
import { TrackingTimeline } from '@/components/order/TrackingTimeline';
import { ShareButtons } from '@/components/product/ShareButtons';
import { useOrder } from '@/hooks/useOrders';
import { useCartStore } from '@/store/cartStore';
import { useToastStore } from '@/store/toastStore';
import { useNotificationStore } from '@/store/notificationStore';
import { orderStatusTone } from '@/utils/orderStatus';
import { formatDate, formatCurrency } from '@/utils/currency';
import { canCancelOrder, canReturnOrder, deriveRefundStatus, getEffectiveOrderStatus } from '@/utils/refund';
import { downloadInvoice } from '@/utils/invoice';
import { products } from '@/data/products';
import type { CancellationReason, ReturnReason } from '@/types/order';

const cancellationReasons: { value: CancellationReason; label: string }[] = [
  { value: 'changed-mind', label: 'Changed my mind' },
  { value: 'found-cheaper', label: 'Found it cheaper elsewhere' },
  { value: 'ordered-by-mistake', label: 'Ordered by mistake' },
  { value: 'shipping-too-slow', label: 'Shipping is too slow' },
  { value: 'other', label: 'Other' },
];

const returnReasons: { value: ReturnReason; label: string }[] = [
  { value: 'no-longer-needed', label: 'No longer needed' },
  { value: 'wrong-item', label: 'Received the wrong item' },
  { value: 'damaged-in-transit', label: 'Arrived damaged' },
  { value: 'not-as-described', label: 'Not as described' },
  { value: 'changed-mind', label: 'Changed my mind' },
  { value: 'other', label: 'Other' },
];

const useRealOrdersApi = import.meta.env.VITE_REAL_ORDERS_API === 'true';

export default function AccountOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, cancelOrder, requestReturn, updateCustomerNotes, reorder: reorderReal } = useOrder(id);
  const addCartItem = useCartStore((s) => s.addItem);
  const loadCartFromServer = useCartStore((s) => s.loadFromServer);
  const showToast = useToastStore((s) => s.showToast);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancellationReason>('changed-mind');
  const [cancelNote, setCancelNote] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState<ReturnReason>('no-longer-needed');
  const [returnNote, setReturnNote] = useState('');
  const [selectedReturnItems, setSelectedReturnItems] = useState<Set<number>>(new Set());
  const [notesDraft, setNotesDraft] = useState(order?.customerNotes ?? '');
  const [notesSaved, setNotesSaved] = useState(false);

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

  const status = getEffectiveOrderStatus(order, useRealOrdersApi);

  async function handleDownloadInvoice() {
    setGeneratingInvoice(true);
    try {
      await downloadInvoice(order!);
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function addAllItemsToCartLocal(): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    for (const item of order!.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !product.inStock) {
        skipped++;
        continue;
      }
      // Awaited sequentially, not fired concurrently — with the real
      // backend (Phase 14), concurrent adds to the same cart could race;
      // sequential is also simply correct behavior for the local-only
      // path, which never had a reason to run these in parallel either.
      await addCartItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        categorySlug: product.categorySlug,
        price: product.price,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        maxQuantity: product.stockCount,
      });
      added++;
    }
    return { added, skipped };
  }

  /**
   * Real backend only calls reorderReal() (the real /orders/:id/reorder
   * endpoint, Phase 15) — checks genuine current InventoryService
   * availability per item server-side, rather than this page's own
   * possibly-stale local product list. Same {added, skipped} shape
   * either way, so the two callers below don't need to know which path
   * ran. Explicitly syncs cartStore from the server afterward — the
   * caller (handleReorder) navigates straight to /checkout/shipping
   * without visiting /cart first, and that page's own loadFromServer()
   * only fires on /cart's own mount, so without this the checkout flow
   * would show the pre-reorder cart, not the real one that was just
   * updated server-side.
   */
  async function addAllItemsToCart(): Promise<{ added: number; skipped: number }> {
    if (useRealOrdersApi) {
      const result = await reorderReal();
      await loadCartFromServer();
      return result;
    }
    return addAllItemsToCartLocal();
  }

  async function handleBuyAgain() {
    const { added, skipped } = await addAllItemsToCart();
    if (added === 0) {
      showToast('error', "None of these items are available anymore.");
      return;
    }
    showToast('success', skipped > 0 ? `Added ${added} item(s) — ${skipped} no longer available.` : `Added ${added} item(s) to your cart.`);
  }

  async function handleReorder() {
    const { added, skipped } = await addAllItemsToCart();
    if (added === 0) {
      showToast('error', "None of these items are available anymore.");
      return;
    }
    if (skipped > 0) showToast('info', `${skipped} item(s) were no longer available and were skipped.`);
    void navigate('/checkout/shipping');
  }

  async function handleConfirmCancel() {
    await cancelOrder(cancelReason, cancelNote || null);
    setCancelOpen(false);
    showToast('info', 'Order cancelled.');
    // Real backend only skips this — its own ORDER_CANCELLED event
    // listener (Phase 15) already creates this notification server-side;
    // calling the old local store too on the real path would duplicate it.
    if (!useRealOrdersApi) {
      addNotification({
        type: 'order',
        title: 'Order Cancelled',
        message: `Order ${order!.id} was cancelled.`,
        href: `/account/orders/${order!.id}`,
      });
    }
  }

  function toggleReturnItem(index: number) {
    setSelectedReturnItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleConfirmReturn() {
    await requestReturn(returnReason, returnNote || null);
    setReturnOpen(false);
    showToast('info', 'Return requested — refund will show as processing.');
    if (!useRealOrdersApi) {
      addNotification({
        type: 'order',
        title: 'Return Requested',
        message: `A return was requested for order ${order!.id}.`,
        href: `/account/orders/${order!.id}`,
      });
    }
  }

  async function handleSaveNotes() {
    await updateCustomerNotes(notesDraft);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  function handleContactSupport() {
    void navigate('/contact', {
      state: {
        subject: `Order ${order!.id}`,
        message: `Hi, I have a question about my order ${order!.id} (placed ${formatDate(order!.createdAt)}).\n\n`,
      },
    });
  }

  // Phase 6: in real mode, order.cancellation.refundStatus is the server's
  // own real value (derived from actual Payment/Refund state, since
  // OrdersService.requestCancellation now attempts a real refund) — trust
  // it verbatim rather than re-deriving a second, client-side opinion from
  // elapsed time, which would show "refunded" on a fixed timer regardless
  // of whether the real refund actually succeeded. Mock mode has no
  // server recomputing this over time (the local store sets it once, at
  // request time — see orderStore.ts), so it keeps the elapsed-time
  // simulation to still show forward progress in a demo. Returns aren't
  // wired to a real refund yet either way, so they always simulate.
  const refundStatus = order.cancellation?.refundStatus
    ? useRealOrdersApi
      ? order.cancellation.refundStatus
      : deriveRefundStatus(order.cancellation.requestedAt)
    : order.returnRequest
      ? deriveRefundStatus(order.returnRequest.requestedAt)
      : null;

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(order.createdAt)}
        title={order.id}
        action={<Tag tone={orderStatusTone[status]}>{status.replace('-', ' ')}</Tag>}
      />

      {(order.cancellation ?? order.returnRequest) && (
        // Deliberately NOT also gated on `refundStatus` — a COD
        // cancellation has refundStatus: null (nothing was ever charged),
        // and that's exactly the case this alert needs to explain, not
        // hide. A real, previously-unnoticed bug: this alert never
        // rendered for a COD cancellation before this fix, silently
        // dropping the "nothing was charged" message it exists to show.
        <Alert tone={refundStatus === 'refunded' ? 'success' : 'info'} className="mb-6">
          {order.cancellation ? 'Cancellation' : 'Return'} reason:{' '}
          {(order.cancellation
            ? cancellationReasons.find((r) => r.value === order.cancellation!.reason)
            : returnReasons.find((r) => r.value === order.returnRequest!.reason))?.label}
          {order.payment.method === 'cod' && order.cancellation && !order.cancellation.refundStatus
            ? ' — nothing was charged (Cash on Delivery), so there\u2019s no refund to process.'
            : refundStatus === 'refunded'
              ? ' — refund complete.'
              : ' — refund processing.'}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-10">
        <Button variant="outline" size="sm" icon={<Package size={14} />} disabled={generatingInvoice} onClick={() => void handleDownloadInvoice()}>
          {generatingInvoice ? 'Generating…' : 'Download invoice'}
        </Button>
        <Button variant="outline" size="sm" icon={<ShoppingBag size={14} />} onClick={() => void handleBuyAgain()}>
          Buy again
        </Button>
        <Button variant="outline" size="sm" icon={<RotateCcw size={14} />} onClick={() => void handleReorder()}>
          Reorder & checkout
        </Button>
        {canCancelOrder(order) && (
          <Button variant="outline" size="sm" icon={<XCircle size={14} />} className="!border-rust !text-rust" onClick={() => setCancelOpen(true)}>
            Cancel order
          </Button>
        )}
        {canReturnOrder(order) && (
          <Button variant="outline" size="sm" icon={<Undo2 size={14} />} onClick={() => setReturnOpen(true)}>
            Return order
          </Button>
        )}
        <Button variant="outline" size="sm" icon={<MessageCircle size={14} />} onClick={handleContactSupport}>
          Contact support
        </Button>
        <ShareButtons title={`My Folia order ${order.id}`} url={typeof window !== 'undefined' ? window.location.href : ''} />
      </div>

      <div className="mb-12">
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Delivery tracking</h2>
        <TrackingTimeline order={order} />
      </div>

      <div className="mb-10">
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Order summary</h2>
        <OrderSummary order={order} />
      </div>

      <div className="mb-10 max-w-md">
        <h2 className="font-display text-lg font-semibold text-heading mb-3">Notes</h2>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={3}
          placeholder="Add a personal note about this order — e.g. 'gift for Mom's birthday'."
          className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm focus:border-fern transition-colors"
        />
        <div className="flex items-center gap-3 mt-2">
          <Button variant="outline" size="sm" onClick={() => void handleSaveNotes()}>
            Save note
          </Button>
          {notesSaved && (
            <span className="flex items-center gap-1 text-xs text-fern-dark">
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-reason" className="text-sm font-medium text-ink-soft">
              Reason
            </label>
            <select
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as CancellationReason)}
              className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
            >
              {cancellationReasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={cancelNote}
            onChange={(e) => setCancelNote(e.target.value)}
            placeholder="Additional details (optional)"
            rows={2}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button variant="primary" onClick={() => void handleConfirmCancel()}>Confirm cancellation</Button>
          </div>
        </div>
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Return this order?">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ink-soft mb-2">Which items?</p>
            <div className="flex flex-col gap-1.5">
              {order.items.map((item, i) => (
                <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedReturnItems.has(i)}
                    onChange={() => toggleReturnItem(i)}
                    className="w-4 h-4 accent-fern"
                  />
                  {item.name}{item.variantLabel ? ` (${item.variantLabel})` : ''} — {formatCurrency(item.price)}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="return-reason" className="text-sm font-medium text-ink-soft">
              Reason
            </label>
            <select
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
              className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
            >
              {returnReasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder="Additional details (optional)"
            rows={2}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          <p className="text-xs text-ink-soft">
            This return covers the whole order's refund — item selection is recorded for our records but doesn't split the refund total.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={selectedReturnItems.size === 0} onClick={() => void handleConfirmReturn()}>
              Request return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
