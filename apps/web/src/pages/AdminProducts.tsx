import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { BarChartWidget } from '@/components/admin/charts/BarChartWidget';
import { TableWidget } from '@/components/admin/TableWidget';
import { ExportButton } from '@/components/admin/ExportButton';
import { Modal } from '@/components/common/Modal';
import { ProductForm } from '@/components/admin/ProductForm';
import { Button } from '@/components/ui/Button';
import { useProductAnalytics, useRealAdminApi } from '@/hooks/useAdminAnalytics';
import { createAdminProduct, updateAdminProduct, deleteAdminProduct } from '@/services/adminApiService';
import { fetchProducts } from '@/services/productService';
import { fetchCategories } from '@/services/categoryService';
import { formatCurrency } from '@/utils/currency';
import { products } from '@/data/products';
import type { TableColumn } from '@/components/admin/TableWidget';
import type { ProductMetric, ProductPairMetric } from '@/utils/analytics';
import type { AdminProductFormValues } from '@/utils/validation';
import type { Product } from '@/types/product';

const PRODUCT_LIST_QUERY_KEY = ['admin-product-list'];
const CATEGORY_LIST_QUERY_KEY = ['admin-category-list'];

const metricColumns: TableColumn<ProductMetric>[] = [
  { key: 'name', label: 'Product', render: (row) => row.name },
  { key: 'value', label: 'Count', align: 'right', render: (row) => row.value },
];

function productName(id: string): string {
  return products.find((p) => p.id === id)?.name ?? id;
}

export default function AdminProducts() {
  const { bestSellers, worstSellers, mostReturned, mostViewed, mostWishlisted, frequentlyBoughtTogether } = useProductAnalytics();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Reuses the public catalog endpoints rather than a separate admin list —
  // no dedicated admin product-list endpoint exists server-side. This means
  // the management table only reflects the real catalog when
  // VITE_REAL_CATALOG_API is also on (true by default alongside
  // VITE_REAL_ADMIN_API in this repo's .env — see vite.config.ts).
  const { data: productList } = useQuery({
    queryKey: PRODUCT_LIST_QUERY_KEY,
    queryFn: () => fetchProducts({ page: 1, pageSize: 100 }),
    enabled: useRealAdminApi,
  });
  const { data: categories = [] } = useQuery({
    queryKey: CATEGORY_LIST_QUERY_KEY,
    queryFn: fetchCategories,
    enabled: useRealAdminApi,
  });

  function invalidateProducts() {
    return queryClient.invalidateQueries({ queryKey: PRODUCT_LIST_QUERY_KEY });
  }

  const createMutation = useMutation({
    mutationFn: createAdminProduct,
    onSuccess: () => {
      void invalidateProducts();
      setEditingProduct(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAdminProduct>[1] }) => updateAdminProduct(id, input),
    onSuccess: () => {
      void invalidateProducts();
      setEditingProduct(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: () => {
      void invalidateProducts();
      setDeleteTarget(null);
    },
  });

  async function handleFormSubmit(values: AdminProductFormValues) {
    const input = {
      slug: values.slug,
      name: values.name,
      price: Number(values.price),
      compareAtPrice: values.compareAtPrice === '' || values.compareAtPrice === undefined ? undefined : Number(values.compareAtPrice),
      description: values.description,
      categoryId: values.categoryId,
      badge: values.badge === '' || values.badge === undefined ? undefined : values.badge,
      careLevel: values.careLevel === '' || values.careLevel === undefined ? undefined : values.careLevel,
    };
    if (editingProduct === 'new') {
      await createMutation.mutateAsync(input);
    } else if (editingProduct) {
      await updateMutation.mutateAsync({ id: editingProduct.id, input });
    }
  }

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
          <TableWidget
            columns={metricColumns}
            rows={mostWishlisted}
            keyExtractor={(r) => r.productId}
            caption="Most wishlisted products"
            emptyMessage={useRealAdminApi ? 'Not yet tracked server-side.' : 'No data yet.'}
          />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Most returned</h2>
          <TableWidget
            columns={metricColumns}
            rows={mostReturned}
            keyExtractor={(r) => r.productId}
            caption="Most returned products"
            emptyMessage={useRealAdminApi ? 'Not yet tracked server-side.' : 'No returns recorded.'}
          />
        </div>
      </div>

      <div className="mb-10">
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Frequently bought together</h2>
        <p className="text-xs text-ink-soft mb-3">
          {useRealAdminApi
            ? 'Not yet tracked server-side — no co-purchase aggregation exists in the real backend.'
            : 'Real co-purchase pairs counted from actual order data — distinct from the storefront’s category-based recommendation engine.'}
        </p>
        <TableWidget columns={pairColumns} rows={frequentlyBoughtTogether} keyExtractor={(r) => r.pair.join('-')} caption="Frequently bought together product pairs" />
      </div>

      {useRealAdminApi ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-heading">Manage products</h2>
            <Button type="button" variant="primary" size="sm" onClick={() => setEditingProduct('new')}>
              <Plus size={14} className="mr-1" />
              Add product
            </Button>
          </div>
          <TableWidget
            caption="All products with edit and delete actions"
            emptyMessage="No products yet."
            rows={productList?.items ?? []}
            keyExtractor={(p: Product) => p.id}
            columns={[
              { key: 'name', label: 'Product', render: (p: Product) => p.name },
              { key: 'category', label: 'Category', render: (p: Product) => p.category },
              { key: 'price', label: 'Price', align: 'right', render: (p: Product) => formatCurrency(p.price) },
              { key: 'stock', label: 'Stock', align: 'right', render: (p: Product) => p.stockCount },
              {
                key: 'actions',
                label: 'Actions',
                render: (p: Product) => (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(p)}
                      aria-label={`Edit ${p.name}`}
                      className="p-1.5 rounded-full border border-stone-dark hover:border-fern text-ink-soft hover:text-heading"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      aria-label={`Delete ${p.name}`}
                      className="p-1.5 rounded-full border border-stone-dark hover:border-rust text-ink-soft hover:text-rust"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          Product management actions require the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      )}

      <Modal
        open={editingProduct !== null}
        onClose={() => setEditingProduct(null)}
        title={editingProduct === 'new' ? 'Add product' : `Edit ${editingProduct?.name ?? ''}`}
      >
        <ProductForm
          categories={categories}
          initialValues={editingProduct !== 'new' ? (editingProduct ?? undefined) : undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => setEditingProduct(null)}
          submitLabel={editingProduct === 'new' ? 'Create product' : 'Save changes'}
        />
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete this product?">
        <p className="text-sm text-ink-soft mb-5">
          {deleteTarget?.name} will be permanently removed from the catalog. This can't be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
