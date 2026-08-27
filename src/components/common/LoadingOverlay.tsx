import { Loader2 } from 'lucide-react';

export function LoadingOverlay({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="absolute inset-0 z-10 flex items-center justify-center bg-stone-light/70 backdrop-blur-[1px] rounded-[var(--radius-card)]"
    >
      <Loader2 size={24} className="animate-spin text-fern" />
    </div>
  );
}
