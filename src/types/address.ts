export type AddressType = 'home' | 'office' | 'other';

export type DeliveryTimeSlot = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface GeoPlaceholder {
  lat: number;
  lng: number;
  /** Always 'mock' — there is no real geolocation lookup behind this. */
  source: 'mock';
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  companyName?: string;

  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  deliveryInstructions?: string;

  city: string;
  state: string;
  country: string;
  postalCode: string;

  type: AddressType;
  label?: string;

  preferredTimeSlot?: DeliveryTimeSlot;
  geo?: GeoPlaceholder;

  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export type AddressInput = Omit<Address, 'id'>;
