import { useState } from 'react';
import { Loader2, Tag as TagIcon, X } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

export function CouponInput() {
  const [code, setCode] = useState('');
  const coupon = useCartStore((s) => s.coupon);
  const status = useCartStore((s) => s.couponStatus);
  const error = useCartStore((s) => s.couponError);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    await applyCoupon(code);
    setCode('');
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-fern/40 bg-fern/10 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-fern-dark">
          <TagIcon size={14} />
          <span className="font-mono font-medium">{coupon.code}</span>
          <span className="text-ink-soft text-xs hidden sm:inline">— {coupon.description}</span>
        </div>
        <button
          type="button"
          onClick={removeCoupon}
          aria-label="Remove coupon"
          className="p-1 text-ink-soft hover:text-rust transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Coupon code"
          aria-label="Coupon code"
          aria-invalid={status === 'error'}
          className="flex-1 min-w-0 rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3 py-2 text-sm font-mono uppercase placeholder:normal-case placeholder:font-sans focus:border-fern transition-colors"
        />
        <button
          type="submit"
          disabled={status === 'pending' || !code.trim()}
          className="shrink-0 flex items-center justify-center px-4 rounded-[var(--radius-control)] bg-pine text-stone-light text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {status === 'pending' ? <Loader2 size={15} className="animate-spin" /> : 'Apply'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rust">
          {error}
        </p>
      )}
    </form>
  );
}
