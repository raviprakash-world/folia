import { motion } from 'framer-motion';
import {
  Package,
  CreditCard,
  Box,
  Truck,
  Send,
  Navigation,
  Bike,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Weight,
  FileSignature,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/common/Alert';
import { getCourier } from '@/data/couriers';
import { deliveryWindowHours } from '@/data/trackingStages';
import { useOrderTracking } from '@/hooks/useOrderTracking';
import { estimatePackageDetails } from '@/utils/packageDetails';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { Order, TrackingStage } from '@/types/order';

const stageIcons: Record<TrackingStage, typeof Package> = {
  'order-placed': Package,
  'payment-confirmed': CreditCard,
  packed: Box,
  'picked-up': Truck,
  shipped: Send,
  'in-transit': Navigation,
  'out-for-delivery': Bike,
  delivered: CheckCircle2,
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TrackingTimeline({ order }: { order: Order }) {
  const { data: tracking, isLoading, isError } = useOrderTracking(order);
  const packageDetails = estimatePackageDetails(order.items);
  const windowHours = deliveryWindowHours(order.deliveryMethod);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft py-10">
        <Loader2 size={16} className="animate-spin" />
        Loading tracking information…
      </div>
    );
  }

  if (isError || !tracking) {
    return <Alert tone="error">Couldn't load tracking information for this order.</Alert>;
  }

  const courier = tracking.courierId ? getCourier(tracking.courierId) : null;
  const isCancelledOrReturned = order.status === 'cancelled' || order.status === 'returned';

  return (
    <div className="flex flex-col gap-8">
      {!courier && !isCancelledOrReturned && (
        <Alert tone="info">Your order is being prepared. Tracking will appear here once it ships.</Alert>
      )}

      {tracking.isDelayed && !isCancelledOrReturned && (
        <Alert tone="info">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-ochre" />
            Running about {tracking.delayHours} hours behind schedule — the estimate below already
            accounts for this.
          </span>
        </Alert>
      )}

      {isCancelledOrReturned && (
        <Alert tone="info">
          Tracking stopped updating when this order was {order.status === 'cancelled' ? 'cancelled' : 'returned'}.
        </Alert>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {courier && (
          <Card variant="flat" className="p-4 flex items-center gap-3">
            <span
              className="flex items-center justify-center w-11 h-11 rounded-full text-stone-light font-mono text-sm font-semibold shrink-0"
              style={{ backgroundColor: courier.color }}
              aria-hidden="true"
            >
              {courier.monogram}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{courier.name}</p>
              <p className="font-mono text-xs text-ink-soft">{tracking.trackingNumber}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-ink-soft">
                {courier.supportPhone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} />
                    {courier.supportPhone}
                  </span>
                )}
                {courier.supportEmail && (
                  <span className="flex items-center gap-1">
                    <Mail size={11} />
                    {courier.supportEmail}
                  </span>
                )}
                {tracking.trackingUrl && (
                  <a
                    href={tracking.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-fern hover:text-heading transition-colors"
                  >
                    <ExternalLink size={11} />
                    Track on carrier site
                  </a>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card variant="flat" className="p-4">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-soft mb-1.5">Estimated delivery</p>
          <p className="text-sm text-ink">{order.estimatedDelivery}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-ink-soft">
            {tracking.currentLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {tracking.currentLocation}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Weight size={11} />
              {packageDetails.weightLbs} lbs · {packageDetails.dimensions}
            </span>
          </div>
        </Card>
      </div>

      {order.shippingAddress.deliveryInstructions && (
        <div className="text-sm text-ink-soft bg-stone-dark/30 rounded-[var(--radius-control)] p-3">
          <span className="font-medium text-ink">Delivery instructions: </span>
          {order.shippingAddress.deliveryInstructions}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs text-ink-soft mb-2">
          <span>Progress</span>
          <span className="font-mono">{tracking.progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-stone-dark overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tracking.progressPercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-fern rounded-full"
          />
        </div>
      </div>

      <ol className="flex flex-col">
        {tracking.stages.map((stageEvent, i) => {
          const Icon = stageIcons[stageEvent.stage];
          const isLast = i === tracking.stages.length - 1;
          const isCurrent = stageEvent.completed && !tracking.stages[i + 1]?.completed;

          return (
            <li key={stageEvent.stage} className="flex gap-4">
              <div className="flex flex-col items-center">
                <motion.span
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full shrink-0',
                    stageEvent.completed
                      ? isCurrent
                        ? 'bg-fern text-stone-light ring-4 ring-fern/20'
                        : 'bg-fern/80 text-stone-light'
                      : 'bg-stone-dark text-ink-soft'
                  )}
                >
                  {stageEvent.completed ? <Icon size={15} /> : <Circle size={10} />}
                </motion.span>
                {!isLast && (
                  <span
                    className={cn('w-px flex-1 min-h-[28px]', stageEvent.completed ? 'bg-fern/60' : 'bg-stone-dark')}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="pb-7 min-w-0">
                <p className={cn('text-sm font-medium', stageEvent.completed ? 'text-ink' : 'text-ink-soft')}>
                  {stageEvent.label}
                </p>
                <p className="text-xs text-ink-soft mt-0.5">{stageEvent.description}</p>
                {stageEvent.timestamp && (
                  <p className="font-mono text-xs text-fern-dark mt-1">{formatTimestamp(stageEvent.timestamp)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {tracking.proofOfDelivery && (
        <Card variant="flat" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSignature size={15} className="text-fern" />
            <h3 className="text-sm font-medium text-ink">Proof of delivery</h3>
          </div>
          <div className="grid sm:grid-cols-[100px_1fr] gap-4">
            <div className="aspect-square rounded-[var(--radius-control)] bg-stone-dark flex items-center justify-center">
              <span className="font-mono text-[10px] text-ink-soft/60 text-center px-1">Placeholder photo</span>
            </div>
            <dl className="text-sm flex flex-col gap-1">
              <div className="flex gap-2">
                <dt className="text-ink-soft w-24 shrink-0">Delivered to</dt>
                <dd className="text-ink capitalize">{tracking.proofOfDelivery.deliveredTo}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-soft w-24 shrink-0">Signed by</dt>
                <dd className="text-ink">{tracking.proofOfDelivery.signedBy}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-soft w-24 shrink-0">Method</dt>
                <dd className="text-ink capitalize">{tracking.proofOfDelivery.method}</dd>
              </div>
              <p className="text-xs text-ink-soft/70 mt-2">{tracking.proofOfDelivery.note}</p>
            </dl>
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-medium text-ink mb-3">Shipment history</h3>
        <ul className="flex flex-col gap-2">
          {[...tracking.stages]
            .filter((s) => s.completed)
            .reverse()
            .map((s) => (
              <li key={s.stage} className="flex items-center justify-between text-xs border-b border-stone-dark py-2 last:border-0">
                <span className="text-ink-soft">{s.label} — {tracking.currentLocation}</span>
                <span className="font-mono text-ink-soft">{s.timestamp ? formatTimestamp(s.timestamp) : ''}</span>
              </li>
            ))}
        </ul>
      </div>

      <p className="text-xs text-ink-soft/70">
        Delivery window: roughly {windowHours} hours from order placement — {formatCurrency(order.shippingCost)} shipping.
      </p>
    </div>
  );
}
