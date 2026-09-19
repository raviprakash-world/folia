import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** What a shopper sees when something failed to load. Technical detail belongs in the console/logs, never here. */
export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this right now. Please check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center px-2 py-14 text-center sm:py-20">
      <h3 className="font-display text-2xl font-semibold text-heading">{title}</h3>
      <p className="mt-2 max-w-[40ch] text-[15px] leading-relaxed text-ink-soft">{description}</p>
      {onRetry && (
        <Button variant="primary" className="mt-6" icon={<RefreshCw size={16} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
