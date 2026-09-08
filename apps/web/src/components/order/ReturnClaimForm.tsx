import { useState } from 'react';
import { Upload, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/currency';
import type { Order, OrderItem } from '@/types/order';
import type { ReturnClaimReason } from '@/types/returnClaim';
import type { CreateReturnClaimInput } from '@/services/returnsApiService';

const PLANT_CATEGORY_SLUG = 'plants';

/** Mirrors apps/api/src/orders/return-policy.util.ts's DOA_CLAIM_REASONS/STANDARD_RETURN_REASONS exactly — the backend re-validates this regardless, but showing only the reasons that can actually succeed avoids a confusing rejection after upload. */
const STANDARD_RETURN_REASONS: ReturnClaimReason[] = [
  'no-longer-needed',
  'wrong-item',
  'damaged-in-transit',
  'not-as-described',
  'changed-mind',
  'other',
];
const DOA_CLAIM_REASONS: ReturnClaimReason[] = ['doa', 'damaged-in-transit', 'wrong-item'];

const REASON_LABELS: Record<ReturnClaimReason, string> = {
  'no-longer-needed': 'No longer needed',
  'wrong-item': 'Received the wrong item',
  'damaged-in-transit': 'Arrived damaged',
  'not-as-described': 'Not as described',
  'changed-mind': 'Changed my mind',
  other: 'Other',
  doa: 'Dead on arrival',
};

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EVIDENCE_TYPES = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';

interface ReturnClaimFormProps {
  order: Order;
  onSubmit: (input: CreateReturnClaimInput) => Promise<void>;
  onCancel: () => void;
  submitError?: string | null;
  isSubmitting: boolean;
}

export function ReturnClaimForm({ order, onSubmit, onCancel, submitError, isSubmitting }: ReturnClaimFormProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnClaimReason | ''>('');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const selectedItems: OrderItem[] = order.items.filter((item) => quantities[item.id] !== undefined);
  const hasPlant = selectedItems.some((item) => item.categorySlug === PLANT_CATEGORY_SLUG);
  const hasNonPlant = selectedItems.some((item) => item.categorySlug !== PLANT_CATEGORY_SLUG);
  const isMixed = hasPlant && hasNonPlant;
  const claimType = hasPlant ? 'doa-claim' : 'standard-return';
  const allowedReasons = hasPlant ? DOA_CLAIM_REASONS : STANDARD_RETURN_REASONS;
  const evidenceRequired = hasPlant;

  function toggleItem(item: OrderItem, checked: boolean) {
    setQuantities((prev) => {
      const next = { ...prev };
      if (checked) next[item.id] = 1;
      else delete next[item.id];
      return next;
    });
    // A newly-changed selection may make the current reason ineligible
    // for the derived claim type — clear it rather than silently submit
    // a stale, now-invalid choice.
    setReason('');
  }

  function setQuantity(itemId: string, quantity: number, max: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.min(Math.max(1, quantity), max) }));
  }

  function handleFileChange(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.length > MAX_EVIDENCE_FILES) {
      setFileError(`You can attach up to ${MAX_EVIDENCE_FILES} files.`);
      return;
    }
    const oversized = selected.find((f) => f.size > MAX_EVIDENCE_FILE_BYTES);
    if (oversized) {
      setFileError(`"${oversized.name}" is too large — the limit is ${MAX_EVIDENCE_FILE_BYTES / (1024 * 1024)}MB.`);
      return;
    }
    setFileError(null);
    setEvidence(selected);
  }

  function removeFile(index: number) {
    setEvidence((prev) => prev.filter((_, i) => i !== index));
  }

  const canSubmit =
    selectedItems.length > 0 &&
    !isMixed &&
    !!reason &&
    (!evidenceRequired || evidence.length > 0) &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit || !reason) return;
    await onSubmit({
      items: selectedItems.map((item) => ({ orderItemId: item.id, quantity: quantities[item.id]! })),
      reason,
      note: note || undefined,
      evidence,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-ink-soft mb-2">Which items?</p>
        <div className="flex flex-col gap-2.5">
          {order.items.map((item) => {
            const checked = quantities[item.id] !== undefined;
            return (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleItem(item, e.target.checked)}
                    className="w-4 h-4 accent-fern shrink-0"
                  />
                  <span>
                    {item.name}
                    {item.variantLabel ? ` (${item.variantLabel})` : ''} — {formatCurrency(item.price)}
                    <span className="text-ink-soft"> × {item.quantity} purchased</span>
                  </span>
                </label>
                {checked && item.quantity > 1 && (
                  <input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={quantities[item.id]}
                    onChange={(e) => setQuantity(item.id, Number(e.target.value), item.quantity)}
                    className="w-14 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-2 py-1 text-sm"
                    aria-label={`Quantity of ${item.name} to claim`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isMixed && (
        <p className="flex items-start gap-2 text-xs text-rust">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          Plants and other items can&apos;t be claimed together — an order can only have one return/DOA claim
          in total, so please select items from just one group.
        </p>
      )}

      {selectedItems.length > 0 && !isMixed && (
        <p className="text-xs text-ink-soft">
          {hasPlant
            ? 'This will be filed as a plant DOA/damage claim — photo or video evidence is required.'
            : 'This will be filed as a standard return.'}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="claim-reason" className="text-sm font-medium text-ink-soft">
          Reason
        </label>
        <select
          id="claim-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReturnClaimReason)}
          disabled={selectedItems.length === 0 || isMixed}
          className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm disabled:opacity-50"
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {allowedReasons.map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Additional details (optional)"
        rows={2}
        className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
      />

      {(evidenceRequired || evidence.length > 0) && (
        <div>
          <p className="text-sm font-medium text-ink-soft mb-2">
            Evidence{evidenceRequired ? ' (required)' : ' (optional)'}
          </p>
          <label className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-[var(--radius-control)] border border-stone-dark hover:border-fern cursor-pointer">
            <Upload size={14} />
            Add photos or video
            <input
              type="file"
              multiple
              accept={ACCEPTED_EVIDENCE_TYPES}
              onChange={(e) => handleFileChange(e.target.files)}
              className="hidden"
            />
          </label>
          {fileError && <p className="text-xs text-rust mt-1.5">{fileError}</p>}
          {evidence.length > 0 && (
            <ul className="flex flex-col gap-1.5 mt-2">
              {evidence.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center justify-between text-xs bg-stone-dark/40 rounded-[var(--radius-control)] px-2.5 py-1.5">
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${file.name}`} className="text-ink-soft hover:text-rust shrink-0 ml-2">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-ink-soft" data-claim-type={claimType}>
        You can only file one return/DOA claim per order.
      </p>

      {submitError && <p className="text-sm text-rust">{submitError}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
          {isSubmitting ? 'Submitting…' : 'Submit claim'}
        </Button>
      </div>
    </div>
  );
}
