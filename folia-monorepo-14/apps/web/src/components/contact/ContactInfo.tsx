import { Mail, Phone, MapPin, Clock } from 'lucide-react';

const cards = [
  { Icon: Mail, label: 'Email', value: 'hello@folia.example' },
  { Icon: Phone, label: 'Phone', value: '(555) 019-2043' },
  { Icon: MapPin, label: 'Studio', value: '412 Alder Street, Portland, OR' },
];

const hours = [
  { day: 'Monday – Friday', time: '9am – 6pm PT' },
  { day: 'Saturday', time: '10am – 4pm PT' },
  { day: 'Sunday', time: 'Closed' },
];

export function ContactInfo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4">
        {cards.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3 p-4 rounded-[var(--radius-card)] bg-stone-light border border-stone-dark">
            <Icon size={18} className="text-fern shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-ink-soft">{label}</p>
              <p className="text-sm text-ink font-medium">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-fern" />
          <h3 className="text-sm font-medium text-ink">Business hours</h3>
        </div>
        <dl className="flex flex-col gap-1.5 text-sm">
          {hours.map((h) => (
            <div key={h.day} className="flex justify-between">
              <dt className="text-ink-soft">{h.day}</dt>
              <dd className="text-ink font-mono">{h.time}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="aspect-[4/3] rounded-[var(--radius-card)] bg-stone-dark flex flex-col items-center justify-center gap-2 text-ink-soft">
        <MapPin size={24} />
        <p className="font-mono text-xs uppercase tracking-wider">Map placeholder — Portland, OR</p>
      </div>
    </div>
  );
}
