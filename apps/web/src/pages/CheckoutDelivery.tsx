import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { DeliveryOptionCard } from '@/components/checkout/DeliveryOptionCard';
import { useAddressStore } from '@/store/addressStore';
import { useCheckoutStore } from '@/store/checkoutStore';
import { useCartTotals } from '@/hooks/useCart';
import { checkDeliveryAvailability } from '@/services/deliveryService';
import type { DeliveryAvailability } from '@/services/deliveryService';

interface DeliveryResult {
  postalCode: string;
  availability: DeliveryAvailability | null;
  error: string | null;
}

export default function CheckoutDelivery() {
  const navigate = useNavigate();
  const addresses = useAddressStore((s) => s.addresses);
  const shippingAddressId = useCheckoutStore((s) => s.shippingAddressId);
  const deliveryMethod = useCheckoutStore((s) => s.deliveryMethod);
  const setDelivery = useCheckoutStore((s) => s.setDelivery);
  const { subtotal } = useCartTotals();

  const shippingAddress = addresses.find((a) => a.id === shippingAddressId);

  // Result is keyed by the postal code it was fetched for, so loading/error/
  // availability are all *derived* below rather than toggled imperatively —
  // the only setState calls happen inside the promise callbacks, not
  // synchronously in the effect body.
  const [result, setResult] = useState<DeliveryResult | null>(null);

  useEffect(() => {
    if (!shippingAddress) return;
    let cancelled = false;

    checkDeliveryAvailability(shippingAddress.postalCode, subtotal)
      .then((availability) => {
        if (cancelled) return;
        setResult({ postalCode: shippingAddress.postalCode, availability, error: null });
        if (!deliveryMethod || !availability.options.some((o) => o.id === deliveryMethod)) {
          const first = availability.options[0];
          if (first) setDelivery(first.id, first.cost, first.etaDays);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setResult({
          postalCode: shippingAddress.postalCode,
          availability: null,
          error: "Couldn't check delivery options for this address.",
        });
      });

    return () => {
      cancelled = true;
    };
    // Only re-fetch when the address or subtotal changes — re-running on
    // every deliveryMethod change would fight with the default-selection
    // logic above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingAddress?.postalCode, subtotal]);

  const resultIsCurrent = !!shippingAddress && result?.postalCode === shippingAddress.postalCode;
  const loading = !!shippingAddress && !resultIsCurrent;
  const availability = resultIsCurrent ? result.availability : null;
  const error = resultIsCurrent ? result.error : null;

  if (!shippingAddress) {
    return (
      <Alert tone="error">
        No shipping address selected.{' '}
        <button type="button" onClick={() => void navigate('/checkout/shipping')} className="underline">
          Go back
        </button>
        .
      </Alert>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-heading mb-1">Delivery method</h1>
      <p className="text-sm text-ink-soft mb-6">
        Shipping to {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-soft py-8">
          <Loader2 size={16} className="animate-spin" />
          Checking delivery options for your area…
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {availability && !loading && (
        <div className="flex flex-col gap-3 mb-10">
          {availability.options.map((option) => (
            <DeliveryOptionCard
              key={option.id}
              option={option}
              selected={deliveryMethod === option.id}
              onSelect={() => setDelivery(option.id, option.cost, option.etaDays)}
            />
          ))}
          {!availability.sameDayAvailable && (
            <p className="text-xs text-ink-soft">Same-day delivery isn't available in this area.</p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4 border-t border-stone-dark">
        <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => void navigate('/checkout/shipping')}>
          Back
        </Button>
        <Button
          variant="primary"
          icon={<ArrowRight size={15} />}
          iconPosition="right"
          disabled={!deliveryMethod || loading}
          onClick={() => void navigate('/checkout/payment')}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
