import { DollarSign, ShoppingBag, Users, TrendingUp, Package, Search, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { MetricCard } from '@/components/admin/MetricCard';
import { AreaChartWidget } from '@/components/admin/charts/AreaChartWidget';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { useRevenueAnalytics, useOrdersAnalytics, useCustomerAnalytics, useSearchAnalytics } from '@/hooks/useAdminAnalytics';
import { useOrderStore } from '@/store/orderStore';
import { formatCurrency } from '@/utils/currency';

export default function AdminOverview() {
  const { series, totals, revenueTrend } = useRevenueAnalytics('daily', 30);
  const { performance } = useOrdersAnalytics(30);
  const customers = useCustomerAnalytics();
  const { conversion } = useSearchAnalytics();
  const liveOrders = useOrderStore((s) => s.orders);

  const activity = liveOrders.slice(0, 5).map((o) => ({
    id: o.id,
    Icon: ShoppingBag,
    title: `Order ${o.id} — ${o.status}`,
    description: `${formatCurrency(o.total)} · ${o.items.length} item${o.items.length === 1 ? '' : 's'}`,
    timestamp: new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard Overview"
        description="Baseline platform data (last 90 days, deterministic mock) combined with this session's real activity."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <MetricCard
          label="Gross revenue (30d)"
          value={formatCurrency(totals.grossRevenue)}
          Icon={DollarSign}
          trend={revenueTrend ?? undefined}
          positiveDirection="up"
        />
        <StatCard label="Orders (30d)" value={performance.totalOrders} Icon={ShoppingBag} />
        <StatCard label="Total customers" value={customers.totalCustomers} Icon={Users} />
        <StatCard label="Avg order value" value={formatCurrency(customers.averageOrderValue)} Icon={TrendingUp} />
      </div>

      <div className="mb-10">
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Revenue, last 30 days</h2>
        <AreaChartWidget
          data={series}
          series={[{ key: 'net', label: 'Net revenue', color: 'var(--color-fern)' }]}
          xKey="label"
          description={`Daily net revenue over the last 30 days, ranging from the lowest to highest day in that window.`}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Delivery rate" value={`${performance.deliveryRate}%`} Icon={Package} />
        <StatCard label="Return rate" value={`${performance.returnRate}%`} Icon={RotateCcw} />
        <StatCard label="Search click-through" value={`${conversion.clickThroughRate}%`} Icon={Search} />
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Your recent orders</h2>
        <ActivityFeed items={activity} emptyMessage="No live orders placed in this session yet." />
      </div>
    </div>
  );
}
