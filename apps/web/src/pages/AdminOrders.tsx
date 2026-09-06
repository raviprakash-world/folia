import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { BarChartWidget } from '@/components/admin/charts/BarChartWidget';
import { PieChartWidget } from '@/components/admin/charts/PieChartWidget';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { ExportButton } from '@/components/admin/ExportButton';
import { TableWidget } from '@/components/admin/TableWidget';
import { useOrdersAnalytics, useRealAdminApi } from '@/hooks/useAdminAnalytics';
import { fetchAdminOrders, updateAdminOrderStatus } from '@/services/adminApiService';
import { formatCurrency } from '@/utils/currency';
import type { Order, OrderStatus } from '@/types/order';

/** Forward fulfillment steps only — matches the backend's own canTransitionStatus, which deliberately excludes cancel/return (those stay customer-initiated). */
const nextForwardStatus: Partial<Record<OrderStatus, Extract<OrderStatus, 'confirmed' | 'shipped' | 'delivered'>>> = {
  processing: 'confirmed',
  confirmed: 'shipped',
  shipped: 'delivered',
};

const ORDERS_QUERY_KEY = ['admin-orders-list'];

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
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: () => fetchAdminOrders(),
    enabled: useRealAdminApi,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Extract<OrderStatus, 'confirmed' | 'shipped' | 'delivered'> }) =>
      updateAdminOrderStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  });

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

      {useRealAdminApi ? (
        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Manage orders</h2>
          <TableWidget
            caption="Every order with a fulfillment action"
            emptyMessage="No orders yet."
            rows={orders}
            keyExtractor={(o: Order) => o.id}
            columns={[
              { key: 'id', label: 'Order', render: (o: Order) => o.id },
              { key: 'customer', label: 'Customer', render: (o: Order) => o.shippingAddress.fullName },
              { key: 'status', label: 'Status', render: (o: Order) => o.status },
              { key: 'total', label: 'Total', align: 'right', render: (o: Order) => formatCurrency(o.total) },
              {
                key: 'action',
                label: 'Action',
                render: (o: Order) => {
                  const next = nextForwardStatus[o.status];
                  if (!next) return <span className="text-ink-soft text-xs">—</span>;
                  return (
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ id: o.id, status: next })}
                      disabled={statusMutation.isPending}
                      className="text-xs px-2.5 py-1 rounded-full border border-stone-dark hover:border-fern disabled:opacity-50 capitalize"
                    >
                      Mark {next}
                    </button>
                  );
                },
              },
            ]}
          />
        </div>
      ) : (
        <p className="mt-10 text-sm text-ink-soft">
          Order management actions require the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      )}
    </div>
  );
}
