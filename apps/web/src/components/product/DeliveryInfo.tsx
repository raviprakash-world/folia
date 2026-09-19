import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crosshair, MapPin, PackageCheck, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import { estimateShippingRate } from '@/services/shippingService';
import { useLocationStore } from '@/store/locationStore';
import { lookupPincode } from '@/utils/geo';
import { isValidPostalCode } from '@/utils/region';
import { formatCurrency } from '@/utils/currency';
import { isPlant } from '@/utils/plant';
import type { ShipsFrom } from '@/types/product';

/** Check a PIN code without leaving the page; the delivery time and cost are labelled as estimates. */
export function DeliveryCheck({ price, shipsFrom }: { price: number; shipsFrom?: ShipsFrom }) {
  const location = useLocationStore((s) => s.location);
  const setLocation = useLocationStore((s) => s.setLocation);
  const openPicker = useLocationStore((s) => s.openPicker);
  const openPickerAndDetect = useLocationStore((s) => s.openPickerAndDetect);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['delivery-estimate', location?.pincode, Math.round(price)],
    queryFn: () => estimateShippingRate(location!.pincode, price),
    enabled: !!location,
    staleTime: 5 * 60_000,
    retry: false,
  });

  async function check() {
    const value = pin.trim();
    if (!isValidPostalCode(value)) {
      setError('Enter a valid 6-digit PIN code.');
      return;
    }
    setBusy(true);
    setError(null);
    const found = await lookupPincode(value);
    setLocation({ pincode: value, city: found?.city ?? '', state: found?.state ?? '', source: 'manual' });
    setBusy(false);
    setPin('');
  }

  return (
    <section aria-labelledby="delivery-heading" className="rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4">
      <h2 id="delivery-heading" className="flex items-center gap-2 font-medium text-ink">
        <MapPin size={18} className="text-fern" aria-hidden="true" />
        Check delivery
      </h2>
      {shipsFrom && (
        <p className="mt-1 text-sm text-ink-soft">
          Ships from {shipsFrom.city}, {shipsFrom.state}
        </p>
      )}

      {!location ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="Enter PIN code"
              aria-label="PIN code"
              aria-invalid={!!error}
              className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-stone-dark bg-stone px-3 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-fern"
            />
            <Button type="submit" variant="outline" disabled={busy || pin.length !== 6}>
              {busy ? 'Checking…' : 'Check'}
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rust-text">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={openPickerAndDetect}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-fern-dark underline hover:text-heading"
          >
            <Crosshair size={14} aria-hidden="true" />
            Use my current location
          </button>
        </>
      ) : (
        <div className="mt-3 text-[15px]" aria-live="polite">
          <p className="text-ink">
            Delivering to <span className="font-semibold">{location.pincode}</span>
            {location.city && `, ${location.city}`}{' '}
            <button type="button" onClick={openPicker} className="ml-1 inline-flex min-h-8 items-center text-sm font-medium text-fern-dark underline hover:text-heading">
              Change
            </button>
          </p>
          {isLoading && <p className="mt-2 text-ink-soft">Checking delivery time…</p>}
          {isError && (
            <p className="mt-2 text-ink-soft">
              We couldn&apos;t check delivery to {location.pincode}.{' '}
              <button type="button" onClick={() => void refetch()} className="font-medium text-fern-dark underline">
                Try again
              </button>
            </p>
          )}
          {data && (
            <>
              <p className="mt-2 font-medium text-ink">Estimated delivery: {data.etaDays}</p>
              <p className="text-ink-soft">{data.cost === 0 ? 'Free shipping on this item' : `Estimated shipping: ${formatCurrency(data.cost)}`}</p>
              <p className="mt-1 text-xs text-ink-soft">These are estimates, not a delivery guarantee.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ Icon, title, text, to }: { Icon: typeof Truck; title: string; text: string; to?: string }) {
  const body = (
    <>
      <Icon size={18} className="mt-0.5 shrink-0 text-fern" aria-hidden="true" />
      <span>
        <span className="block text-[15px] text-ink">{title}</span>
        <span className="block text-sm text-ink-soft">{text}</span>
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="flex items-start gap-3 rounded-[var(--radius-control)] py-1 hover:bg-stone-dark/40">
      {body}
    </Link>
  ) : (
    <div className="flex items-start gap-3 py-1">{body}</div>
  );
}

/** Shipping, packaging and returns facts, each linking to the policy that backs it. */
export function PolicyRows({ categorySlug = '' }: { categorySlug?: string }) {
  const plant = isPlant(categorySlug);
  return (
    <div className="flex flex-col gap-1.5">
      <Row Icon={Truck} title="Ships in 1–2 business days" text={`Free shipping on orders over ${formatCurrency(FREE_SHIPPING_THRESHOLD)}.`} to="/policies/shipping" />
      {plant ? (
        <>
          <Row Icon={PackageCheck} title="Plant-safe packaging" text="Braced in the box with air holes, not sealed in plastic." to="/policies/shipping" />
          <Row Icon={ShieldCheck} title="30-day health guarantee" text="Arrives unwell? We replace it once. Plants are final sale once delivered." to="/policies/returns" />
        </>
      ) : (
        <Row Icon={RotateCcw} title="14-day returns" text="Unused items in their original packaging." to="/policies/returns" />
      )}
    </div>
  );
}
