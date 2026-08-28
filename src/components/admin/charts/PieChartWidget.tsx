import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface PieChartWidgetProps {
  data: PieSlice[];
  height?: number;
  description: string;
}

export function PieChartWidget({ data, height = 260, description }: PieChartWidgetProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <div role="img" aria-label={description}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive={!prefersReducedMotion}
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} stroke="var(--color-stone-light)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-stone-light)',
              border: '1px solid var(--color-stone-dark)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-ink)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink-soft)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
