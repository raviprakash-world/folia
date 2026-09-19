import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const toneStyles = {
  success: { container: 'bg-pine text-cream-light', Icon: CheckCircle2 },
  error: { container: 'bg-rust text-stone-light', Icon: AlertCircle },
  info: { container: 'bg-ink text-stone-light', Icon: Info },
} as const;

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm lg:bottom-4">
      <AnimatePresence>
        {toasts.map((toast) => {
          const { container, Icon } = toneStyles[toast.tone];
          return (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-control)] px-4 py-3 text-sm shadow-[var(--shadow-lifted)] pointer-events-auto',
                container
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
                className="-mr-2 flex size-11 shrink-0 items-center justify-center opacity-70 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
