import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import type { ThemeMode } from '@/store/themeStore';
import { cn } from '@/utils/cn';

const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const hasHydrated = useThemeStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-[var(--radius-control)] border border-stone-dark bg-stone-light animate-pulse',
          compact ? 'p-0.5 w-[90px] h-[34px]' : 'p-0.5 w-[220px] h-[38px]'
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-[var(--radius-control)] border border-stone-dark bg-stone-light p-0.5"
    >
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              'flex items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] transition-colors',
              compact ? 'p-1.5' : 'px-3 py-1.5 text-sm',
              active ? 'bg-pine text-stone-light' : 'text-ink-soft hover:text-ink'
            )}
          >
            <Icon size={compact ? 15 : 14} />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
