import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
}

export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="border-t border-stone-dark">
      {items.map((item, i) => {
        const open = openIndex === i;
        const panelId = `accordion-panel-${i}`;
        return (
          <div key={item.question} className="border-b border-stone-dark">
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex items-center justify-between w-full py-4 text-left text-sm font-medium text-ink"
              >
                {item.question}
                <ChevronDown
                  size={16}
                  className={cn('text-ink-soft transition-transform shrink-0 ml-4', open && 'rotate-180')}
                />
              </button>
            </h3>
            <div id={panelId} role="region" hidden={!open} className="pb-4 text-sm text-ink-soft">
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
