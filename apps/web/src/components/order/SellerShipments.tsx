import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { orderStatusTone } from '@/utils/orderStatus';
import { formatDate } from '@/utils/currency';
import type { OrderShipmentGroup } from '@/types/order';

/**
 * Marketplace Phase 16 — a genuine multi-seller order can't be
 * represented by TrackingTimeline's single simulated shipment (Order's
 * own courierId/trackingNumber only ever roll up when there's exactly
 * one seller group — see OrdersService.shipOrderSellerGroup's own
 * comment). This shows each seller's own real, honest shipment status
 * instead — no simulated stage timeline per group, just the real
 * courier/tracking data OrderSellerGroup actually carries.
 */
export function SellerShipments({ groups }: { groups: OrderShipmentGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.id} variant="flat" className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-medium text-ink">{group.sellerName ?? 'Folia'}</h3>
            <Tag tone={orderStatusTone[group.status]}>{group.status.replace('-', ' ')}</Tag>
          </div>

          <ul className="text-sm text-ink-soft flex flex-col gap-0.5 mb-3">
            {group.items.map((item) => (
              <li key={item.id}>
                {item.name}
                {item.variantLabel ? ` — ${item.variantLabel}` : ''} × {item.quantity}
              </li>
            ))}
          </ul>

          {group.courierId ? (
            <div className="text-xs text-ink-soft flex flex-wrap items-center gap-3">
              <span className="font-mono">{group.trackingNumber}</span>
              {group.shippedAt && <span>Shipped {formatDate(group.shippedAt)}</span>}
              {group.deliveredAt && <span>Delivered {formatDate(group.deliveredAt)}</span>}
              {group.trackingUrl && (
                <a
                  href={group.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-fern hover:text-heading transition-colors"
                >
                  <ExternalLink size={11} />
                  Track on carrier site
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">Being prepared — tracking will appear here once it ships.</p>
          )}
        </Card>
      ))}
    </div>
  );
}
