import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { ProductSpec } from '@/types/product';

interface ProductTabsProps {
  description: string;
  specs: ProductSpec[];
}

export function ProductTabs({ description, specs }: ProductTabsProps) {
  const [tab, setTab] = useState<'description' | 'specs'>('description');

  return (
    <div>
      <div role="tablist" className="flex gap-6 border-b border-stone-dark">
        {(['description', 'specs'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t ? 'border-pine text-pine' : 'border-transparent text-ink-soft hover:text-ink'
            )}
          >
            {t === 'specs' ? 'Specifications' : 'Description'}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {tab === 'description' && <p className="text-sm text-ink-soft leading-relaxed">{description}</p>}
        {tab === 'specs' && (
          <dl className="grid grid-cols-2 gap-y-3 gap-x-6 max-w-md">
            {specs.map((spec) => (
              <div key={spec.label} className="contents">
                <dt className="text-sm text-ink-soft">{spec.label}</dt>
                <dd className="text-sm text-ink font-medium">{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
