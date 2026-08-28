import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { ChartSeries } from './LineChartWidget';

interface AreaChartWidgetProps<T extends object> {
  data: T[];
  series: ChartSeries[];
  xKey: string;
  height?: number;
  description: string;
}

export function AreaChartWidget<T extends object>({ data, series, xKey, height = 260, description }: AreaChartWidgetProps<T>) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <div role="img" aria-label={description}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`area-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-stone-dark)" />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-stone-dark)' }} />
          <YAxis tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-stone-dark)' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-stone-light)',
              border: '1px solid var(--color-stone-dark)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-ink)',
            }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#area-fill-${s.key})`}
              isAnimationActive={!prefersReducedMotion}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
