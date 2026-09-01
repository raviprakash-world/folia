// See users/user.types.ts's top-of-file comment for why these are hand-written.
export type AddressType = 'HOME' | 'OFFICE' | 'OTHER';
export type DeliveryTimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME';

export interface AddressRecord {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  companyName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  deliveryInstructions: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  type: AddressType;
  label: string | null;
  preferredTimeSlot: DeliveryTimeSlot | null;
  geoLat: number | null;
  geoLng: number | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

const typeToPublic: Record<AddressType, 'home' | 'office' | 'other'> = {
  HOME: 'home',
  OFFICE: 'office',
  OTHER: 'other',
};
const typeFromPublic: Record<'home' | 'office' | 'other', AddressType> = {
  home: 'HOME',
  office: 'OFFICE',
  other: 'OTHER',
};
const slotToPublic: Record<
  DeliveryTimeSlot,
  'morning' | 'afternoon' | 'evening' | 'anytime'
> = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  ANYTIME: 'anytime',
};
const slotFromPublic: Record<
  'morning' | 'afternoon' | 'evening' | 'anytime',
  DeliveryTimeSlot
> = {
  morning: 'MORNING',
  afternoon: 'AFTERNOON',
  evening: 'EVENING',
  anytime: 'ANYTIME',
};

/** Matches apps/web/src/types/address.ts's Address exactly. */
export function toPublicAddress(a: AddressRecord) {
  return {
    id: a.id,
    fullName: a.fullName,
    phone: a.phone,
    alternatePhone: a.alternatePhone ?? undefined,
    email: a.email ?? undefined,
    companyName: a.companyName ?? undefined,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2 ?? undefined,
    landmark: a.landmark ?? undefined,
    deliveryInstructions: a.deliveryInstructions ?? undefined,
    city: a.city,
    state: a.state,
    country: a.country,
    postalCode: a.postalCode,
    type: typeToPublic[a.type],
    label: a.label ?? undefined,
    preferredTimeSlot: a.preferredTimeSlot
      ? slotToPublic[a.preferredTimeSlot]
      : undefined,
    geo:
      a.geoLat !== null && a.geoLng !== null
        ? { lat: a.geoLat, lng: a.geoLng, source: 'mock' as const }
        : undefined,
    isDefaultShipping: a.isDefaultShipping,
    isDefaultBilling: a.isDefaultBilling,
  };
}

export function typeToDb(type: 'home' | 'office' | 'other'): AddressType {
  return typeFromPublic[type];
}

export function slotToDb(
  slot: 'morning' | 'afternoon' | 'evening' | 'anytime' | undefined,
): DeliveryTimeSlot | null {
  return slot ? slotFromPublic[slot] : null;
}
