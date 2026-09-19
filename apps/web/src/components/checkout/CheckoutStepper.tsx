import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

const steps = [
  { path: '/checkout/shipping', label: 'Address' },
  { path: '/checkout/delivery', label: 'Delivery' },
  { path: '/checkout/payment', label: 'Payment' },
  { path: '/checkout/review', label: 'Review' },
];

export function CheckoutStepper({ pathname }: { pathname: string }) {
  const currentIndex = steps.findIndex((s) => pathname.startsWith(s.path));

  return (
    <>
    <p className="mb-3 text-sm text-ink-soft sm:hidden" aria-hidden="true">
      Step {currentIndex + 1} of {steps.length} · <span className="font-medium text-ink">{steps[currentIndex]?.label}</span>
    </p>
    <ol className="mb-6 flex items-center sm:mb-10" aria-label="Checkout progress">
      {steps.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li key={step.path} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono shrink-0 transition-colors',
                  isComplete && 'bg-fern text-stone-light',
                  isCurrent && 'bg-pine text-cream-light',
                  !isComplete && !isCurrent && 'bg-stone-dark text-ink-soft'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete ? <Check size={13} /> : i + 1}
              </span>
              <span className={cn('hidden text-sm sm:inline', isCurrent ? 'font-medium text-ink' : 'text-ink-soft')}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn('flex-1 h-px mx-3', isComplete ? 'bg-fern' : 'bg-stone-dark')} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
    </>
  );
}
