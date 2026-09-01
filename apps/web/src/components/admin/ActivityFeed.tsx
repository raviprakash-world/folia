import type { LucideIcon } from 'lucide-react';

export interface ActivityItem {
  id: string;
  Icon: LucideIcon;
  title: string;
  description?: string;
  timestamp: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  emptyMessage?: string;
}

export function ActivityFeed({ items, emptyMessage = 'No recent activity.' }: ActivityFeedProps) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-soft py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-fern/10 text-fern-dark shrink-0">
            <item.Icon size={14} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink">{item.title}</p>
            {item.description && <p className="text-xs text-ink-soft mt-0.5">{item.description}</p>}
            <p className="font-mono text-[11px] text-ink-soft/70 mt-1">{item.timestamp}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
