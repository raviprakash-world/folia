import { Info } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { usePreferencesStore } from '@/store/preferencesStore';

const toggles: { key: 'orderConfirmationEmail' | 'shippingUpdatesEmail' | 'deliveryUpdatesSms' | 'marketingEmail'; label: string; description: string }[] = [
  { key: 'orderConfirmationEmail', label: 'Order confirmation (email)', description: 'Get an email when you place an order.' },
  { key: 'shippingUpdatesEmail', label: 'Shipping updates (email)', description: 'Get an email when your order ships.' },
  { key: 'deliveryUpdatesSms', label: 'Delivery updates (SMS)', description: 'Get a text when your order is out for delivery.' },
  { key: 'marketingEmail', label: 'New arrivals & promotions (email)', description: 'Occasional emails about new plants and sales.' },
];

export default function AccountNotifications() {
  const notifications = usePreferencesStore((s) => s.notifications);
  const toggleNotification = usePreferencesStore((s) => s.toggleNotification);

  return (
    <div className="max-w-md">
      <PageHeader title="Notifications" description="Choose what you hear from us, and how." />

      <div className="flex gap-2.5 text-xs text-ink-soft bg-stone-dark/30 rounded-[var(--radius-control)] p-3 mb-6">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          These preferences are saved, but this demo doesn't have a real email or SMS system behind
          it — nothing will actually be sent.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {toggles.map((t) => (
          <label
            key={t.key}
            className="flex items-start justify-between gap-4 p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium text-ink">{t.label}</p>
              <p className="text-xs text-ink-soft mt-0.5">{t.description}</p>
            </div>
            <input
              type="checkbox"
              checked={notifications[t.key]}
              onChange={() => toggleNotification(t.key)}
              className="w-4 h-4 accent-fern mt-0.5 shrink-0"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
