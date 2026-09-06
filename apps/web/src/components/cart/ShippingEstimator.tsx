import { useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { formatCurrency } from '@/utils/currency';

export function ShippingEstimator() {
  const [zip, setZip] = useState('');
  const shippingZip = useCartStore((s) => s.shippingZip);
  const shippingCost = useCartStore((s) => s.shippingCost);
  const shippingEta = useCartStore((s) => s.shippingEta);
  const status = useCartStore((s) => s.shippingStatus);
  const error = useCartStore((s) => s.shippingError);
  const estimateShipping = useCartStore((s) => s.estimateShipping);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!zip.trim()) return;
    await estimateShipping(zip.trim());
  }

  return (
    <div>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder={shippingZip ?? 'PIN code'}
          aria-label="PIN code for shipping estimate"
          aria-invalid={status === 'error'}
          maxLength={6}
          className="flex-1 min-w-0 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 py-2 text-sm font-mono focus:border-fern transition-colors"
        />
        <button
          type="submit"
          disabled={status === 'pending' || !zip.trim()}
          className="shrink-0 flex items-center justify-center px-4 rounded-[var(--radius-control)] border border-stone-dark text-ink text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {status === 'pending' ? <Loader2 size={15} className="animate-spin" /> : 'Estimate'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-rust mt-1.5">
          {error}
        </p>
      )}

      {shippingCost !== null && status !== 'error' && (
        <p className="flex items-center gap-1.5 text-xs text-fern-dark mt-1.5">
          <Truck size={13} />
          {shippingCost === 0 ? 'Free shipping' : `${formatCurrency(shippingCost)} shipping`} to {shippingZip} — {shippingEta}
        </p>
      )}
    </div>
  );
}
