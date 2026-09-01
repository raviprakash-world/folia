import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

interface MetricCardProps {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  trend?: { value: number; direction: 'up' | 'down' | 'flat' };
  /** Whether an "up" trend is good (revenue) or bad (cancellation rate) — flips the color. */
  positiveDirection?: 'up' | 'down';
}

const trendIcon = { up: ArrowUp, down: ArrowDown, flat: Minus };

export function MetricCard({ label, value, Icon, trend, positiveDirection = 'up' }: MetricCardProps) {
  const TrendIcon = trend ? trendIcon[trend.direction] : null;
  const isGood = trend && (trend.direction === 'flat' ? true : trend.direction === positiveDirection);

  return (
    <Card variant="flat" className="p-4">
      <div className="flex items-start justify-between">
        <Icon size={16} className="text-fern" aria-hidden="true" />
        {trend && TrendIcon && (
          <span className={cn('flex items-center gap-0.5 text-xs font-mono', isGood ? 'text-fern-dark' : 'text-rust')}>
            <TrendIcon size={11} />
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="font-display text-2xl font-semibold text-heading mt-2">{value}</p>
      <p className="text-xs text-ink-soft mt-0.5">{label}</p>
    </Card>
  );
}
