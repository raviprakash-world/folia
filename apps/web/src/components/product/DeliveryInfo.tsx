import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';

const rows = [
  { Icon: Truck, label: 'Ships in 1–2 business days', detail: 'Free shipping on orders over ₹75.' },
  { Icon: ShieldCheck, label: '30-day health guarantee', detail: 'Arrives unwell? We replace it.' },
  { Icon: RotateCcw, label: '14-day returns on vessels & tools', detail: 'Plants are final sale once delivered.' },
];

export function DeliveryInfo() {
  return (
    <div className="flex flex-col gap-3 border-t border-stone-dark pt-5">
      {rows.map(({ Icon, label, detail }) => (
        <div key={label} className="flex items-start gap-3">
          <Icon size={16} className="text-fern mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-ink">{label}</p>
            <p className="text-xs text-ink-soft">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
