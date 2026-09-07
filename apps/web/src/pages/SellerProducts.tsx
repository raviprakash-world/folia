import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useSellerProductsList, useRealSellersApi } from '@/hooks/useSellerProducts';
import { productApprovalStatusTone, productApprovalStatusLabel } from '@/utils/sellerProductStatus';
import { formatCurrency } from '@/utils/currency';
import type { SellerProduct } from '@/types/sellerDashboard';

export default function SellerProducts() {
  const { items, isLoading } = useSellerProductsList();

  return (
    <div>
      <PageHeader
        title="Your products"
        description="Everything you're selling on Folia — draft, in review, live, or archived."
        action={
          <Link to="/seller/products/new">
            <Button type="button" variant="primary" size="sm">
              <Plus size={14} className="mr-1" />
              New product
            </Button>
          </Link>
        }
      />

      {!useRealSellersApi ? (
        <p className="text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      ) : isLoading ? (
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      ) : (
        <TableWidget
          caption="Your products"
          emptyMessage="You haven't listed any products yet."
          rows={items}
          keyExtractor={(p: SellerProduct) => p.id}
          columns={[
            {
              key: 'name',
              label: 'Product',
              render: (p: SellerProduct) => (
                <Link to={`/seller/products/${p.id}`} className="text-fern underline">
                  {p.name}
                </Link>
              ),
            },
            { key: 'category', label: 'Category', render: (p: SellerProduct) => p.categoryName },
            { key: 'price', label: 'Price', align: 'right', render: (p: SellerProduct) => formatCurrency(p.price) },
            { key: 'stock', label: 'Stock', align: 'right', render: (p: SellerProduct) => p.stockCount },
            {
              key: 'status',
              label: 'Status',
              render: (p: SellerProduct) => (
                <Tag tone={productApprovalStatusTone[p.approvalStatus]}>
                  {productApprovalStatusLabel[p.approvalStatus]}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
