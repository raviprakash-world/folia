import { AlertTriangle, Check, Droplets, PawPrint, Ruler, Sprout, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { isPlant } from '@/utils/plant';
import type { Product, ProductSpec } from '@/types/product';

const find = (specs: ProductSpec[], ...labels: string[]) =>
  specs.find((s) => labels.some((l) => s.label.toLowerCase() === l.toLowerCase()))?.value;

interface Highlight {
  key: string;
  Icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'good' | 'warn';
}

function petHighlight(value: string): Highlight {
  const v = value.toLowerCase();
  if (v.includes('toxic') || v.startsWith('no')) {
    return { key: 'pet', Icon: AlertTriangle, label: 'Pets', value: 'Toxic to pets', tone: 'warn' };
  }
  if (v.startsWith('yes') || v.includes('safe')) {
    return { key: 'pet', Icon: Check, label: 'Pets', value: 'Pet safe', tone: 'good' };
  }
  return { key: 'pet', Icon: PawPrint, label: 'Pets', value };
}

/** Light, water, pet safety, care level and size, straight from the product's own specs. Renders nothing unless it has at least two facts. */
export function PlantHighlights({ product }: { product: Pick<Product, 'specs' | 'careLevel' | 'categorySlug'> }) {
  if (!isPlant(product.categorySlug)) return null;
  const { specs } = product;
  const light = find(specs, 'Light');
  const water = find(specs, 'Water');
  const pet = find(specs, 'Pet safe');
  const height = find(specs, 'Mature height', 'Height');

  const items: Highlight[] = [];
  if (light) items.push({ key: 'light', Icon: Sun, label: 'Light', value: light });
  if (water) items.push({ key: 'water', Icon: Droplets, label: 'Water', value: water });
  if (product.careLevel) items.push({ key: 'care', Icon: Sprout, label: 'Difficulty', value: product.careLevel });
  if (pet) items.push(petHighlight(pet));
  if (height) items.push({ key: 'size', Icon: Ruler, label: 'Size', value: height });
  if (items.length < 2) return null;

  return (
    <section aria-labelledby="plant-highlights">
      <h2 id="plant-highlights" className="mb-3 font-display text-lg font-semibold text-heading">
        Plant at a glance
      </h2>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {items.map(({ key, Icon, label, value, tone }) => (
          <div
            key={key}
            className={cn(
              'flex items-start gap-3 rounded-[var(--radius-control)] border bg-stone-light p-3',
              tone === 'warn' ? 'border-rust/50' : 'border-stone-dark'
            )}
          >
            <Icon size={20} aria-hidden="true" className={cn('mt-0.5 shrink-0', tone === 'warn' ? 'text-rust-text' : 'text-fern')} />
            <div className="min-w-0">
              <dt className="text-xs text-ink-soft">{label}</dt>
              <dd className="text-[15px] font-medium leading-snug text-ink">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
