export type AddressType = 'home' | 'office' | 'other';

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  email?: string;

  addressLine1: string;
  addressLine2?: string;
  landmark?: string;

  city: string;
  state: string;
  country: string;
  postalCode: string;

  type: AddressType;

  /** Extends the base spec — "Address nickname" was explicitly requested in the feature list. */
  label?: string;

  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export type AddressInput = Omit<Address, 'id'>;
