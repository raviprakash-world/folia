import { useState } from 'react';
import { DollarSign, TrendingUp, Tag, Truck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { LineChartWidget } from '@/components/admin/charts/LineChartWidget';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { ExportButton } from '@/components/admin/ExportButton';
import { useRevenueAnalytics, useRealAdminApi } from '@/hooks/useAdminAnalytics';
import { formatCurrency } from '@/utils/currency';
import type { RevenueGranularity } from '@/utils/analytics';

const granularityOptions: { value: RevenueGranularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function AdminRevenue() {
  const [granularity, setGranularity] = useState<RevenueGranularity>('daily');
  const [windowDays, setWindowDays] = useState(90);
  const effectiveGranularity = useRealAdminApi ? 'daily' : granularity;
  const { series, totals } = useRevenueAnalytics(effectiveGranularity, windowDays);

  return (
    <div>
      <PageHeader
        title="Revenue Analytics"
        description={
          useRealAdminApi
            ? 'Daily order revenue from the store database. Discount and shipping breakdowns are not tracked separately yet.'
            : 'Gross/net revenue, discounts, and shipping revenue.'
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {useRealAdminApi ? (
          <div />
        ) : (
          <div className="flex gap-2">
            {granularityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGranularity(opt.value)}
                className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                  granularity === opt.value ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <DateRangeFilter value={windowDays} onChange={setWindowDays} />
          <ExportButton data={series} filename={`revenue-${effectiveGranularity}`} />
        </div>
      </div>

      {useRealAdminApi ? (
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <StatCard label="Revenue" value={formatCurrency(totals.grossRevenue)} Icon={DollarSign} />
          <StatCard label="Avg per day" value={formatCurrency(series.length ? totals.grossRevenue / series.length : 0)} Icon={TrendingUp} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Gross revenue" value={formatCurrency(totals.grossRevenue)} Icon={DollarSign} />
          <StatCard label="Net revenue" value={formatCurrency(totals.netRevenue)} Icon={TrendingUp} />
          <StatCard label="Discounts given" value={formatCurrency(totals.totalDiscounts)} Icon={Tag} />
          <StatCard label="Shipping revenue" value={formatCurrency(totals.shippingRevenue)} Icon={Truck} />
        </div>
      )}

      <LineChartWidget
        data={series}
        series={
          useRealAdminApi
            ? [{ key: 'net', label: 'Revenue', color: 'var(--color-fern)' }]
            : [
                { key: 'gross', label: 'Gross', color: 'var(--color-fern)' },
                { key: 'net', label: 'Net', color: 'var(--color-ochre)' },
              ]
        }
        xKey="label"
        height={340}
        description={`${effectiveGranularity} revenue over the selected date range, ${series.length} data points.`}
      />
    </div>
  );
}
