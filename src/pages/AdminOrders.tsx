import { useState } from 'react';
import { ShoppingBag, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { BarChartWidget } from '@/components/admin/charts/BarChartWidget';
import { PieChartWidget } from '@/components/admin/charts/PieChartWidget';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { ExportButton } from '@/components/admin/ExportButton';
import { useOrdersAnalytics } from '@/hooks/useAdminAnalytics';

const statusColorVar: Record<string, string> = {
  delivered: 'var(--color-fern)',
  shipped: 'var(--color-fern-light)',
  confirmed: 'var(--color-ochre-light)',
  processing: 'var(--color-ochre)',
  cancelled: 'var(--color-rust)',
  returned: 'var(--color-rust-light)',
  refunded: 'var(--color-ink-soft)',
};

export default function AdminOrders() {
  const [windowDays, setWindowDays] = useState(90);
  const { perDay, byStatus, performance } = useOrdersAnalytics(30, windowDays);

  const pieData = byStatus.map((s) => ({
    name: s.status,
    value: s.count,
    color: statusColorVar[s.status] ?? 'var(--color-ink-soft)',
  }));

  return (
    <div>
      <PageHeader title="Orders Dashboard" description="Order volume, status breakdown, and delivery performance." />

      <div className="flex justify-end items-center gap-3 mb-6">
        <DateRangeFilter value={windowDays} onChange={setWindowDays} />
        <ExportButton data={byStatus} filename="orders-by-status" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total orders" value={performance.totalOrders} Icon={ShoppingBag} />
        <StatCard label="Delivery rate" value={`${performance.deliveryRate}%`} Icon={CheckCircle2} />
        <StatCard label="Cancellation rate" value={`${performance.cancellationRate}%`} Icon={XCircle} />
        <StatCard label="Return rate" value={`${performance.returnRate}%`} Icon={RotateCcw} />
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Orders per day (30d)</h2>
          <BarChartWidget
            data={perDay}
            series={[{ key: 'count', label: 'Orders', color: 'var(--color-fern)' }]}
            xKey="label"
            description={`Daily order count over the last 30 days, ${perDay.reduce((s, p) => s + p.count, 0)} orders total.`}
          />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Orders by status</h2>
          <PieChartWidget
            data={pieData}
            description={`Order status breakdown: ${byStatus.map((s) => `${s.status} ${s.count}`).join(', ')}.`}
          />
        </div>
      </div>
    </div>
  );
}
