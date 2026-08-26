import { cn } from '@/utils/cn';

interface LogoProps {
  className?: string;
  /** Use light on the pine hero/footer blocks, dark everywhere else. */
  tone?: 'dark' | 'light';
}

/**
 * Original wordmark: a leaf formed from two simple arcs, sitting inside the
 * "o" of the name — a nod to the plant-tag motif without illustrating a
 * literal plant.
 */
export function Logo({ className, tone = 'dark' }: LogoProps) {
  const color = tone === 'dark' ? 'var(--color-pine)' : 'var(--color-stone-light)';
  return (
    <span className={cn('inline-flex items-center gap-2 font-display font-semibold text-xl', className)} style={{ color }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.5" />
        <path
          d="M8 15C8 10 12 8 16 8C16 12 14 16 8 15Z"
          fill={color}
        />
        <path d="M8 15C10 13 12 11 16 8" stroke={tone === 'dark' ? 'var(--color-stone)' : 'var(--color-pine)'} strokeWidth="0.75" />
      </svg>
      Folia
    </span>
  );
}
