import { PageHeader } from '@/components/common/PageHeader';
import { BarChartWidget } from '@/components/admin/charts/BarChartWidget';
import { TableWidget } from '@/components/admin/TableWidget';
import { ExportButton } from '@/components/admin/ExportButton';
import { useProductAnalytics } from '@/hooks/useAdminAnalytics';
import { products } from '@/data/products';
import type { TableColumn } from '@/components/admin/TableWidget';
import type { ProductMetric, ProductPairMetric } from '@/utils/analytics';

const metricColumns: TableColumn<ProductMetric>[] = [
  { key: 'name', label: 'Product', render: (row) => row.name },
  { key: 'value', label: 'Count', align: 'right', render: (row) => row.value },
];

function productName(id: string): string {
  return products.find((p) => p.id === id)?.name ?? id;
}

export default function AdminProducts() {
  const { bestSellers, worstSellers, mostReturned, mostViewed, mostWishlisted, frequentlyBoughtTogether } = useProductAnalytics();

  const pairColumns: TableColumn<ProductPairMetric>[] = [
    { key: 'pair', label: 'Product pair', render: (row) => `${productName(row.pair[0])} + ${productName(row.pair[1])}` },
    { key: 'count', label: 'Co-purchases', align: 'right', render: (row) => row.count },
  ];

  return (
    <div>
      <PageHeader title="Product Analytics" description="Best/worst sellers, view and wishlist activity, and real co-purchase pairs." />

      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-heading">Best sellers</h2>
            <ExportButton data={bestSellers} filename="best-sellers" />
          </div>
          <BarChartWidget
            data={bestSellers}
            series={[{ key: 'value', label: 'Units sold', color: 'var(--color-fern)' }]}
            xKey="name"
            layout="vertical"
            description={`Top ${bestSellers.length} best-selling products by units sold.`}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-heading">Worst sellers</h2>
            <ExportButton data={worstSellers} filename="worst-sellers" />
          </div>
          <BarChartWidget
            data={worstSellers}
            series={[{ key: 'value', label: 'Units sold', color: 'var(--color-rust)' }]}
            xKey="name"
            layout="vertical"
            description={`Bottom ${worstSellers.length} lowest-selling products by units sold.`}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Most viewed</h2>
          <TableWidget columns={metricColumns} rows={mostViewed} keyExtractor={(r) => r.productId} caption="Most viewed products" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Most wishlisted</h2>
          <TableWidget columns={metricColumns} rows={mostWishlisted} keyExtractor={(r) => r.productId} caption="Most wishlisted products" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Most returned</h2>
          <TableWidget
            columns={metricColumns}
            rows={mostReturned}
            keyExtractor={(r) => r.productId}
            caption="Most returned products"
            emptyMessage="No returns recorded."
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Frequently bought together</h2>
        <p className="text-xs text-ink-soft mb-3">
          Real co-purchase pairs counted from actual order data — distinct from the storefront's category-based recommendation engine.
        </p>
        <TableWidget columns={pairColumns} rows={frequentlyBoughtTogether} keyExtractor={(r) => r.pair.join('-')} caption="Frequently bought together product pairs" />
      </div>
    </div>
  );
}
