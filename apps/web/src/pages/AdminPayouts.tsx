import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { Wallet } from 'lucide-react';
import {
  useAdminSellersList,
  useAdminSellerPayoutPanel,
  useAdminPayoutsList,
  useAdminPayoutDetail,
  useAdminPayoutActions,
  useRealAdminApi,
} from '@/hooks/useAdminMarketplace';
import { payoutStatusTone } from '@/utils/sellerPayoutStatus';
import { formatCurrency, formatDate } from '@/utils/currency';
import type { SellerPayout } from '@/types/sellerDashboard';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const STATUS_TABS = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'] as const;

function SellerPayoutPanel({ sellerId }: { sellerId: string }) {
  const { items: sellers } = useAdminSellersList('active', 1, 50);
  const seller = sellers.find((s) => s.id === sellerId);
  const [ledgerPage] = useState(1);
  const { balance, ledgerItems, adjustLedger, initiatePayout } = useAdminSellerPayoutPanel(sellerId, ledgerPage);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  async function handleInitiate() {
    await initiatePayout.mutateAsync(crypto.randomUUID());
  }

  async function handleAdjust() {
    const amount = Number(adjustAmount);
    if (isNaN(amount) || amount === 0 || !adjustNote.trim()) return;
    await adjustLedger.mutateAsync({ amount, note: adjustNote });
    setAdjustOpen(false);
    setAdjustAmount('');
    setAdjustNote('');
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-stone-dark p-4 mb-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-base font-semibold text-heading">{seller?.displayName ?? sellerId}</h2>
          <p className="text-xs text-ink-soft">Unclaimed balance</p>
        </div>
        <p className="font-display text-2xl font-semibold text-heading">{formatCurrency(balance)}</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <Button variant="primary" size="sm" disabled={balance <= 0 || initiatePayout.isPending} onClick={() => void handleInitiate()}>
          {initiatePayout.isPending ? 'Initiating…' : 'Initiate payout'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
          Manual adjustment
        </Button>
      </div>
      {initiatePayout.isError && (
        <Alert tone="error" className="mb-4">
          {errorMessage(initiatePayout.error, "Couldn't initiate a payout.")}
        </Alert>
      )}

      <h3 className="text-sm font-medium text-ink mb-2">Recent ledger activity</h3>
      <TableWidget
        caption="Ledger entries"
        emptyMessage="No ledger activity yet."
        rows={ledgerItems}
        keyExtractor={(e) => e.id}
        columns={[
          { key: 'type', label: 'Type', render: (e) => e.type },
          {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            render: (e) => <span className={e.amount < 0 ? 'text-rust' : 'text-fern'}>{formatCurrency(e.amount)}</span>,
          },
          { key: 'note', label: 'Note', render: (e) => e.note ?? '—' },
          { key: 'date', label: 'Date', render: (e) => formatDate(e.createdAt) },
        ]}
      />

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Manual ledger adjustment">
        <div className="flex flex-col gap-4">
          <input
            type="number"
            step="0.01"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="Amount — positive to credit, negative to debit"
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          <textarea
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            placeholder="Reason (required, for the audit trail)"
            rows={2}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {adjustLedger.isError && (
            <Alert tone="error">{errorMessage(adjustLedger.error, "Couldn't record that adjustment.")}</Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!adjustAmount || !adjustNote.trim() || adjustLedger.isPending}
              onClick={() => void handleAdjust()}
            >
              {adjustLedger.isPending ? 'Saving…' : 'Record adjustment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PayoutDetailModal({ payoutId, onClose }: { payoutId: string; onClose: () => void }) {
  const { data: detail, isLoading } = useAdminPayoutDetail(payoutId);
  return (
    <Modal open onClose={onClose} title="Payout detail" size="lg">
      {isLoading || !detail ? (
        <p className="text-sm text-ink-soft py-6 text-center">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            {formatCurrency(Number(detail.amount))} · <Tag tone={payoutStatusTone[detail.status as keyof typeof payoutStatusTone]}>{detail.status}</Tag>
          </p>
          <h3 className="text-sm font-medium text-ink mt-2">Claimed ledger entries</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {detail.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between border-b border-stone-dark py-1.5 last:border-0">
                <span className="text-ink-soft">{item.ledgerEntry.type}</span>
                <span className={Number(item.ledgerEntry.amount) < 0 ? 'text-rust font-mono' : 'text-fern font-mono'}>
                  {formatCurrency(Number(item.ledgerEntry.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export default function AdminPayouts() {
  const [searchParams] = useSearchParams();
  const sellerIdParam = searchParams.get('sellerId') ?? undefined;
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('PENDING');
  const { payouts, isLoading } = useAdminPayoutsList({ status });
  const { markProcessing, markPaid, markFailed, cancel } = useAdminPayoutActions();

  const [failTarget, setFailTarget] = useState<SellerPayout | null>(null);
  const [failReason, setFailReason] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  async function handleMarkFailed() {
    if (!failTarget || !failReason.trim()) return;
    await markFailed.mutateAsync({ id: failTarget.id, failureReason: failReason });
    setFailTarget(null);
    setFailReason('');
  }

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Payouts" />
        <p className="text-sm text-ink-soft">
          Payout management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payouts" description="Real seller balances and the real payout lifecycle — nothing here is simulated." />

      {sellerIdParam && <SellerPayoutPanel sellerId={sellerIdParam} />}

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={status === tab}
            onClick={() => setStatus(tab)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              status === tab ? 'border-fern bg-fern text-stone-light' : 'border-stone-dark text-ink-soft hover:border-fern'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {(markProcessing.isError || markPaid.isError || cancel.isError) && (
        <Alert tone="error" className="mb-4">
          {errorMessage(markProcessing.error ?? markPaid.error ?? cancel.error, "Couldn't update that payout.")}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      ) : (
        <TableWidget
          caption={`Payouts filtered to ${status}`}
          emptyMessage="No payouts in this queue."
          rows={payouts}
          keyExtractor={(p: SellerPayout) => p.id}
          columns={[
            {
              key: 'id',
              label: 'Payout',
              render: (p: SellerPayout) => (
                <button type="button" onClick={() => setDetailId(p.id)} className="text-fern underline">
                  {p.id.slice(0, 8)}
                </button>
              ),
            },
            { key: 'amount', label: 'Amount', align: 'right', render: (p: SellerPayout) => formatCurrency(p.amount) },
            { key: 'status', label: 'Status', render: (p: SellerPayout) => <Tag tone={payoutStatusTone[p.status]}>{p.status}</Tag> },
            { key: 'initiated', label: 'Initiated', render: (p: SellerPayout) => formatDate(p.createdAt) },
            {
              key: 'actions',
              label: 'Actions',
              align: 'right',
              render: (p: SellerPayout) => (
                <div className="flex flex-wrap gap-2 justify-end">
                  {p.status === 'PENDING' && (
                    <Button variant="outline" size="sm" disabled={markProcessing.isPending} onClick={() => void markProcessing.mutateAsync(p.id)}>
                      Mark processing
                    </Button>
                  )}
                  {p.status === 'PROCESSING' && (
                    <Button variant="primary" size="sm" disabled={markPaid.isPending} onClick={() => void markPaid.mutateAsync(p.id)}>
                      Mark paid
                    </Button>
                  )}
                  {(p.status === 'PENDING' || p.status === 'PROCESSING') && (
                    <>
                      <Button variant="outline" size="sm" className="!border-rust !text-rust" onClick={() => setFailTarget(p)}>
                        Mark failed
                      </Button>
                      <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => void cancel.mutateAsync(p.id)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {!sellerIdParam && (
        <p className="text-xs text-ink-soft mt-6 flex items-center gap-1.5">
          <Wallet size={12} /> Open a seller from the Sellers page to view their balance and initiate a payout.
        </p>
      )}

      <Modal open={!!failTarget} onClose={() => setFailTarget(null)} title="Mark this payout failed?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">Every ledger entry this payout claimed becomes claimable again.</p>
          <textarea
            value={failReason}
            onChange={(e) => setFailReason(e.target.value)}
            placeholder="Why the real transfer failed (required)"
            rows={3}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
          {markFailed.isError && <Alert tone="error">{errorMessage(markFailed.error, "Couldn't mark this payout failed.")}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFailTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!failReason.trim() || markFailed.isPending} onClick={() => void handleMarkFailed()}>
              {markFailed.isPending ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>

      {detailId && <PayoutDetailModal payoutId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
