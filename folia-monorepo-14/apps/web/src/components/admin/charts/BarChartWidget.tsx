import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { ChartSeries } from './LineChartWidget';

interface BarChartWidgetProps<T extends object> {
  data: T[];
  series: ChartSeries[];
  xKey: string;
  height?: number;
  description: string;
  layout?: 'horizontal' | 'vertical';
}

export function BarChartWidget<T extends object>({
  data,
  series,
  xKey,
  height = 260,
  description,
  layout = 'horizontal',
}: BarChartWidgetProps<T>) {
  const isVertical = layout === 'vertical';
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <div role="img" aria-label={description}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-stone-dark)" />
          {isVertical ? (
            <>
              <XAxis type="number" tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-stone-dark)' }} />
              <YAxis
                type="category"
                dataKey={xKey}
                width={110}
                tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--color-stone-dark)' }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-stone-dark)' }} />
              <YAxis tick={{ fill: 'var(--color-ink-soft)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-stone-dark)' }} />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-stone-light)',
              border: '1px solid var(--color-stone-dark)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-ink)',
            }}
            cursor={{ fill: 'var(--color-stone-dark)', opacity: 0.3 }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 4, 4]} isAnimationActive={!prefersReducedMotion} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
