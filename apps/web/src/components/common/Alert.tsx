import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

type AlertTone = 'success' | 'error' | 'info';

interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<AlertTone, { container: string; Icon: typeof CheckCircle2 }> = {
  success: { container: 'bg-fern/10 border-fern/40 text-fern-dark', Icon: CheckCircle2 },
  error: { container: 'bg-rust-light border-rust/40 text-rust', Icon: AlertCircle },
  info: { container: 'bg-stone-dark/40 border-stone-dark text-ink-soft', Icon: Info },
};

export function Alert({ tone, children, className }: AlertProps) {
  const { container, Icon } = toneStyles[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-[var(--radius-control)] border px-4 py-3 text-sm', container, className)}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
