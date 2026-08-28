import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  Icon: LucideIcon;
}

export function StatCard({ label, value, Icon }: StatCardProps) {
  return (
    <Card variant="flat" className="p-4">
      <Icon size={16} className="text-fern mb-2" aria-hidden="true" />
      <p className="font-display text-2xl font-semibold text-heading">{value}</p>
      <p className="text-xs text-ink-soft mt-0.5">{label}</p>
    </Card>
  );
}
