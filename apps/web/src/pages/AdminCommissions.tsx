import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { useAdminCommissions, useRealAdminApi } from '@/hooks/useAdminMarketplace';
import type { AdminCommissionRate } from '@/types/adminMarketplace';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminCommissions() {
  const { marketplaceDefault, sellers, isLoading, setRate } = useAdminCommissions();
  const [defaultDraft, setDefaultDraft] = useState('');
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [sellerDraft, setSellerDraft] = useState('');

  if (!useRealAdminApi) {
    return (
      <div>
        <PageHeader title="Commissions" />
        <p className="text-sm text-ink-soft">
          Commission management requires the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      </div>
    );
  }

  async function handleSetDefault() {
    const rate = Number(defaultDraft);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    await setRate.mutateAsync({ sellerId: null, ratePercent: rate });
    setDefaultDraft('');
  }

  async function handleSetSellerRate(sellerId: string) {
    const rate = Number(sellerDraft);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    await setRate.mutateAsync({ sellerId, ratePercent: rate });
    setEditingSellerId(null);
    setSellerDraft('');
  }

  return (
    <div>
      <PageHeader title="Commissions" description="The marketplace-default rate, and any per-seller overrides." />

      <div className="rounded-[var(--radius-card)] border border-stone-dark p-4 mb-10 max-w-md">
        <h2 className="font-display text-base font-semibold text-heading mb-1">Marketplace default</h2>
        <p className="text-xs text-ink-soft mb-3">Applies to every seller without their own override.</p>
        <div className="flex items-center gap-3">
          <p className="font-mono text-2xl text-ink">
            {marketplaceDefault === null ? 'Not set' : `${marketplaceDefault}%`}
          </p>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={defaultDraft}
            onChange={(e) => setDefaultDraft(e.target.value)}
            placeholder="New rate"
            className="w-28 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 py-1.5 text-sm"
          />
          <Button variant="outline" size="sm" disabled={!defaultDraft || setRate.isPending} onClick={() => void handleSetDefault()}>
            {setRate.isPending ? 'Saving…' : 'Set'}
          </Button>
        </div>
        {setRate.isError && <p className="text-xs text-rust mt-2">{errorMessage(setRate.error, "Couldn't set that rate.")}</p>}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-heading mb-4">Per-seller rates</h2>
        {isLoading ? (
          <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
        ) : (
          <TableWidget
            caption="Effective commission rate per seller"
            emptyMessage="No sellers yet."
            rows={sellers}
            keyExtractor={(s: AdminCommissionRate) => s.sellerId}
            columns={[
              { key: 'seller', label: 'Seller', render: (s: AdminCommissionRate) => s.displayName },
              {
                key: 'rate',
                label: 'Effective rate',
                render: (s: AdminCommissionRate) =>
                  editingSellerId === s.sellerId ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      autoFocus
                      value={sellerDraft}
                      onChange={(e) => setSellerDraft(e.target.value)}
                      className="w-24 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-2.5 py-1 text-sm"
                    />
                  ) : (
                    `${s.ratePercent}%`
                  ),
              },
              {
                key: 'source',
                label: 'Source',
                render: (s: AdminCommissionRate) =>
                  s.isMarketplaceDefault ? <Tag tone="stone">Default</Tag> : <Tag tone="pine">Override</Tag>,
              },
              {
                key: 'actions',
                label: 'Actions',
                align: 'right',
                render: (s: AdminCommissionRate) =>
                  editingSellerId === s.sellerId ? (
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditingSellerId(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!sellerDraft || setRate.isPending}
                        onClick={() => void handleSetSellerRate(s.sellerId)}
                      >
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSellerId(s.sellerId);
                        setSellerDraft(String(s.ratePercent));
                      }}
                    >
                      Set override
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
