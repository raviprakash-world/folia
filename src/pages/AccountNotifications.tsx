import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Info,
  Package,
  Truck,
  Tag as TagIcon,
  Heart,
  UserCircle,
  ShieldCheck,
  Check,
  Archive,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { useNotificationStore } from '@/store/notificationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { cn } from '@/utils/cn';
import type { NotificationType } from '@/types/notification';

const typeIcons: Record<NotificationType, typeof Package> = {
  order: Package,
  shipping: Truck,
  promotion: TagIcon,
  wishlist: Heart,
  account: UserCircle,
  security: ShieldCheck,
};

const typeFilters: { value: NotificationType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'order', label: 'Order' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'account', label: 'Account' },
  { value: 'security', label: 'Security' },
];

const preferenceToggles: { key: 'orderConfirmationEmail' | 'shippingUpdatesEmail' | 'deliveryUpdatesSms' | 'marketingEmail'; label: string; description: string }[] = [
  { key: 'orderConfirmationEmail', label: 'Order confirmation (email)', description: 'Get an email when you place an order.' },
  { key: 'shippingUpdatesEmail', label: 'Shipping updates (email)', description: 'Get an email when your order ships.' },
  { key: 'deliveryUpdatesSms', label: 'Delivery updates (SMS)', description: 'Get a text when your order is out for delivery.' },
  { key: 'marketingEmail', label: 'New arrivals & promotions (email)', description: 'Occasional emails about new plants and sales.' },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AccountNotifications() {
  const notifications = useNotificationStore((s) => s.notifications);
  const seedIfEmpty = useNotificationStore((s) => s.seedIfEmpty);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const archiveNotification = useNotificationStore((s) => s.archiveNotification);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);

  const prefs = usePreferencesStore((s) => s.notifications);
  const prefsHydrated = usePreferencesStore((s) => s.hasHydrated);
  const togglePref = usePreferencesStore((s) => s.toggleNotification);

  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    seedIfEmpty();
  }, [seedIfEmpty]);

  const visible = useMemo(() => {
    return notifications
      .filter((n) => (showArchived ? n.archived : !n.archived))
      .filter((n) => filter === 'all' || n.type === filter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, filter, showArchived]);

  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" icon={<CheckCheck size={14} />} onClick={markAllAsRead}>
              Mark all read
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter(t.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                filter === t.value ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs text-ink-soft hover:text-pine transition-colors underline"
        >
          {showArchived ? 'Show active' : 'Show archived'}
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No archived notifications' : 'Nothing here'}
          description={showArchived ? 'Notifications you archive will show up here.' : "You're all caught up."}
        />
      ) : (
        <ul className="flex flex-col gap-2 mb-14">
          {visible.map((n) => {
            const Icon = typeIcons[n.type];
            const content = (
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full shrink-0',
                    n.read ? 'bg-stone-dark text-ink-soft' : 'bg-fern/15 text-fern-dark'
                  )}
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className={cn('text-sm', n.read ? 'text-ink-soft' : 'text-ink font-medium')}>{n.title}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{n.message}</p>
                  <p className="font-mono text-[11px] text-ink-soft/70 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );

            return (
              <li
                key={n.id}
                className={cn(
                  'flex items-start justify-between gap-3 p-3.5 rounded-[var(--radius-card)] border',
                  n.read ? 'bg-stone-light border-stone-dark' : 'bg-fern/5 border-fern/30'
                )}
              >
                {n.href ? (
                  <Link to={n.href} onClick={() => markAsRead(n.id)} className="flex-1 min-w-0">
                    {content}
                  </Link>
                ) : (
                  <div className="flex-1 min-w-0">{content}</div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      aria-label="Mark as read"
                      className="p-1.5 text-ink-soft hover:text-fern transition-colors"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {!n.archived && (
                    <button
                      type="button"
                      onClick={() => archiveNotification(n.id)}
                      aria-label="Archive"
                      className="p-1.5 text-ink-soft hover:text-pine transition-colors"
                    >
                      <Archive size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteNotification(n.id)}
                    aria-label="Delete"
                    className="p-1.5 text-ink-soft hover:text-rust transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-8 border-t border-stone-dark">
        <h2 className="font-display text-lg font-semibold text-pine mb-3">Notification preferences</h2>
        <div className="flex gap-2.5 text-xs text-ink-soft bg-stone-dark/30 rounded-[var(--radius-control)] p-3 mb-5">
          <Info size={14} className="shrink-0 mt-0.5" />
          <p>These preferences are saved, but this demo doesn't have a real email or SMS system behind it.</p>
        </div>
        <div className="flex flex-col gap-3 max-w-md">
          {!prefsHydrated ? (
            <div className="animate-pulse flex flex-col gap-3">
              <div className="h-16 bg-stone-dark/40 rounded-[var(--radius-card)]" />
              <div className="h-16 bg-stone-dark/40 rounded-[var(--radius-card)]" />
            </div>
          ) : (
            preferenceToggles.map((t) => (
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
                  checked={prefs[t.key]}
                  onChange={() => togglePref(t.key)}
                  className="w-4 h-4 accent-fern mt-0.5 shrink-0"
                />
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
