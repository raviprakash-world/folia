import { useEffect, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useLocationStore } from '@/store/locationStore';
import { formatCurrency } from '@/utils/currency';

export function ShippingEstimator() {
  const [zip, setZip] = useState('');
  const shippingZip = useCartStore((s) => s.shippingZip);
  const shippingCost = useCartStore((s) => s.shippingCost);
  const shippingEta = useCartStore((s) => s.shippingEta);
  const status = useCartStore((s) => s.shippingStatus);
  const error = useCartStore((s) => s.shippingError);
  const estimateShipping = useCartStore((s) => s.estimateShipping);

  // A shopper who already told us their PIN shouldn't have to type it again.
  const savedPin = useLocationStore((s) => s.location?.pincode);
  useEffect(() => {
    if (savedPin && shippingZip === null && status === 'idle') void estimateShipping(savedPin);
  }, [savedPin, shippingZip, status, estimateShipping]);

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
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-stone-dark bg-stone px-3 text-[15px] tabular-nums focus:border-fern transition-colors"
        />
        <button
          type="submit"
          disabled={status === 'pending' || !zip.trim()}
          className="flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-stone-dark px-4 text-[15px] font-medium text-ink transition-opacity disabled:opacity-40"
        >
          {status === 'pending' ? <Loader2 size={15} className="animate-spin" /> : 'Estimate'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-1.5 text-sm text-rust-text">
          {error}
        </p>
      )}

      {shippingCost !== null && status !== 'error' && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-fern-dark">
          <Truck size={13} />
          {shippingCost === 0 ? 'Free shipping' : `${formatCurrency(shippingCost)} shipping`} to {shippingZip} — estimated {shippingEta}
        </p>
      )}
    </div>
  );
}
