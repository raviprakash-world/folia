import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { TableWidget } from '@/components/admin/TableWidget';
import { Pagination } from '@/components/common/Pagination';
import { Tag } from '@/components/ui/Tag';
import { useSellerBalance, useSellerLedger, useSellerPayouts, useRealSellersApi } from '@/hooks/useSellerEarnings';
import { payoutStatusTone } from '@/utils/sellerPayoutStatus';
import { formatCurrency, formatDate } from '@/utils/currency';
import type { SellerLedgerEntry, SellerPayout } from '@/types/sellerDashboard';

const PAGE_SIZE = 20;

const LEDGER_TYPE_LABEL: Record<string, string> = {
  SALE: 'Sale',
  COMMISSION: 'Commission',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
  PAYOUT: 'Payout',
};

export default function SellerEarnings() {
  const [page, setPage] = useState(1);
  const { balance } = useSellerBalance();
  const { items: ledgerItems, total, isLoading } = useSellerLedger(page, PAGE_SIZE);
  const { items: payouts } = useSellerPayouts();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!useRealSellersApi) {
    return (
      <div>
        <PageHeader title="Earnings" />
        <p className="text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Earnings" description="Your real ledger — every sale, commission, refund, adjustment, and payout." />

      <div className="mb-10">
        <StatCard label="Available balance" value={formatCurrency(balance)} Icon={Wallet} />
      </div>

      <div className="mb-10">
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Payout history</h2>
        <TableWidget
          caption="Your payout history"
          emptyMessage="No payouts yet — an admin initiates a payout once you have a positive balance."
          rows={payouts}
          keyExtractor={(p: SellerPayout) => p.id}
          columns={[
            { key: 'amount', label: 'Amount', align: 'right', render: (p: SellerPayout) => formatCurrency(p.amount) },
            { key: 'status', label: 'Status', render: (p: SellerPayout) => <Tag tone={payoutStatusTone[p.status]}>{p.status}</Tag> },
            { key: 'initiated', label: 'Initiated', render: (p: SellerPayout) => formatDate(p.createdAt) },
            { key: 'processed', label: 'Processed', render: (p: SellerPayout) => (p.processedAt ? formatDate(p.processedAt) : '—') },
            { key: 'note', label: 'Note', render: (p: SellerPayout) => p.failureReason ?? '—' },
          ]}
        />
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Ledger</h2>
        {isLoading ? (
          <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
        ) : (
          <TableWidget
            caption="Your ledger entries"
            emptyMessage="No ledger activity yet."
            rows={ledgerItems}
            keyExtractor={(e: SellerLedgerEntry) => e.id}
            columns={[
              { key: 'type', label: 'Type', render: (e: SellerLedgerEntry) => LEDGER_TYPE_LABEL[e.type] ?? e.type },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                render: (e: SellerLedgerEntry) => (
                  <span className={e.amount < 0 ? 'text-rust' : 'text-fern'}>{formatCurrency(e.amount)}</span>
                ),
              },
              { key: 'note', label: 'Note', render: (e: SellerLedgerEntry) => e.note ?? '—' },
              { key: 'date', label: 'Date', render: (e: SellerLedgerEntry) => formatDate(e.createdAt) },
            ]}
          />
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
