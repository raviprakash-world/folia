import { Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { DeliveryOptionBase } from '@/data/deliveryMethods';

interface DeliveryOptionCardProps {
  option: DeliveryOptionBase & { cost: number };
  selected: boolean;
  onSelect: () => void;
}

export function DeliveryOptionCard({ option, selected, onSelect }: DeliveryOptionCardProps) {
  return (
    <Card
      variant={selected ? 'raised' : 'flat'}
      className={cn('p-4 cursor-pointer transition-colors', selected && 'border-2 border-fern')}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
              selected ? 'border-fern bg-fern' : 'border-stone-dark'
            )}
            aria-hidden="true"
          >
            {selected && <Check size={12} className="text-stone-light" />}
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{option.label}</p>
            <p className="text-xs text-ink-soft mt-0.5">{option.description}</p>
            <p className="text-xs text-fern-dark font-mono mt-1">{option.etaDays}</p>
          </div>
        </div>
        <span className="font-mono text-sm text-ink shrink-0">
          {option.cost === 0 ? 'Free' : formatCurrency(option.cost)}
        </span>
      </div>
    </Card>
  );
}
