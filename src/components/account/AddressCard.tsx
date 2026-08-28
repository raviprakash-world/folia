import { Pencil, Trash2, Check, Home, Building2, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/utils/cn';
import type { Address } from '@/types/address';

interface AddressCardProps {
  address: Address;
  onEdit?: () => void;
  onDelete?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

const typeIcon = { home: Home, office: Building2, other: MapPin } as const;

export function AddressCard({ address, onEdit, onDelete, selectable, selected, onSelect }: AddressCardProps) {
  const TypeIcon = typeIcon[address.type];

  return (
    <Card
      variant={selected ? 'raised' : 'flat'}
      className={cn(
        'p-4 relative transition-colors',
        selectable && 'cursor-pointer',
        selected && 'border-2 border-fern'
      )}
      onClick={selectable ? onSelect : undefined}
    >
      {selectable && (
        <span
          className={cn(
            'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center',
            selected ? 'border-fern bg-fern' : 'border-stone-dark'
          )}
          aria-hidden="true"
        >
          {selected && <Check size={12} className="text-stone-light" />}
        </span>
      )}

      <div className="flex items-center gap-2 mb-2">
        <TypeIcon size={14} className="text-fern" />
        <span className="text-sm font-medium text-ink">{address.label || address.fullName}</span>
        {address.isDefaultShipping && <Tag tone="pine">Default shipping</Tag>}
        {address.isDefaultBilling && <Tag tone="ochre">Default billing</Tag>}
      </div>

      <p className="text-sm text-ink-soft">{address.fullName}</p>
      {address.companyName && <p className="text-xs text-ink-soft/80">{address.companyName}</p>}
      <p className="text-sm text-ink-soft">
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ''}
      </p>
      {address.landmark && <p className="text-xs text-ink-soft/80">Near {address.landmark}</p>}
      <p className="text-sm text-ink-soft">
        {address.city}, {address.state} {address.postalCode}
      </p>
      <p className="font-mono text-xs text-ink-soft mt-1">{address.phone}</p>
      {address.deliveryInstructions && (
        <p className="text-xs text-ink-soft/80 mt-1 italic">"{address.deliveryInstructions}"</p>
      )}
      {address.preferredTimeSlot && address.preferredTimeSlot !== 'anytime' && (
        <p className="text-xs text-fern-dark mt-1 capitalize">Prefers {address.preferredTimeSlot} delivery</p>
      )}

      {(onEdit || onDelete) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-stone-dark">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-pine transition-colors"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-rust transition-colors"
            >
              <Trash2 size={12} />
              Remove
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
