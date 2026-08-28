import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface LineChartWidgetProps<T extends object> {
  data: T[];
  series: ChartSeries[];
  xKey: string;
  height?: number;
  description: string;
}

export function LineChartWidget<T extends object>({ data, series, xKey, height = 260, description }: LineChartWidgetProps<T>) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <div role="img" aria-label={description}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
