import { Truck, ShieldCheck, RotateCcw, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { FREE_SHIPPING_THRESHOLD } from '@/services/deliveryService';
import { estimateShippingRate } from '@/services/shippingService';
import { useLocationStore } from '@/store/locationStore';
import { formatCurrency } from '@/utils/currency';
import type { ShipsFrom } from '@/types/product';

const rows = [
  {
    Icon: Truck,
    label: 'Ships in 1–2 business days',
    detail: `Free shipping on orders over ${formatCurrency(FREE_SHIPPING_THRESHOLD)}.`,
  },
  { Icon: ShieldCheck, label: '30-day health guarantee', detail: 'Arrives unwell? We replace it.' },
  { Icon: RotateCcw, label: '14-day returns on vessels & tools', detail: 'Plants are final sale once delivered.' },
];

/** "Ships from …" plus a delivery estimate for the visitor's saved PIN code (or a prompt to set one). */
function LocationRow({ price, shipsFrom }: { price: number; shipsFrom?: ShipsFrom }) {
  const location = useLocationStore((s) => s.location);
  const openPicker = useLocationStore((s) => s.openPicker);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['delivery-estimate', location?.pincode, Math.round(price)],
    queryFn: () => estimateShippingRate(location!.pincode, price),
    enabled: !!location,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <div className="flex items-start gap-3">
      <MapPin size={16} className="text-fern mt-0.5 shrink-0" />
      <div>
        {shipsFrom && (
          <p className="text-sm text-ink">
            Ships from {shipsFrom.city}, {shipsFrom.state}
          </p>
        )}
        {!location ? (
          <button type="button" onClick={openPicker} className="text-xs text-fern hover:text-heading underline">
            Enter your PIN code to see delivery time
          </button>
        ) : isLoading ? (
          <p className="text-xs text-ink-soft">Checking delivery to {location.pincode}…</p>
        ) : isError || !data ? (
          <p className="text-xs text-ink-soft">
            Couldn&apos;t check delivery to {location.pincode}.{' '}
            <button type="button" onClick={openPicker} className="text-fern hover:text-heading underline">
              Change
            </button>
          </p>
        ) : (
          <p className="text-xs text-ink-soft">
            To {location.pincode}
            {location.city && ` (${location.city})`}: {data.etaDays} ·{' '}
            {data.cost === 0 ? 'free shipping' : `${formatCurrency(data.cost)} shipping`} for this item.{' '}
            <button type="button" onClick={openPicker} className="text-fern hover:text-heading underline">
              Change
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export function DeliveryInfo({ price, shipsFrom }: { price?: number; shipsFrom?: ShipsFrom }) {
  return (
    <div className="flex flex-col gap-3 border-t border-stone-dark pt-5">
      {price !== undefined && <LocationRow price={price} shipsFrom={shipsFrom} />}
      {rows.map(({ Icon, label, detail }) => (
        <div key={label} className="flex items-start gap-3">
          <Icon size={16} className="text-fern mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-ink">{label}</p>
            <p className="text-xs text-ink-soft">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
